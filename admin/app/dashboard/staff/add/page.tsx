'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import FullPageLoader from '../../../../components/FullPageLoader';
import PageHeader from '../../../../components/PageHeader';
import { useNotify } from '../../../../components/NotificationProvider';
import { getSession } from '../../../../services/auth.service';
import {
  createDepartment,
  createDesignation,
  createStaff,
  getStaff,
  listDepartments,
  listDesignations,
  updateStaff,
  uploadStaffPhoto,
  type StaffPayload,
  type StaffRole,
} from '../../../../services/staff.service';
import { SchoolAdminOnly } from '../_components/SchoolAdminOnly';

const roles: StaffRole[] = ['SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'STAFF'];
const emptyForm: StaffPayload = {
  email: '',
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
  socialLinks: [],
};

export default function AddStaffPage() {
  const notify = useNotify();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const editId = searchParams.get('id');
  const [form, setForm] = useState<StaffPayload>(emptyForm);
  const [newDepartment, setNewDepartment] = useState('');
  const [newDesignation, setNewDesignation] = useState('');
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);

  const { data: session, isLoading: sessionLoading } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSchoolAdmin = session?.role === 'SCHOOL_ADMIN';
  const departmentsQuery = useQuery({ queryKey: ['staff-departments'], queryFn: listDepartments, enabled: isSchoolAdmin });
  const designationsQuery = useQuery({ queryKey: ['staff-designations'], queryFn: listDesignations, enabled: isSchoolAdmin });
  const staffQuery = useQuery({ queryKey: ['staff-detail', editId], queryFn: () => getStaff(editId!), enabled: Boolean(isSchoolAdmin && editId) });

  useEffect(() => {
    if (!staffQuery.data) return;
    const staff = staffQuery.data;
    setForm({
      email: staff.user?.email ?? '',
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
      socialLinks: staff.socialLinks?.map((link) => ({ platform: link.platform, url: link.url })) ?? [],
    });
  }, [staffQuery.data]);

  const validate = () => {
    if (!form.email.trim()) return 'Email is required.';
    if (!form.firstName.trim()) return 'First name is required.';
    if (!form.lastName.trim()) return 'Last name is required.';
    if (!form.roleName) return 'Role is required.';
    return '';
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const error = validate();
      if (error) throw new Error(error);
      return editId ? updateStaff(editId, form) : createStaff(form);
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      if (result?.tempPassword) setCreatedPassword(result.tempPassword);
      notify.success(editId ? 'Staff updated' : 'Staff created', 'Staff profile saved successfully.');
      if (editId) router.push(`/dashboard/staff/${editId}`);
    },
    onError: (error: any) => notify.error('Save failed', error?.response?.data?.error?.message ?? error.message ?? 'Unable to save staff.'),
  });

  const addDepartmentMutation = useMutation({
    mutationFn: () => createDepartment({ name: newDepartment.trim() }),
    onSuccess: (item) => {
      setForm((current) => ({ ...current, departmentId: item.id }));
      setNewDepartment('');
      queryClient.invalidateQueries({ queryKey: ['staff-departments'] });
    },
  });

  const addDesignationMutation = useMutation({
    mutationFn: () => createDesignation({ name: newDesignation.trim() }),
    onSuccess: (item) => {
      setForm((current) => ({ ...current, designationId: item.id }));
      setNewDesignation('');
      queryClient.invalidateQueries({ queryKey: ['staff-designations'] });
    },
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

  if (sessionLoading || !session?.role) return <FullPageLoader label="Checking staff access..." />;
  if (!isSchoolAdmin) return <SchoolAdminOnly moduleName="staff management" />;

  const inputClass = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[var(--theme-button-bg)]';

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-8">
        <PageHeader
          title={editId ? 'Edit Staff' : 'Add Staff'}
          subtitle="Capture profile, payroll, bank, social, and document-ready staff information."
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Staff', href: '/dashboard/staff' }, { label: editId ? 'Edit' : 'Add' }]}
        />

        <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mx-auto flex h-32 w-32 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-3xl font-bold text-slate-500">
              {form.photoUrl ? <img src={form.photoUrl} alt="Staff" className="h-full w-full object-cover" /> : `${form.firstName?.[0] ?? 'S'}${form.lastName?.[0] ?? ''}`}
            </div>
            <label className="mt-4 block rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-center text-sm font-bold text-slate-600">
              Upload Photo
              <input type="file" accept="image/*" className="hidden" onChange={(event) => uploadPhoto(event.target.files?.[0])} />
            </label>
            <div className="mt-5 space-y-2 text-sm text-slate-500">
              <p>Allowed photo: image under 3 MB.</p>
              <p>Documents can be uploaded from the details page after saving.</p>
            </div>
            {createdPassword ? (
              <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                <p className="font-bold">Temporary password</p>
                <p className="font-mono">{createdPassword}</p>
              </div>
            ) : null}
          </aside>

          <section className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">Basic Info</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <input className={inputClass} placeholder="Staff no" value={form.employeeNo ?? ''} onChange={(e) => setForm({ ...form, employeeNo: e.target.value })} />
                <select className={inputClass} value={form.roleName} onChange={(e) => setForm({ ...form, roleName: e.target.value as StaffRole })}>
                  {roles.map((role) => <option key={role} value={role}>{role.replace('_', ' ')}</option>)}
                </select>
                <input className={inputClass} placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <input className={inputClass} placeholder="First name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                <input className={inputClass} placeholder="Last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                <input className={inputClass} placeholder="Mobile" value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                <input className={inputClass} placeholder="Father name" value={form.fatherName ?? ''} onChange={(e) => setForm({ ...form, fatherName: e.target.value })} />
                <input className={inputClass} placeholder="Mother name" value={form.motherName ?? ''} onChange={(e) => setForm({ ...form, motherName: e.target.value })} />
                <select className={inputClass} value={form.gender ?? ''} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                  <option value="">Gender</option><option>Male</option><option>Female</option><option>Other</option>
                </select>
                <input className={inputClass} type="date" value={form.dateOfBirth ?? ''} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
                <input className={inputClass} type="date" value={form.dateOfJoining ?? ''} onChange={(e) => setForm({ ...form, dateOfJoining: e.target.value })} />
                <input className={inputClass} placeholder="Emergency mobile" value={form.emergencyMobile ?? ''} onChange={(e) => setForm({ ...form, emergencyMobile: e.target.value })} />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">Department & Payroll</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="flex gap-2">
                  <select className={inputClass} value={form.departmentId ?? ''} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                    <option value="">Department</option>
                    {(departmentsQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  <input className={inputClass} placeholder="New dept" value={newDepartment} onChange={(e) => setNewDepartment(e.target.value)} />
                  <button type="button" onClick={() => newDepartment.trim() && addDepartmentMutation.mutate()} className="rounded-xl border px-3 text-sm font-bold">Add</button>
                </div>
                <div className="flex gap-2">
                  <select className={inputClass} value={form.designationId ?? ''} onChange={(e) => setForm({ ...form, designationId: e.target.value })}>
                    <option value="">Designation</option>
                    {(designationsQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  <input className={inputClass} placeholder="New desig." value={newDesignation} onChange={(e) => setNewDesignation(e.target.value)} />
                  <button type="button" onClick={() => newDesignation.trim() && addDesignationMutation.mutate()} className="rounded-xl border px-3 text-sm font-bold">Add</button>
                </div>
                <input className={inputClass} placeholder="EPF no" value={form.payrollInfo?.epfNo ?? ''} onChange={(e) => setForm({ ...form, payrollInfo: { ...form.payrollInfo, epfNo: e.target.value } })} />
                <input className={inputClass} type="number" placeholder="Basic salary" value={form.payrollInfo?.basicSalary ?? 0} onChange={(e) => setForm({ ...form, payrollInfo: { ...form.payrollInfo, basicSalary: Number(e.target.value) } })} />
                <input className={inputClass} placeholder="Contract type" value={form.payrollInfo?.contractType ?? ''} onChange={(e) => setForm({ ...form, payrollInfo: { ...form.payrollInfo, contractType: e.target.value } })} />
                <input className={inputClass} placeholder="Payment mode" value={form.payrollInfo?.paymentMode ?? ''} onChange={(e) => setForm({ ...form, payrollInfo: { ...form.payrollInfo, paymentMode: e.target.value } })} />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">Bank, Address & Experience</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {['accountHolderName', 'accountNumber', 'ifscCode', 'accountType', 'bankName', 'branchName', 'panNumber'].map((key) => (
                  <input key={key} className={inputClass} placeholder={key.replace(/([A-Z])/g, ' $1')} value={String(form.bankDetails?.[key] ?? '')} onChange={(e) => setForm({ ...form, bankDetails: { ...form.bankDetails, [key]: e.target.value } })} />
                ))}
                <input className={inputClass} placeholder="Driving license" value={form.drivingLicense ?? ''} onChange={(e) => setForm({ ...form, drivingLicense: e.target.value })} />
                <input className={inputClass} placeholder="Marital status" value={form.maritalStatus ?? ''} onChange={(e) => setForm({ ...form, maritalStatus: e.target.value })} />
                <input className={inputClass} placeholder="Qualifications" value={form.qualifications ?? ''} onChange={(e) => setForm({ ...form, qualifications: e.target.value })} />
                <input className={inputClass} placeholder="Experience" value={form.experience ?? ''} onChange={(e) => setForm({ ...form, experience: e.target.value })} />
                <textarea className={`${inputClass} md:col-span-3`} placeholder="Current address" value={form.currentAddress ?? ''} onChange={(e) => setForm({ ...form, currentAddress: e.target.value })} />
                <textarea className={`${inputClass} md:col-span-3`} placeholder="Permanent address" value={form.permanentAddress ?? ''} onChange={(e) => setForm({ ...form, permanentAddress: e.target.value })} />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Link href="/dashboard/staff" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold">Cancel</Link>
              <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="rounded-xl bg-[var(--theme-button-bg)] px-5 py-2 text-sm font-bold text-[var(--theme-button-text)] disabled:opacity-50">
                {editId ? 'Update Staff' : 'Save Staff'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
