'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import FullPageLoader from '../../../../components/FullPageLoader';
import PageHeader from '../../../../components/PageHeader';
import { useNotify } from '../../../../components/NotificationProvider';
import { getSession } from '../../../../services/auth.service';
import { listLeaveDefines, listLeaveTypes } from '../../../../services/leave.service';
import {
  createDepartment,
  createDesignation,
  createStaff,
  getStaff,
  listDepartments,
  listDesignations,
  seedStaffDefaults,
  updateStaff,
  uploadStaffPhoto,
  type Department,
  type Designation,
  type StaffPayload,
  type StaffRole,
} from '../../../../services/staff.service';
import { SchoolAdminOnly } from '../_components/SchoolAdminOnly';

type Preset = {
  key: string;
  title: string;
  roleName: StaffRole;
  department: string;
  designation: string;
  basicSalary: number;
  contractType: string;
};

type IconName = 'user' | 'briefcase' | 'money' | 'calendar' | 'bank' | 'map' | 'plus' | 'trash' | 'check' | 'spark' | 'upload';

const roles: StaffRole[] = ['SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'STAFF'];

const presets: Preset[] = [
  { key: 'teacher', title: 'Teacher', roleName: 'TEACHER', department: 'Academics', designation: 'Teacher', basicSalary: 45000, contractType: 'Full Time' },
  { key: 'senior-teacher', title: 'Senior Teacher', roleName: 'TEACHER', department: 'Academics', designation: 'Senior Teacher', basicSalary: 58000, contractType: 'Full Time' },
  { key: 'librarian', title: 'Librarian', roleName: 'LIBRARIAN', department: 'Library', designation: 'Librarian', basicSalary: 32000, contractType: 'Full Time' },
  { key: 'accountant', title: 'Accountant', roleName: 'ACCOUNTANT', department: 'Accounts', designation: 'Accountant', basicSalary: 38000, contractType: 'Full Time' },
  { key: 'driver', title: 'Driver', roleName: 'STAFF', department: 'Transport', designation: 'Driver', basicSalary: 26000, contractType: 'Full Time' },
  { key: 'receptionist', title: 'Receptionist', roleName: 'STAFF', department: 'Administration', designation: 'Receptionist', basicSalary: 28000, contractType: 'Full Time' },
  { key: 'nurse', title: 'Nurse', roleName: 'STAFF', department: 'Health & Safety', designation: 'Nurse', basicSalary: 34000, contractType: 'Full Time' },
  { key: 'security', title: 'Security Guard', roleName: 'STAFF', department: 'Operations', designation: 'Security Guard', basicSalary: 24000, contractType: 'Full Time' },
];

const emptyForm: StaffPayload = {
  email: '',
  password: '',
  roleName: 'TEACHER',
  employeeNo: '',
  departmentId: '',
  designationId: '',
  firstName: '',
  lastName: '',
  fatherName: '',
  motherName: '',
  gender: '',
  dateOfBirth: '',
  dateOfJoining: '',
  phone: '',
  emergencyMobile: '',
  photoUrl: '',
  drivingLicense: '',
  currentAddress: '',
  permanentAddress: '',
  qualifications: '',
  experience: '',
  maritalStatus: '',
  bankDetails: {},
  payrollInfo: { basicSalary: 0, epfNo: '', contractType: '', paymentMode: '' },
  leaveBalances: [],
  socialLinks: [],
};

const iconPaths: Record<IconName, string> = {
  user: 'M15 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm-12 15a7 7 0 0 1 14 0',
  briefcase: 'M4 7h16v14H4V7Zm5 0V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M4 13h16',
  money: 'M12 3v18M17 7.5c-.8-1.2-2.4-2-4.2-2-2.4 0-4.3 1.2-4.3 2.8 0 4.4 9 1.8 9 6.3 0 1.7-1.9 3-4.5 3-2 0-3.8-.8-4.8-2.1',
  calendar: 'M7 3v4M17 3v4M4 9h20M5 5h18v18H5V5Z',
  bank: 'M3 10h18M5 10v10M9 10v10M15 10v10M19 10v10M4 20h20M12 3 3 8h18l-9-5Z',
  map: 'M9 18 3 21V6l6-3 6 3 6-3v15l-6 3-6-3ZM9 3v15M15 6v15',
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 16h10l1-16M9 7V4h6v3',
  check: 'm5 13 4 4L19 7',
  spark: 'M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Zm7 13 .9 3.1L23 19l-3.1.9L19 23l-.9-3.1L15 19l3.1-.9L19 15Z',
  upload: 'M12 16V4M8 8l4-4 4 4M4 16v4h16v-4',
};

function Icon({ name, className = 'h-4 w-4' }: { name: IconName; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={iconPaths[name]} />
    </svg>
  );
}

function fullName(form: StaffPayload) {
  return `${form.firstName ?? ''} ${form.lastName ?? ''}`.trim();
}

const labelForRole = (role: string) => role.replace('_', ' ');

const findByName = <T extends Department | Designation>(items: T[] | undefined, name: string) => items?.find((item) => item.name.toLowerCase() === name.toLowerCase())?.id ?? '';

const money = (value: number | string | null | undefined) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value ?? 0));

export default function AddStaffPage() {
  const notify = useNotify();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const editId = searchParams.get('id');
  const presetKey = searchParams.get('type');
  const [form, setForm] = useState<StaffPayload>(emptyForm);
  const [newDepartment, setNewDepartment] = useState('');
  const [newDesignation, setNewDesignation] = useState('');
  const [createdLogin, setCreatedLogin] = useState<{ email: string; password?: string | null } | null>(null);
  const [appliedPresetKey, setAppliedPresetKey] = useState('');

  const { data: session, isLoading: sessionLoading } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSchoolAdmin = session?.role === 'SCHOOL_ADMIN';
  const departmentsQuery = useQuery({ queryKey: ['staff-departments'], queryFn: listDepartments, enabled: isSchoolAdmin });
  const designationsQuery = useQuery({ queryKey: ['staff-designations'], queryFn: listDesignations, enabled: isSchoolAdmin });
  const leaveTypesQuery = useQuery({ queryKey: ['leave-types'], queryFn: listLeaveTypes, enabled: isSchoolAdmin });
  const leaveDefinesQuery = useQuery({ queryKey: ['leave-defines'], queryFn: listLeaveDefines, enabled: isSchoolAdmin });
  const staffQuery = useQuery({ queryKey: ['staff-detail', editId], queryFn: () => getStaff(editId!), enabled: Boolean(isSchoolAdmin && editId) });

  const leaveRows = useMemo(() => {
    const defines = (leaveDefinesQuery.data ?? []).filter((item) => item.roleName === form.roleName);
    return (leaveTypesQuery.data ?? []).map((type) => {
      const saved = form.leaveBalances?.find((item) => item.leaveTypeId === type.id);
      const define = defines.find((item) => item.leaveTypeId === type.id);
      return {
        leaveTypeId: type.id,
        name: type.name,
        totalDays: Number(saved?.totalDays ?? define?.days ?? type.totalDays ?? 0),
      };
    });
  }, [form.leaveBalances, form.roleName, leaveDefinesQuery.data, leaveTypesQuery.data]);

  const selectedDepartment = departmentsQuery.data?.find((item) => item.id === form.departmentId);
  const selectedDesignation = designationsQuery.data?.find((item) => item.id === form.designationId);
  const profileName = fullName(form) || 'New employee';
  const baseSalary = Number(form.payrollInfo?.basicSalary ?? 0);
  const hasHrSetup = Boolean((departmentsQuery.data?.length ?? 0) && (designationsQuery.data?.length ?? 0) && (leaveTypesQuery.data?.length ?? 0));

  useEffect(() => {
    if (!staffQuery.data) return;
    const staff = staffQuery.data;
    setForm({
      email: staff.user?.email ?? '',
      password: '',
      roleName: (staff.role as StaffRole) ?? (staff.roleName as StaffRole) ?? 'TEACHER',
      employeeNo: staff.employeeNo ?? '',
      departmentId: staff.department?.id ?? '',
      designationId: staff.designation?.id ?? '',
      firstName: staff.firstName ?? '',
      lastName: staff.lastName ?? '',
      fatherName: staff.fatherName ?? '',
      motherName: staff.motherName ?? '',
      gender: staff.gender ?? '',
      dateOfBirth: staff.dateOfBirth?.slice(0, 10) ?? '',
      dateOfJoining: staff.dateOfJoining?.slice(0, 10) ?? '',
      phone: staff.phone ?? '',
      emergencyMobile: staff.emergencyMobile ?? '',
      photoUrl: staff.photoUrl ?? '',
      drivingLicense: staff.drivingLicense ?? '',
      currentAddress: staff.currentAddress ?? '',
      permanentAddress: staff.permanentAddress ?? '',
      qualifications: staff.qualifications ?? '',
      experience: staff.experience ?? '',
      maritalStatus: staff.maritalStatus ?? '',
      bankDetails: staff.bankInfo ?? staff.bankDetails ?? {},
      payrollInfo: {
        epfNo: staff.payrollInfo?.epfNo ?? '',
        basicSalary: Number(staff.payrollInfo?.basicSalary ?? 0),
        contractType: staff.payrollInfo?.contractType ?? '',
        paymentMode: staff.payrollInfo?.paymentMode ?? '',
      },
      leaveBalances: staff.leaveBalances?.map((balance) => ({ leaveTypeId: balance.leaveTypeId, totalDays: Number(balance.totalDays ?? 0) })) ?? [],
      socialLinks: staff.socialLinks?.map((link) => ({ platform: link.platform, url: link.url })) ?? [],
    });
  }, [staffQuery.data]);

  const setupMutation = useMutation({
    mutationFn: seedStaffDefaults,
    onSuccess: () => {
      notify.success('HR setup ready', 'Default departments, designations, and leave rules were prepared.');
      queryClient.invalidateQueries({ queryKey: ['staff-departments'] });
      queryClient.invalidateQueries({ queryKey: ['staff-designations'] });
      queryClient.invalidateQueries({ queryKey: ['leave-types'] });
      queryClient.invalidateQueries({ queryKey: ['leave-defines'] });
    },
    onError: (error: any) => notify.error('Setup failed', error?.response?.data?.error?.message ?? 'Unable to prepare staff setup.'),
  });

  const addDepartmentMutation = useMutation({
    mutationFn: () => createDepartment({ name: newDepartment.trim() }),
    onSuccess: (item) => {
      setForm((current) => ({ ...current, departmentId: item.id }));
      setNewDepartment('');
      queryClient.invalidateQueries({ queryKey: ['staff-departments'] });
    },
    onError: (error: any) => notify.error('Department failed', error?.response?.data?.error?.message ?? 'Unable to add department.'),
  });

  const addDesignationMutation = useMutation({
    mutationFn: () => createDesignation({ name: newDesignation.trim() }),
    onSuccess: (item) => {
      setForm((current) => ({ ...current, designationId: item.id }));
      setNewDesignation('');
      queryClient.invalidateQueries({ queryKey: ['staff-designations'] });
    },
    onError: (error: any) => notify.error('Designation failed', error?.response?.data?.error?.message ?? 'Unable to add designation.'),
  });

  const validate = () => {
    if (!form.email.trim()) return 'Email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Enter a valid email.';
    if (form.password && form.password.length < 8) return 'Password must be at least 8 characters.';
    if (!form.firstName.trim()) return 'First name is required.';
    if (!form.lastName.trim()) return 'Last name is required.';
    if (!form.roleName) return 'Login role is required.';
    if (!form.designationId) return 'Designation is required.';
    if (!form.departmentId) return 'Department is required.';
    if (baseSalary < 0) return 'Salary cannot be negative.';
    return '';
  };

  const buildPayload = (): StaffPayload => {
    const payload: StaffPayload = {
      ...form,
      password: form.password?.trim() || undefined,
      leaveBalances: leaveRows.length ? leaveRows.map((row) => ({ leaveTypeId: row.leaveTypeId, totalDays: Number(row.totalDays || 0) })) : undefined,
      payrollInfo: {
        epfNo: form.payrollInfo?.epfNo ?? '',
        basicSalary: Number(form.payrollInfo?.basicSalary ?? 0),
        contractType: form.payrollInfo?.contractType ?? '',
        paymentMode: form.payrollInfo?.paymentMode ?? '',
      },
      socialLinks: (form.socialLinks ?? []).filter((item) => item.platform.trim() && item.url.trim()),
    };
    if (editId) delete payload.password;
    return payload;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const error = validate();
      if (error) throw new Error(error);
      const payload = buildPayload();
      return editId ? updateStaff(editId, payload) : createStaff(payload);
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['staff-detail'] });
      if (result?.tempPassword || !editId) {
        setCreatedLogin({ email: result?.staff?.user?.email ?? form.email, password: result?.tempPassword ?? null });
      }
      notify.success(editId ? 'Employee updated' : 'Employee created', 'Profile, login, payroll, and leave details were saved.');
      if (editId) router.push(`/dashboard/staff/${editId}`);
    },
    onError: (error: any) => notify.error('Save failed', error?.response?.data?.error?.message ?? error.message ?? 'Unable to save employee.'),
  });

  const uploadPhoto = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 3 * 1024 * 1024) {
      notify.error('Invalid photo', 'Upload an image under 3 MB.');
      return;
    }
    const uploaded = await uploadStaffPhoto(file);
    setForm((current) => ({ ...current, photoUrl: uploaded.url }));
  };

  const applyPreset = (preset: Preset) => {
    const departmentId = findByName(departmentsQuery.data, preset.department);
    const designationId = findByName(designationsQuery.data, preset.designation);
    setForm((current) => ({
      ...current,
      roleName: preset.roleName,
      departmentId: departmentId || current.departmentId,
      designationId: designationId || current.designationId,
      payrollInfo: { ...current.payrollInfo, basicSalary: preset.basicSalary, contractType: preset.contractType, paymentMode: current.payrollInfo?.paymentMode || 'Bank Transfer' },
    }));
    if (!departmentId || !designationId) notify.info('Preset selected', 'Use Load HR Presets once to create missing departments and designations.');
  };

  useEffect(() => {
    if (editId || !presetKey || appliedPresetKey === presetKey) return;
    const preset = presets.find((item) => item.key === presetKey);
    if (!preset) return;
    applyPreset(preset);
    setAppliedPresetKey(presetKey);
  }, [appliedPresetKey, departmentsQuery.data, designationsQuery.data, editId, presetKey]);

  const setLeaveDays = (leaveTypeId: string, totalDays: number) => {
    setForm((current) => {
      const others = (current.leaveBalances ?? []).filter((item) => item.leaveTypeId !== leaveTypeId);
      return { ...current, leaveBalances: [...others, { leaveTypeId, totalDays }] };
    });
  };

  const addSocialLink = () => setForm((current) => ({ ...current, socialLinks: [...(current.socialLinks ?? []), { platform: '', url: '' }] }));
  const updateSocialLink = (index: number, field: 'platform' | 'url', value: string) => {
    setForm((current) => ({
      ...current,
      socialLinks: (current.socialLinks ?? []).map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    }));
  };

  if (sessionLoading || !session?.role) return <FullPageLoader label="Checking staff access..." />;
  if (!isSchoolAdmin) return <SchoolAdminOnly moduleName="staff management" />;

  const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[var(--theme-button-bg)] focus:ring-4 focus:ring-violet-100';
  const labelClass = 'mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500';

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-6 lg:px-8">
        <PageHeader
          title={editId ? 'Edit Employee' : 'Add Employee'}
          subtitle="Create staff records with login access, designation, salary, leave, bank, and profile details."
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Staff', href: '/dashboard/staff' }, { label: editId ? 'Edit' : 'Add' }]}
          actions={
            <button
              type="button"
              onClick={() => setupMutation.mutate()}
              disabled={setupMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-4 py-2 text-sm font-bold text-violet-700 shadow-sm disabled:opacity-50"
            >
              <Icon name="spark" />
              Load HR Presets
            </button>
          }
        />

        <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="space-y-5">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="h-28 bg-gradient-to-br from-slate-950 via-violet-700 to-cyan-500" />
              <div className="-mt-14 px-5 pb-5">
                <div className="grid h-28 w-28 place-items-center overflow-hidden rounded-2xl border-4 border-white bg-violet-100 text-3xl font-black text-violet-700 shadow-lg">
                  {form.photoUrl ? <img src={form.photoUrl} alt={profileName} className="h-full w-full object-cover" /> : profileName.slice(0, 2).toUpperCase()}
                </div>
                <h2 className="mt-4 text-xl font-black text-slate-950">{profileName}</h2>
                <p className="text-sm font-semibold text-slate-500">{selectedDesignation?.name ?? labelForRole(form.roleName)}</p>
                <label className="mt-4 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm font-bold text-slate-700">
                  <Icon name="upload" />
                  Upload Photo
                  <input type="file" accept="image/*" className="hidden" onChange={(event) => uploadPhoto(event.target.files?.[0])} />
                </label>
                {createdLogin ? (
                  <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                    <p className="font-bold">Login created</p>
                    <p className="mt-1 font-mono text-xs">{createdLogin.email}</p>
                    <p className="mt-1 font-mono text-xs">{createdLogin.password ? `Password: ${createdLogin.password}` : 'Password: chosen by admin'}</p>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">Employee Summary</h3>
              <div className="mt-4 space-y-3 text-sm">
                <SummaryRow label="Login role" value={labelForRole(form.roleName)} />
                <SummaryRow label="Department" value={selectedDepartment?.name ?? '-'} />
                <SummaryRow label="Designation" value={selectedDesignation?.name ?? '-'} />
                <SummaryRow label="Salary" value={money(baseSalary)} />
                <SummaryRow label="Leave types" value={leaveRows.length ? String(leaveRows.length) : hasHrSetup ? '0' : 'Run presets'} />
              </div>
            </section>
          </aside>

          <section className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-black text-slate-950"><Icon name="briefcase" /> Employee Type</h2>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{labelForRole(form.roleName)} login</span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {presets.map((preset) => {
                  const active = preset.roleName === form.roleName && selectedDesignation?.name?.toLowerCase() === preset.designation.toLowerCase();
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className={`rounded-2xl border p-4 text-left transition ${active ? 'border-violet-300 bg-violet-50 shadow-sm' : 'border-slate-200 bg-white hover:border-violet-200 hover:bg-slate-50'}`}
                    >
                      <p className="text-sm font-black text-slate-950">{preset.title}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{labelForRole(preset.roleName)} login</p>
                      <p className="mt-3 text-xs text-slate-500">{preset.department} / {preset.designation}</p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-black text-slate-950"><Icon name="user" /> Login & Personal Details</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Field label="Login Role" labelClass={labelClass}>
                  <select className={inputClass} value={form.roleName} onChange={(event) => setForm({ ...form, roleName: event.target.value as StaffRole, leaveBalances: [] })}>
                    {roles.map((role) => <option key={role} value={role}>{labelForRole(role)}</option>)}
                  </select>
                </Field>
                <Field label="Employee No (Auto)" labelClass={labelClass}>
                  <input className={inputClass} value={form.employeeNo ?? ''} onChange={(event) => setForm({ ...form, employeeNo: event.target.value })} placeholder="Auto generated if empty" />
                </Field>
                <Field label="Email" labelClass={labelClass}>
                  <input className={inputClass} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="name@school.com" />
                </Field>
                {!editId ? (
                  <Field label="Password" labelClass={labelClass}>
                    <input className={inputClass} type="password" value={form.password ?? ''} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Leave empty to auto-generate" />
                  </Field>
                ) : null}
                <Field label="First Name" labelClass={labelClass}>
                  <input className={inputClass} value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} />
                </Field>
                <Field label="Last Name" labelClass={labelClass}>
                  <input className={inputClass} value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} />
                </Field>
                <Field label="Gender" labelClass={labelClass}>
                  <select className={inputClass} value={form.gender ?? ''} onChange={(event) => setForm({ ...form, gender: event.target.value })}>
                    <option value="">Select gender</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </Field>
                <Field label="Date of Birth" labelClass={labelClass}>
                  <input className={inputClass} type="date" value={form.dateOfBirth ?? ''} onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })} />
                </Field>
                <Field label="Date of Joining" labelClass={labelClass}>
                  <input className={inputClass} type="date" value={form.dateOfJoining ?? ''} onChange={(event) => setForm({ ...form, dateOfJoining: event.target.value })} />
                </Field>
                <Field label="Father Name" labelClass={labelClass}>
                  <input className={inputClass} value={form.fatherName ?? ''} onChange={(event) => setForm({ ...form, fatherName: event.target.value })} />
                </Field>
                <Field label="Mother Name" labelClass={labelClass}>
                  <input className={inputClass} value={form.motherName ?? ''} onChange={(event) => setForm({ ...form, motherName: event.target.value })} />
                </Field>
                <Field label="Marital Status" labelClass={labelClass}>
                  <select className={inputClass} value={form.maritalStatus ?? ''} onChange={(event) => setForm({ ...form, maritalStatus: event.target.value })}>
                    <option value="">Select status</option>
                    <option>Single</option>
                    <option>Married</option>
                    <option>Other</option>
                  </select>
                </Field>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-black text-slate-950"><Icon name="briefcase" /> Employment</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="Department" labelClass={labelClass}>
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <select className={inputClass} value={form.departmentId ?? ''} onChange={(event) => setForm({ ...form, departmentId: event.target.value })}>
                      <option value="">Select department</option>
                      {(departmentsQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                    <button type="button" onClick={() => newDepartment.trim() && addDepartmentMutation.mutate()} className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700" title="Add department">
                      <Icon name="plus" />
                    </button>
                  </div>
                  <input className={`${inputClass} mt-2`} placeholder="New department" value={newDepartment} onChange={(event) => setNewDepartment(event.target.value)} />
                </Field>
                <Field label="Designation" labelClass={labelClass}>
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <select className={inputClass} value={form.designationId ?? ''} onChange={(event) => setForm({ ...form, designationId: event.target.value })}>
                      <option value="">Select designation</option>
                      {(designationsQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                    <button type="button" onClick={() => newDesignation.trim() && addDesignationMutation.mutate()} className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700" title="Add designation">
                      <Icon name="plus" />
                    </button>
                  </div>
                  <input className={`${inputClass} mt-2`} placeholder="New designation" value={newDesignation} onChange={(event) => setNewDesignation(event.target.value)} />
                </Field>
                <Field label="Qualification" labelClass={labelClass}>
                  <input className={inputClass} value={form.qualifications ?? ''} onChange={(event) => setForm({ ...form, qualifications: event.target.value })} placeholder="B.Ed, M.Sc Mathematics" />
                </Field>
                <Field label="Experience" labelClass={labelClass}>
                  <input className={inputClass} value={form.experience ?? ''} onChange={(event) => setForm({ ...form, experience: event.target.value })} placeholder="8 years" />
                </Field>
                <Field label="Driving License" labelClass={labelClass}>
                  <input className={inputClass} value={form.drivingLicense ?? ''} onChange={(event) => setForm({ ...form, drivingLicense: event.target.value })} placeholder="Required for driver profile" />
                </Field>
                <Field label="Emergency Mobile" labelClass={labelClass}>
                  <input className={inputClass} value={form.emergencyMobile ?? ''} onChange={(event) => setForm({ ...form, emergencyMobile: event.target.value })} />
                </Field>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-black text-slate-950"><Icon name="money" /> Salary & Payroll</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-4">
                <Field label="Basic Salary" labelClass={labelClass}>
                  <input className={inputClass} type="number" min={0} value={form.payrollInfo?.basicSalary ?? 0} onChange={(event) => setForm({ ...form, payrollInfo: { ...form.payrollInfo, basicSalary: Number(event.target.value) } })} />
                </Field>
                <Field label="EPF No" labelClass={labelClass}>
                  <input className={inputClass} value={form.payrollInfo?.epfNo ?? ''} onChange={(event) => setForm({ ...form, payrollInfo: { ...form.payrollInfo, epfNo: event.target.value } })} />
                </Field>
                <Field label="Contract Type" labelClass={labelClass}>
                  <select className={inputClass} value={form.payrollInfo?.contractType ?? ''} onChange={(event) => setForm({ ...form, payrollInfo: { ...form.payrollInfo, contractType: event.target.value } })}>
                    <option value="">Select type</option>
                    <option>Full Time</option>
                    <option>Part Time</option>
                    <option>Contract</option>
                    <option>Temporary</option>
                  </select>
                </Field>
                <Field label="Payment Mode" labelClass={labelClass}>
                  <select className={inputClass} value={form.payrollInfo?.paymentMode ?? ''} onChange={(event) => setForm({ ...form, payrollInfo: { ...form.payrollInfo, paymentMode: event.target.value } })}>
                    <option value="">Select mode</option>
                    <option>Bank Transfer</option>
                    <option>Cash</option>
                    <option>Cheque</option>
                    <option>UPI</option>
                  </select>
                </Field>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <Metric label="Monthly Basic" value={money(baseSalary)} />
                <Metric label="Annual Basic" value={money(baseSalary * 12)} />
                <Metric label="Payroll Status" value={baseSalary ? 'Ready' : 'Salary pending'} />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-black text-slate-950"><Icon name="calendar" /> Leave Opening Balance</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {leaveRows.length ? leaveRows.map((row) => (
                  <label key={row.leaveTypeId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <span className="block text-sm font-black text-slate-950">{row.name}</span>
                    <input
                      className={`${inputClass} mt-3 bg-white`}
                      type="number"
                      min={0}
                      max={365}
                      value={row.totalDays}
                      onChange={(event) => setLeaveDays(row.leaveTypeId, Number(event.target.value))}
                    />
                  </label>
                )) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-500 md:col-span-2 xl:col-span-4">
                    No leave types found.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-black text-slate-950"><Icon name="bank" /> Bank Details</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {[
                  ['accountHolderName', 'Account Holder'],
                  ['accountNumber', 'Account Number'],
                  ['ifscCode', 'IFSC Code'],
                  ['accountType', 'Account Type'],
                  ['bankName', 'Bank Name'],
                  ['branchName', 'Branch Name'],
                  ['panNumber', 'PAN Number'],
                ].map(([key, label]) => (
                  <Field key={key} label={label} labelClass={labelClass}>
                    <input className={inputClass} value={String(form.bankDetails?.[key] ?? '')} onChange={(event) => setForm({ ...form, bankDetails: { ...form.bankDetails, [key]: event.target.value } })} />
                  </Field>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-black text-slate-950"><Icon name="map" /> Contact, Address & Social</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="Mobile" labelClass={labelClass}>
                  <input className={inputClass} value={form.phone ?? ''} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
                </Field>
                <Field label="Photo URL" labelClass={labelClass}>
                  <input className={inputClass} value={form.photoUrl ?? ''} onChange={(event) => setForm({ ...form, photoUrl: event.target.value })} />
                </Field>
                <Field label="Current Address" labelClass={labelClass} className="md:col-span-2">
                  <textarea className={inputClass} rows={3} value={form.currentAddress ?? ''} onChange={(event) => setForm({ ...form, currentAddress: event.target.value })} />
                </Field>
                <Field label="Permanent Address" labelClass={labelClass} className="md:col-span-2">
                  <textarea className={inputClass} rows={3} value={form.permanentAddress ?? ''} onChange={(event) => setForm({ ...form, permanentAddress: event.target.value })} />
                </Field>
              </div>
              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">Social Links</h3>
                  <button type="button" onClick={addSocialLink} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700">
                    <Icon name="plus" />
                    Add
                  </button>
                </div>
                {(form.socialLinks ?? []).map((link, index) => (
                  <div key={index} className="grid gap-2 md:grid-cols-[180px_1fr_auto]">
                    <input className={inputClass} value={link.platform} onChange={(event) => updateSocialLink(index, 'platform', event.target.value)} placeholder="Platform" />
                    <input className={inputClass} value={link.url} onChange={(event) => updateSocialLink(index, 'url', event.target.value)} placeholder="https://..." />
                    <button type="button" onClick={() => setForm((current) => ({ ...current, socialLinks: (current.socialLinks ?? []).filter((_, itemIndex) => itemIndex !== index) }))} className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-3 text-rose-700" title="Remove social link">
                      <Icon name="trash" />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <div className="flex flex-wrap justify-end gap-2">
              <Link href="/dashboard/staff" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700">Cancel</Link>
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--theme-button-bg)] px-5 py-2 text-sm font-black text-[var(--theme-button-text)] shadow-lg shadow-violet-200 disabled:opacity-50"
              >
                <Icon name="check" />
                {editId ? 'Update Employee' : 'Create Employee Login'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Field({ label, labelClass, className = '', children }: { label: string; labelClass: string; className?: string; children: ReactNode }) {
  return (
    <label className={className}>
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-bold text-slate-900">{value}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}
