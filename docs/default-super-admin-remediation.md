# Default Super-Admin Remediation

`backend/prisma/migrations/20260207180000_seed_super_admin/migration.sql` creates a real global super-admin account. Creating users or credentials inside migrations is unsafe because migrations are long-lived deployment history, are often replayed into new environments, and can leave default credentials active after the intended bootstrap window.

Do not edit, delete, squash, or rewrite the existing migration. Some databases may already have applied it, and changing applied migration history risks drift between environments.

## Safe Remediation

Use the maintenance script in dry-run mode first:

```sh
npm --prefix backend run maintenance:default-super-admin -- --email=techstageit@admin.com
```

The script identifies only a global user with the requested email and the `SUPER_ADMIN` role. It does not print passwords or password hashes.

To disable the default account in a reviewed local, QA, or maintenance environment:

```sh
npm --prefix backend run maintenance:default-super-admin -- --apply --mode=disable --email=techstageit@admin.com
```

`--mode=disable` sets `status=INACTIVE` and `mustChangePassword=true`. If operations need to keep the account active briefly while forcing credential rotation, use:

```sh
npm --prefix backend run maintenance:default-super-admin -- --apply --mode=force-reset --email=techstageit@admin.com
```

Do not run mutation mode against production casually. If it must be run during a production maintenance window, require an operator review and set `ALLOW_PRODUCTION_SUPER_ADMIN_REMEDIATION=true` only for that command.

## Future Provisioning

Future first-admin provisioning should be outside Prisma migrations. Prefer a one-time bootstrap flow or reviewed maintenance command that accepts operator-supplied identity details, generates no committed credentials, requires password change or invitation acceptance, and records an audit event.

Seed scripts are for disposable local or QA data. They now refuse `NODE_ENV=production` unless `ALLOW_PRODUCTION_SEED=true` is explicitly set, and their console output avoids printing default passwords.
