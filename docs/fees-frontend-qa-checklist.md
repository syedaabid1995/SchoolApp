# Fees Management Frontend QA Checklist

Use this checklist after backend accounting fixes are deployed to the test environment.

## Routes

- [ ] `/dashboard/fees/overview` loads without crash.
- [ ] `/dashboard/fees/particulars` loads without crash.
- [ ] `/dashboard/fees/types` loads without crash.
- [ ] `/dashboard/fees/structures` loads without crash.
- [ ] `/dashboard/fees/assignments` loads without crash.
- [ ] `/dashboard/fees/invoice-generate` loads without crash.
- [ ] `/dashboard/fees/invoices` loads without crash.
- [ ] `/dashboard/fees/collection` loads without crash.
- [ ] `/dashboard/fees/discounts` loads without crash.
- [ ] `/dashboard/fees/fines` loads without crash.
- [ ] `/dashboard/fees/ledger` loads without crash.
- [ ] `/dashboard/fees/reports` loads without crash.

## Metadata and dropdowns

- [ ] Academic Session loads from fee metadata or Academic Setup fallback.
- [ ] Academic Session persists after refresh.
- [ ] Class dropdown loads.
- [ ] Section dropdown filters by selected class where applicable.
- [ ] Student dropdown/search shows only selectable ENROLLED students for new billing/collection.
- [ ] Fee Type dropdown shows active fee types for structure/invoice generation.
- [ ] Fee Particular dropdown loads.
- [ ] Fee Structure dropdown loads active structures.
- [ ] Payment Mode dropdown loads Cash, UPI, Bank Transfer, Cheque, Card, Online Gateway.
- [ ] Report Type dropdown includes all fee report types.

## Setup forms

- [ ] Fee Particular create/edit/delete works.
- [ ] Fee Type create/edit/delete works.
- [ ] Fee Structure create/edit/delete works and rejects zero/negative item amount.
- [ ] Assignment create/edit/delete/activate/deactivate works.
- [ ] Discount create/edit/delete/approve/reject works by permission.
- [ ] Fine create/delete works and rejects zero amount.
- [ ] Validation errors display beside fields.
- [ ] Success toast appears after save.
- [ ] Error toast shows backend validation message.
- [ ] Tables refresh after mutation without manual page reload.

## Invoice generation

- [ ] Preview works for class/section/student/school targets.
- [ ] Selected fee structure preview works.
- [ ] Assignment-based generation works.
- [ ] Duplicate invoices are marked/skipped.
- [ ] Discount amount is shown correctly.
- [ ] Previous balance is not duplicated into new invoice preview.
- [ ] Generate button disables while processing.
- [ ] Generated invoice list refreshes after generation.

## Invoice list

- [ ] Search by student, admission number, invoice number works.
- [ ] Class/section/fee type/month/status/date filters work.
- [ ] Pagination works.
- [ ] Sorting works.
- [ ] Status badges show ISSUED, PARTIALLY_PAID, PAID, OVERDUE, CANCELLED correctly.
- [ ] Cancel unpaid invoice works with confirmation.
- [ ] Paid invoice cancellation is blocked with readable error.
- [ ] Print/PDF actions work where available.

## Fee collection

- [ ] Student search excludes EXITED, TRANSFERRED, DISABLED students for new collection.
- [ ] Pending invoice balance equals backend `dueAmount`.
- [ ] Full payment works.
- [ ] Partial payment works.
- [ ] Multi-invoice payment works.
- [ ] Overpayment is blocked.
- [ ] UPI requires transaction reference.
- [ ] Bank/Card/Online payment requires transaction reference.
- [ ] Cheque requires cheque number and bank name.
- [ ] Receipt is displayed/generated after payment.
- [ ] Submit button disables while collecting payment.
- [ ] Failed payment resets disabled state.

## Discounts and fines

- [ ] Accountant cannot approve/reject discounts.
- [ ] School Admin can approve/reject discounts.
- [ ] Approved post-invoice discount updates invoice due and ledger.
- [ ] Duplicate fine on same invoice is blocked with clear error.
- [ ] Fine amount updates invoice and ledger.

## Reports and exports

- [ ] Daily collection report loads.
- [ ] Monthly collection report loads.
- [ ] Class-wise due report loads.
- [ ] Section-wise due report loads.
- [ ] Student-wise due report loads.
- [ ] Outstanding report loads.
- [ ] Discount report loads.
- [ ] Fine report loads.
- [ ] Cancelled invoice report loads.
- [ ] Payment mode report loads.
- [ ] Accountant-wise collection report loads.
- [ ] Receipt report loads.
- [ ] Ledger summary loads.
- [ ] Report filters apply by school/session/date/class/section/status.
- [ ] Report totals match backend reconciliation totals.
- [ ] PDF export downloads.
- [ ] Excel export downloads.
- [ ] Empty state appears when no rows match filters.

## UX and browser checks

- [ ] No console errors on each Fees route.
- [ ] Loading states appear while metadata/tables load.
- [ ] Empty states are readable.
- [ ] Toast messages are readable and action-specific.
- [ ] No stale table data after create/update/delete/cancel/payment.
- [ ] Buttons reset after failed API calls.
- [ ] Mobile layout remains usable with horizontal table scroll where needed.
