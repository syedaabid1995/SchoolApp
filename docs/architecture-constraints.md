# Architecture Constraints (Master Guardrail)

This system is a multi-school (tenant-isolated) School SaaS.

## Non-Negotiable Constraints

1. Do NOT change existing architecture, routes, or core domain boundaries.
2. Do NOT refactor already implemented core modules (auth, users/roles, schools, subscriptions, messaging, cache, and academic masters if present).
3. For modules not yet implemented (attendance/leave/payroll), only additive design is allowed:
   - keep additive changes
   - do not break current routes/contracts
   - follow tenant isolation and role guard patterns
4. All features must be additive and backward-compatible.
5. Tenant isolation by `schoolId` is mandatory at all layers.

## Mandatory Output for Any New Feature/API

- Migration plan + rollback plan (if DB changes exist)
- Permission matrix impact (role × action)
- Cache impact + audit log impact
- Test checklist (API, role access, tenant isolation)

If any requirement conflicts with existing architecture, adapt the feature.
Do NOT redesign the system.
