-- ============================================================================
-- Migration: Add Support for Nested Groups and Bundles
-- ============================================================================
-- This migration enables:
-- 1. Distinguishing between "groups" and "bundles" in item_groups
-- 2. Groups containing other groups (nested groups)
-- 3. Groups containing both items and other groups
-- 4. Prevention of circular references
-- ============================================================================

-- Step 1: Create enum for group types
CREATE TYPE group_type AS ENUM ('group', 'bundle');

-- Step 2: Add group_type column to item_groups (default to 'group' for existing records)
ALTER TABLE item_groups
  ADD COLUMN IF NOT EXISTS group_type group_type NOT NULL DEFAULT 'group';

-- Step 3: Modify group_items to support both items and nested groups
-- First, we need to change the primary key since item_id will become nullable
-- Drop the existing composite primary key
ALTER TABLE group_items
  DROP CONSTRAINT IF EXISTS group_items_pkey;

-- Add an id column as the new primary key
ALTER TABLE group_items
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

-- Set id for existing rows (in case any don't have one)
UPDATE group_items
SET id = gen_random_uuid()
WHERE id IS NULL;

-- Make id NOT NULL and set as primary key
ALTER TABLE group_items
  ALTER COLUMN id SET NOT NULL;

ALTER TABLE group_items
  ADD CONSTRAINT group_items_pkey PRIMARY KEY (id);

-- Add the new column for child groups
ALTER TABLE group_items
  ADD COLUMN IF NOT EXISTS child_group_id uuid;

-- Add foreign key for child_group_id
ALTER TABLE group_items
  ADD CONSTRAINT group_items_child_group_id_fkey
    FOREIGN KEY (child_group_id)
    REFERENCES item_groups(id)
    ON DELETE CASCADE;

-- Step 4: Make item_id nullable (since we can now have groups instead)
ALTER TABLE group_items
  ALTER COLUMN item_id DROP NOT NULL;

-- Step 4b: Add unique constraints to prevent duplicate entries
-- Unique constraint for items (when item_id is not null)
CREATE UNIQUE INDEX IF NOT EXISTS group_items_unique_item 
  ON group_items (group_id, item_id) 
  WHERE item_id IS NOT NULL;

-- Unique constraint for nested groups (when child_group_id is not null)
CREATE UNIQUE INDEX IF NOT EXISTS group_items_unique_group 
  ON group_items (group_id, child_group_id) 
  WHERE child_group_id IS NOT NULL;

-- Step 5: Add constraint to ensure exactly one of item_id or child_group_id is set
ALTER TABLE group_items
  ADD CONSTRAINT group_items_item_or_group_check
    CHECK (
      (item_id IS NOT NULL AND child_group_id IS NULL) OR
      (item_id IS NULL AND child_group_id IS NOT NULL)
    );

-- Step 6: Add constraint to prevent direct self-reference (group cannot contain itself)
ALTER TABLE group_items
  ADD CONSTRAINT group_items_no_self_reference_check
    CHECK (group_id != child_group_id);

-- Step 7: Create function to detect circular references (indirect)
-- This function checks if adding a group would create a cycle
CREATE OR REPLACE FUNCTION check_circular_group_reference(
  p_parent_group_id uuid,
  p_child_group_id uuid
) RETURNS boolean AS $$
DECLARE
  v_current_id uuid;
  v_visited_ids uuid[] := ARRAY[p_parent_group_id];
BEGIN
  -- If trying to add a group to itself, it's circular
  IF p_parent_group_id = p_child_group_id THEN
    RETURN false;
  END IF;

  -- Start from the child group and traverse up the hierarchy
  v_current_id := p_child_group_id;

  -- Traverse up the parent chain
  WHILE v_current_id IS NOT NULL LOOP
    -- Check if we've seen this group before (cycle detected)
    IF v_current_id = ANY(v_visited_ids) THEN
      RETURN false; -- Circular reference detected
    END IF;

    -- Add current group to visited set
    v_visited_ids := array_append(v_visited_ids, v_current_id);

    -- Find parent groups that contain this group
    SELECT group_id INTO v_current_id
    FROM group_items
    WHERE child_group_id = v_current_id
    LIMIT 1;

    -- If we reach the parent we're trying to add, it's circular
    IF v_current_id = p_parent_group_id THEN
      RETURN false; -- Circular reference detected
    END IF;
  END LOOP;

  -- No cycle detected
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Create trigger function to prevent circular references on INSERT/UPDATE
CREATE OR REPLACE FUNCTION prevent_circular_group_reference()
RETURNS TRIGGER AS $$
BEGIN
  -- Only check if we're adding a child group (not an item)
  IF NEW.child_group_id IS NOT NULL THEN
    IF NOT check_circular_group_reference(NEW.group_id, NEW.child_group_id) THEN
      RAISE EXCEPTION 'Circular reference detected: Group % cannot contain group % as it would create a cycle', 
        NEW.group_id, NEW.child_group_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 9: Create trigger to enforce circular reference prevention
DROP TRIGGER IF EXISTS group_items_prevent_circular_reference ON group_items;
CREATE TRIGGER group_items_prevent_circular_reference
  BEFORE INSERT OR UPDATE ON group_items
  FOR EACH ROW
  WHEN (NEW.child_group_id IS NOT NULL)
  EXECUTE FUNCTION prevent_circular_group_reference();

-- Step 10: Update group_on_hand view to handle nested groups
-- This view calculates on_hand for groups, including nested groups
-- Uses recursive CTE to flatten nested group hierarchies
DROP VIEW IF EXISTS group_on_hand;
CREATE VIEW group_on_hand AS
WITH RECURSIVE group_hierarchy AS (
  -- Base case: direct items in groups (leaf nodes)
  SELECT 
    gi.group_id,
    gi.quantity,
    i.total_quantity,
    1 as depth,
    gi.item_id,
    NULL::uuid as child_group_id
  FROM group_items gi
  JOIN items i ON i.id = gi.item_id
  WHERE gi.item_id IS NOT NULL

  UNION ALL

  -- Recursive case: nested groups - expand child groups to their items
  SELECT 
    gi.group_id,
    gi.quantity * gh.quantity as quantity, -- Multiply quantities through hierarchy
    gh.total_quantity,
    gh.depth + 1,
    gh.item_id,
    gi.child_group_id
  FROM group_items gi
  JOIN group_hierarchy gh ON gh.group_id = gi.child_group_id
  WHERE gi.child_group_id IS NOT NULL
    AND gh.depth < 10 -- Prevent infinite recursion (max 10 levels deep)
),
per_part AS (
  SELECT 
    group_id,
    FLOOR((total_quantity::numeric / NULLIF(quantity, 0)::numeric))::integer AS possible_sets
  FROM group_hierarchy
  WHERE total_quantity IS NOT NULL
)
SELECT 
  group_id,
  COALESCE(MIN(possible_sets), 0) AS on_hand
FROM per_part
GROUP BY group_id;

-- Step 11: Update group_parts view to show both items and nested groups
-- Drop the existing view first to avoid column name conflicts
DROP VIEW IF EXISTS group_parts;
CREATE VIEW group_parts AS
SELECT 
  gi.group_id,
  gi.item_id,
  gi.child_group_id,
  CASE 
    WHEN gi.item_id IS NOT NULL THEN i.name
    WHEN gi.child_group_id IS NOT NULL THEN ig.name
  END AS item_name,
  gi.quantity,
  CASE 
    WHEN gi.item_id IS NOT NULL THEN icp.current_price
    WHEN gi.child_group_id IS NOT NULL THEN gcp.current_price
  END AS item_current_price,
  CASE 
    WHEN gi.item_id IS NOT NULL THEN 'item'::text
    WHEN gi.child_group_id IS NOT NULL THEN 'group'::text
  END AS part_type
FROM group_items gi
LEFT JOIN items i ON i.id = gi.item_id
LEFT JOIN item_groups ig ON ig.id = gi.child_group_id
LEFT JOIN item_current_price icp ON icp.item_id = gi.item_id
LEFT JOIN group_current_price gcp ON gcp.group_id = gi.child_group_id;

-- Step 12: Update groups_with_rollups view to handle nested groups
-- This is more complex as we need to recursively calculate values
-- Drop dependent views first
DROP VIEW IF EXISTS inventory_index CASCADE;
DROP VIEW IF EXISTS groups_with_rollups CASCADE;
CREATE VIEW groups_with_rollups AS
WITH RECURSIVE group_hierarchy AS (
  -- Base case: direct items in groups (leaf nodes)
  SELECT 
    gi.group_id,
    gi.quantity,
    i.total_quantity,
    COALESCE(icp.current_price, 0::numeric) * gi.quantity::numeric AS parts_value,
    1 as depth,
    gi.item_id,
    NULL::uuid as child_group_id
  FROM group_items gi
  JOIN items i ON i.id = gi.item_id
  LEFT JOIN item_current_price icp ON icp.item_id = gi.item_id
  WHERE gi.item_id IS NOT NULL

  UNION ALL

  -- Recursive case: nested groups - expand child groups to their items
  SELECT 
    gi.group_id,
    gi.quantity * gh.quantity as quantity, -- Multiply quantities through hierarchy
    gh.total_quantity,
    gh.parts_value * gi.quantity::numeric AS parts_value, -- Multiply parts value by parent quantity
    gh.depth + 1,
    gh.item_id,
    gi.child_group_id
  FROM group_items gi
  JOIN group_hierarchy gh ON gh.group_id = gi.child_group_id
  WHERE gi.child_group_id IS NOT NULL
    AND gh.depth < 10 -- Prevent infinite recursion
),
agg AS (
  SELECT 
    p.group_id,
    COALESCE(MIN(FLOOR((COALESCE(p.total_quantity, 0)::numeric / NULLIF(p.quantity, 0)::numeric)))::integer, 0) AS on_hand,
    SUM(p.parts_value) AS parts_value
  FROM group_hierarchy p
  GROUP BY p.group_id
)
SELECT 
  g.id,
  g.company_id,
  g.name,
  COALESCE(a.on_hand, 0) AS on_hand,
  COALESCE(gcp.current_price, a.parts_value) AS current_price,
  'NOK'::text AS currency
FROM item_groups g
LEFT JOIN agg a ON a.group_id = g.id
LEFT JOIN group_current_price gcp ON gcp.group_id = g.id;

-- Step 13: Recreate inventory_index view (it depends on groups_with_rollups)
-- Match the structure from the RLS migration
CREATE VIEW inventory_index WITH (security_invoker='on') AS
SELECT 
  i.company_id,
  i.id,
  i.name,
  ic.name AS category_name,
  ib.name AS brand_name,
  i.model,
  i.total_quantity AS on_hand,
  icp.current_price,
  'NOK'::text AS currency,
  false AS is_group,
  NULL::boolean AS "unique",
  i.allow_individual_booking,
  i.active,
  i.deleted,
  i.internally_owned,
  i.external_owner_id,
  co.name AS external_owner_name
FROM items i
LEFT JOIN item_categories ic ON ic.id = i.category_id
LEFT JOIN item_brands ib ON ib.id = i.brand_id
LEFT JOIN item_current_price icp ON icp.item_id = i.id
LEFT JOIN customers co ON co.id = i.external_owner_id

UNION ALL

SELECT 
  g.company_id,
  g.id,
  g.name,
  ic2.name AS category_name,
  NULL::text AS brand_name,
  NULL::text AS model,
  gr.on_hand,
  gcp.current_price,
  'NOK'::text AS currency,
  true AS is_group,
  g."unique",
  true AS allow_individual_booking,
  g.active,
  g.deleted,
  g.internally_owned,
  g.external_owner_id,
  co2.name AS external_owner_name
FROM item_groups g
LEFT JOIN item_categories ic2 ON ic2.id = g.category_id
LEFT JOIN groups_with_rollups gr ON gr.id = g.id
LEFT JOIN group_current_price gcp ON gcp.group_id = g.id
LEFT JOIN customers co2 ON co2.id = g.external_owner_id;

-- Step 14: Add comment to document the changes
COMMENT ON COLUMN item_groups.group_type IS 'Type of group: "group" for regular groups, "bundle" for bundles';
COMMENT ON COLUMN group_items.child_group_id IS 'Reference to a nested group. Exactly one of item_id or child_group_id must be set.';
COMMENT ON CONSTRAINT group_items_item_or_group_check ON group_items IS 'Ensures exactly one of item_id or child_group_id is set';
COMMENT ON CONSTRAINT group_items_no_self_reference_check ON group_items IS 'Prevents a group from directly containing itself';

