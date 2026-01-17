-- Secure unrestricted views by enforcing SECURITY INVOKER
-- so RLS policies apply based on the querying user.

-- company_user_profiles
CREATE OR REPLACE VIEW "public"."company_user_profiles" WITH ("security_invoker"='on') AS
SELECT 
  cu.company_id,
  cu.user_id,
  cu.role,
  cu.rate_type,
  cu.rate,
  cu.rate_updated_at,
  p.email,
  p.display_name,
  p.first_name,
  p.last_name,
  p.phone,
  p.avatar_url,
  p.created_at
FROM "public"."company_users" cu
JOIN "public"."profiles" p ON p.user_id = cu.user_id;

ALTER VIEW "public"."company_user_profiles" OWNER TO "postgres";

-- groups_with_rollups
CREATE OR REPLACE VIEW "public"."groups_with_rollups" WITH ("security_invoker"='on') AS
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
  FROM "public"."group_items" gi
  JOIN "public"."items" i ON i.id = gi.item_id
  LEFT JOIN "public"."item_current_price" icp ON icp.item_id = gi.item_id
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
  FROM "public"."group_items" gi
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
FROM "public"."item_groups" g
LEFT JOIN agg a ON a.group_id = g.id
LEFT JOIN "public"."group_current_price" gcp ON gcp.group_id = g.id;

ALTER VIEW "public"."groups_with_rollups" OWNER TO "postgres";
