-- Seed default super admin (idempotent)
INSERT INTO "roles" ("id", "name", "created_at", "updated_at")
VALUES (gen_random_uuid(), 'SUPER_ADMIN', NOW(), NOW())
ON CONFLICT ("name") DO NOTHING;

WITH inserted_user AS (
  INSERT INTO "users" (
    "id",
    "school_id",
    "email",
    "password_hash",
    "must_change_password",
    "status",
    "created_at",
    "updated_at"
  )
  SELECT
    gen_random_uuid(),
    NULL,
    'techstageit@admin.com',
    '$2a$12$cX7C5XfrrhHq2m1dMOP9yumYOQDl33aFbRXcHiojAaluBC7jQsk..',
    false,
    'ACTIVE',
    NOW(),
    NOW()
  WHERE NOT EXISTS (
    SELECT 1 FROM "users" WHERE "email" = 'techstageit@admin.com' AND "school_id" IS NULL
  )
  RETURNING "id"
)
INSERT INTO "user_roles" ("user_id", "role_id", "created_at")
SELECT
  COALESCE((SELECT "id" FROM inserted_user), (SELECT "id" FROM "users" WHERE "email" = 'techstageit@admin.com' AND "school_id" IS NULL)),
  (SELECT "id" FROM "roles" WHERE "name" = 'SUPER_ADMIN'),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "user_roles"
  WHERE "user_id" = (SELECT "id" FROM "users" WHERE "email" = 'techstageit@admin.com' AND "school_id" IS NULL)
    AND "role_id" = (SELECT "id" FROM "roles" WHERE "name" = 'SUPER_ADMIN')
);
