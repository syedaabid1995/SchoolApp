'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../../../components/PageHeader';
import FullPageLoader from '../../../../components/FullPageLoader';
import { useNotify } from '../../../../components/NotificationProvider';
import { getSession } from '../../../../services/auth.service';
import {
  addStudentDocument,
  addStudentTimeline,
  deleteStudentDocument,
  deleteStudentTimeline,
  getStudent,
  resolveStudentPhotoUrl,
  resolveUploadUrl,
  type Student,
  updateStudent,
  uploadStudentDocument,
} from '../../../../services/student.service';
import {
  getStudentFeeLedger,
  listStudentCollectionInvoices,
  type FeeInvoice,
} from '../../../../services/fee-management.service';
import { listStudentTransportAssignments } from '../../../../services/transport.service';
import { listStudentDormitoryAssignments } from '../../../../services/dormitory.service';
import { listLibraryMembers, listMemberIssues } from '../../../../services/library.service';

type TabKey = 'profile' | 'parents' | 'fees' | 'transport' | 'library' | 'dormitory' | 'exam' | 'documents' | 'timeline';

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'profile', label: 'Profile' },
  { key: 'parents', label: 'Parents' },
  { key: 'fees', label: 'Fees' },
  { key: 'transport', label: 'Transport' },
  { key: 'library', label: 'Library' },
  { key: 'dormitory', label: 'Dormitory' },
  { key: 'exam', label: 'Exam' },
  { key: 'documents', label: 'Documents' },
  { key: 'timeline', label: 'Timeline' },
];

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
};

const Icon = ({ path }: { path: string }) => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
  </svg>
);

const InfoRow = ({ label, value }: { label: string; value?: string | number | null }) => (
  <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 text-sm font-semibold text-slate-900">{value || '-'}</p>
  </div>
);

const toMoney = (value?: string | number | null) => {
  const amount = Number(value ?? 0);
  if (Number.isNaN(amount)) return '-';
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const sumInvoiceField = (items: FeeInvoice[], field: 'totalAmount' | 'discountAmount' | 'fineAmount' | 'paidAmount' | 'dueAmount') =>
  items.reduce((sum, item) => sum + Number(item[field] ?? 0), 0);

type StudentMark = NonNullable<Student['marks']>[number];

const formatMark = (value?: number | string | null, fractionDigits = 2) => {
  if (value === undefined || value === null || value === '') return '-';
  const amount = Number(value);
  if (Number.isNaN(amount)) return '-';
  return amount.toLocaleString(undefined, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits });
};

const isPassingMark = (mark: StudentMark) => {
  const status = String(mark.status ?? '').toUpperCase();
  if (status === 'FAIL' || status === 'FAILED') return false;
  if (status === 'PASS' || status === 'PASSED') return true;
  const obtained = Number(mark.marks ?? 0);
  const passMarks = Number(mark.examPaper?.passMarks ?? 0);
  return obtained >= passMarks;
};

const getExamDivision = (percentage: number, result: 'Pass' | 'Fail') => {
  if (result === 'Fail') return 'Fail';
  if (percentage >= 60) return 'First';
  if (percentage >= 45) return 'Second';
  if (percentage >= 33) return 'Third';
  return 'Fail';
};

export default function StudentDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const studentId = params.id as string;
  const [tab, setTab] = useState<TabKey>('profile');
  const [editMode, setEditMode] = useState(searchParams.get('edit') === '1');
  const [editForm, setEditForm] = useState({ fullName: '', phone: '', email: '', category: '', presentAddress: '', permanentAddress: '' });
  const [documentForm, setDocumentForm] = useState({ title: '', file: null as File | null });
  const [timelineForm, setTimelineForm] = useState({ title: '', description: '', timelineDate: new Date().toISOString().slice(0, 10) });

  const { data: session, isLoading: isSessionLoading } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSchoolAdmin = session?.role === 'SCHOOL_ADMIN';
  const permissionCodes = session?.permissionCodes ?? [];
  const hasPermission = (code: string) => isSchoolAdmin || permissionCodes.includes(code);
  const canViewStudent = hasPermission('students.list') || hasPermission('student.view');
  const canEditStudent = hasPermission('student.edit');
  const canCreateDocument = hasPermission('student.document.create');
  const canDeleteDocument = hasPermission('student.document.delete');
  const canCreateTimeline = hasPermission('student.timeline.create');
  const canDeleteTimeline = hasPermission('student.timeline.delete');

  const studentQuery = useQuery({
    queryKey: ['student', studentId],
    queryFn: () => getStudent(studentId),
    enabled: Boolean(studentId) && canViewStudent,
  });
  const student = studentQuery.data;
  const displayName = student ? student.fullName ?? `${student.firstName} ${student.lastName}`.trim() : '';

  const feeInvoicesQuery = useQuery({
    queryKey: ['student-fee-invoices', studentId],
    queryFn: () => listStudentCollectionInvoices(studentId),
    enabled: Boolean(studentId) && canViewStudent && tab === 'fees',
  });
  const feeLedgerQuery = useQuery({
    queryKey: ['student-fee-ledger', studentId],
    queryFn: () => getStudentFeeLedger(studentId, { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' }),
    enabled: Boolean(studentId) && canViewStudent && tab === 'fees',
  });
  const transportQuery = useQuery({
    queryKey: ['student-detail-transport', studentId, student?.classId, student?.sectionId],
    queryFn: () => listStudentTransportAssignments({
      classId: student?.classId ?? undefined,
      sectionId: student?.sectionId ?? undefined,
      search: student?.classId ? undefined : student?.admissionNo || displayName,
      active: 'all',
    }),
    enabled: Boolean(student?.id) && canViewStudent && tab === 'transport',
  });
  const dormitoryQuery = useQuery({
    queryKey: ['student-detail-dormitory', studentId, student?.classId, student?.sectionId],
    queryFn: () => listStudentDormitoryAssignments({
      classId: student?.classId ?? undefined,
      sectionId: student?.sectionId ?? undefined,
      search: student?.classId ? undefined : student?.admissionNo || displayName,
      active: 'all',
    }),
    enabled: Boolean(student?.id) && canViewStudent && tab === 'dormitory',
  });
  const libraryMembersQuery = useQuery({
    queryKey: ['student-detail-library-members', studentId, student?.admissionNo],
    queryFn: () => listLibraryMembers({ search: student?.admissionNo || displayName, active: true }),
    enabled: Boolean(student?.id) && canViewStudent && tab === 'library',
  });
  const libraryMember = (libraryMembersQuery.data ?? []).find((member) => member.studentId === studentId || member.fullName.toLowerCase() === displayName.toLowerCase());
  const libraryIssuesQuery = useQuery({
    queryKey: ['student-detail-library-issues', studentId, libraryMember?.id],
    queryFn: () => listMemberIssues(libraryMember!.id),
    enabled: Boolean(libraryMember?.id) && canViewStudent && tab === 'library',
  });
  const feeInvoices = feeInvoicesQuery.data?.items ?? [];
  const transportAssignments = (transportQuery.data ?? []).filter((item) => item.student?.id === studentId);
  const dormitoryAssignments = (dormitoryQuery.data ?? []).filter((item) => item.student?.id === studentId);
  const libraryIssues = libraryIssuesQuery.data ?? [];
  const examGroups = Object.values(
    (student?.marks ?? []).reduce<Record<string, { id: string; name: string; marks: StudentMark[] }>>((groups, mark) => {
      const examId = mark.examPaper?.exam?.id ?? 'unassigned';
      const examName = mark.examPaper?.exam?.name ?? 'Unassigned Exam';
      if (!groups[examId]) groups[examId] = { id: examId, name: examName, marks: [] };
      groups[examId].marks.push(mark);
      return groups;
    }, {}),
  ).map((exam) => {
    const grandTotal = exam.marks.reduce((sum, mark) => sum + Number(mark.examPaper?.maxMarks ?? 0), 0);
    const totalObtained = exam.marks.reduce((sum, mark) => sum + Number(mark.marks ?? 0), 0);
    const percentage = grandTotal > 0 ? (totalObtained / grandTotal) * 100 : 0;
    const result: 'Pass' | 'Fail' = exam.marks.every(isPassingMark) ? 'Pass' : 'Fail';
    return {
      ...exam,
      grandTotal,
      totalObtained,
      percentage,
      result,
      division: getExamDivision(percentage, result),
    };
  });

  useEffect(() => {
    if (!student) return;
    setEditForm({
      fullName: displayName,
      phone: student.phone ?? '',
      email: student.email ?? '',
      category: student.category ?? '',
      presentAddress: student.presentAddress ?? student.addressLine1 ?? '',
      permanentAddress: student.permanentAddress ?? student.addressLine2 ?? '',
    });
  }, [student, displayName]);

  const updateMutation = useMutation({
    mutationFn: () => updateStudent(studentId, editForm),
    onSuccess: () => {
      notify.success('Student updated', 'Profile changes were saved.');
      setEditMode(false);
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (error: any) => notify.error('Update failed', error?.response?.data?.error?.message ?? 'Unable to update student.'),
  });

  const documentMutation = useMutation({
    mutationFn: async () => {
      if (!documentForm.file) throw new Error('Select a document.');
      if (!documentForm.title.trim()) throw new Error('Document title is required.');
      const uploaded = await uploadStudentDocument(documentForm.file, studentId);
      return addStudentDocument(studentId, {
        title: documentForm.title.trim(),
        url: uploaded.url,
        fileName: uploaded.filename,
        mimeType: documentForm.file.type,
        sizeBytes: documentForm.file.size,
      });
    },
    onSuccess: () => {
      notify.success('Document uploaded', 'Student document was added.');
      setDocumentForm({ title: '', file: null });
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
    },
    onError: (error: any) => notify.error('Upload failed', error?.response?.data?.error?.message ?? error.message ?? 'Unable to upload document.'),
  });

  const timelineMutation = useMutation({
    mutationFn: () => {
      if (!timelineForm.title.trim()) throw new Error('Timeline title is required.');
      return addStudentTimeline(studentId, {
        title: timelineForm.title.trim(),
        description: timelineForm.description.trim() || null,
        timelineDate: timelineForm.timelineDate,
      });
    },
    onSuccess: () => {
      notify.success('Timeline added', 'Timeline item was saved.');
      setTimelineForm({ title: '', description: '', timelineDate: new Date().toISOString().slice(0, 10) });
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
    },
    onError: (error: any) => notify.error('Timeline failed', error?.response?.data?.error?.message ?? error.message ?? 'Unable to save timeline.'),
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: (documentId: string) => deleteStudentDocument(studentId, documentId),
    onSuccess: () => {
      notify.success('Document deleted', 'Student document was removed.');
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
    },
  });

  const deleteTimelineMutation = useMutation({
    mutationFn: (timelineId: string) => deleteStudentTimeline(studentId, timelineId),
    onSuccess: () => {
      notify.success('Timeline deleted', 'Timeline item was removed.');
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
    },
  });

  if (isSessionLoading || !session?.role || studentQuery.isLoading) {
    return <FullPageLoader label="Loading student details..." />;
  }
  if (!canViewStudent) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm font-semibold text-amber-800">
        Student details are not enabled for your role. Ask a School Admin to update Role Permissions.
      </section>
    );
  }

  if (!student) {
    return (
      <div className="p-6">
        <PageHeader title="Student Not Found" breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Students', href: '/dashboard/students' }, { label: 'Not Found' }]} />
      </div>
    );
  }

  const photo = resolveStudentPhotoUrl(student);

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-6 lg:px-8">
        <PageHeader
          title={displayName}
          subtitle="View profile, parents, fees, transport, library, dormitory, exam results, documents, and timeline."
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Students', href: '/dashboard/students' }, { label: displayName }]}
        />

        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="h-28 bg-gradient-to-r from-violet-600 to-indigo-600" />
            <div className="-mt-12 px-5 pb-5">
              <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-2xl border-4 border-white bg-violet-100 text-2xl font-bold text-violet-700 shadow">
                {photo ? <img src={photo} alt={displayName} className="h-full w-full object-cover" /> : displayName.slice(0, 2).toUpperCase()}
              </div>
              <h2 className="mt-4 text-xl font-bold text-slate-950">{displayName}</h2>
              <p className="text-sm text-slate-500">Admission: {student.admissionNo}</p>
              <div className="mt-4 space-y-2 text-sm">
                <InfoRow label="Roll number" value={student.rollNo} />
                <InfoRow label="Class" value={`${student.class?.name ?? '-'}${student.section?.name ? ` - ${student.section.name}` : ''}`} />
                <InfoRow label="Gender" value={student.gender} />
                <InfoRow label="Status" value={student.status} />
              </div>
              <div className="mt-5 flex gap-2">
                {canEditStudent ? <button onClick={() => setEditMode(true)} className="flex-1 rounded-xl bg-[var(--theme-button-bg)] px-4 py-2 text-sm font-bold text-[var(--theme-button-text)]">Edit</button> : null}
                <Link href="/dashboard/students" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700">Back</Link>
              </div>
            </div>
          </aside>

          <main className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
              <div className="flex flex-wrap gap-2">
                {tabs.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setTab(item.key)}
                    className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === item.key ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {editMode && canEditStudent && (
              <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-950">Edit Basic Profile</h2>
                  <button onClick={() => setEditMode(false)} className="text-sm font-semibold text-slate-500">Cancel</button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <input value={editForm.fullName} onChange={(event) => setEditForm({ ...editForm, fullName: event.target.value })} placeholder="Full name" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  <input value={editForm.category} onChange={(event) => setEditForm({ ...editForm, category: event.target.value })} placeholder="Type / category" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  <input value={editForm.phone} onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })} placeholder="Phone" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  <input value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} placeholder="Email" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  <textarea value={editForm.presentAddress} onChange={(event) => setEditForm({ ...editForm, presentAddress: event.target.value })} placeholder="Present address" className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2" />
                  <textarea value={editForm.permanentAddress} onChange={(event) => setEditForm({ ...editForm, permanentAddress: event.target.value })} placeholder="Permanent address" className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2" />
                </div>
                <button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} className="mt-4 rounded-xl bg-violet-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">
                  {updateMutation.isPending ? 'Saving...' : 'Save changes'}
                </button>
              </section>
            )}

            {tab === 'profile' && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-slate-950">Profile</h2>
                <div className="grid gap-4 md:grid-cols-3">
                  <InfoRow label="Admission date" value={formatDate(student.admissionDate)} />
                  <InfoRow label="Date of birth" value={formatDate(student.dob)} />
                  <InfoRow label="Type" value={student.category ?? 'Regular'} />
                  <InfoRow label="Religion" value={student.religion} />
                  <InfoRow label="Phone number" value={student.phone ?? student.parentPhone} />
                  <InfoRow label="Email address" value={student.email ?? student.parentEmail} />
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <InfoRow label="Present address" value={student.presentAddress ?? student.addressLine1} />
                  <InfoRow label="Permanent address" value={student.permanentAddress ?? student.addressLine2} />
                </div>
                <h3 className="mt-6 text-base font-bold text-slate-950">Sibling Information</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {student.siblings?.length ? student.siblings.map((item) => (
                    <div key={item.sibling.id} className="rounded-xl border border-slate-100 p-3">
                      <p className="font-semibold text-slate-900">{item.sibling.fullName}</p>
                      <p className="text-sm text-slate-500">{item.sibling.class?.name ?? '-'} {item.sibling.section?.name ?? ''}</p>
                    </div>
                  )) : <p className="text-sm text-slate-500">No sibling linked.</p>}
                </div>
              </section>
            )}

            {tab === 'parents' && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-slate-950">Parents & Guardians</h2>
                <div className="grid gap-4 md:grid-cols-3">
                  <InfoRow label="Father name" value={student.fatherName} />
                  <InfoRow label="Father phone" value={student.fatherPhone} />
                  <InfoRow label="Father occupation" value={student.fatherOccupation} />
                  <InfoRow label="Mother name" value={student.motherName} />
                  <InfoRow label="Mother phone" value={student.motherPhone} />
                  <InfoRow label="Mother occupation" value={student.motherOccupation} />
                  <InfoRow label="Guardian name" value={student.guardianName} />
                  <InfoRow label="Guardian relationship" value={student.guardianRelationship} />
                  <InfoRow label="Parent email" value={student.parentEmail} />
                </div>
                <h3 className="mt-6 text-base font-bold text-slate-950">Linked Parent Accounts</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {student.parentLinks?.length ? student.parentLinks.map((link) => (
                    <div key={link.parentId} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                      <p className="font-bold text-slate-950">{link.parent.firstName} {link.parent.lastName}</p>
                      <p className="mt-1 text-sm text-slate-600">{link.parent.phone ?? 'No phone'}</p>
                      <p className="text-sm text-slate-600">{link.parent.email ?? 'No email'}</p>
                    </div>
                  )) : <p className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">No parent login account is linked.</p>}
                </div>
                <h3 className="mt-6 text-base font-bold text-slate-950">Guardian Records</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {student.guardians?.length ? student.guardians.map((guardian) => (
                    <div key={guardian.id} className="rounded-xl border border-slate-100 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-slate-950">{guardian.name}</p>
                          <p className="text-xs font-semibold uppercase text-violet-600">{guardian.type}{guardian.isPrimary ? ' - Primary' : ''}</p>
                        </div>
                        {guardian.relation ? <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{guardian.relation}</span> : null}
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-slate-600">
                        <p>Phone: {guardian.phone ?? '-'}</p>
                        <p>Email: {guardian.email ?? '-'}</p>
                        <p>Occupation: {guardian.occupation ?? '-'}</p>
                      </div>
                    </div>
                  )) : <p className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">No additional guardian records found.</p>}
                </div>
              </section>
            )}

            {tab === 'fees' && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-slate-950">Fees</h2>
                  <Link href={`/dashboard/fees/collection?studentId=${student.id}`} className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-700">
                    Open fee collection
                  </Link>
                </div>
                {feeInvoicesQuery.isLoading || feeLedgerQuery.isLoading ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">Loading fee details...</div>
                ) : feeInvoicesQuery.isError || feeLedgerQuery.isError ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm font-semibold text-amber-800">Unable to load fee details. Check whether Fees access is enabled for this role.</div>
                ) : (
                  <>
                    <div className="grid gap-3 md:grid-cols-5">
                      <InfoRow label="Invoices" value={feeInvoices.length} />
                      <InfoRow label="Total" value={toMoney(sumInvoiceField(feeInvoices, 'totalAmount'))} />
                      <InfoRow label="Discount" value={toMoney(sumInvoiceField(feeInvoices, 'discountAmount'))} />
                      <InfoRow label="Paid" value={toMoney(sumInvoiceField(feeInvoices, 'paidAmount'))} />
                      <InfoRow label="Balance" value={toMoney(sumInvoiceField(feeInvoices, 'dueAmount'))} />
                    </div>
                    <div className="mt-5 overflow-x-auto rounded-xl border border-slate-100">
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                          <tr><th className="px-3 py-2">Invoice</th><th className="px-3 py-2">Fee</th><th className="px-3 py-2">Month</th><th className="px-3 py-2">Due date</th><th className="px-3 py-2">Total</th><th className="px-3 py-2">Paid</th><th className="px-3 py-2">Balance</th><th className="px-3 py-2">Status</th></tr>
                        </thead>
                        <tbody>
                          {feeInvoices.length ? feeInvoices.map((invoice) => (
                            <tr key={invoice.id} className="border-b border-slate-100">
                              <td className="px-3 py-2 font-semibold text-slate-900">{invoice.invoiceNumber}</td>
                              <td className="px-3 py-2">{invoice.feeType?.name ?? '-'}</td>
                              <td className="px-3 py-2">{invoice.feeMonth ?? '-'}</td>
                              <td className="px-3 py-2">{formatDate(invoice.dueDate)}</td>
                              <td className="px-3 py-2">{toMoney(invoice.totalAmount)}</td>
                              <td className="px-3 py-2">{toMoney(invoice.paidAmount)}</td>
                              <td className="px-3 py-2">{toMoney(invoice.dueAmount)}</td>
                              <td className="px-3 py-2">{invoice.status}</td>
                            </tr>
                          )) : <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-500">No fee invoices found for this student.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                    <h3 className="mt-6 text-base font-bold text-slate-950">Recent Ledger</h3>
                    <div className="mt-3 space-y-2">
                      {(feeLedgerQuery.data?.items ?? []).length ? feeLedgerQuery.data!.items.map((entry) => (
                        <div key={entry.id} className="grid gap-2 rounded-xl border border-slate-100 p-3 text-sm md:grid-cols-[1fr_auto_auto_auto]">
                          <div>
                            <p className="font-semibold text-slate-900">{entry.description}</p>
                            <p className="text-xs text-slate-500">{formatDate(entry.createdAt)} {entry.invoice?.invoiceNumber ? `- ${entry.invoice.invoiceNumber}` : ''}</p>
                          </div>
                          <p>Debit: {toMoney(entry.debit ?? entry.debitAmount)}</p>
                          <p>Credit: {toMoney(entry.credit ?? entry.creditAmount)}</p>
                          <p className="font-semibold">Balance: {toMoney(entry.balance ?? entry.balanceAfter)}</p>
                        </div>
                      )) : <p className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">No fee ledger entries found.</p>}
                    </div>
                  </>
                )}
              </section>
            )}

            {tab === 'transport' && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-slate-950">Transport</h2>
                {transportQuery.isLoading ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">Loading transport assignment...</div>
                ) : transportQuery.isError ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm font-semibold text-amber-800">Unable to load transport details. Check whether Transport access is enabled for this role.</div>
                ) : transportAssignments.length ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {transportAssignments.map((assignment) => (
                      <div key={assignment.id} className="rounded-xl border border-slate-100 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-bold text-slate-950">{assignment.route.title}</p>
                          <span className={`rounded-full px-2 py-1 text-xs font-bold ${assignment.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{assignment.active ? 'Active' : 'Inactive'}</span>
                        </div>
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          <InfoRow label="Fare" value={toMoney(assignment.route.fare)} />
                          <InfoRow label="Vehicle" value={assignment.vehicle?.vehicleNumber} />
                          <InfoRow label="Driver" value={assignment.vehicle?.driverName} />
                          <InfoRow label="Driver contact" value={assignment.vehicle?.driverContact} />
                        </div>
                        {assignment.note ? <p className="mt-3 text-sm text-slate-600">{assignment.note}</p> : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">This student is not assigned to transport.</div>
                )}
              </section>
            )}

            {tab === 'library' && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-slate-950">Library</h2>
                {libraryMembersQuery.isLoading || libraryIssuesQuery.isLoading ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">Loading library details...</div>
                ) : libraryMembersQuery.isError || libraryIssuesQuery.isError ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm font-semibold text-amber-800">Unable to load library details. Check whether Library access is enabled for this role.</div>
                ) : libraryMember ? (
                  <>
                    <div className="grid gap-3 md:grid-cols-4">
                      <InfoRow label="Member code" value={libraryMember.memberCode} />
                      <InfoRow label="Member status" value={libraryMember.active ? 'Active' : 'Inactive'} />
                      <InfoRow label="Phone" value={libraryMember.phone} />
                      <InfoRow label="Issued books" value={libraryIssues.length} />
                    </div>
                    <div className="mt-5 overflow-x-auto rounded-xl border border-slate-100">
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                          <tr><th className="px-3 py-2">Book</th><th className="px-3 py-2">Book No</th><th className="px-3 py-2">Issue Date</th><th className="px-3 py-2">Return Date</th><th className="px-3 py-2">Status</th></tr>
                        </thead>
                        <tbody>
                          {libraryIssues.length ? libraryIssues.map((issue) => (
                            <tr key={issue.id} className="border-b border-slate-100">
                              <td className="px-3 py-2 font-semibold text-slate-900">{issue.book?.title ?? '-'}</td>
                              <td className="px-3 py-2">{issue.book?.bookNumber ?? '-'}</td>
                              <td className="px-3 py-2">{formatDate(issue.issueDate)}</td>
                              <td className="px-3 py-2">{formatDate(issue.returnDate ?? issue.returnedAt)}</td>
                              <td className="px-3 py-2">{issue.status}</td>
                            </tr>
                          )) : <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">No library issues found for this student.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">This student is not registered as a library member.</div>
                )}
              </section>
            )}

            {tab === 'dormitory' && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-slate-950">Dormitory</h2>
                {dormitoryQuery.isLoading ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">Loading dormitory assignment...</div>
                ) : dormitoryQuery.isError ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm font-semibold text-amber-800">Unable to load dormitory details. Check whether Dormitory access is enabled for this role.</div>
                ) : dormitoryAssignments.length ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {dormitoryAssignments.map((assignment) => (
                      <div key={assignment.id} className="rounded-xl border border-slate-100 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-bold text-slate-950">{assignment.dormitory.name}</p>
                          <span className={`rounded-full px-2 py-1 text-xs font-bold ${assignment.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{assignment.active ? 'Active' : 'Inactive'}</span>
                        </div>
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          <InfoRow label="Room" value={assignment.room?.roomNumber} />
                          <InfoRow label="Room type" value={assignment.room?.roomType?.name} />
                          <InfoRow label="Beds" value={assignment.room?.bedCount} />
                          <InfoRow label="Cost per bed" value={toMoney(assignment.room?.costPerBed)} />
                        </div>
                        {assignment.note ? <p className="mt-3 text-sm text-slate-600">{assignment.note}</p> : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">This student is not assigned to a dormitory.</div>
                )}
              </section>
            )}

            {tab === 'exam' && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-slate-950">Exam Results</h2>
                {examGroups.length ? (
                  <div className="space-y-6">
                    {examGroups.map((exam) => (
                      <div key={exam.id} className="overflow-hidden rounded-xl border border-slate-200">
                        <div className="border-b border-slate-200 bg-slate-100 px-4 py-3 text-lg font-bold text-slate-950">
                          {exam.name}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-left text-sm">
                            <thead className="bg-white text-xs uppercase text-slate-500">
                              <tr>
                                <th className="px-3 py-3">Subject</th>
                                <th className="px-3 py-3">Max Marks</th>
                                <th className="px-3 py-3">Min Marks</th>
                                <th className="px-3 py-3">Marks Obtained</th>
                                <th className="px-3 py-3">Result</th>
                                <th className="px-3 py-3">Grade</th>
                                <th className="px-3 py-3">Note</th>
                              </tr>
                            </thead>
                            <tbody>
                              {exam.marks.map((mark) => {
                                const subjectName = mark.examPaper?.subject?.name ?? '-';
                                const subjectCode = mark.examPaper?.subject?.code;
                                const passed = isPassingMark(mark);
                                return (
                                  <tr key={mark.id} className="border-t border-slate-100">
                                    <td className="px-3 py-3 font-semibold text-slate-900">
                                      {subjectName}{subjectCode ? ` (${subjectCode})` : ''}
                                    </td>
                                    <td className="px-3 py-3">{formatMark(mark.examPaper?.maxMarks)}</td>
                                    <td className="px-3 py-3">{formatMark(mark.examPaper?.passMarks)}</td>
                                    <td className="px-3 py-3 font-bold text-slate-950">{formatMark(mark.marks)}</td>
                                    <td className="px-3 py-3">
                                      <span className={`rounded-md px-2 py-1 text-xs font-bold ${passed ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                                        {passed ? 'Pass' : 'Fail'}
                                      </span>
                                    </td>
                                    <td className="px-3 py-3">{mark.grade ?? '-'}</td>
                                    <td className="px-3 py-3">{mark.status ?? '-'}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <div className="grid gap-3 bg-slate-100 px-4 py-4 text-sm font-bold text-slate-950 md:grid-cols-2 xl:grid-cols-6">
                          <div>Grand Total : {formatMark(exam.grandTotal, 0)}</div>
                          <div>Total Obtain Marks : {formatMark(exam.totalObtained, 0)}</div>
                          <div>Percentage : {formatMark(exam.percentage, 2)}</div>
                          <div>Rank : -</div>
                          <div>
                            Result :
                            <span className={`ml-2 rounded-md px-2 py-1 text-xs font-bold ${exam.result === 'Pass' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                              {exam.result}
                            </span>
                          </div>
                          <div>Division : {exam.division}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                    No exam results found.
                  </div>
                )}
              </section>
            )}

            {tab === 'documents' && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-slate-950">Documents</h2>
                {canCreateDocument ? <div className="mb-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                  <input value={documentForm.title} onChange={(event) => setDocumentForm({ ...documentForm, title: event.target.value })} placeholder="Document title" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  <input type="file" accept=".pdf,.doc,.docx,image/*" onChange={(event) => setDocumentForm({ ...documentForm, file: event.target.files?.[0] ?? null })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  <button onClick={() => documentMutation.mutate()} disabled={documentMutation.isPending} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Upload</button>
                </div> : null}
                <div className="grid gap-3">
                  {student.documents?.length ? student.documents.map((document) => (
                    <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3">
                      <div>
                        <p className="font-semibold text-slate-900">{document.title}</p>
                        <p className="text-xs text-slate-500">{formatDate(document.createdAt)}</p>
                      </div>
                      <div className="flex gap-2">
                        <a href={resolveUploadUrl(document.url, { type: 'student-document', id: document.id }) ?? undefined} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">Download</a>
                        {canDeleteDocument ? <button onClick={() => window.confirm('Delete this document?') && deleteDocumentMutation.mutate(document.id)} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600">Delete</button> : null}
                      </div>
                    </div>
                  )) : <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">No documents uploaded.</p>}
                </div>
              </section>
            )}

            {tab === 'timeline' && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-slate-950">Timeline</h2>
                {canCreateTimeline ? <div className="mb-5 grid gap-3 md:grid-cols-[1fr_160px_auto]">
                  <input value={timelineForm.title} onChange={(event) => setTimelineForm({ ...timelineForm, title: event.target.value })} placeholder="Title" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  <input type="date" value={timelineForm.timelineDate} onChange={(event) => setTimelineForm({ ...timelineForm, timelineDate: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  <button onClick={() => timelineMutation.mutate()} disabled={timelineMutation.isPending} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Add</button>
                  <textarea value={timelineForm.description} onChange={(event) => setTimelineForm({ ...timelineForm, description: event.target.value })} placeholder="Description" className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-3" />
                </div> : null}
                <div className="space-y-3">
                  {student.timelines?.length ? student.timelines.map((item) => (
                    <div key={item.id} className="rounded-xl border border-slate-100 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-bold text-slate-950">{item.title}</p>
                          <p className="text-xs font-semibold uppercase text-violet-600">{formatDate(item.timelineDate)}</p>
                          <p className="mt-2 text-sm text-slate-600">{item.description || '-'}</p>
                        </div>
                        {canDeleteTimeline ? <button onClick={() => window.confirm('Delete this timeline item?') && deleteTimelineMutation.mutate(item.id)} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600">
                          <Icon path="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6" />
                        </button> : null}
                      </div>
                    </div>
                  )) : <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">No timeline items found.</p>}
                </div>
              </section>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
