'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import FullPageLoader from '../../../../components/FullPageLoader';
import PageHeader from '../../../../components/PageHeader';
import { useNotify } from '../../../../components/NotificationProvider';
import { getSession } from '../../../../services/auth.service';
import { listAcademicYears } from '../../../../services/academic.service';
import { listSetupClasses, listSetupSections } from '../../../../services/academic-setup.service';
import {
  createFeeCarryForward,
  generateCarryForwardInvoice,
  previewFeeCarryForward,
  type FeeCarryForward,
} from '../../../../services/fee-management.service';
import { previewStudentPromotion, promoteStudents, type StudentPromotionResult } from '../../../../services/student-operations.service';

const money = (value: number | string | null | undefined) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value ?? 0));

export default function StudentPromotionPage() {
  const notify = useNotify();
  const [form, setForm] = useState({
    fromAcademicSessionId: '',
    toAcademicSessionId: '',
    fromClassId: '',
    toClassId: '',
    fromSectionId: '',
    toSectionId: '',
    note: '',
  });
  const [results, setResults] = useState<Record<string, StudentPromotionResult>>({});
  const [carryForwardPreview, setCarryForwardPreview] = useState<Awaited<ReturnType<typeof previewFeeCarryForward>> | null>(null);
  const [carryForwardRecords, setCarryForwardRecords] = useState<FeeCarryForward[]>([]);

  const { data: session, isLoading: sessionLoading } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSchoolAdmin = session?.role === 'SCHOOL_ADMIN';
  const permissionCodes = session?.permissionCodes ?? [];
  const hasPermission = (code: string) => isSchoolAdmin || permissionCodes.includes(code);
  const canViewPromotion = hasPermission('student.promote.view');
  const canCreatePromotion = hasPermission('student.promote.create');
  const canCreateCarryForward = isSchoolAdmin || permissionCodes.includes('fees.carry-forward.create') || permissionCodes.includes('fees.carry-forwards.create');
  const yearsQuery = useQuery({ queryKey: ['academic-years'], queryFn: () => listAcademicYears(), enabled: canViewPromotion });
  const classesQuery = useQuery({ queryKey: ['setup-classes'], queryFn: () => listSetupClasses(), enabled: canViewPromotion });
  const sectionsQuery = useQuery({ queryKey: ['setup-sections'], queryFn: () => listSetupSections(), enabled: canViewPromotion });

  const fromSections = useMemo(
    () => (sectionsQuery.data ?? []).filter((section) => (form.fromClassId ? section.classSections?.some((link) => link.classId === form.fromClassId) || section.classId === form.fromClassId : true)),
    [form.fromClassId, sectionsQuery.data],
  );
  const toSections = useMemo(
    () => (sectionsQuery.data ?? []).filter((section) => (form.toClassId ? section.classSections?.some((link) => link.classId === form.toClassId) || section.classId === form.toClassId : true)),
    [form.toClassId, sectionsQuery.data],
  );

  const previewQuery = useQuery({
    queryKey: ['student-promotion-preview', form.fromAcademicSessionId, form.fromClassId, form.fromSectionId],
    queryFn: () => previewStudentPromotion({ academicSessionId: form.fromAcademicSessionId, classId: form.fromClassId, sectionId: form.fromSectionId }),
    enabled: false,
  });

  const loadStudents = async () => {
    if (!form.fromAcademicSessionId || !form.fromClassId || !form.fromSectionId) {
      notify.warning('Select criteria', 'Current session, class, and section are required.');
      return;
    }
    const data = await previewQuery.refetch();
    if (data.data) {
      setResults(Object.fromEntries(data.data.students.map((student) => [student.id, 'PASS'])));
      if (!form.toAcademicSessionId && data.data.suggestedPromoteSession?.id) {
        setForm((current) => ({ ...current, toAcademicSessionId: data.data?.suggestedPromoteSession?.id ?? '' }));
      }
    }
  };

  const promoteMutation = useMutation({
    mutationFn: () => {
      if (!form.toAcademicSessionId || !form.toClassId || !form.toSectionId) throw new Error('Promote session, class, and section are required.');
      const selected = Object.entries(results).map(([studentId, result]) => ({ studentId, result }));
      if (!selected.length) throw new Error('Load students before promoting.');
      return promoteStudents({
        fromAcademicSessionId: form.fromAcademicSessionId,
        toAcademicSessionId: form.toAcademicSessionId,
        fromClassId: form.fromClassId,
        toClassId: form.toClassId,
        fromSectionId: form.fromSectionId,
        toSectionId: form.toSectionId,
        note: form.note,
        results: selected,
      });
    },
    onSuccess: () => notify.success('Students promoted', 'Promotion history was saved and passed students were moved.'),
    onError: (error: any) => notify.error('Promotion failed', error?.response?.data?.error?.message ?? error.message ?? 'Unable to promote students.'),
  });

  const selectedCarryForwardStudentIds = () => Object.entries(results).filter(([, result]) => result === 'PASS').map(([studentId]) => studentId);

  const previewCarryForwardMutation = useMutation({
    mutationFn: () => {
      if (!form.fromAcademicSessionId || !form.toAcademicSessionId) throw new Error('Current and promote sessions are required.');
      const studentIds = selectedCarryForwardStudentIds();
      if (!studentIds.length) throw new Error('Mark at least one student as pass before previewing carry-forward.');
      return previewFeeCarryForward({
        fromAcademicSessionId: form.fromAcademicSessionId,
        toAcademicSessionId: form.toAcademicSessionId,
        academicSessionId: form.fromAcademicSessionId,
        studentIds,
      });
    },
    onSuccess: (data) => {
      setCarryForwardPreview(data);
      notify.success('Carry-forward preview ready', `${data.items.length} student balance(s) found.`);
    },
    onError: (error: any) => notify.error('Carry-forward preview failed', error?.response?.data?.error?.message ?? error.message ?? 'Unable to preview carry-forward.'),
  });

  const createCarryForwardMutation = useMutation({
    mutationFn: () => {
      if (!form.fromAcademicSessionId || !form.toAcademicSessionId) throw new Error('Current and promote sessions are required.');
      const studentIds = selectedCarryForwardStudentIds();
      if (!studentIds.length) throw new Error('Mark at least one student as pass before creating carry-forward.');
      return createFeeCarryForward({
        fromAcademicSessionId: form.fromAcademicSessionId,
        toAcademicSessionId: form.toAcademicSessionId,
        academicSessionId: form.fromAcademicSessionId,
        studentIds,
      });
    },
    onSuccess: (data) => {
      setCarryForwardRecords(data.items);
      notify.success('Carry-forward created', `${data.items.length} carry-forward record(s) created.`);
    },
    onError: (error: any) => notify.error('Carry-forward failed', error?.response?.data?.error?.message ?? error.message ?? 'Unable to create carry-forward.'),
  });

  const generateCarryForwardInvoicesMutation = useMutation({
    mutationFn: async () => {
      const pending = carryForwardRecords.filter((item) => item.status === 'PENDING');
      if (!pending.length) throw new Error('Create pending carry-forward records before generating invoices.');
      return Promise.all(pending.map((item) => generateCarryForwardInvoice(item.id, { academicSessionId: form.toAcademicSessionId })));
    },
    onSuccess: (items) => {
      setCarryForwardRecords(items.map((item) => item.carryForward));
      notify.success('Carry-forward invoices generated', `${items.length} invoice(s) generated in the target session.`);
    },
    onError: (error: any) => notify.error('Invoice generation failed', error?.response?.data?.error?.message ?? error.message ?? 'Unable to generate carry-forward invoices.'),
  });

  if (sessionLoading || !session?.role) return <FullPageLoader label="Checking promotion access..." />;
  if (!canViewPromotion) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm font-semibold text-amber-800">
        Student promotion is not enabled for your role. Ask a School Admin to update Role Permissions.
      </section>
    );
  }

  const students = previewQuery.data?.students ?? [];

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-6 lg:px-8">
        <PageHeader
          title="Student Promotion"
          subtitle="Promote passed students to the next academic session and keep promotion history."
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Students', href: '/dashboard/students' }, { label: 'Promotion' }]}
        />

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">Select Criteria</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            <select value={form.fromAcademicSessionId} onChange={(event) => setForm({ ...form, fromAcademicSessionId: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="">Current Session</option>
              {(yearsQuery.data ?? []).map((year: any) => <option key={year.id} value={year.id}>{year.name}</option>)}
            </select>
            <select value={form.fromClassId} onChange={(event) => setForm({ ...form, fromClassId: event.target.value, fromSectionId: '' })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="">Current Class</option>
              {(classesQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <select value={form.fromSectionId} onChange={(event) => setForm({ ...form, fromSectionId: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="">Current Section</option>
              {fromSections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <select value={form.toAcademicSessionId} onChange={(event) => setForm({ ...form, toAcademicSessionId: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="">Promote Session</option>
              {(yearsQuery.data ?? []).map((year: any) => <option key={year.id} value={year.id}>{year.name}</option>)}
            </select>
            <select value={form.toClassId} onChange={(event) => setForm({ ...form, toClassId: event.target.value, toSectionId: '' })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="">Promote Class</option>
              {(classesQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <select value={form.toSectionId} onChange={(event) => setForm({ ...form, toSectionId: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="">Promote Section</option>
              {toSections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={loadStudents} className="rounded-xl bg-[var(--theme-button-bg)] px-4 py-2 text-sm font-bold text-[var(--theme-button-text)] shadow-sm">Search Students</button>
            <button
              disabled={!canCreateCarryForward || !students.length || previewCarryForwardMutation.isPending}
              onClick={() => previewCarryForwardMutation.mutate()}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50"
            >
              Preview Carry-Forward
            </button>
            <button
              disabled={!canCreateCarryForward || !students.length || createCarryForwardMutation.isPending}
              onClick={() => window.confirm('Create carry-forward records for passed students?') && createCarryForwardMutation.mutate()}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50"
            >
              Generate Carry-Forward
            </button>
            <button
              disabled={!canCreateCarryForward || !carryForwardRecords.some((item) => item.status === 'PENDING') || generateCarryForwardInvoicesMutation.isPending}
              onClick={() => window.confirm('Generate invoices for pending carry-forward records?') && generateCarryForwardInvoicesMutation.mutate()}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50"
            >
              Generate CF Invoices
            </button>
            <button onClick={() => window.print()} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700">Print</button>
          </div>
        </section>

        {(carryForwardPreview || carryForwardRecords.length) ? (
          <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Carry-Forward</h2>
                <p className="text-sm text-slate-500">
                  {carryForwardPreview ? `${carryForwardPreview.items.length} preview item(s), total ${money(carryForwardPreview.totalAmount)}.` : `${carryForwardRecords.length} generated record(s).`}
                </p>
              </div>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Invoices</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {carryForwardRecords.length ? carryForwardRecords.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-semibold">{item.student?.fullName ?? item.studentId}</td>
                      <td className="px-4 py-3">{item.generatedInvoice?.invoiceNumber ?? '-'}</td>
                      <td className="px-4 py-3 text-right font-bold">{money(item.amount)}</td>
                      <td className="px-4 py-3">{item.status}</td>
                    </tr>
                  )) : carryForwardPreview?.items.map((item) => (
                    <tr key={item.studentId}>
                      <td className="px-4 py-3 font-semibold">{item.student.fullName}</td>
                      <td className="px-4 py-3">{item.invoices.map((invoice) => invoice.invoiceNumber).join(', ') || '-'}</td>
                      <td className="px-4 py-3 text-right font-bold">{money(item.amount)}</td>
                      <td className="px-4 py-3">Preview</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Promotion Students</h2>
              <p className="text-sm text-slate-500">{students.length ? `${students.length} students loaded.` : 'Search current session and class to load students.'}</p>
            </div>
            <input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Promotion note" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Admission No</th>
                  <th className="px-4 py-3">Roll No</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Academic Performance</th>
                  <th className="px-4 py-3">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewQuery.isFetching ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">Loading students...</td></tr>
                ) : students.length ? (
                  students.map((student) => (
                    <tr key={student.id}>
                      <td className="px-4 py-3 font-semibold">{student.admissionNo}</td>
                      <td className="px-4 py-3">{student.rollNo ?? '-'}</td>
                      <td className="px-4 py-3">{student.fullName || `${student.firstName} ${student.lastName}`.trim()}</td>
                      <td className="px-4 py-3">
                        <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700" onClick={() => alert('Academic performance summary will use exam results when configured.')}>View</button>
                      </td>
                      <td className="px-4 py-3">
                        <select value={results[student.id] ?? 'PASS'} onChange={(event) => setResults({ ...results, [student.id]: event.target.value as StudentPromotionResult })} className="rounded-lg border border-slate-200 px-3 py-2">
                          <option value="PASS">Pass</option>
                          <option value="FAIL">Fail</option>
                        </select>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">No students found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-end">
            <button disabled={!canCreatePromotion || !students.length || promoteMutation.isPending} onClick={() => window.confirm('Promote selected students?') && promoteMutation.mutate()} className="rounded-xl bg-[var(--theme-button-bg)] px-5 py-2 text-sm font-bold text-[var(--theme-button-text)] shadow-sm disabled:opacity-50">
              Promote Students
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
