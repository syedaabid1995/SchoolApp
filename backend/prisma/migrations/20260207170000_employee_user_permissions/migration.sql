-- Add per-user permission overrides (school scoped)
CREATE TABLE "employee_user_permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "school_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "permission_code" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_user_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employee_user_permissions_school_id_user_id_permission_code_key"
    ON "employee_user_permissions"("school_id", "user_id", "permission_code");

CREATE INDEX "employee_user_permissions_school_id_user_id_idx"
    ON "employee_user_permissions"("school_id", "user_id");

ALTER TABLE "employee_user_permissions"
ADD CONSTRAINT "employee_user_permissions_school_id_fkey"
FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employee_user_permissions"
ADD CONSTRAINT "employee_user_permissions_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
