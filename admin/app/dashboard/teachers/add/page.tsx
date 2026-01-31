'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createTeacher } from '../../../../services/teacher.service';
import { listSchools } from '../../../../services/school.service';
import { getSession } from '../../../../services/auth.service';

type Step = 1 | 2 | 3 | 4 | 5;

const steps: Array<{ id: Step; title: string }> = [
  { id: 1, title: 'Profile' },
  { id: 2, title: 'Contact' },
  { id: 3, title: 'Banking' },
  { id: 4, title: 'Review' },
  { id: 5, title: 'Confirm' },
];

export default function AddTeacherPage() {
  const [step, setStep] = useState<Step>(1);
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
    branchName: '',
    panNumber: '',
  });
  const [createdTeacher, setCreatedTeacher] = useState<{ email: string; tempPassword: string } | null>(null);
  const [schoolId, setSchoolId] = useState('');
  const [stepError, setStepError] = useState('');

  const { data: session } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSuperAdmin = session?.role === 'SUPER_ADMIN';
  const effectiveSchoolId = isSuperAdmin ? schoolId : session?.schoolId ?? undefined;

  const { data: schools } = useQuery({
    queryKey: ['schools', 'all'],
    queryFn: () => listSchools({ limit: 100 }),
    enabled: isSuperAdmin,
  });

  const createMutation = useMutation({
    mutationFn: createTeacher,
    onSuccess: (result) => {
      if (result?.user?.email && result?.tempPassword) {
        setCreatedTeacher({ email: result.user.email, tempPassword: result.tempPassword });
      } else {
        setCreatedTeacher(null);
      }
      setForm({
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
        branchName: '',
        panNumber: '',
      });
    },
  });

  const summary = useMemo(
    () => ({
      profile: {
        email: form.email,
        firstName: form.firstName,
        lastName: form.lastName,
        employeeNo: form.employeeNo,
      },
      contact: {
        phone: form.phone,
        address: form.address,
      },
      banking: {
        accountHolderName: form.accountHolderName,
        accountNumber: form.accountNumber,
        ifscCode: form.ifscCode,
        accountType: form.accountType,
        bankName: form.bankName,
        branchName: form.branchName,
        panNumber: form.panNumber,
      },
    }),
    [form],
  );

  const nextStep = () => {
    let error = '';
    if (step === 1) {
      if (!form.email.trim()) error = 'Email is required.';
      else if (!form.firstName.trim()) error = 'First name is required.';
      else if (!form.lastName.trim()) error = 'Last name is required.';
    }
    if (step === 2) {
      if (!form.phone.trim()) error = 'Phone is required.';
      else if (!form.address.trim()) error = 'Address is required.';
    }
    setStepError(error);
    if (error) return;
    setStep((prev) => (prev < 5 ? ((prev + 1) as Step) : prev));
  };

  const prevStep = () => {
    setStepError('');
    setStep((prev) => (prev > 1 ? ((prev - 1) as Step) : prev));
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Add Teacher</h1>
        <p className="text-sm text-slate">Create teacher profile with contact and banking details.</p>
      </header>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <div className="flex flex-wrap items-center gap-2">
          {steps.map((item) => (
            <span
              key={item.id}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                step === item.id ? 'bg-ink text-white' : 'bg-sand text-slate'
              }`}
            >
              {item.id}. {item.title}
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        {isSuperAdmin ? (
          <div className="mb-4">
            <select
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
            >
              <option value="">Select school</option>
              {schools?.items.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name} ({school.code})
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {step === 1 ? (
          <>
            <h2 className="mt-4 text-lg font-semibold">Teacher Profile</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Email"
                className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              />
              <input
                value={form.employeeNo}
                onChange={(e) => setForm({ ...form, employeeNo: e.target.value })}
                placeholder="Employee No"
                className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              />
              <input
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                placeholder="First name"
                className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              />
              <input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                placeholder="Last name"
                className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              />
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h2 className="mt-4 text-lg font-semibold">Contact Information</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="Phone"
                className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              />
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Address"
                className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              />
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h3 className="mt-4 text-sm font-semibold text-ink">Banking Details (optional)</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <input
                value={form.accountHolderName}
                onChange={(e) => setForm({ ...form, accountHolderName: e.target.value })}
                placeholder="Account holder name"
                className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              />
              <input
                value={form.accountNumber}
                onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                placeholder="Account number"
                className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              />
              <input
                value={form.ifscCode}
                onChange={(e) => setForm({ ...form, ifscCode: e.target.value })}
                placeholder="IFSC code"
                className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              />
              <input
                value={form.accountType}
                onChange={(e) => setForm({ ...form, accountType: e.target.value })}
                placeholder="Account type"
                className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              />
              <input
                value={form.bankName}
                onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                placeholder="Bank name"
                className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              />
              <input
                value={form.branchName}
                onChange={(e) => setForm({ ...form, branchName: e.target.value })}
                placeholder="Branch name"
                className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              />
              <input
                value={form.panNumber}
                onChange={(e) => setForm({ ...form, panNumber: e.target.value })}
                placeholder="PAN number"
                className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              />
            </div>
          </>
        ) : null}

        {step === 4 ? (
          <>
            <h2 className="mt-4 text-lg font-semibold">Review</h2>
            <div className="mt-4 grid gap-4 text-sm text-slate md:grid-cols-2">
              <div className="rounded-xl border border-slate/10 p-4">
                <p className="text-xs uppercase text-slate">Profile</p>
                <p className="mt-2">Email: {summary.profile.email || '—'}</p>
                <p>Name: {summary.profile.firstName} {summary.profile.lastName}</p>
                <p>Employee No: {summary.profile.employeeNo || '—'}</p>
              </div>
              <div className="rounded-xl border border-slate/10 p-4">
                <p className="text-xs uppercase text-slate">Contact</p>
                <p className="mt-2">Phone: {summary.contact.phone || '—'}</p>
                <p>Address: {summary.contact.address || '—'}</p>
              </div>
              <div className="rounded-xl border border-slate/10 p-4 md:col-span-2">
                <p className="text-xs uppercase text-slate">Banking</p>
                <p className="mt-2">Account: {summary.banking.accountNumber || '—'}</p>
                <p>IFSC: {summary.banking.ifscCode || '—'}</p>
                <p>Bank: {summary.banking.bankName || '—'}</p>
              </div>
            </div>
          </>
        ) : null}

        {step === 5 ? (
          <>
            <h2 className="mt-4 text-lg font-semibold">Confirm</h2>
            <p className="mt-2 text-sm text-slate">Create the teacher profile and generate a temporary password.</p>
          </>
        ) : null}

        <button
          className="mt-4 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
          onClick={() => {
            if (step < 5) return nextStep();
            createMutation.mutate({
              email: form.email,
              firstName: form.firstName,
              lastName: form.lastName,
              employeeNo: form.employeeNo || null,
              phone: form.phone || null,
              address: form.address || null,
              bankDetails: {
                accountHolderName: form.accountHolderName || null,
                accountNumber: form.accountNumber || null,
                ifscCode: form.ifscCode || null,
                accountType: form.accountType || null,
                bankName: form.bankName || null,
                branchName: form.branchName || null,
                panNumber: form.panNumber || null,
              },
              schoolId: effectiveSchoolId,
            });
          }}
          disabled={createMutation.isPending || !effectiveSchoolId}
        >
          {step < 5 ? 'Save & Continue' : createMutation.isPending ? 'Creating...' : 'Create Teacher'}
        </button>

        <div className="mt-3 flex justify-between">
          {step > 1 ? (
            <button className="rounded-lg border border-slate/20 px-4 py-2 text-sm" onClick={prevStep}>
              Back
            </button>
          ) : (
            <span />
          )}
        </div>
        {stepError ? <p className="mt-3 text-sm font-semibold text-rose-600">{stepError}</p> : null}

        {createdTeacher ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
            <p className="font-semibold text-emerald-700">Teacher account created</p>
            <p className="text-emerald-700">Email: {createdTeacher.email}</p>
            <p className="text-emerald-700">Temporary Password: {createdTeacher.tempPassword}</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
