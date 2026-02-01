'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'next/navigation';
import { getSession } from '../../../../services/auth.service';
import { getTeacher, updateTeacher } from '../../../../services/teacher.service';
import { useNotify } from '../../../../components/NotificationProvider';

type Step = 1 | 2 | 3 | 4 | 5;

const steps: Array<{ id: Step; title: string }> = [
  { id: 1, title: 'Profile' },
  { id: 2, title: 'Contact' },
  { id: 3, title: 'Banking' },
];

const indianBanks = [
  'State Bank of India',
  'HDFC Bank',
  'ICICI Bank',
  'Axis Bank',
  'Kotak Mahindra Bank',
  'Punjab National Bank',
  'Bank of Baroda',
  'Canara Bank',
  'Union Bank of India',
  'Bank of India',
  'Central Bank of India',
  'Indian Overseas Bank',
  'UCO Bank',
  'Indian Bank',
  'Punjab & Sind Bank',
  'IDFC First Bank',
  'Yes Bank',
  'IndusInd Bank',
  'Federal Bank',
  'South Indian Bank',
  'Karur Vysya Bank',
  'City Union Bank',
  'Tamilnad Mercantile Bank',
  'Dhanlaxmi Bank',
  'RBL Bank',
  'Bandhan Bank',
  'ESAF Small Finance Bank',
  'Equitas Small Finance Bank',
  'Jana Small Finance Bank',
  'Others',
];

export default function TeacherDetailPage() {
  const notify = useNotify();
  const params = useParams();
  const searchParams = useSearchParams();
  const teacherId = params.id as string;
  const [step, setStep] = useState<Step>(1);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    employeeNo: '',
    phone: '',
    address: '',
    accountHolderName: '',
    accountNumber: '',
    ifscCode: '',
    accountType: '',
    bankName: '',
    customBankName: '',
    branchName: '',
    panNumber: '',
  });

  const { data: session } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSuperAdmin = session?.role === 'SUPER_ADMIN';
  const schoolIdParam = searchParams.get('schoolId') ?? undefined;
  const effectiveSchoolId = isSuperAdmin ? schoolIdParam : session?.schoolId ?? undefined;

  const { data: teacher, refetch } = useQuery({
    queryKey: ['teacher', teacherId, effectiveSchoolId],
    queryFn: () => getTeacher(teacherId, effectiveSchoolId ? { schoolId: effectiveSchoolId } : undefined),
    enabled: Boolean(teacherId) && (Boolean(effectiveSchoolId) || !isSuperAdmin),
  });

  useEffect(() => {
    if (!teacher) return;
    const knownBank = teacher.bankDetails?.bankName
      ? indianBanks.includes(teacher.bankDetails.bankName)
      : true;
    const resolvedBankName = knownBank ? teacher.bankDetails?.bankName ?? '' : 'Others';
    setForm({
      email: teacher.user.email ?? '',
      firstName: teacher.firstName ?? '',
      lastName: teacher.lastName ?? '',
      employeeNo: teacher.employeeNo ?? '',
      phone: teacher.phone ?? '',
      address: teacher.address ?? '',
      accountHolderName: teacher.bankDetails?.accountHolderName ?? '',
      accountNumber: teacher.bankDetails?.accountNumber ?? '',
      ifscCode: teacher.bankDetails?.ifscCode ?? '',
      accountType: teacher.bankDetails?.accountType ?? '',
      bankName: resolvedBankName,
      customBankName: !knownBank ? teacher.bankDetails?.bankName ?? '' : '',
      branchName: teacher.bankDetails?.branchName ?? '',
      panNumber: teacher.bankDetails?.panNumber ?? '',
    });
  }, [teacher]);

  const updateMutation = useMutation({
    mutationFn: () =>
      updateTeacher(teacherId, {
        email: form.email.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        employeeNo: form.employeeNo.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        schoolId: effectiveSchoolId,
        bankDetails: {
          accountHolderName: form.accountHolderName.trim() || null,
          accountNumber: form.accountNumber.trim() || null,
          ifscCode: form.ifscCode.trim() || null,
          accountType: form.accountType.trim() || null,
          bankName: form.bankName === 'Others' ? form.customBankName.trim() || null : form.bankName.trim() || null,
          branchName: form.branchName.trim() || null,
          panNumber: form.panNumber.trim() || null,
        },
      }),
    onSuccess: () => {
      notify.success('Teacher updated', 'Changes saved successfully.');
      setIsEditing(false);
      refetch();
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error?.message || error?.message || 'Failed to update teacher';
      notify.error('Update failed', message);
    },
  });

  const nextStep = () => setStep((prev) => (prev < 3 ? ((prev + 1) as Step) : prev));
  const prevStep = () => setStep((prev) => (prev > 1 ? ((prev - 1) as Step) : prev));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Teacher Details</h1>
          <p className="text-sm text-slate">View and edit teacher profile.</p>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                className="rounded-lg border border-slate/20 px-4 py-2 text-sm"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
                onClick={() => updateMutation.mutate()}
              >
                Save changes
              </button>
            </>
          ) : (
            <button className="rounded-lg border border-slate/20 px-4 py-2 text-sm" onClick={() => setIsEditing(true)}>
              Edit
            </button>
          )}
        </div>
      </header>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <div className="flex flex-wrap items-center gap-2">
          {steps.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setStep(item.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                step === item.id ? 'bg-ink text-white' : 'bg-sand text-slate hover:bg-sand/70'
              }`}
            >
              {item.id}. {item.title}
            </button>
          ))}
        </div>
      </section>

      {step === 1 ? (
        <section className="rounded-2xl border border-slate/10 bg-white p-6">
          <h2 className="text-lg font-semibold">Profile</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Email"
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              disabled={!isEditing}
            />
            <input
              value={form.employeeNo}
              onChange={(e) => setForm({ ...form, employeeNo: e.target.value })}
              placeholder="Employee no"
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              disabled={!isEditing}
            />
            <input
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              placeholder="First name"
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              disabled={!isEditing}
            />
            <input
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              placeholder="Last name"
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              disabled={!isEditing}
            />
          </div>
          <div className="mt-4 flex justify-between">
            <button className="rounded-lg border border-slate/20 px-4 py-2 text-sm" disabled>
              Back
            </button>
            <button className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white" onClick={nextStep}>
              Save &amp; Continue
            </button>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="rounded-2xl border border-slate/10 bg-white p-6">
          <h2 className="text-lg font-semibold">Contact</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Phone"
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              disabled={!isEditing}
            />
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Address"
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              disabled={!isEditing}
            />
          </div>
          <div className="mt-4 flex justify-between">
            <button className="rounded-lg border border-slate/20 px-4 py-2 text-sm" onClick={prevStep}>
              Back
            </button>
            <button className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white" onClick={nextStep}>
              Save &amp; Continue
            </button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="rounded-2xl border border-slate/10 bg-white p-6">
          <h2 className="text-lg font-semibold">Banking Details</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input
              value={form.accountHolderName}
              onChange={(e) => setForm({ ...form, accountHolderName: e.target.value })}
              placeholder="Account holder name"
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              disabled={!isEditing}
            />
            <input
              value={form.accountNumber}
              onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
              placeholder="Account number"
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              disabled={!isEditing}
            />
            <input
              value={form.ifscCode}
              onChange={(e) => setForm({ ...form, ifscCode: e.target.value.toUpperCase() })}
              placeholder="IFSC code"
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              disabled={!isEditing}
            />
            <input
              value={form.accountType}
              onChange={(e) => setForm({ ...form, accountType: e.target.value })}
              placeholder="Account type"
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              disabled={!isEditing}
            />
            <select
              value={form.bankName}
              onChange={(e) => setForm({ ...form, bankName: e.target.value })}
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              disabled={!isEditing}
            >
              <option value="">Bank name</option>
              {indianBanks.map((bank) => (
                <option key={bank} value={bank}>
                  {bank}
                </option>
              ))}
            </select>
            {form.bankName === 'Others' ? (
              <input
                value={form.customBankName}
                onChange={(e) => setForm({ ...form, customBankName: e.target.value })}
                placeholder="Enter bank name"
                className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
                disabled={!isEditing}
              />
            ) : null}
            <input
              value={form.branchName}
              onChange={(e) => setForm({ ...form, branchName: e.target.value })}
              placeholder="Branch name"
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              disabled={!isEditing}
            />
            <input
              value={form.panNumber}
              onChange={(e) => setForm({ ...form, panNumber: e.target.value.toUpperCase() })}
              placeholder="PAN number"
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              disabled={!isEditing}
            />
          </div>
          <div className="mt-4 flex justify-between">
            <button className="rounded-lg border border-slate/20 px-4 py-2 text-sm" onClick={prevStep}>
              Back
            </button>
            <button className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white" onClick={nextStep}>
              Save &amp; Continue
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
