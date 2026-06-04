# Document 13 - Incomplete, Dead & Unused Features

Generated from repository code on 2026-06-04. Source root: `/Users/syedaabidahamedarshad/Documents/TechStageIT/SchoolApp`.

## Explicit Incomplete / Stubbed Items

| Source | Finding | Recommendation |
|---|---|---|
| `backend/src/controllers/report.controller.ts:50` | throw new HttpError(501, 'Rank card generation not implemented'); | Triage before production or client handover. |
| `backend/src/middlewares/version.middleware.ts:5` | const DEPRECATED_BEFORE = '1.1.0'; | Triage before production or client handover. |
| `backend/src/middlewares/version.middleware.ts:24` | if (isLessThan(version, DEPRECATED_BEFORE)) { | Triage before production or client handover. |
| `backend/src/services/adminDashboard.service.ts:192` | // TODO: Add a trial lifecycle field/model before reporting trial schools. | Triage before production or client handover. |
| `backend/src/services/adminDashboard.service.ts:318` | // TODO: Add invoice/payment models before reporting real pending amounts. | Triage before production or client handover. |
| `backend/src/services/adminDashboard.service.ts:320` | // TODO: Add invoice/payment models before reporting real overdue amounts. | Triage before production or client handover. |
| `backend/src/services/adminDashboard.service.ts:399` | // TODO: Add WAITING to TicketStatus before reporting waiting tickets. | Triage before production or client handover. |
| `backend/src/services/adminDashboard.service.ts:468` | // TODO: Add file/storage accounting before reporting real storage use. | Triage before production or client handover. |
| `backend/src/services/adminDashboard.service.ts:524` | // TODO: Wire BullMQ queue metrics when queue names are centralized. | Triage before production or client handover. |
| `backend/src/services/adminDashboard.service.ts:530` | // TODO: Add a safe S3 HEAD/list health check after storage usage policy is finalized. | Triage before production or client handover. |
| `backend/src/services/adminDashboard.service.ts:534` | // TODO: Add email provider health check when email delivery service is configured. | Triage before production or client handover. |
| `backend/src/services/dataCompliance.service.ts:257` | throw new HttpError(501, 'Export approval workflow is not implemented by the current export job model'); | Triage before production or client handover. |
| `backend/src/services/dataCompliance.service.ts:261` | throw new HttpError(501, 'Export rejection workflow is not implemented by the current export job model'); | Triage before production or client handover. |
| `backend/src/services/dataCompliance.service.ts:331` | throw new HttpError(501, 'Deletion rejection workflow is not implemented by the current deletion job model'); | Triage before production or client handover. |
| `backend/src/services/otp.service.ts:42` | return { sent: true, code }; // return code for now (stubbed send) | Triage before production or client handover. |
| `backend/src/services/subscription.service.ts:497` | message: 'Billing records are not implemented yet. Manual payment notes are stored in audit history only.', | Triage before production or client handover. |
| `admin/app/change-password/page.tsx:13` | 'w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] px-4 py-3 text-sm font-semibold text-[var(--shell-text)] outline-none transition-colors placeholder:te | Triage before production or client handover. |
| `admin/app/dashboard/academics/exams/page.tsx:342` | placeholder="Exam name" | Triage before production or client handover. |
| `admin/app/dashboard/academics/exams/page.tsx:610` | placeholder="Internal marks" | Triage before production or client handover. |
| `admin/app/dashboard/academics/exams/page.tsx:616` | placeholder="External marks" | Triage before production or client handover. |
| `admin/app/dashboard/academics/exams/page.tsx:625` | placeholder="Practical marks" | Triage before production or client handover. |
| `admin/app/dashboard/academics/page.backup.tsx:336` | placeholder="e.g., 2024-2025" | Triage before production or client handover. |
| `admin/app/dashboard/academics/page.backup.tsx:437` | placeholder="Class name" | Triage before production or client handover. |
| `admin/app/dashboard/academics/page.backup.tsx:539` | placeholder="Exam type name" | Triage before production or client handover. |
| `admin/app/dashboard/academics/page.backup.tsx:545` | placeholder="Code (e.g., MIDTERM)" | Triage before production or client handover. |
| `admin/app/dashboard/academics/page.backup.tsx:638` | placeholder="Section name" | Triage before production or client handover. |
| `admin/app/dashboard/academics/page.backup.tsx:743` | placeholder="Subject name" | Triage before production or client handover. |
| `admin/app/dashboard/academics/page.backup.tsx:797` | placeholder="Search subjects" | Triage before production or client handover. |
| `admin/app/dashboard/academics/page.tsx:400` | placeholder="Quick search..." | Triage before production or client handover. |
| `admin/app/dashboard/academics/page.tsx:980` | placeholder="Example: 2026 Year" | Triage before production or client handover. |
| `admin/app/dashboard/academics/page.tsx:1057` | <input className={inputClass} value={classForm.name} onChange={(e) => setClassForm((p) => ({ ...p, name: e.target.value }))} placeholder="Example: Grade 10" /> | Triage before production or client handover. |
| `admin/app/dashboard/academics/page.tsx:1140` | <input className={inputClass} value={sectionForm.name} onChange={(e) => setSectionForm((p) => ({ ...p, name: e.target.value }))} placeholder="Example: A" /> | Triage before production or client handover. |
| `admin/app/dashboard/academics/page.tsx:1178` | <Field label="Subject name"><input className={inputClass} value={subjectForm.name} onChange={(e) => setSubjectForm((p) => ({ ...p, name: e.target.value }))} placeholder="Example: M | Triage before production or client handover. |
| `admin/app/dashboard/academics/page.tsx:1179` | <Field label="Subject code"><input className={inputClass} value={subjectForm.code} onChange={(e) => setSubjectForm((p) => ({ ...p, code: e.target.value }))} placeholder="Example: M | Triage before production or client handover. |
| `admin/app/dashboard/academics/page.tsx:1222` | <Field label="Room number"><input className={inputClass} value={roomForm.roomNumber} onChange={(e) => setRoomForm((p) => ({ ...p, roomNumber: e.target.value }))} placeholder="Examp | Triage before production or client handover. |
| `admin/app/dashboard/academics/page.tsx:1289` | <Field label="Period name"><input className={inputClass} value={timeForm.name} onChange={(e) => setTimeForm((p) => ({ ...p, name: e.target.value }))} placeholder="Example: 1st Peri | Triage before production or client handover. |
| `admin/app/dashboard/academics/page.tsx:1333` | <input className={inputClass} value={assignSubjectFilter} onChange={(e) => setAssignSubjectFilter(e.target.value)} placeholder="Search by name or code" /> | Triage before production or client handover. |
| `admin/app/dashboard/academics/page.tsx:1336` | <input className={inputClass} value={assignTeacherFilter} onChange={(e) => setAssignTeacherFilter(e.target.value)} placeholder="Search by name, ID, email" /> | Triage before production or client handover. |
| `admin/app/dashboard/attendance/locks/page.tsx:32` | <input className="w-full rounded border px-3 py-2" placeholder="Session ID" value={sessionId} onChange={(e) => setSessionId(e.target.value)} /> | Triage before production or client handover. |
| `admin/app/dashboard/attendance/locks/page.tsx:33` | <input className="w-full rounded border px-3 py-2" placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} /> | Triage before production or client handover. |
| `admin/app/dashboard/attendance/page.tsx:121` | placeholder="From (YYYY-MM-DD)" | Triage before production or client handover. |
| `admin/app/dashboard/attendance/page.tsx:128` | placeholder="To (YYYY-MM-DD)" | Triage before production or client handover. |
| `admin/app/dashboard/attendance/page.tsx:291` | placeholder="Rejection reason" | Triage before production or client handover. |
| `admin/app/dashboard/attendance/students/mark/page.tsx:266` | placeholder="Remarks" | Triage before production or client handover. |
| `admin/app/dashboard/audit/page.tsx:315` | placeholder="Event, actor, target" | Triage before production or client handover. |
| `admin/app/dashboard/audit/page.tsx:319` | <FilterInput label="Event" value={filters.action} onChange={(value) => setFilter('action', value)} placeholder="LOGIN_FAILED" /> | Triage before production or client handover. |
| `admin/app/dashboard/audit/page.tsx:334` | <FilterInput label="Target Type" value={filters.targetType} onChange={(value) => setFilter('targetType', value)} placeholder="USER" /> | Triage before production or client handover. |
| `admin/app/dashboard/audit/page.tsx:343` | {isSuperAdmin ? <FilterInput label="IP Address" value={filters.ipAddress} onChange={(value) => setFilter('ipAddress', value)} placeholder="103." /> : null} | Triage before production or client handover. |
| `admin/app/dashboard/audit/page.tsx:506` | <FilterInput label="Event" value={exportForm.action} onChange={(value) => setExportForm({ ...exportForm, action: value })} placeholder="LOGIN_FAILED" /> | Triage before production or client handover. |
| `admin/app/dashboard/audit/page.tsx:569` | function FilterInput({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string  | Triage before production or client handover. |
| `admin/app/dashboard/audit/page.tsx:573` | <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1 w-full rounded-xl border border-[var(--shell-border)]  | Triage before production or client handover. |
| `admin/app/dashboard/backups/page.tsx:245` | onError: () => setFormError('Backup service is not implemented yet.'), | Triage before production or client handover. |
| `admin/app/dashboard/backups/page.tsx:256` | onError: () => setFormError('Restore service is not implemented yet.'), | Triage before production or client handover. |
| `admin/app/dashboard/backups/page.tsx:276` | setFormError('Backup execution is not implemented yet on the backend.'); | Triage before production or client handover. |
| `admin/app/dashboard/backups/page.tsx:294` | setFormError('Restore execution is not implemented yet.'); | Triage before production or client handover. |
| `admin/app/dashboard/backups/page.tsx:349` | Backup and restore execution is currently not implemented. This page displays records and readiness status only. | Triage before production or client handover. |
| `admin/app/dashboard/backups/page.tsx:373` | placeholder="Search by ID, school, status" | Triage before production or client handover. |
| `admin/app/dashboard/backups/page.tsx:436` | Backup execution is not implemented yet on the backend. The submit action is disabled to avoid fake success. | Triage before production or client handover. |
| `admin/app/dashboard/backups/page.tsx:475` | placeholder="Manual backup before deployment" | Triage before production or client handover. |
| `admin/app/dashboard/backups/page.tsx:505` | Restore execution is not implemented yet. The submit action is disabled to avoid fake success. | Triage before production or client handover. |
| `admin/app/dashboard/backups/page.tsx:516` | placeholder="Reason for restore request" | Triage before production or client handover. |
| `admin/app/dashboard/compliance/page.tsx:526` | <p className="mt-1">Review requests carefully before approval. Export approval/rejection and deletion rejection are not implemented by the current backend workflow, so the API repo | Triage before production or client handover. |
| `admin/app/dashboard/compliance/page.tsx:539` | placeholder="Search" | Triage before production or client handover. |
| `admin/app/dashboard/dormitory/page.tsx:133` | <input className={`${inputClass} sm:max-w-xs`} placeholder="Quick search..." value={search ?? ''} onChange={(event) => setSearch(event.target.value)} /> | Triage before production or client handover. |
| `admin/app/dashboard/dormitory/page.tsx:421` | <input className={inputClass} placeholder="Boys, Girls, Staff..." value={dormitoryForm.type} onChange={(e) => setDormitoryForm((p) => ({ ...p, type: e.target.value }))} /> | Triage before production or client handover. |
| `admin/app/dashboard/fees/page.tsx:331` | {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())} | Triage before production or client handover. |
| `admin/app/dashboard/fees/page.tsx:928` | <input className={inputClass} value={particularSearch} onChange={(event) => { setParticularSearch(event.target.value); setParticularPage(1); }} placeholder="Tuition, transport, fin | Triage before production or client handover. |
| `admin/app/dashboard/fees/page.tsx:1029` | <input className={inputClass} {...particularForm.register('name')} placeholder="Monthly Tuition Fee" /> | Triage before production or client handover. |
| `admin/app/dashboard/fees/page.tsx:1033` | <input className={inputClass} {...particularForm.register('code')} placeholder="TUITION" /> | Triage before production or client handover. |
| `admin/app/dashboard/fees/page.tsx:1069` | <input className={inputClass} {...feeTypeForm.register('name')} placeholder="Monthly" /> | Triage before production or client handover. |
| `admin/app/dashboard/fees/page.tsx:1073` | <input className={inputClass} {...feeTypeForm.register('code')} placeholder="MONTHLY" /> | Triage before production or client handover. |
| `admin/app/dashboard/fees/page.tsx:1151` | <input className={inputClass} {...structureForm.register('name')} placeholder="Class 1 Monthly Fee" /> | Triage before production or client handover. |
| `admin/app/dashboard/fees/page.tsx:1427` | <input className={inputClass} {...paymentForm.register('transactionReference')} placeholder="UPI ref / cheque no / gateway id" /> | Triage before production or client handover. |
| `admin/app/dashboard/fees/page.tsx:1588` | <input className={inputClass} {...fineForm.register('name')} placeholder="Late Payment Fine" /> | Triage before production or client handover. |
| `admin/app/dashboard/homework/page.tsx:508` | <input className={`${inputClass} sm:max-w-xs`} placeholder="Quick search..." value={quickSearch} onChange={(event) => setQuickSearch(event.target.value)} /> | Triage before production or client handover. |
| `admin/app/dashboard/homework/page.tsx:692` | <input className={`${inputClass} max-w-md`} placeholder="Quick search..." value={search} onChange={(event) => onSearch(event.target.value)} /> | Triage before production or client handover. |
| `admin/app/dashboard/homework/page.tsx:716` | <input className={inputClass} placeholder="Comment" value={row.comments} onChange={(event) => onRowChange(row.studentId, { comments: event.target.value })} /> | Triage before production or client handover. |
| `admin/app/dashboard/leave/my/page.tsx:173` | <textarea value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="Reason" className="min-h-28 w-full rounded-xl border border-slate- | Triage before production or client handover. |
| `admin/app/dashboard/leave/requests/page.tsx:193` | <input value={typeForm.name} onChange={(event) => setTypeForm({ ...typeForm, name: event.target.value })} placeholder="Type name" className="w-full rounded-xl border border-slate-2 | Triage before production or client handover. |
| `admin/app/dashboard/leave/requests/page.tsx:194` | <input type="number" value={typeForm.totalDays} onChange={(event) => setTypeForm({ ...typeForm, totalDays: Number(event.target.value) })} placeholder="Total days" className="w-full | Triage before production or client handover. |
| `admin/app/dashboard/leave/requests/page.tsx:217` | <input type="number" value={defineForm.days} onChange={(event) => setDefineForm({ ...defineForm, days: Number(event.target.value) })} placeholder="Days" className="w-full rounded-x | Triage before production or client handover. |
| `admin/app/dashboard/leave/requests/page.tsx:241` | <input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Search name, email, staff no" className="rounded-xl border b | Triage before production or client handover. |
| `admin/app/dashboard/leave/requests/page.tsx:346` | <input value={statusForm.note} onChange={(event) => setStatusForm({ ...statusForm, note: event.target.value })} placeholder="Review note" className="rounded-xl border border-slate- | Triage before production or client handover. |
| `admin/app/dashboard/library/page.tsx:139` | <input className={`${inputClass} sm:max-w-xs`} placeholder="Quick search..." value={search ?? ''} onChange={(event) => setSearch(event.target.value)} /> | Triage before production or client handover. |
| `admin/app/dashboard/library/page.tsx:507` | <input className={inputClass} placeholder="Search member..." value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} /> | Triage before production or client handover. |
| `admin/app/dashboard/parents/page.tsx:39` | placeholder="Search parents" | Triage before production or client handover. |
| `admin/app/dashboard/payroll/page.tsx:262` | <input type="number" value={form.basicSalary} onChange={(event) => setForm({ ...form, basicSalary: Number(event.target.value) })} placeholder="Basic salary" className="rounded-xl b | Triage before production or client handover. |
| `admin/app/dashboard/payroll/page.tsx:263` | <input type="number" value={form.tax} onChange={(event) => setForm({ ...form, tax: Number(event.target.value) })} placeholder="Tax" className="rounded-xl border border-slate-200 px | Triage before production or client handover. |
| `admin/app/dashboard/payroll/page.tsx:264` | <input value={form.paymentMode} onChange={(event) => setForm({ ...form, paymentMode: event.target.value })} placeholder="Payment mode" className="rounded-xl border border-slate-200 | Triage before production or client handover. |
| `admin/app/dashboard/reports/page.tsx:763` | placeholder="Search by report name" | Triage before production or client handover. |
| `admin/app/dashboard/schools/[id]/admins/page.tsx:335` | placeholder="Search admins by email or creator..." | Triage before production or client handover. |
| `admin/app/dashboard/schools/[id]/admins/page.tsx:741` | placeholder="admin@school.com" | Triage before production or client handover. |
| `admin/app/dashboard/schools/page.tsx:482` | placeholder="Search schools..." | Triage before production or client handover. |
| `admin/app/dashboard/schools/page.tsx:994` | placeholder="ABC PUBLIC SCHOOL" | Triage before production or client handover. |
| `admin/app/dashboard/schools/page.tsx:1013` | placeholder="ABC_00001" | Triage before production or client handover. |
| `admin/app/dashboard/schools/page.tsx:1064` | placeholder="admin@school.com" | Triage before production or client handover. |
| `admin/app/dashboard/settings/branding/page.tsx:102` | placeholder, | Triage before production or client handover. |
| `admin/app/dashboard/settings/branding/page.tsx:108` | placeholder?: string; | Triage before production or client handover. |
| `admin/app/dashboard/settings/branding/page.tsx:114` | <textarea className={fieldClass} rows={3} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /> | Triage before production or client handover. |
| `admin/app/dashboard/settings/branding/page.tsx:116` | <input className={fieldClass} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /> | Triage before production or client handover. |
| `admin/app/dashboard/settings/consent/page.tsx:28` | placeholder="Filter by Parent ID" | Triage before production or client handover. |
| `admin/app/dashboard/settings/page.tsx:421` | placeholder="Example 40" | Triage before production or client handover. |
| `admin/app/dashboard/settings/page.tsx:433` | placeholder="Example 33" | Triage before production or client handover. |
| `admin/app/dashboard/settings/page.tsx:445` | placeholder="Example 1" | Triage before production or client handover. |
| `admin/app/dashboard/settings/page.tsx:677` | placeholder="Feature key" | Triage before production or client handover. |
| `admin/app/dashboard/settings/page.tsx:683` | placeholder="Name" | Triage before production or client handover. |
| `admin/app/dashboard/settings/page.tsx:689` | placeholder="Description" | Triage before production or client handover. |
| `admin/app/dashboard/settings/page.tsx:730` | placeholder="Name" | Triage before production or client handover. |
| `admin/app/dashboard/settings/page.tsx:736` | placeholder="Description" | Triage before production or client handover. |
| `admin/app/dashboard/settings/page.tsx:792` | placeholder="Key" | Triage before production or client handover. |
| `admin/app/dashboard/settings/page.tsx:798` | placeholder="Description" | Triage before production or client handover. |
| `admin/app/dashboard/settings/page.tsx:804` | placeholder='{"enabled": true}' | Triage before production or client handover. |
| `admin/app/dashboard/settings/page.tsx:832` | placeholder="Description" | Triage before production or client handover. |
| `admin/app/dashboard/settings/security/page.tsx:500` | placeholder="000000" | Triage before production or client handover. |
| `admin/app/dashboard/settings/security/page.tsx:532` | placeholder="123456 or backup code" | Triage before production or client handover. |
| `admin/app/dashboard/settings/security/totp/page.tsx:225` | placeholder="000000" | Triage before production or client handover. |
| `admin/app/dashboard/settings/security/totp/page.tsx:255` | placeholder="123456 or ABCD-EFGH" | Triage before production or client handover. |
| `admin/app/dashboard/settings/sms/page.tsx:29` | placeholder?: string; | Triage before production or client handover. |
| `admin/app/dashboard/settings/sms/page.tsx:35` | { key: 'accountSid', label: 'Account SID', required: true, placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' }, | Triage before production or client handover. |
| `admin/app/dashboard/settings/sms/page.tsx:36` | { key: 'authToken', label: 'Auth Token', required: true, secret: true, placeholder: 'Twilio auth token' }, | Triage before production or client handover. |

## High-Signal Gaps

- Backup and restore pages intentionally disable execution; backend records/readiness exist but execution is not implemented.
- Data compliance export/deletion approval and rejection workflows return HTTP 501 in service code.
- Rank card generation returns HTTP 501.
- Billing records for subscriptions/manual payments are not implemented; notes are audit-history only.
- OTP sending is stubbed to return the code.
- Some platform dashboard metrics are TODO because backing models/statuses/accounting are missing.

## Unused/Dead Feature Method

This document lists explicit code markers only. A deeper dead-code proof would require TypeScript project reference analysis and production route telemetry; no such telemetry is present in the repository.
