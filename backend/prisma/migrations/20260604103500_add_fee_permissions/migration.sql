INSERT INTO "permissions" ("id", "code", "description", "created_at", "updated_at")
SELECT gen_random_uuid(), code, description, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  VALUES
    ('fees.view', 'View fee management'),
    ('fees.create', 'Create fee setup, assignments, and invoices'),
    ('fees.edit', 'Edit fee setup and invoices'),
    ('fees.delete', 'Delete fee setup records'),
    ('fees.collect', 'Collect fee payments'),
    ('fees.report', 'View fee reports')
) AS fee_permissions(code, description)
ON CONFLICT ("code") DO UPDATE
SET "description" = EXCLUDED."description",
    "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "subscription_plan_permissions" ("id", "plan_id", "permission_code", "enabled", "created_at", "updated_at")
SELECT gen_random_uuid(), plan."id", fee_permissions.code, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "subscription_plans" plan
CROSS JOIN (
  VALUES
    ('fees.view'),
    ('fees.create'),
    ('fees.edit'),
    ('fees.delete'),
    ('fees.collect'),
    ('fees.report')
) AS fee_permissions(code)
ON CONFLICT ("plan_id", "permission_code") DO UPDATE
SET "enabled" = true,
    "updated_at" = CURRENT_TIMESTAMP;
