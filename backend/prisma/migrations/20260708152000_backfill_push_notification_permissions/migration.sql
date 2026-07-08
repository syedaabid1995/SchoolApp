WITH push_permissions(code, description) AS (
  VALUES
    ('communication.push.send', 'Send push notifications'),
    ('communication.push_log.view', 'View push notification logs'),
    ('communication.push_template.view', 'View push notification templates'),
    ('communication.push_template.create', 'Create push notification templates'),
    ('communication.push_template.edit', 'Edit push notification templates'),
    ('communication.push_template.delete', 'Delete push notification templates')
)
INSERT INTO permissions (id, code, description, created_at, updated_at)
SELECT gen_random_uuid(), code, description, now(), now()
FROM push_permissions
ON CONFLICT (code) DO UPDATE
SET description = EXCLUDED.description,
    updated_at = now();

WITH push_permissions(code) AS (
  VALUES
    ('communication.push.send'),
    ('communication.push_log.view'),
    ('communication.push_template.view'),
    ('communication.push_template.create'),
    ('communication.push_template.edit'),
    ('communication.push_template.delete')
)
INSERT INTO subscription_plan_permissions (id, plan_id, permission_code, enabled, created_at, updated_at)
SELECT gen_random_uuid(), plans.id, push_permissions.code, true, now(), now()
FROM subscription_plans plans
CROSS JOIN push_permissions
ON CONFLICT (plan_id, permission_code) DO UPDATE
SET enabled = true,
    updated_at = now();

WITH push_permissions(code) AS (
  VALUES
    ('communication.push.send'),
    ('communication.push_log.view'),
    ('communication.push_template.view'),
    ('communication.push_template.create'),
    ('communication.push_template.edit'),
    ('communication.push_template.delete')
)
INSERT INTO employee_role_permissions (id, school_id, role_name, permission_code, enabled, created_at, updated_at)
SELECT gen_random_uuid(), schools.id, 'SCHOOL_ADMIN'::"RoleName", push_permissions.code, true, now(), now()
FROM schools
CROSS JOIN push_permissions
ON CONFLICT (school_id, role_name, permission_code) DO UPDATE
SET enabled = true,
    updated_at = now();
