# Sensitive Field Encryption Plan

This document is the Day 1 planning baseline for adding backward-compatible encryption for high-risk fields only. The goal is to make selected database values unreadable at rest while keeping the public API shape unchanged for the admin portal and mobile apps.

## Rollout Flags

Use these backend environment variables:

```dotenv
SENSITIVE_FIELD_ENCRYPTION_ENABLED=false
SENSITIVE_FIELD_ENCRYPTION_KEY=<strong-random-secret-at-least-32-chars>
```

- `SENSITIVE_FIELD_ENCRYPTION_ENABLED=false`: new writes remain plaintext, but reads must still support decrypting already encrypted values.
- `SENSITIVE_FIELD_ENCRYPTION_ENABLED=true`: selected high-risk fields are encrypted before storage.
- `SENSITIVE_FIELD_ENCRYPTION_KEY`: dedicated key material for this feature. Do not reuse `JWT_SECRET` or `TOTP_ENCRYPTION_KEY`.

## Day 2A Utility Layer

Implemented in `backend/src/utils/sensitiveFieldCrypto.ts`.

- `encryptSensitiveField(value, options)`
- `decryptSensitiveField(value, options)`
- `isEncryptedSensitiveField(value)`
- `maybeEncryptSensitiveField(value, options)`
- `maybeDecryptSensitiveField(value, options)`
- `normalizeSensitiveLookupValue(value)`
- `hashSensitiveLookupValue(value, options)`
- `isSensitiveLookupHash(value)`

This layer is intentionally not wired into Prisma model reads/writes yet. It is a reusable foundation for the next phase and keeps current app behavior unchanged.

## Day 2B Student Low-Risk Fields

Implemented in `backend/src/modules/students/utils/student-sensitive-fields.ts`.

Encrypted on new writes when `SENSITIVE_FIELD_ENCRYPTION_ENABLED=true`:

- `Student.presentAddress`
- `Student.permanentAddress`
- `Student.addressLine1`
- `Student.addressLine2`
- `Student.city`
- `Student.state`
- `Student.pincode`
- `Student.bloodGroup`
- `Student.medicalConditions`
- `Student.allergies`
- `Student.docBirthCert`
- `Student.docTransferCert`
- `Student.docReportCard`

Covered write paths:

- Student create/update
- Student bulk import through `/students/import`
- Student transfer document-ref rewrite path

Covered read/response paths:

- Student list/detail responses
- Student create/update/status responses
- Disabled-student list/disable/restore responses
- Parent portal child detail and admission document file resolution
- Student report workbook
- Student admission account email
- Tenant data export

## Day 2C Legacy File References

Implemented in `backend/src/services/legacyFileReferences.service.ts` and the legacy upload audit/migration scripts.

- Student legacy file-reference rows are decrypted before classification, so encrypted `docBirthCert`, `docTransferCert`, and `docReportCard` values can still be audited.
- The audit and migration scripts use a broader student scan when encrypted student fields may hide `/uploads/` patterns from the database filter.
- Migrated scalar student document refs are written back through the student sensitive-field mapper, so future `local://` or `s3://` refs remain encrypted when the feature flag is enabled.
- The raw stored DB value is still used in the migration `where` clause to avoid overwriting a concurrent update.

## Day 3A Student Aadhaar Document Lookup

Implemented for `Student.docAadhaar`.

- Added nullable `Student.docAadhaarHash` mapped to `students.doc_aadhaar_hash`.
- Added an index on `(school_id, doc_aadhaar_hash)` for future exact-match lookup.
- `docAadhaar` now uses the same encrypt/decrypt mapper as the other student document refs.
- When `docAadhaar` is present on create/update/import/transfer writes, the mapper maintains `docAadhaarHash`.
- If the encryption flag is disabled and no key is configured, `docAadhaar` remains plaintext and `docAadhaarHash` is set to `null` rather than blocking rollback writes.
- No API response shape changes: read paths still return `docAadhaar` as the original plaintext value.

## Day 3B-1 Student Contact Hash Foundation

Implemented as hash-only preparation for future student contact encryption.

- Added nullable hash columns for `Student.email`, `Student.phone`, `Student.fatherPhone`, `Student.motherPhone`, `Student.parentPhone`, `Student.parentEmail`, `Student.emergencyContact`, and `Student.doctorContact`.
- Added per-school indexes for each new contact hash column.
- The shared student mapper now maintains contact hashes on create/update/import writes while leaving the original contact values plaintext.
- The older generic bulk import service now uses the same student sensitive-field mapper for student rows.
- Partial text search remains on plaintext contact fields for now; exact-match hash lookup can be wired where needed before the later encryption phase.
- No API response shape changes.

## Day 3B-2B Low-Risk Student Contact Encryption

Implemented for the first safe contact slice only.

- `Student.emergencyContact` and `Student.doctorContact` are now encrypted on new writes when `SENSITIVE_FIELD_ENCRYPTION_ENABLED=true`.
- Their existing hash columns continue to be maintained for future exact-match lookup.
- Backward compatibility remains: old plaintext values decrypt as-is, and API/report/email response shapes are unchanged.
- Student `phone`, `parentPhone`, `fatherPhone`, `motherPhone`, `email`, and `parentEmail` remain plaintext for now because they are used in partial search, messaging, fees, parent linking, and support workflows.

## Day 3B-3A Exact-Match Contact Lookup Helpers

Implemented helper predicates for future exact-match contact lookups.

- Added `studentContactHashWhere(schoolId, field, value)` for one exact searchable contact field.
- Added `studentAnyContactHashWhere(schoolId, value)` for matching across student `email`, `phone`, `fatherPhone`, `motherPhone`, `parentPhone`, and `parentEmail` hashes.
- Added `isStudentSearchableContactHashField(field)` to constrain callers to searchable contact fields only.
- Empty values or missing encryption key produce no-match hash predicates instead of raw-value predicates.
- Existing partial search remains unchanged.

## Day 4A Messaging Provider Credentials

Implemented encryption for secret values inside `SchoolMessagingConfig.credentials`.

- Added a shared messaging credentials mapper for provider secret keys such as `password`, `authToken`, `authKey`, `accessToken`, `apiKey`, `clientSecret`, `privateKey`, and related token/secret names.
- Non-secret provider configuration such as `host`, `port`, `fromEmail`, `senderId`, `accountSid`, and API endpoint URLs remains plaintext for validation/routing/display.
- `upsertSchoolMessagingConfig` decrypts saved credentials before merge/validation, then encrypts secret keys for storage when `SENSITIVE_FIELD_ENCRYPTION_ENABLED=true`.
- `resolveSchoolMessagingProvider` and `TenantEmailProvider` return decrypted credentials for backend delivery use.
- Legacy SMTP `v1:` password values from `cryptoVault` remain decryptable, so old tenant SMTP rows keep working.
- API response shape is unchanged: settings still return credential keys and masked values only.

## Day 4B Sensitive Data Operations Tooling

Implemented dry-run-first operational scripts.

- `npm run sensitive:audit -- [--school-id <id>] [--limit <n>]`
  - Counts plaintext/encrypted/empty selected student fields.
  - Counts valid/missing/invalid student hash columns when those columns exist.
  - Counts plaintext, `sfv1`, and legacy `v1` provider secret values in `SchoolMessagingConfig.credentials`.
  - Does not print raw sensitive values.
- `npm run sensitive:backfill-student-hashes -- --dry-run|--apply [--school-id <id>] [--limit <n>]`
  - Backfills `Student.*Hash` columns from decrypted/plaintext source fields.
  - Requires `SENSITIVE_FIELD_ENCRYPTION_KEY`.
  - Fails fast with a migration message if hash columns are not present.
- `npm run sensitive:migrate-messaging-credentials -- --dry-run|--apply [--school-id <id>] [--channel EMAIL|SMS|WHATSAPP|PUSH] [--limit <n>]`
  - Re-saves messaging credentials through the new secret-key mapper.
  - Reports undecryptable legacy rows instead of printing secrets or aborting the full dry run.

## Compatibility Rule

All encrypted-field read paths must support both formats:

- Plaintext old/demo value: return as-is.
- Encrypted value with the sensitive-field envelope: decrypt and return plaintext.
- Empty/null value: return as-is.

This allows a quick rollback by setting `SENSITIVE_FIELD_ENCRYPTION_ENABLED=false` and restarting the backend. Existing encrypted rows remain readable.

## Field Classification

### Encrypt Only

These fields should be encrypted because they are high-risk and are not good candidates for sorting, joining, or broad list filtering.

| Model | Fields | Reason |
| --- | --- | --- |
| `Student` | `presentAddress`, `permanentAddress`, `addressLine1`, `addressLine2`, `city`, `state`, `pincode` | Address data is high-risk personal data. |
| `Student` | `bloodGroup`, `medicalConditions`, `allergies` | Health and medical data is high-risk personal data. |
| `Student` | `docBirthCert`, `docTransferCert`, `docReportCard` | Document identifiers/paths can expose identity records. |
| `StudentDocument` | `documentNumber`, `files` | Document numbers and attached-file manifests can contain identity data. |
| `StaffDocument` | `documentNumber` | Staff document identifiers are sensitive identity data. |
| `SchoolDocument` | `documentNumber` | School document identifiers may contain regulated or confidential IDs. |
| `TeacherProfile` | `address`, `currentAddress`, `permanentAddress`, `drivingLicense` | Staff address/license data is high-risk. |
| `TeacherBankDetails` | `accountHolderName` | Account holder names can expose financial identity data. |
| `UserBankDetails` | `accountHolderName` | Account holder names can expose financial identity data. |
| `StaffPayrollInfo` | `epfNo` | Payroll registration IDs are sensitive. |
| `FeePayment` | `chequeNumber`, `transactionReference`, `gatewayPaymentId`, `note` | Payment references and notes may expose financial details. |
| `TransportVehicle` | `driverLicense`, `note` | Driver license and free-text notes can expose staff/driver identity data. |
| `SchoolMessagingConfig` | secret values inside `credentials` JSON, including `authToken`, `accessToken`, `apiKey`, `password` | Provider credentials must not remain readable in DB. Existing code only encrypts SMTP `password`; other provider secrets need coverage. |

### Encrypt And Add Search Hash If Search Is Required

These values are high-risk, but product workflows may need exact-match lookup. Encrypt the stored value and add a deterministic hash column only where exact search/duplicate checks are required.

| Model | Fields | Hash Use |
| --- | --- | --- |
| `Student` | `phone`, `parentPhone`, `fatherPhone`, `motherPhone`, `emergencyContact`, `doctorContact` | Exact phone lookup, duplicate checks, support workflows. |
| `Student` | `email`, `parentEmail` | Exact email lookup or duplicate checks. |
| `ParentGuardian` | `phone`, `email` | Existing indexes indicate these are searchable today. |
| `ParentProfile` | `phone`, `email` | Parent login/support lookup may need exact search. |
| `TeacherProfile` | `phone`, `emergencyMobile` | Staff lookup/support workflows. |
| `Student` | `docAadhaar` | Aadhaar exact-match duplicate checks if the school uses them. |
| `TeacherBankDetails` | `accountNumber`, `panNumber` | Duplicate/prevention checks if required. |
| `UserBankDetails` | `accountNumber`, `panNumber` | Duplicate/prevention checks if required. |
| `TransportVehicle` | `driverContact` | Exact driver contact lookup if transport workflows need it. |
| `LibraryMember` | `phone`, `email` | Exact member lookup if library screens search by contact fields. |
| `OtpCode` | `phone` | Parent OTP lookup uses phone today; use encrypted phone plus keyed hash for lookup. |
| `PushDeviceToken` | `token` | Push tokens are secrets and currently unique; use encrypted token plus keyed hash/unique column for registration lookup. |
| `DemoRequest` | `email`, `phone`, `approvalToken` | Demo leads and approval tokens are sensitive; approval token should preferably be stored as a hash, not decryptable ciphertext. |

Hash columns must store keyed hashes/HMACs, not raw normalized values. They are for exact-match lookup only, not partial search.

### Keep Plaintext For Now

These fields should remain plaintext because they are core operational data used for listing, filtering, sorting, joins, permissions, or tenant isolation.

| Model/Area | Fields |
| --- | --- |
| Tenant and ownership | `id`, `schoolId`, `userId`, `studentId`, `teacherId`, class/section/academic-year IDs |
| Status and workflow | `status`, `isActive`, `createdAt`, `updatedAt`, approval/status timestamps |
| Student operations | `admissionNo`, `rollNo`, `firstName`, `lastName`, `fullName`, `classId`, `sectionId`, `academicSessionId` |
| Staff operations | `employeeNo`, `firstName`, `lastName`, `roleName`, `departmentId`, `designationId` |
| Fee operations | `paymentNumber`, `paymentMode`, `amount`, `paidAt`, `status`, `bankName` |
| Document metadata | `title`, `fileName`, `mimeType`, `fileType`, `sizeBytes`, `uploadedById` |
| Authentication/security | Existing `passwordHash`, `tokenHash`, `otpHash`, `codeHash`, TOTP encrypted secret fields |
| Login identity for Phase 1 | `User.email` because login, uniqueness, role lookup, and admin queries currently depend on direct email access |
| Display names for Phase 1 | Student/staff/guardian names, father/mother names, `fullName`, `driverName`, `LibraryMember.fullName` |

## Later-Phase Audit Areas

The deeper schema scan found additional free-text and JSON areas that may contain sensitive data depending on user behavior. They are not ideal first-pass encryption targets because they affect logs, audits, reporting, review workflows, or broad modules, but they should be audited before production hardening is considered complete.

| Area | Fields/Models | Default Decision |
| --- | --- | --- |
| Audit snapshots | `AuditLog.beforeState`, `AuditLog.afterState`, `AttendanceAudit.previousValue`, `AttendanceAudit.newValue` | Prefer redaction/minimization first; encrypt if full snapshots must be retained. |
| Import payloads/reports | `ImportJob`, `StudentImportLog.report`, `ImportRowError`, raw import JSON fields | Avoid retaining raw sensitive payloads; encrypt or purge after processing. |
| Support and comments | `SupportTicket.description`, `TicketComment.body`, review notes/reasons across workflows | Redact/minimize first; consider encryption for retained free text. |
| Notifications | `NotificationLog.payload`, message payload JSON | Redact PII and tokens before storage; encrypt retained provider payloads if needed. |
| AI assistant payloads | `AiMessage.toolPayload`, `AiPendingAction.payload` | Avoid storing sensitive student/staff data in tool payloads; encrypt if retention is required. |
| Expense receipts | `Expense.receiptUrl`, `Expense.receiptKey`, receipt metadata | Keep private object storage mandatory; encrypt DB keys if receipt references expose private paths. |
| Payment gateway settings | `SchoolSystemSetting.paymentGateways`, `feeChallanBanks` | Inspect actual payloads; encrypt only if credentials/account identifiers are stored here. |
| Exam centers | `ExamCenter.address`, `contactPerson`, `phone` | Usually institution contact data; encrypt only if personal/private center contacts are stored. |

## Initial Implementation Scope

Phase 1 should integrate encryption for structured school profile fields first:

1. `Student`
2. `ParentGuardian`
3. `ParentProfile`
4. `TeacherProfile`
5. `TeacherBankDetails`
6. `UserBankDetails`
7. `StudentDocument`
8. `StaffDocument`
9. `SchoolDocument`

Phase 1B should cover operational secrets and exact-match hash columns:

1. `SchoolMessagingConfig.credentials`
2. `OtpCode.phone`
3. `PushDeviceToken.token`
4. `DemoRequest.email`, `DemoRequest.phone`, `DemoRequest.approvalToken`
5. `TransportVehicle.driverLicense`, `TransportVehicle.driverContact`
6. `LibraryMember.phone`, `LibraryMember.email`

`FeePayment` can follow as Phase 1C if the payment/reporting workflows need more testing time.

## Decisions

- Do not encrypt every field.
- Do not migrate old/demo data if it will be deleted.
- Do not change mobile API response shapes.
- Do not make encrypted values searchable by partial text search.
- Add exact-match hash columns only when a real lookup or duplicate-check workflow requires them.
