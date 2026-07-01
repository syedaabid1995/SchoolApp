DROP INDEX IF EXISTS "demo_requests_selected_plan_id_idx";

ALTER TABLE "demo_requests" DROP CONSTRAINT IF EXISTS "demo_requests_selected_plan_id_fkey";

ALTER TABLE "demo_requests"
  DROP COLUMN IF EXISTS "role",
  DROP COLUMN IF EXISTS "preferred_date",
  DROP COLUMN IF EXISTS "selected_plan_id",
  DROP COLUMN IF EXISTS "selected_plan_name";
