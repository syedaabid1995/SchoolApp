'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createTeacher } from '../../../../services/teacher.service';
import { listSchools } from '../../../../services/school.service';
import { getSession } from '../../../../services/auth.service';
import { useNotify } from '../../../../components/NotificationProvider';

const toTitleCase = (str: string) => {
  return str.replace(/\w\S*/g, (txt) => 
    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
};

const toUpperCase = (str: string) => str.toUpperCase();

type Step = 1 | 2 | 3 | 4 | 5;

const steps: Array<{ id: Step; title: string }> = [
  { id: 1, title: 'Profile' },
  { id: 2, title: 'Contact' },
  { id: 3, title: 'Banking' },
  { id: 4, title: 'Review' },
  { id: 5, title: 'Confirm' },
];

const indianBanks = [
  'State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra Bank',
  'Punjab National Bank', 'Bank of Baroda', 'Canara Bank', 'Union Bank of India',
  'Bank of India', 'Central Bank of India', 'Indian Overseas Bank', 'UCO Bank',
  'Indian Bank', 'Punjab & Sind Bank', 'IDFC First Bank', 'Yes Bank', 'IndusInd Bank',
  'Federal Bank', 'South Indian Bank', 'Karur Vysya Bank', 'City Union Bank',
  'Tamilnad Mercantile Bank', 'Dhanlaxmi Bank', 'RBL Bank', 'Bandhan Bank',
  'ESAF Small Finance Bank', 'Equitas Small Finance Bank', 'Jana Small Finance Bank',
  'Others'
];

export default function AddTeacherPage() {
  const notify = useNotify();
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
    customBankName: '',
    branchName: '',
    panNumber: '',
  });
  const [createdTeacher, setCreatedTeacher] = useState<{ email: string; tempPassword: string } | null>(null);
  const [schoolId, setSchoolId] = useState('');
  const [stepError, setStepError] = useState('');
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
        notify.success('Teacher created successfully!', `Account created for ${result.user.email}`);
      } else {
        setCreatedTeacher(null);
        notify.warning('Teacher created', 'Account created but no login credentials generated');
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
    onError: (error: any) => {
      const message = error?.response?.data?.error?.message || error?.message || 'Failed to create teacher';
      notify.error('Creation failed', message);
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
      else if (!emailPattern.test(form.email.trim())) error = 'Enter a valid email.';
      else if (!form.firstName.trim()) error = 'First name is required.';
      else if (form.firstName.trim().length < 3) error = 'First name must be at least 3 characters.';
      else if (!form.lastName.trim()) error = 'Last name is required.';
      else if (form.lastName.trim().length < 3) error = 'Last name must be at least 3 characters.';
      else if (isSuperAdmin && !effectiveSchoolId) error = 'Select a school before continuing.';
    }
    if (step === 2) {
      if (!form.phone.trim()) error = 'Phone is required.';
      else if (!/^[0-9]{10}$/.test(form.phone.trim())) error = 'Enter a valid 10-digit phone number.';
      else if (!form.address.trim()) error = 'Address is required.';
    }
    if (step === 3) {
      if (form.accountNumber && !form.ifscCode.trim()) error = 'IFSC code is required when account number is provided.';
      else if (form.ifscCode && !form.accountNumber.trim()) error = 'Account number is required when IFSC code is provided.';
      else if (form.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifscCode.trim())) error = 'Enter a valid IFSC code (AAAA0BBBBBB format).';
      else if (form.accountNumber && (form.accountNumber.length < 9 || form.accountNumber.length > 18)) error = 'Account number must be 9-18 digits.';
      else if (form.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.panNumber.trim())) error = 'Enter a valid PAN number (ABCDE1234F).';
      else if (form.bankName === 'Others' && !form.customBankName.trim()) error = 'Enter bank name when Others is selected.';
    }
    setStepError(error);
    if (error) {
      notify.error('Validation error', error);
      return;
    }
    setStep((prev) => (prev < 5 ? ((prev + 1) as Step) : prev));
    notify.success('Step saved', 'Continue to the next section.');
  };

  const validateBeforeCreate = () => {
    let error = '';
    if (!form.email.trim()) error = 'Email is required.';
    else if (!emailPattern.test(form.email.trim())) error = 'Enter a valid email.';
    else if (!form.firstName.trim()) error = 'First name is required.';
    else if (form.firstName.trim().length < 3) error = 'First name must be at least 3 characters.';
    else if (!form.lastName.trim()) error = 'Last name is required.';
    else if (form.lastName.trim().length < 3) error = 'Last name must be at least 3 characters.';
    else if (!form.phone.trim()) error = 'Phone is required.';
    else if (!/^[0-9]{10}$/.test(form.phone.trim())) error = 'Enter a valid 10-digit phone number.';
    else if (!form.address.trim()) error = 'Address is required.';
    else if (form.accountNumber && !form.ifscCode.trim()) error = 'IFSC code is required when account number is provided.';
    else if (form.ifscCode && !form.accountNumber.trim()) error = 'Account number is required when IFSC code is provided.';
    else if (form.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifscCode.trim())) error = 'Enter a valid IFSC code (AAAA0BBBBBB format).';
    else if (form.accountNumber && (form.accountNumber.length < 9 || form.accountNumber.length > 18)) error = 'Account number must be 9-18 digits.';
    else if (form.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.panNumber.trim())) error = 'Enter a valid PAN number (ABCDE1234F).';
    else if (form.bankName === 'Others' && !form.customBankName.trim()) error = 'Enter bank name when Others is selected.';
    else if (isSuperAdmin && !effectiveSchoolId) error = 'Select a school before creating.';
    setStepError(error);
    if (error) notify.error('Validation error', error);
    return !error;
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
                onChange={(e) => setForm({ ...form, firstName: toTitleCase(e.target.value) })}
                placeholder="First name"
                className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              />
              <input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: toTitleCase(e.target.value) })}
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
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, '');
                  setForm({ ...form, phone: value });
                }}
                placeholder="Phone"
                maxLength={10}
                className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              />
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: toTitleCase(e.target.value) })}
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
                onChange={(e) => setForm({ ...form, accountHolderName: toUpperCase(e.target.value) })}
                placeholder="Account holder name"
                className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              />
              <input
                value={form.accountNumber}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, '');
                  if (value.length <= 18) setForm({ ...form, accountNumber: value });
                }}
                placeholder="Account number (9-18 digits)"
                className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              />
              <input
                value={form.ifscCode}
                onChange={(e) => {
                  const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                  if (value.length <= 11) setForm({ ...form, ifscCode: value });
                }}
                placeholder="IFSC code (AAAA0BBBBBB)"
                className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              />
              <select
                value={form.accountType}
                onChange={(e) => setForm({ ...form, accountType: e.target.value })}
                className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              >
                <option value="">Select account type</option>
                <option value="Savings">Savings</option>
                <option value="Current">Current</option>
                <option value="Salary">Salary</option>
              </select>
              <select
                value={form.bankName}
                onChange={(e) => setForm({ ...form, bankName: e.target.value, customBankName: '' })}
                className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              >
                <option value="">Select bank</option>
                {indianBanks.map((bank) => (
                  <option key={bank} value={bank}>{bank}</option>
                ))}
              </select>
              {form.bankName === 'Others' && (
                <input
                  value={form.customBankName}
                  onChange={(e) => setForm({ ...form, customBankName: toUpperCase(e.target.value) })}
                  placeholder="Enter bank name"
                  className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
                />
              )}
              <input
                value={form.branchName}
                onChange={(e) => setForm({ ...form, branchName: toUpperCase(e.target.value) })}
                placeholder="Branch name"
                className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              />
              <input
                value={form.panNumber}
                onChange={(e) => {
                  const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                  if (value.length <= 10) setForm({ ...form, panNumber: value });
                }}
                placeholder="PAN number (ABCDE1234F)"
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
            if (!validateBeforeCreate()) return;
            notify.info('Creating teacher...', 'Please wait while we process your request');
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
                bankName: form.bankName === 'Others' ? form.customBankName : form.bankName || null,
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
