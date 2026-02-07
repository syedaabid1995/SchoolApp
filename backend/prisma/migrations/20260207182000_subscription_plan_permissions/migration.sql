CREATE TABLE "subscription_plan_permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "plan_id" UUID NOT NULL,
    "permission_code" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plan_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscription_plan_permissions_plan_id_permission_code_key"
    ON "subscription_plan_permissions"("plan_id", "permission_code");

CREATE INDEX "subscription_plan_permissions_plan_id_idx"
    ON "subscription_plan_permissions"("plan_id");

ALTER TABLE "subscription_plan_permissions"
ADD CONSTRAINT "subscription_plan_permissions_plan_id_fkey"
FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
