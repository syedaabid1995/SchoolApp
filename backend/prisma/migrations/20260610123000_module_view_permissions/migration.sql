-- Add page-level permissions for modules that previously borrowed students.list.
INSERT INTO subscription_plan_permissions (id, plan_id, permission_code, enabled, created_at, updated_at)
SELECT gen_random_uuid(), id, code, true, NOW(), NOW()
FROM subscription_plans
CROSS JOIN (VALUES
  ('homework.view'),
  ('library.view'),
  ('transport.view'),
  ('dormitory.view')
) AS permissions(code)
ON CONFLICT (plan_id, permission_code) DO NOTHING;
