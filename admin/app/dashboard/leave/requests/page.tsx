'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import FullPageLoader from '../../../../components/FullPageLoader';
import PageHeader from '../../../../components/PageHeader';
import { useNotify } from '../../../../components/NotificationProvider';
import { getSession } from '../../../../services/auth.service';
import { listStaff } from '../../../../services/staff.service';
import {
  createLeaveDefine,
  createLeaveType,
  deleteLeaveApplication,
  deleteLeaveDefine,
  deleteLeaveType,
  getLeaveApplication,
  listLeaveApplications,
  listLeaveDefines,
  listLeaveTypes,
  updateLeaveDefine,
  updateLeaveStatus,
  updateLeaveType,
  type LeaveApplication,
  type LeaveDefine,
  type LeaveStatus,
  type LeaveType,
} from '../../../../services/leave.service';

type TabKey = 'requests' | 'types' | 'defines';

const roles = ['SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'STAFF'];
const statuses: LeaveStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];

const statusClass: Record<string, string> = {
  PENDING: 'border-amber-200 bg-amber-50 text-amber-700',
  APPROVED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  REJECTED: 'border-rose-200 bg-rose-50 text-rose-700',
  CANCELLED: 'border-slate-200 bg-slate-50 text-slate-600',
};

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString();
};

const staffName = (item?: LeaveApplication['staff'] | null) => item ? item.fullName ?? `${item.firstName ?? ''} ${item.lastName ?? ''}`.trim() : '-';

const exportCsv = (items: LeaveApplication[]) => {
  const headers = ['Name', 'Type', 'From', 'To', 'Apply date', 'Duration', 'Status', 'Reason'];
  const body = items.map((item) => [staffName(item.staff), item.leaveType?.name ?? '', item.fromDate, item.toDate, item.appliedAt, item.durationDays ?? item.duration ?? 0, item.status, item.reason]);
  const csv = [headers, ...body].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'leave-requests.csv';
  anchor.click();
  URL.revokeObjectURL(url);
};

export default function LeaveRequestsPage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>('requests');
  const [typeForm, setTypeForm] = useState({ id: '', name: '', totalDays: 0 });
  const [defineForm, setDefineForm] = useState({ id: '', roleName: 'TEACHER', leaveTypeId: '', days: 0 });
  const [filters, setFilters] = useState({ status: '', roleName: '', staffId: '', search: '' });
  const [selectedId, setSelectedId] = useState('');
  const [statusForm, setStatusForm] = useState<{ status: LeaveStatus; note: string }>({ status: 'PENDING', note: '' });

  const { data: session, isLoading: sessionLoading } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSchoolAdmin = session?.role === 'SCHOOL_ADMIN';
  const permissionCodes = session?.permissionCodes ?? [];
  const hasPermission = (code: string) => isSchoolAdmin || permissionCodes.includes(code);
  const canViewLeaveRequests = hasPermission('leave.approve.view');
  const canEditLeaveRequests = hasPermission('leave.approve.edit');
  const canDeleteLeaveRequests = hasPermission('leave.approve.delete');
  const canViewLeaveTypes = hasPermission('leave.type.view');
  const canCreateLeaveTypes = hasPermission('leave.type.create');
  const canEditLeaveTypes = hasPermission('leave.type.edit');
  const canDeleteLeaveTypes = hasPermission('leave.type.delete');
  const canViewLeaveDefines = hasPermission('leave.define.view');
  const canCreateLeaveDefines = hasPermission('leave.define.create');
  const canEditLeaveDefines = hasPermission('leave.define.edit');
  const canDeleteLeaveDefines = hasPermission('leave.define.delete');
  const canUseLeaveManagement = canViewLeaveRequests || canViewLeaveTypes || canViewLeaveDefines;

  const typesQuery = useQuery({ queryKey: ['leave-types'], queryFn: listLeaveTypes, enabled: canViewLeaveTypes || canViewLeaveDefines });
  const definesQuery = useQuery({ queryKey: ['leave-defines'], queryFn: listLeaveDefines, enabled: canViewLeaveDefines });
  const staffQuery = useQuery({ queryKey: ['leave-staff-options', filters.roleName], queryFn: () => listStaff({ limit: 100, role: filters.roleName || undefined }), enabled: canViewLeaveRequests });
  const requestsQuery = useQuery({
    queryKey: ['leave-applications', filters],
    queryFn: () => listLeaveApplications({ status: filters.status as LeaveStatus || undefined, roleName: filters.roleName || undefined, staffId: filters.staffId || undefined, search: filters.search || undefined }),
    enabled: canViewLeaveRequests,
  });
  const detailQuery = useQuery({ queryKey: ['leave-application-detail', selectedId], queryFn: () => getLeaveApplication(selectedId), enabled: Boolean(canViewLeaveRequests && selectedId) });

  const requests = useMemo(() => requestsQuery.data ?? [], [requestsQuery.data]);
  const types = typesQuery.data ?? [];
  const defines = definesQuery.data ?? [];

  const typeMutation = useMutation({
    mutationFn: () => {
      if (!typeForm.name.trim()) throw new Error('Leave type name is required.');
      return typeForm.id ? updateLeaveType(typeForm.id, { name: typeForm.name, totalDays: Number(typeForm.totalDays) }) : createLeaveType({ name: typeForm.name, totalDays: Number(typeForm.totalDays) });
    },
    onSuccess: () => {
      notify.success(typeForm.id ? 'Leave type updated' : 'Leave type created');
      setTypeForm({ id: '', name: '', totalDays: 0 });
      queryClient.invalidateQueries({ queryKey: ['leave-types'] });
    },
    onError: (error: any) => notify.error('Unable to save leave type', error?.response?.data?.error?.message ?? error.message ?? 'Please try again.'),
  });

  const defineMutation = useMutation({
    mutationFn: () => {
      if (!defineForm.leaveTypeId) throw new Error('Leave type is required.');
      return defineForm.id
        ? updateLeaveDefine(defineForm.id, { roleName: defineForm.roleName, leaveTypeId: defineForm.leaveTypeId, days: Number(defineForm.days) })
        : createLeaveDefine({ roleName: defineForm.roleName, leaveTypeId: defineForm.leaveTypeId, days: Number(defineForm.days) });
    },
    onSuccess: () => {
      notify.success(defineForm.id ? 'Leave define updated' : 'Leave define created');
      setDefineForm({ id: '', roleName: 'TEACHER', leaveTypeId: '', days: 0 });
      queryClient.invalidateQueries({ queryKey: ['leave-defines'] });
      queryClient.invalidateQueries({ queryKey: ['my-leave-balances'] });
    },
    onError: (error: any) => notify.error('Unable to save leave define', error?.response?.data?.error?.message ?? error.message ?? 'Please try again.'),
  });

  const deleteTypeMutation = useMutation({
    mutationFn: deleteLeaveType,
    onSuccess: () => {
      notify.success('Leave type deleted');
      queryClient.invalidateQueries({ queryKey: ['leave-types'] });
    },
    onError: (error: any) => notify.error('Delete failed', error?.response?.data?.error?.message ?? 'Unable to delete leave type.'),
  });

  const deleteDefineMutation = useMutation({
    mutationFn: deleteLeaveDefine,
    onSuccess: () => {
      notify.success('Leave define deleted');
      queryClient.invalidateQueries({ queryKey: ['leave-defines'] });
    },
    onError: (error: any) => notify.error('Delete failed', error?.response?.data?.error?.message ?? 'Unable to delete leave define.'),
  });

  const statusMutation = useMutation({
    mutationFn: () => updateLeaveStatus(selectedId, statusForm),
    onSuccess: () => {
      notify.success('Leave status updated');
      setSelectedId('');
      queryClient.invalidateQueries({ queryKey: ['leave-applications'] });
    },
    onError: (error: any) => notify.error('Unable to update leave status', error?.response?.data?.error?.message ?? 'Please try again.'),
  });

  const deleteRequestMutation = useMutation({
    mutationFn: deleteLeaveApplication,
    onSuccess: () => {
      notify.success('Leave request deleted');
      queryClient.invalidateQueries({ queryKey: ['leave-applications'] });
    },
    onError: (error: any) => notify.error('Delete failed', error?.response?.data?.error?.message ?? 'Unable to delete leave request.'),
  });

  const openDetail = (id: string) => {
    const item = requests.find((request) => request.id === id);
    setStatusForm({ status: item?.status ?? 'PENDING', note: item?.reviewNote ?? '' });
    setSelectedId(id);
  };

  if (sessionLoading || !session?.role) return <FullPageLoader label="Checking leave access..." />;
  if (!canUseLeaveManagement) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm font-semibold text-amber-800">
        Leave management is not enabled for your role. Ask a School Admin to update Role Permissions.
      </section>
    );
  }

  const selected = detailQuery.data;

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-6 lg:px-8">
        <PageHeader
          title="Leave Management"
          subtitle="Define leave types, configure role-wise leave days, and approve staff leave requests."
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Leave' }, { label: 'Management' }]}
          actions={<button onClick={() => requestsQuery.refetch()} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700">Refresh</button>}
        />

        <div className="mb-5 flex flex-wrap gap-2">
          {([
            ['requests', 'Approve Leave Request', canViewLeaveRequests],
            ['types', 'Leave Type', canViewLeaveTypes],
            ['defines', 'Leave Define', canViewLeaveDefines],
          ] as Array<[TabKey, string, boolean]>).filter((item) => item[2]).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key as TabKey)} className={`rounded-xl px-4 py-2 text-sm font-bold shadow-sm ${tab === key ? 'bg-[var(--theme-button-bg)] text-[var(--theme-button-text)]' : 'border border-slate-200 bg-white text-slate-700'}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'types' && canViewLeaveTypes ? (
          <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">{typeForm.id ? 'Edit Leave Type' : 'Add Leave Type'}</h2>
              <div className="mt-4 space-y-3">
                <input value={typeForm.name} onChange={(event) => setTypeForm({ ...typeForm, name: event.target.value })} placeholder="Type name" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                <input type="number" value={typeForm.totalDays} onChange={(event) => setTypeForm({ ...typeForm, totalDays: Number(event.target.value) })} placeholder="Total days" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                <div className="flex justify-end gap-2">
                  {typeForm.id ? <button onClick={() => setTypeForm({ id: '', name: '', totalDays: 0 })} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold">Cancel</button> : null}
                  {(typeForm.id ? canEditLeaveTypes : canCreateLeaveTypes) ? <button onClick={() => typeMutation.mutate()} disabled={typeMutation.isPending} className="rounded-xl bg-[var(--theme-button-bg)] px-5 py-2 text-sm font-bold text-[var(--theme-button-text)] disabled:opacity-50">Save</button> : null}
                </div>
              </div>
            </section>
            <LeaveTypeTable items={types} loading={typesQuery.isLoading} canEdit={canEditLeaveTypes} canDelete={canDeleteLeaveTypes} onEdit={(item) => setTypeForm({ id: item.id, name: item.name, totalDays: item.totalDays })} onDelete={(id) => window.confirm('Delete this leave type?') && deleteTypeMutation.mutate(id)} />
          </div>
        ) : null}

        {tab === 'defines' && canViewLeaveDefines ? (
          <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">{defineForm.id ? 'Edit Leave Define' : 'Add Leave Define'}</h2>
              <div className="mt-4 space-y-3">
                <select value={defineForm.roleName} onChange={(event) => setDefineForm({ ...defineForm, roleName: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  {roles.map((role) => <option key={role} value={role}>{role.replace('_', ' ')}</option>)}
                </select>
                <select value={defineForm.leaveTypeId} onChange={(event) => setDefineForm({ ...defineForm, leaveTypeId: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  <option value="">Select leave type</option>
                  {types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
                </select>
                <input type="number" value={defineForm.days} onChange={(event) => setDefineForm({ ...defineForm, days: Number(event.target.value) })} placeholder="Days" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                <div className="flex justify-end gap-2">
                  {defineForm.id ? <button onClick={() => setDefineForm({ id: '', roleName: 'TEACHER', leaveTypeId: '', days: 0 })} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold">Cancel</button> : null}
                  {(defineForm.id ? canEditLeaveDefines : canCreateLeaveDefines) ? <button onClick={() => defineMutation.mutate()} disabled={defineMutation.isPending} className="rounded-xl bg-[var(--theme-button-bg)] px-5 py-2 text-sm font-bold text-[var(--theme-button-text)] disabled:opacity-50">Save</button> : null}
                </div>
              </div>
            </section>
            <LeaveDefineTable items={defines} loading={definesQuery.isLoading} canEdit={canEditLeaveDefines} canDelete={canDeleteLeaveDefines} onEdit={(item) => setDefineForm({ id: item.id, roleName: String(item.roleName), leaveTypeId: item.leaveTypeId, days: item.days })} onDelete={(id) => window.confirm('Delete this leave define?') && deleteDefineMutation.mutate(id)} />
          </div>
        ) : null}

        {tab === 'requests' && canViewLeaveRequests ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Staff Leave Requests</h2>
                <p className="text-sm text-slate-500">Review pending and historical staff leave applications.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => exportCsv(requests)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">Export</button>
                <button onClick={() => window.print()} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">PDF / Print</button>
              </div>
            </div>
            <div className="mb-4 grid gap-3 md:grid-cols-4">
              <input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Search name, email, staff no" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <option value="">All status</option>
                {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <select value={filters.roleName} onChange={(event) => setFilters({ ...filters, roleName: event.target.value, staffId: '' })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <option value="">All roles</option>
                {roles.map((role) => <option key={role} value={role}>{role.replace('_', ' ')}</option>)}
              </select>
              <select value={filters.staffId} onChange={(event) => setFilters({ ...filters, staffId: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <option value="">All staff</option>
                {(staffQuery.data?.items ?? []).map((staff) => <option key={staff.id} value={staff.id}>{staff.fullName ?? `${staff.firstName} ${staff.lastName}`}</option>)}
              </select>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">From</th>
                    <th className="px-4 py-3">To</th>
                    <th className="px-4 py-3">Apply date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requestsQuery.isLoading ? (
                    Array.from({ length: 6 }).map((_, index) => <tr key={index} className="animate-pulse"><td colSpan={7} className="px-4 py-4"><div className="h-4 rounded bg-slate-100" /></td></tr>)
                  ) : requests.length ? (
                    requests.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 font-semibold">{staffName(item.staff)}</td>
                        <td className="px-4 py-3">{item.leaveType?.name ?? '-'}</td>
                        <td className="px-4 py-3">{formatDate(item.fromDate)}</td>
                        <td className="px-4 py-3">{formatDate(item.toDate)}</td>
                        <td className="px-4 py-3">{formatDate(item.appliedAt)}</td>
                        <td className="px-4 py-3"><span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass[item.status]}`}>{item.status}</span></td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-2">
                            <button onClick={() => openDetail(item.id)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold">{canEditLeaveRequests ? 'View/Edit' : 'View'}</button>
                            {canDeleteLeaveRequests ? <button onClick={() => window.confirm('Delete this leave request?') && deleteRequestMutation.mutate(item.id)} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700">Delete</button> : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">No leave requests found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {selectedId ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
            <section className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-950">Leave Details</h2>
                  <p className="text-sm text-slate-500">{selected ? staffName(selected.staff) : 'Loading...'}</p>
                </div>
                <button onClick={() => setSelectedId('')} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">Close</button>
              </div>
              {detailQuery.isLoading || !selected ? (
                <div className="h-48 animate-pulse rounded-2xl bg-slate-100" />
              ) : (
                <>
                  <div className="grid gap-3 md:grid-cols-3">
                    <Info label="Leave type" value={selected.leaveType?.name} />
                    <Info label="Duration" value={`${selected.durationDays ?? selected.duration ?? 0} days`} />
                    <Info label="Status" value={selected.status} />
                    <Info label="Leave from" value={formatDate(selected.fromDate)} />
                    <Info label="Leave to" value={formatDate(selected.toDate)} />
                    <Info label="Apply date" value={formatDate(selected.appliedAt)} />
                    <Info label="Staff no" value={selected.staff?.employeeNo ?? selected.staff?.staffNo} />
                    <Info label="Role" value={String(selected.staff?.roleName ?? selected.staff?.role ?? '').replace('_', ' ')} />
                    <Info label="Email" value={selected.staff?.user?.email} />
                  </div>
                  <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase text-slate-500">Reason</p>
                    <p className="mt-1 text-sm text-slate-800">{selected.reason}</p>
                  </div>
                  {selected.balances?.length ? (
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      {selected.balances.map((balance) => (
                        <div key={balance.leaveType.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm">
                          <p className="font-bold text-slate-950">{balance.leaveType.name}</p>
                          <p className="text-slate-500">Remaining {balance.remainingDays} / {balance.totalDays}</p>
                          <p className="text-rose-600">Extra {balance.extraTakenDays}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {selected.attachments?.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {selected.attachments.map((file) => <a key={file.id} href={file.fileUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold">Attachment</a>)}
                    </div>
                  ) : null}
                  <div className="mt-5 grid gap-3 md:grid-cols-[180px_1fr]">
                    <select value={statusForm.status} onChange={(event) => setStatusForm({ ...statusForm, status: event.target.value as LeaveStatus })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                      {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                    <input value={statusForm.note} onChange={(event) => setStatusForm({ ...statusForm, note: event.target.value })} placeholder="Review note" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  </div>
                  <div className="mt-5 flex justify-end">
                    {canEditLeaveRequests ? <button onClick={() => statusMutation.mutate()} disabled={statusMutation.isPending} className="rounded-xl bg-[var(--theme-button-bg)] px-5 py-2 text-sm font-bold text-[var(--theme-button-text)] disabled:opacity-50">
                      Save Leave Status
                    </button> : null}
                  </div>
                </>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value || '-'}</p>
    </div>
  );
}

function LeaveTypeTable({ items, loading, canEdit, canDelete, onEdit, onDelete }: { items: LeaveType[]; loading: boolean; canEdit: boolean; canDelete: boolean; onEdit: (item: LeaveType) => void; onDelete: (id: string) => void }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-bold text-slate-950">Leave Type List</h2>
      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-4 py-3">Type name</th><th className="px-4 py-3">Total days</th><th className="px-4 py-3 text-right">Action</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? Array.from({ length: 4 }).map((_, index) => <tr key={index} className="animate-pulse"><td colSpan={3} className="px-4 py-4"><div className="h-4 rounded bg-slate-100" /></td></tr>) :
              items.length ? items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-semibold">{item.name}</td>
                  <td className="px-4 py-3">{item.totalDays}</td>
                  <td className="px-4 py-3 text-right">{canEdit ? <button onClick={() => onEdit(item)} className="mr-2 rounded-lg border px-3 py-1.5 text-xs font-bold">Edit</button> : null}{canDelete ? <button onClick={() => onDelete(item.id)} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700">Delete</button> : null}</td>
                </tr>
              )) : <tr><td colSpan={3} className="px-4 py-10 text-center text-slate-500">No leave types found.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LeaveDefineTable({ items, loading, canEdit, canDelete, onEdit, onDelete }: { items: LeaveDefine[]; loading: boolean; canEdit: boolean; canDelete: boolean; onEdit: (item: LeaveDefine) => void; onDelete: (id: string) => void }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-bold text-slate-950">Leave Define List</h2>
      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-4 py-3">Role</th><th className="px-4 py-3">Leave type</th><th className="px-4 py-3">Days</th><th className="px-4 py-3 text-right">Action</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? Array.from({ length: 4 }).map((_, index) => <tr key={index} className="animate-pulse"><td colSpan={4} className="px-4 py-4"><div className="h-4 rounded bg-slate-100" /></td></tr>) :
              items.length ? items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-semibold">{String(item.roleName).replace('_', ' ')}</td>
                  <td className="px-4 py-3">{item.leaveType?.name ?? '-'}</td>
                  <td className="px-4 py-3">{item.days}</td>
                  <td className="px-4 py-3 text-right">{canEdit ? <button onClick={() => onEdit(item)} className="mr-2 rounded-lg border px-3 py-1.5 text-xs font-bold">Edit</button> : null}{canDelete ? <button onClick={() => onDelete(item.id)} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700">Delete</button> : null}</td>
                </tr>
              )) : <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-500">No leave definitions found.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
