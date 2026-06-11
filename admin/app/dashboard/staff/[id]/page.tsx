'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import FullPageLoader from '../../../../components/FullPageLoader';
import PageHeader from '../../../../components/PageHeader';
import { useNotify } from '../../../../components/NotificationProvider';
import { getSession } from '../../../../services/auth.service';
import {
  addStaffTimeline,
  deleteStaffDocument,
  deleteStaffTimeline,
  getStaff,
  uploadStaffDocument,
  type Payroll,
  type Staff,
} from '../../../../services/staff.service';

type TabKey = 'profile' | 'payroll' | 'leaves' | 'documents' | 'timeline';

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'profile', label: 'Profile' },
  { key: 'payroll', label: 'Payroll' },
  { key: 'leaves', label: 'Leaves' },
  { key: 'documents', label: 'Documents' },
  { key: 'timeline', label: 'Timeline' },
];

const today = () => new Date().toISOString().slice(0, 10);

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString();
};

const formatMoney = (value?: string | number | null) => {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);
};

const statusBadge = (status?: string | null) => {
  const key = String(status ?? '').toUpperCase();
  if (key === 'PAID') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (key === 'GENERATED') return 'border-violet-200 bg-violet-50 text-violet-700';
  if (key === 'CANCELLED') return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
};

const leaveStatusBadge = (status?: string | null) => {
  const key = String(status ?? '').toUpperCase();
  if (key === 'APPROVED') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (key === 'PENDING') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (key === 'REJECTED') return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
};

const InfoRow = ({ label, value }: { label: string; value?: string | number | null }) => (
  <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 text-sm font-semibold text-slate-900">{value || '-'}</p>
  </div>
);

const fullName = (staff?: Staff | null) => (staff ? staff.fullName ?? `${staff.firstName ?? ''} ${staff.lastName ?? ''}`.trim() : '');

export default function StaffDetailPage() {
  const params = useParams();
  const staffId = params.id as string;
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>('profile');
  const [documentForm, setDocumentForm] = useState({ title: '', file: null as File | null });
  const [timelineForm, setTimelineForm] = useState({ title: '', description: '', date: today(), time: '09:00' });

  const { data: session, isLoading: sessionLoading } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSchoolAdmin = session?.role === 'SCHOOL_ADMIN';
  const permissionCodes = session?.permissionCodes ?? [];
  const hasPermission = (code: string) => isSchoolAdmin || permissionCodes.includes(code);
  const canViewStaff = hasPermission('staff.view');
  const canCreateDocument = hasPermission('staff.document.create');
  const canDeleteDocument = hasPermission('staff.document.delete');
  const canCreateTimeline = hasPermission('staff.timeline.create');
  const canDeleteTimeline = hasPermission('staff.timeline.delete');
  const staffQuery = useQuery({ queryKey: ['staff-detail', staffId], queryFn: () => getStaff(staffId), enabled: Boolean(canViewStaff && staffId) });
  const staff = staffQuery.data;
  const name = fullName(staff);
  const leaveBalances = staff?.leaveBalances ?? [];
  const leaveApplications = staff?.leaveApplications ?? [];

  const documentMutation = useMutation({
    mutationFn: async () => {
      if (!documentForm.title.trim()) throw new Error('Document title is required.');
      if (!documentForm.file) throw new Error('Select a document.');
      return uploadStaffDocument(staffId, documentForm.title.trim(), documentForm.file);
    },
    onSuccess: () => {
      notify.success('Document uploaded', 'Staff document was added.');
      setDocumentForm({ title: '', file: null });
      queryClient.invalidateQueries({ queryKey: ['staff-detail', staffId] });
    },
    onError: (error: any) => notify.error('Upload failed', error?.response?.data?.error?.message ?? error.message ?? 'Unable to upload document.'),
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: (documentId: string) => deleteStaffDocument(staffId, documentId),
    onSuccess: () => {
      notify.success('Document deleted', 'Staff document was removed.');
      queryClient.invalidateQueries({ queryKey: ['staff-detail', staffId] });
    },
  });

  const timelineMutation = useMutation({
    mutationFn: () => {
      if (!timelineForm.title.trim()) throw new Error('Timeline title is required.');
      return addStaffTimeline(staffId, timelineForm);
    },
    onSuccess: () => {
      notify.success('Timeline added', 'Timeline item was saved.');
      setTimelineForm({ title: '', description: '', date: today(), time: '09:00' });
      queryClient.invalidateQueries({ queryKey: ['staff-detail', staffId] });
    },
    onError: (error: any) => notify.error('Timeline failed', error?.response?.data?.error?.message ?? error.message ?? 'Unable to save timeline.'),
  });

  const deleteTimelineMutation = useMutation({
    mutationFn: (timelineId: string) => deleteStaffTimeline(staffId, timelineId),
    onSuccess: () => {
      notify.success('Timeline deleted', 'Timeline item was removed.');
      queryClient.invalidateQueries({ queryKey: ['staff-detail', staffId] });
    },
  });

  if (sessionLoading || !session?.role) return <FullPageLoader label="Checking staff access..." />;
  if (!canViewStaff) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm font-semibold text-amber-800">
        Staff details are not enabled for your role. Ask a School Admin to update Role Permissions.
      </section>
    );
  }
  if (staffQuery.isLoading) return <FullPageLoader label="Loading staff details..." />;

  if (!staff) {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-6">
        <PageHeader title="Staff Not Found" breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Staff', href: '/dashboard/staff' }, { label: 'Not Found' }]} />
      </div>
    );
  }

  const documents = staff.documents ?? [];
  const offerDocument = documents.find((doc) => doc.fileUrl.startsWith('/dashboard/') && doc.title.toLowerCase().includes('offer'));
  const uploadedDocuments = documents.filter((doc) => doc.id !== offerDocument?.id);

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-6 lg:px-8">
        <PageHeader
          title={name}
          subtitle="View staff profile, payroll, documents, timeline, and employment information."
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Staff', href: '/dashboard/staff' }, { label: name }]}
          actions={<Link href={`/dashboard/staff/add?id=${staff.id}`} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700">Edit Staff</Link>}
        />

        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="h-28 bg-gradient-to-r from-violet-600 to-indigo-600" />
            <div className="-mt-12 px-5 pb-5">
              <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-2xl border-4 border-white bg-violet-100 text-2xl font-bold text-violet-700 shadow">
                {staff.photoUrl ? <img src={staff.photoUrl} alt={name} className="h-full w-full object-cover" /> : name.slice(0, 2).toUpperCase()}
              </div>
              <h2 className="mt-4 text-xl font-bold text-slate-950">{name}</h2>
              <p className="text-sm text-slate-500">{String(staff.role ?? staff.roleName ?? '').replace('_', ' ')}</p>
              <div className="mt-4 space-y-2">
                <InfoRow label="Staff no" value={staff.employeeNo ?? staff.staffNo} />
                <InfoRow label="Designation" value={staff.designation?.name} />
                <InfoRow label="Department" value={staff.department?.name} />
                <InfoRow label="EPF no" value={staff.payrollInfo?.epfNo} />
                <InfoRow label="Basic salary" value={formatMoney(staff.payrollInfo?.basicSalary)} />
                <InfoRow label="Contract type" value={staff.payrollInfo?.contractType} />
                <InfoRow label="Date of joining" value={formatDate(staff.dateOfJoining)} />
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
                    className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === item.key ? 'bg-[var(--theme-button-bg)] text-[var(--theme-button-text)] shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {tab === 'profile' ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-slate-950">Profile</h2>
                <div className="grid gap-4 md:grid-cols-3">
                  <InfoRow label="Mobile" value={staff.phone} />
                  <InfoRow label="Emergency mobile" value={staff.emergencyMobile} />
                  <InfoRow label="Email" value={staff.user?.email ?? staff.email} />
                  <InfoRow label="Gender" value={staff.gender} />
                  <InfoRow label="Date of birth" value={formatDate(staff.dateOfBirth)} />
                  <InfoRow label="Marital status" value={staff.maritalStatus} />
                  <InfoRow label="Father name" value={staff.fatherName} />
                  <InfoRow label="Mother name" value={staff.motherName} />
                  <InfoRow label="Driving license" value={staff.drivingLicense} />
                  <InfoRow label="Qualification" value={staff.qualifications} />
                  <InfoRow label="Work experience" value={staff.experience} />
                  <InfoRow label="Payment mode" value={staff.payrollInfo?.paymentMode} />
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <InfoRow label="Current address" value={staff.currentAddress} />
                  <InfoRow label="Permanent address" value={staff.permanentAddress} />
                </div>
              </section>
            ) : null}

            {tab === 'payroll' ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-slate-950">Payslips</h2>
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-100 text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Payslip ID</th>
                        <th className="px-4 py-3">Month-Year</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Mode</th>
                        <th className="px-4 py-3">Net salary</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {staff.payrolls?.length ? staff.payrolls.map((payroll: Payroll) => (
                        <tr key={payroll.id}>
                          <td className="px-4 py-3 font-semibold">{payroll.payslipNo}</td>
                          <td className="px-4 py-3">{payroll.month}/{payroll.year}</td>
                          <td className="px-4 py-3">{formatDate(payroll.generatedAt)}</td>
                          <td className="px-4 py-3">{payroll.paymentMode ?? '-'}</td>
                          <td className="px-4 py-3">{formatMoney(payroll.netSalary)}</td>
                          <td className="px-4 py-3"><span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusBadge(payroll.status)}`}>{payroll.status}</span></td>
                        </tr>
                      )) : (
                        <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">No payslips generated yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {tab === 'leaves' ? (
              <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-950">Leave Balance</h2>
                    <p className="text-sm text-slate-500">Opening balance, used days, and remaining leave for this employee.</p>
                  </div>
                  <Link href="/dashboard/leave/requests" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700">Manage Leave</Link>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {leaveBalances.length ? leaveBalances.map((balance) => (
                    <div key={balance.leaveTypeId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-bold text-slate-950">{balance.leaveType?.name ?? 'Leave'}</p>
                      <p className="mt-2 text-2xl font-black text-slate-950">{balance.remainingDays ?? Math.max(0, Number(balance.totalDays) - Number(balance.usedDays))}</p>
                      <p className="text-xs font-semibold text-slate-500">Remaining of {balance.totalDays}</p>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-[var(--theme-button-bg)]"
                          style={{ width: `${Math.min(100, Math.max(0, ((Number(balance.usedDays ?? 0) / Math.max(1, Number(balance.totalDays ?? 1))) * 100)))}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-slate-500">Used {balance.usedDays} / Extra {balance.extraTakenDays}</p>
                    </div>
                  )) : (
                    <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500 md:col-span-2 xl:col-span-4">No leave balance assigned.</p>
                  )}
                </div>
                <div>
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Recent Leave Applications</h3>
                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-100 text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3">From</th>
                          <th className="px-4 py-3">To</th>
                          <th className="px-4 py-3">Days</th>
                          <th className="px-4 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {leaveApplications.length ? leaveApplications.map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-3 font-semibold">{item.leaveType?.name ?? '-'}</td>
                            <td className="px-4 py-3">{formatDate(item.fromDate)}</td>
                            <td className="px-4 py-3">{formatDate(item.toDate)}</td>
                            <td className="px-4 py-3">{item.durationDays}</td>
                            <td className="px-4 py-3"><span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${leaveStatusBadge(item.status)}`}>{item.status}</span></td>
                          </tr>
                        )) : (
                          <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No leave applications yet.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            ) : null}

            {tab === 'documents' ? (
              <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-950">Generated Offer Letter</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{offerDocument?.fileName ?? `${staff.employeeNo ?? staff.staffNo ?? 'employee'}-offer-letter.html`}</p>
                    </div>
                    <Link href={offerDocument?.fileUrl ?? `/dashboard/staff/${staff.id}/offer-letter`} className="rounded-xl bg-[var(--theme-button-bg)] px-4 py-2 text-sm font-bold text-[var(--theme-button-text)]">
                      View / Print
                    </Link>
                  </div>
                </div>
                {canCreateDocument ? <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                  <input value={documentForm.title} onChange={(event) => setDocumentForm({ ...documentForm, title: event.target.value })} placeholder="Document title" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  <input type="file" onChange={(event) => setDocumentForm({ ...documentForm, file: event.target.files?.[0] ?? null })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  <button onClick={() => documentMutation.mutate()} disabled={documentMutation.isPending} className="rounded-xl bg-[var(--theme-button-bg)] px-4 py-2 text-sm font-bold text-[var(--theme-button-text)] disabled:opacity-50">Upload</button>
                </div> : null}
                <div className="grid gap-3">
                  {uploadedDocuments.length ? uploadedDocuments.map((doc) => {
                    const isInternalDocument = doc.fileUrl.startsWith('/dashboard/');
                    return (
                      <div key={doc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                        <div>
                          <p className="font-semibold text-slate-950">{doc.title}</p>
                          <p className="text-xs text-slate-500">{doc.fileName ?? 'Document'} - {formatDate(doc.createdAt)}</p>
                        </div>
                        <div className="flex gap-2">
                          {isInternalDocument ? (
                            <Link href={doc.fileUrl} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold">View</Link>
                          ) : (
                            <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold">Download</a>
                          )}
                          {canDeleteDocument ? <button onClick={() => window.confirm('Delete this document?') && deleteDocumentMutation.mutate(doc.id)} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700">Delete</button> : null}
                        </div>
                      </div>
                    );
                  }) : <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">No uploaded documents found.</p>}
                </div>
              </section>
            ) : null}

            {tab === 'timeline' ? (
              <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                {canCreateTimeline ? <div className="grid gap-3 md:grid-cols-[1fr_160px_120px]">
                  <input value={timelineForm.title} onChange={(event) => setTimelineForm({ ...timelineForm, title: event.target.value })} placeholder="Timeline title" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  <input type="date" value={timelineForm.date} onChange={(event) => setTimelineForm({ ...timelineForm, date: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  <input type="time" value={timelineForm.time} onChange={(event) => setTimelineForm({ ...timelineForm, time: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  <textarea value={timelineForm.description} onChange={(event) => setTimelineForm({ ...timelineForm, description: event.target.value })} placeholder="Description" className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-3" />
                  <button onClick={() => timelineMutation.mutate()} disabled={timelineMutation.isPending} className="rounded-xl bg-[var(--theme-button-bg)] px-4 py-2 text-sm font-bold text-[var(--theme-button-text)] disabled:opacity-50 md:col-span-3">Add Timeline</button>
                </div> : null}
                <div className="space-y-3">
                  {staff.timelines?.length ? staff.timelines.map((item) => (
                    <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-950">{item.title}</p>
                          <p className="text-xs text-slate-500">{formatDate(item.timelineAt)}</p>
                        </div>
                        {canDeleteTimeline ? <button onClick={() => window.confirm('Delete this timeline item?') && deleteTimelineMutation.mutate(item.id)} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700">Delete</button> : null}
                      </div>
                      {item.description ? <p className="mt-2 text-sm text-slate-600">{item.description}</p> : null}
                    </div>
                  )) : <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">No timeline items found.</p>}
                </div>
              </section>
            ) : null}
          </main>
        </div>
      </div>
    </div>
  );
}
