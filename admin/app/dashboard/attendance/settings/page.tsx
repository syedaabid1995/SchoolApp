'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../../../components/PageHeader';
import Button from '../../../../components/Button';
import { useNotify } from '../../../../components/NotificationProvider';
import { listAcademicYears, listClasses, listSections } from '../../../../services/academic.service';
import { getSession } from '../../../../services/auth.service';
import {
  bulkApplyAttendanceConfigurations,
  createAttendanceConfiguration,
  deactivateAttendanceConfiguration,
  listAttendanceConfigurations,
  updateAttendanceConfiguration,
  type AttendanceConfiguration,
  type AttendanceConfigurationInput,
  type AttendanceConfigurationScope,
  type AttendanceMode,
} from '../../../../services/attendanceV2.service';
import {
  createStaffAttendanceConfiguration,
  deactivateStaffAttendanceConfiguration,
  listStaffAttendanceConfigurations,
  updateStaffAttendanceConfiguration,
  type StaffAttendanceConfiguration,
  type StaffAttendanceMode,
  type StaffRole,
} from '../../../../services/staff.service';

type Draft = AttendanceConfigurationInput & { id?: string };
type StaffDraft = {
  id?: string;
  roleName: StaffRole | '';
  mode: StaffAttendanceMode;
  effectiveFrom: string;
  effectiveTo: string;
  isActive: boolean;
};
type SectionOption = { id: string; name: string; classId?: string | null; classSections?: Array<{ classId: string }> };

const modes: AttendanceMode[] = ['DAILY', 'TWICE_DAILY', 'PERIOD_WISE'];
const staffRoles: Array<{ value: StaffRole | ''; label: string }> = [
  { value: '', label: 'All Employees' },
  { value: 'TEACHER', label: 'Teachers' },
  { value: 'STAFF', label: 'Staff' },
  { value: 'SCHOOL_ADMIN', label: 'School Admins' },
  { value: 'ACCOUNTANT', label: 'Accountants' },
  { value: 'LIBRARIAN', label: 'Librarians' },
];
const scopes: AttendanceConfigurationScope[] = ['SCHOOL', 'ACADEMIC_YEAR', 'CLASS', 'SECTION'];
const hierarchy = ['Section', 'Class', 'Academic Year', 'School'];

const emptyDraft = (): Draft => ({
  scope: 'SCHOOL',
  mode: 'DAILY',
  academicYearId: '',
  classId: '',
  sectionId: '',
  effectiveFrom: new Date().toISOString().slice(0, 10),
  effectiveTo: '',
  isActive: true,
});

const emptyStaffDraft = (): StaffDraft => ({
  roleName: '',
  mode: 'DAILY',
  effectiveFrom: new Date().toISOString().slice(0, 10),
  effectiveTo: '',
  isActive: true,
});

const errorMessage = (error: any, fallback: string) =>
  error?.response?.data?.error?.message ?? error?.response?.data?.message ?? fallback;

const scopeLabel = (config: AttendanceConfiguration) => {
  if (config.scope === 'SECTION') {
    const className = config.class?.name ?? config.classId ?? 'Class';
    const sectionName = config.section?.name ?? config.sectionId ?? 'Section';
    return `${className} - ${sectionName}`;
  }
  if (config.scope === 'CLASS') return config.class?.name ?? config.classId ?? 'Class';
  if (config.scope === 'ACADEMIC_YEAR') return config.academicYear?.name ?? config.academicYearId ?? 'Academic Year';
  return 'School Default';
};

const cleanDraft = (draft: Draft, schoolId?: string): AttendanceConfigurationInput => ({
  schoolId,
  scope: draft.scope,
  mode: draft.mode,
  academicYearId: draft.scope === 'SCHOOL' ? null : draft.academicYearId || null,
  classId: draft.scope === 'CLASS' || draft.scope === 'SECTION' ? draft.classId || null : null,
  sectionId: draft.scope === 'SECTION' ? draft.sectionId || null : null,
  effectiveFrom: draft.effectiveFrom,
  effectiveTo: draft.effectiveTo || null,
  isActive: draft.isActive ?? true,
});

const validateDraft = (draft: Draft) => {
  if (!draft.effectiveFrom) return 'Effective From is required.';
  if (draft.effectiveTo && draft.effectiveTo < draft.effectiveFrom) return 'Effective To cannot be earlier than Effective From.';
  if (draft.scope !== 'SCHOOL' && !draft.academicYearId) return 'Academic Year is required for this scope.';
  if ((draft.scope === 'CLASS' || draft.scope === 'SECTION') && !draft.classId) return 'Class is required for this scope.';
  if (draft.scope === 'SECTION' && !draft.sectionId) return 'Section is required for section scope.';
  return '';
};

const sectionsForClass = (sections: SectionOption[] | undefined, classId: string) =>
  (sections ?? []).filter((section) =>
    classId ? section.classId === classId || section.classSections?.some((link) => link.classId === classId) : true,
  );

export default function AttendanceSettingsPage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [activeAudience, setActiveAudience] = useState<'students' | 'employees'>('students');
  const [staffDraft, setStaffDraft] = useState<StaffDraft>(emptyStaffDraft());
  const [editingId, setEditingId] = useState('');
  const [editingStaffId, setEditingStaffId] = useState('');
  const [applyToAllMappedSections, setApplyToAllMappedSections] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(false);

  const { data: session } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const schoolId = session?.schoolId ?? undefined;
  const isSuperAdmin = session?.role === 'SUPER_ADMIN';
  const isSchoolAdmin = session?.role === 'SCHOOL_ADMIN';
  const permissionCodes = session?.permissionCodes ?? [];
  const hasPermission = (code: string) => isSchoolAdmin || permissionCodes.includes(code);
  const canView = isSuperAdmin || hasPermission('attendance.view') || hasPermission('attendance.edit');
  const canManage = !isSuperAdmin && hasPermission('attendance.edit');

  const configsQuery = useQuery({
    queryKey: ['attendance-configurations', schoolId],
    queryFn: () => listAttendanceConfigurations({ schoolId }),
    enabled: canView,
    retry: false,
  });
  const staffConfigsQuery = useQuery({
    queryKey: ['staff-attendance-configurations', schoolId],
    queryFn: () => listStaffAttendanceConfigurations(),
    enabled: canView,
    retry: false,
  });
  const { data: years } = useQuery({ queryKey: ['academic-years', schoolId], queryFn: () => listAcademicYears({ schoolId }), enabled: canView && Boolean(schoolId) });
  const { data: classes } = useQuery({ queryKey: ['classes', schoolId], queryFn: () => listClasses({ schoolId }), enabled: canView && Boolean(schoolId) });
  const { data: sections } = useQuery({ queryKey: ['sections', schoolId], queryFn: () => listSections({ schoolId }), enabled: canView && Boolean(schoolId) });

  const sectionOptions = useMemo(() => sectionsForClass(sections, draft.classId ?? ''), [sections, draft.classId]);
  const changeDraftClass = (classId: string) => {
    const options = sectionsForClass(sections, classId);
    const sectionStillValid = Boolean(draft.sectionId && options.some((section) => section.id === draft.sectionId));
    setDraft({ ...draft, classId, sectionId: sectionStillValid ? draft.sectionId : '' });
  };
  const sortedConfigs = useMemo(
    () =>
      [...(configsQuery.data ?? [])].sort((a, b) => {
        const order: Record<AttendanceConfigurationScope, number> = { SECTION: 1, CLASS: 2, ACADEMIC_YEAR: 3, SCHOOL: 4 };
        return order[a.scope] - order[b.scope] || a.effectiveFrom.localeCompare(b.effectiveFrom);
      }),
    [configsQuery.data],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const validation = validateDraft(draft);
      if (validation) throw new Error(validation);
      if (applyToAllMappedSections) {
        if (editingId) throw new Error('Bulk apply is only available when creating a new configuration.');
        if (draft.scope !== 'ACADEMIC_YEAR') throw new Error('Bulk apply requires Academic Year scope.');
        if (!draft.academicYearId) throw new Error('Academic Year is required for bulk apply.');
        return bulkApplyAttendanceConfigurations({
          schoolId,
          scope: draft.scope,
          mode: draft.mode,
          academicYearId: draft.academicYearId,
          effectiveFrom: draft.effectiveFrom,
          effectiveTo: draft.effectiveTo || null,
          replaceExisting,
        });
      }
      const payload = cleanDraft(draft, schoolId);
      if (editingId) return updateAttendanceConfiguration(editingId, payload);
      return createAttendanceConfiguration(payload);
    },
    onSuccess: (result: any) => {
      setDraft(emptyDraft());
      setEditingId('');
      setApplyToAllMappedSections(false);
      setReplaceExisting(false);
      queryClient.invalidateQueries({ queryKey: ['attendance-configurations'] });
      notify.success(
        'Configuration saved',
        typeof result?.count === 'number'
          ? `${result.count} class/section configurations were created.`
          : 'Attendance configuration was updated.',
      );
    },
    onError: (error: any) => notify.error('Unable to save configuration', errorMessage(error, error?.message ?? 'Please try again.')),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => deactivateAttendanceConfiguration(id, { schoolId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-configurations'] });
      notify.success('Configuration deactivated', 'The configuration remains in history but is no longer active.');
    },
    onError: (error: any) => notify.error('Unable to deactivate configuration', errorMessage(error, 'Please try again.')),
  });

  const staffSaveMutation = useMutation({
    mutationFn: () => {
      if (!staffDraft.effectiveFrom) throw new Error('Effective From is required.');
      if (staffDraft.effectiveTo && staffDraft.effectiveTo < staffDraft.effectiveFrom) throw new Error('Effective To cannot be earlier than Effective From.');
      const payload = {
        roleName: staffDraft.roleName || null,
        mode: staffDraft.mode,
        effectiveFrom: staffDraft.effectiveFrom,
        effectiveTo: staffDraft.effectiveTo || null,
        isActive: staffDraft.isActive,
      };
      if (editingStaffId) return updateStaffAttendanceConfiguration(editingStaffId, payload);
      return createStaffAttendanceConfiguration(payload);
    },
    onSuccess: () => {
      setStaffDraft(emptyStaffDraft());
      setEditingStaffId('');
      queryClient.invalidateQueries({ queryKey: ['staff-attendance-configurations'] });
      notify.success('Employee configuration saved', 'Employee attendance configuration history was updated.');
    },
    onError: (error: any) => notify.error('Unable to save employee configuration', errorMessage(error, error?.message ?? 'Please try again.')),
  });

  const staffDeactivateMutation = useMutation({
    mutationFn: (id: string) => deactivateStaffAttendanceConfiguration(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-attendance-configurations'] });
      notify.success('Employee configuration deactivated', 'The configuration remains in history but is no longer active.');
    },
    onError: (error: any) => notify.error('Unable to deactivate employee configuration', errorMessage(error, 'Please try again.')),
  });

  const startEdit = (config: AttendanceConfiguration) => {
    setEditingId(config.id);
    setApplyToAllMappedSections(false);
    setReplaceExisting(false);
    setDraft({
      id: config.id,
      scope: config.scope,
      mode: config.mode,
      academicYearId: config.academicYearId ?? '',
      classId: config.classId ?? '',
      sectionId: config.sectionId ?? '',
      effectiveFrom: config.effectiveFrom.slice(0, 10),
      effectiveTo: config.effectiveTo?.slice(0, 10) ?? '',
      isActive: config.isActive,
    });
  };

  const startStaffEdit = (config: StaffAttendanceConfiguration) => {
    setEditingStaffId(config.id);
    setStaffDraft({
      id: config.id,
      roleName: config.roleName ?? '',
      mode: config.mode,
      effectiveFrom: config.effectiveFrom.slice(0, 10),
      effectiveTo: config.effectiveTo?.slice(0, 10) ?? '',
      isActive: config.isActive,
    });
  };

  if (!canView) {
    return (
      <section className="rounded-xl border border-rose-100 bg-rose-50 p-8 text-center">
        <p className="text-sm font-bold uppercase tracking-wide text-rose-600">Permission not available</p>
        <h1 className="mt-2 text-2xl font-bold text-rose-950">Attendance settings are not enabled for your role.</h1>
      </section>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-6 lg:px-8">
        <PageHeader
          title="Attendance Settings"
          subtitle="Manage student and employee attendance configuration history."
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Attendance', href: '/dashboard/attendance/overview' }, { label: 'Settings' }]}
        />

        <div className="mb-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveAudience('students')}
            className={`rounded-xl px-4 py-2 text-sm font-bold ${activeAudience === 'students' ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}
          >
            Students
          </button>
          <button
            type="button"
            onClick={() => setActiveAudience('employees')}
            className={`rounded-xl px-4 py-2 text-sm font-bold ${activeAudience === 'employees' ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}
          >
            Employees
          </button>
        </div>

        {activeAudience === 'employees' ? (
          <div className="grid gap-5 lg:grid-cols-[420px_1fr]">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-slate-950">{editingStaffId ? 'Edit Employee Configuration' : 'Create Employee Configuration'}</h2>
                <p className="text-sm text-slate-500">Configure daily, twice-daily, or period-wise attendance by employee type.</p>
              </div>
              <div className="space-y-3">
                <select disabled={!canManage} value={staffDraft.roleName} onChange={(event) => setStaffDraft({ ...staffDraft, roleName: event.target.value as StaffRole | '' })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50">
                  {staffRoles.map((role) => <option key={role.value || 'ALL'} value={role.value}>{role.label}</option>)}
                </select>
                <select disabled={!canManage} value={staffDraft.mode} onChange={(event) => setStaffDraft({ ...staffDraft, mode: event.target.value as StaffAttendanceMode })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50">
                  {modes.map((mode) => <option key={mode} value={mode}>{mode.replace('_', ' ')}</option>)}
                </select>
                <input disabled={!canManage} type="date" value={staffDraft.effectiveFrom} onChange={(event) => setStaffDraft({ ...staffDraft, effectiveFrom: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50" />
                <input disabled={!canManage} type="date" value={staffDraft.effectiveTo} onChange={(event) => setStaffDraft({ ...staffDraft, effectiveTo: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50" />
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input disabled={!canManage} type="checkbox" checked={staffDraft.isActive} onChange={(event) => setStaffDraft({ ...staffDraft, isActive: event.target.checked })} />
                  Active
                </label>
                <div className="flex gap-2">
                  <Button disabled={!canManage || staffSaveMutation.isPending} onClick={() => staffSaveMutation.mutate()}>{editingStaffId ? 'Update' : 'Create'}</Button>
                  {editingStaffId ? <button type="button" onClick={() => { setEditingStaffId(''); setStaffDraft(emptyStaffDraft()); }} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700">Cancel</button> : null}
                </div>
              </div>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-slate-950">Employee Configuration History</h2>
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr><th className="px-4 py-3">Employee Type</th><th className="px-4 py-3">Mode</th><th className="px-4 py-3">Effective</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(staffConfigsQuery.data ?? []).map((config) => (
                      <tr key={config.id}>
                        <td className="px-4 py-3 font-bold">{staffRoles.find((role) => role.value === (config.roleName ?? ''))?.label ?? config.roleName ?? 'All Employees'}</td>
                        <td className="px-4 py-3">{config.mode.replace('_', ' ')}</td>
                        <td className="px-4 py-3">{config.effectiveFrom.slice(0, 10)} - {config.effectiveTo?.slice(0, 10) ?? 'Open'}</td>
                        <td className="px-4 py-3"><span className={`rounded-full px-3 py-1 text-xs font-bold ${config.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{config.isActive ? 'Active' : 'Inactive'}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button type="button" disabled={!canManage} onClick={() => startStaffEdit(config)} className="rounded-lg border border-slate-200 px-3 py-1 text-sm font-bold text-slate-600 disabled:opacity-50">Edit</button>
                            {config.isActive ? <button type="button" disabled={!canManage} onClick={() => staffDeactivateMutation.mutate(config.id)} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-sm font-bold text-rose-600 disabled:opacity-50">Deactivate</button> : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!staffConfigsQuery.data?.length ? <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No employee configurations found.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        ) : (
          <>

        <section className="mb-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">Resolution Hierarchy</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {hierarchy.map((item, index) => (
              <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Priority {index + 1}</p>
                <p className="mt-1 text-lg font-black text-slate-950">{item}</p>
                {index < hierarchy.length - 1 ? <p className="mt-2 text-xs text-slate-500">Falls back to next level when no active effective config exists.</p> : null}
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[420px_1fr]">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-950">{editingId ? 'Edit Configuration' : 'Create Configuration'}</h2>
              <p className="text-sm text-slate-500">Configurations are deactivated, not deleted, to preserve history.</p>
            </div>
            {isSuperAdmin ? (
              <p className="mb-4 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-800">Super Admin has configuration visibility only.</p>
            ) : null}
            <div className="space-y-3">
              <select disabled={!canManage} value={draft.scope} onChange={(event) => {
                setDraft({ ...draft, scope: event.target.value as AttendanceConfigurationScope, academicYearId: '', classId: '', sectionId: '' });
                setApplyToAllMappedSections(false);
                setReplaceExisting(false);
              }} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50">
                {scopes.map((scope) => <option key={scope} value={scope}>{scope.replace('_', ' ')}</option>)}
              </select>
              <select disabled={!canManage} value={draft.mode} onChange={(event) => setDraft({ ...draft, mode: event.target.value as AttendanceMode })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50">
                {modes.map((mode) => <option key={mode} value={mode}>{mode.replace('_', ' ')}</option>)}
              </select>
              {draft.scope !== 'SCHOOL' ? (
                <select disabled={!canManage} value={draft.academicYearId ?? ''} onChange={(event) => setDraft({ ...draft, academicYearId: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50">
                  <option value="">Select academic year</option>
                  {(years ?? []).map((year: { id: string; name: string }) => <option key={year.id} value={year.id}>{year.name}</option>)}
                </select>
              ) : null}
              {draft.scope === 'CLASS' || draft.scope === 'SECTION' ? (
                <select disabled={!canManage} value={draft.classId ?? ''} onChange={(event) => changeDraftClass(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50">
                  <option value="">Select class</option>
                  {(classes ?? []).map((item: { id: string; name: string }) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              ) : null}
              {draft.scope === 'SECTION' ? (
                <select disabled={!canManage} value={draft.sectionId ?? ''} onChange={(event) => setDraft({ ...draft, sectionId: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50">
                  <option value="">Select section</option>
                  {sectionOptions.map((item: { id: string; name: string }) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              ) : null}
              {draft.scope === 'ACADEMIC_YEAR' ? (
                <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <label className="flex items-start gap-2 text-sm font-semibold text-slate-700">
                    <input
                      disabled={!canManage || Boolean(editingId)}
                      type="checkbox"
                      checked={applyToAllMappedSections}
                      onChange={(event) => setApplyToAllMappedSections(event.target.checked)}
                      className="mt-1"
                    />
                    <span>
                      Apply to every mapped class/section
                      <span className="block text-xs font-normal text-slate-500">
                        Creates separate active configs for each class-section mapping in this academic year.
                      </span>
                    </span>
                  </label>
                  {applyToAllMappedSections ? (
                    <label className="flex items-start gap-2 text-sm font-semibold text-slate-700">
                      <input
                        disabled={!canManage || Boolean(editingId)}
                        type="checkbox"
                        checked={replaceExisting}
                        onChange={(event) => setReplaceExisting(event.target.checked)}
                        className="mt-1"
                      />
                      <span>
                        Replace overlapping active configs
                        <span className="block text-xs font-normal text-slate-500">
                          Deactivates old active configs for the same academic year, classes, sections, and date range.
                        </span>
                      </span>
                    </label>
                  ) : null}
                </div>
              ) : null}
              <input disabled={!canManage} type="date" value={draft.effectiveFrom} onChange={(event) => setDraft({ ...draft, effectiveFrom: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50" />
              <input disabled={!canManage} type="date" value={draft.effectiveTo ?? ''} onChange={(event) => setDraft({ ...draft, effectiveTo: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50" />
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                <input disabled={!canManage} type="checkbox" checked={draft.isActive ?? true} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} />
                Active
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="primary" size="sm" onClick={() => saveMutation.mutate()} disabled={!canManage || saveMutation.isPending} loading={saveMutation.isPending}>Save</Button>
              <Button variant="outline" size="sm" onClick={() => { setEditingId(''); setDraft(emptyDraft()); setApplyToAllMappedSections(false); setReplaceExisting(false); }}>Reset</Button>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-950">Configuration History</h2>
              <p className="text-sm text-slate-500">Active configurations are evaluated by effective date and hierarchy.</p>
            </div>
            {configsQuery.isError ? (
              <p className="mb-4 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {errorMessage(configsQuery.error, 'Unable to load configurations.')}
              </p>
            ) : null}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Scope</th>
                    <th className="px-4 py-3">Target</th>
                    <th className="px-4 py-3">Mode</th>
                    <th className="px-4 py-3">Effective</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {configsQuery.isLoading ? (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">Loading configurations...</td></tr>
                  ) : sortedConfigs.length ? (
                    sortedConfigs.map((config) => (
                      <tr key={config.id}>
                        <td className="px-4 py-3 font-bold text-slate-700">{config.scope.replace('_', ' ')}</td>
                        <td className="px-4 py-3">{scopeLabel(config)}</td>
                        <td className="px-4 py-3">{config.mode.replace('_', ' ')}</td>
                        <td className="px-4 py-3">{config.effectiveFrom.slice(0, 10)} - {config.effectiveTo?.slice(0, 10) ?? 'Open'}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full border px-2 py-1 text-xs font-bold ${config.isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                            {config.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => startEdit(config)} className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700">Edit</button>
                            <button type="button" disabled={!canManage || !config.isActive || deactivateMutation.isPending} onClick={() => deactivateMutation.mutate(config.id)} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700 disabled:opacity-50">Deactivate</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">No attendance configurations found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
          </>
        )}
      </div>
    </div>
  );
}
