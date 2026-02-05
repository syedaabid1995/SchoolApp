# V07 Architecture Constraints - Implementation

## Canonical Source
- `docs/architecture-constraints.md`

## Purpose
Ensure every future module follows additive design, tenant isolation, and compatibility guarantees.

## Implementation Status
- Constraints document created and available.
- Prompt references available in:
  - `documents/attendance/v1_and_v2_prompts/prompts.txt`
  - `documents/attendance/v1_and_v2_prompts/prompt-v01-master-guarantee.md`

## Operational Usage
Before any feature build:
1. Read `docs/architecture-constraints.md`
2. Include mandatory sections in output:
   - migration + rollback
   - permission impact
   - cache + audit impact
   - test checklist
3. Apply this governance review to backend, frontend, migrations, scripts, and operational tooling.

## Recommended Enforcement (next step)
- Add PR template checks for mandatory sections.
- Add architecture review checkbox in code review.
- Reject features that break tenant isolation or existing API contracts.
- Any approved exception must be recorded in the repository with rationale and expiry (if temporary).
- Long-term goal: automate detection of missing mandatory sections in CI.
