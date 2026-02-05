# V01 Master Guarantee - Implementation

## Objective
Operationalize the master guardrail so every future feature stays additive, tenant-safe, and backward-compatible.

This guarantee applies to all code paths, migrations, scripts, and operational tooling.


## What is already done
- Prompt source: `documents/attendance/v1_and_v2_prompts/prompt-v01-master-guarantee.md`
- Constraints doc: `docs/architecture-constraints.md`
- Attendance phase gates: `documents/attendance/phase-gates.md`

## Enforcement Steps
1. Pre-read required before implementation:
   - `docs/architecture-constraints.md`
2. Every feature spec must include:
   - migration + rollback
   - permission matrix impact
   - cache + audit impact
   - test checklist
3. Every feature proposal must explicitly declare:
   - in-scope components
   - out-of-scope components
4. PR template/checklist should include these mandatory blocks (recommended next step).

## Go/No-Go Rule
- **No-Go** if any feature proposal does not include all mandatory output requirements.
- Rollback owner must be named for any DB-affecting change.

## Backward Compatibility Rule
- New APIs/routes/entities must be additive.
- Existing contracts cannot be broken unless explicit migration notice is approved.

## Change Classification
- Additive: allowed by default.
- Behavior-altering: requires migration notice + approval.
- Destructive: forbidden.

## Tenant Safety Rule
- `schoolId` scoping is mandatory on queries/mutations for tenant data.

## Audit Surface Rule
- Any write operation affecting tenant data must emit an audit event.
- Audit schema changes require explicit approval.

## Exception Handling
- Violation of any rule requires either rollback or explicit exception approval recorded in the repository.
