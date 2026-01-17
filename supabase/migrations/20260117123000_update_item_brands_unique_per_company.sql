BEGIN;

ALTER TABLE "public"."item_brands"
  DROP CONSTRAINT IF EXISTS "item_brands_name_key";

DROP INDEX IF EXISTS "public"."item_brands_company_id_name_key";

CREATE UNIQUE INDEX IF NOT EXISTS "item_brands_company_id_name_key"
  ON "public"."item_brands" ("company_id", "name");

COMMIT;
