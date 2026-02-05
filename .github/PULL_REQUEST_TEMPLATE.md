# Pull Request

## Summary
<!-- Brief description of what this PR does -->

---

## Scope Declaration
**In Scope**
- 

**Out of Scope**
- 

---

## Architecture Compliance (MANDATORY)

### 1. Additive Change Confirmation
- [ ] This change is **additive only**
- [ ] No existing routes, APIs, or entities are modified or removed

### 2. Tenant Isolation
- [ ] All queries and mutations are scoped by `schoolId`
- [ ] No cross-school data access is possible

### 3. Backward Compatibility
- [ ] No existing API contracts are broken
- [ ] If behavior changes, migration notice is included

---

## Migration + Rollback (MANDATORY)

**Does this PR introduce DB or schema changes?**
- [ ] Yes
- [ ] No

If **Yes**, provide details:

### Migration Plan
- 

### Rollback Plan
- 

**Rollback Owner**
- Name:

---

## Permission Matrix Impact (MANDATORY)

| Role | New/Changed Actions |
|-----|---------------------|
| SUPER_ADMIN | |
| SCHOOL_ADMIN | |
| TEACHER | |
| STUDENT | |
| PARENT | |

---

## Cache Impact (MANDATORY)
- [ ] No cache impact
- [ ] Cache keys affected:
  - 
- [ ] Invalidation strategy described

---

## Audit Impact (MANDATORY)
- [ ] No audit changes
- [ ] New audit events introduced:
  - 
- [ ] Actor, schoolId, before/after states captured

---

## Test Checklist (MANDATORY)

### API
- [ ] CRUD flows tested
- [ ] Error handling tested

### Role & Permission
- [ ] Unauthorized access blocked
- [ ] Assigned-only access enforced

### Tenant Isolation
- [ ] Cross-school access tested and blocked

### Cache
- [ ] Cache hit/miss behavior validated

---

## Feature Flags
- [ ] Not required
- [ ] Added:
  - 

---

## Governance Confirmation

- [ ] I have read `docs/architecture-constraints.md`
- [ ] This PR complies with **V01 Master Guarantee**
- [ ] This PR complies with **V07 Architecture Constraints**

---

## Reviewer Notes
<!-- Anything reviewers should pay special attention to -->
