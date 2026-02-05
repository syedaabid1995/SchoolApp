'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createTeacher } from '../../../../services/teacher.service';
import { createSchoolUser } from '../../../../services/user.service';
import { listSchools } from '../../../../services/school.service';
import { getSession } from '../../../../services/auth.service';
import { useNotify } from '../../../../components/NotificationProvider';
import FullPageLoader from '../../../../components/FullPageLoader';

const toTitleCase = (str: string) => {
  return str.replace(/\w\S*/g, (txt) => 
    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
};

const toUpperCase = (str: string) => str.toUpperCase();

type Step = 1 | 2 | 3 | 4 | 5;

const steps: Array<{ id: Step; title: string; icon: string }> = [
  { id: 1, title: 'Profile', icon: '👤' },
  { id: 2, title: 'Contact', icon: '📞' },
  { id: 3, title: 'Banking', icon: '🏦' },
  { id: 4, title: 'Review', icon: '📋' },
  { id: 5, title: 'Confirm', icon: '✅' },
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
    roleName: 'TEACHER' as 'SCHOOL_ADMIN' | 'TEACHER' | 'ACCOUNTANT' | 'LIBRARIAN' | 'STAFF',
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
  const [createdTeacher, setCreatedTeacher] = useState<{
    email: string;
    tempPassword: string;
    manualShareRequired?: boolean;
    manualShareUrl?: string | null;
  } | null>(null);
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

  const isTeacherRole = form.roleName === 'TEACHER';
  const isBankingRole = form.roleName === 'TEACHER' || form.roleName === 'SCHOOL_ADMIN';

  const createMutation = useMutation({
    mutationFn: async () => {
      if (isTeacherRole) {
        return createTeacher({
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
      }
      return createSchoolUser({
        email: form.email,
        roleName: form.roleName,
        firstName: form.firstName,
        lastName: form.lastName,
        employeeNo: form.employeeNo || null,
        phone: form.phone || null,
        address: form.address || null,
        bankDetails: isBankingRole
          ? {
              accountHolderName: form.accountHolderName || null,
              accountNumber: form.accountNumber || null,
              ifscCode: form.ifscCode || null,
              accountType: form.accountType || null,
              bankName: form.bankName === 'Others' ? form.customBankName : form.bankName || null,
              branchName: form.branchName || null,
              panNumber: form.panNumber || null,
            }
          : undefined,
        schoolId: effectiveSchoolId,
      });
    },
    onSuccess: (result) => {
      if (result?.user?.email && result?.tempPassword) {
        setCreatedTeacher({
          email: result.user.email,
          tempPassword: result.tempPassword,
          manualShareRequired: result.manualShareRequired,
          manualShareUrl: result.manualShareUrl,
        });
        notify.success('Teacher created successfully!', `Account created for ${result.user.email}`);
      } else {
        setCreatedTeacher(null);
        notify.warning('Teacher created', 'Account created but no login credentials generated');
      }
      setForm({
        roleName: 'TEACHER',
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
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error?.message || error?.message || 'Failed to create employee';
      notify.error('Creation failed', message);
    },
  });

  const summary = useMemo(
    () => ({
      profile: {
        roleName: form.roleName,
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
    if (step === 3 && isBankingRole) {
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
    else if (isBankingRole && form.accountNumber && !form.ifscCode.trim()) error = 'IFSC code is required when account number is provided.';
    else if (isBankingRole && form.ifscCode && !form.accountNumber.trim()) error = 'Account number is required when IFSC code is provided.';
    else if (isBankingRole && form.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifscCode.trim())) error = 'Enter a valid IFSC code (AAAA0BBBBBB format).';
    else if (isBankingRole && form.accountNumber && (form.accountNumber.length < 9 || form.accountNumber.length > 18)) error = 'Account number must be 9-18 digits.';
    else if (isBankingRole && form.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.panNumber.trim())) error = 'Enter a valid PAN number (ABCDE1234F).';
    else if (isBankingRole && form.bankName === 'Others' && !form.customBankName.trim()) error = 'Enter bank name when Others is selected.';
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
      {createMutation.isPending ? <FullPageLoader label="Saving employee..." /> : null}
      
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 px-6 py-16 text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-4 inline-flex items-center rounded-full bg-white/20 px-4 py-2 text-sm font-medium backdrop-blur-sm">
            <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
            </svg>
            Employee Management
          </div>
          <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Add New Employee
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-emerald-100">
            Create employee profiles and assign the right user category for your school operations.
          </p>
        </div>
        
        {/* Animated background elements */}
        <div className="absolute -top-10 -left-10 h-40 w-40 rounded-full bg-white/10 animate-pulse"></div>
        <div className="absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-white/10 animate-bounce"></div>
        <div className="absolute top-1/2 right-1/4 h-6 w-6 rounded-full bg-white/20 animate-ping"></div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-12">
        {/* Progress Stepper */}
        <div className="mb-12">
          <div className="flex items-center justify-between">
            {steps.map((item, index) => (
              <div key={item.id} className="flex items-center">
                <div className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold transition-all duration-300 ${
                  step === item.id
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg scale-110'
                    : step > item.id
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-gray-200 text-gray-500'
                }`}>
                  {step > item.id ? '✓' : item.icon}
                </div>
                <div className="ml-3 hidden sm:block">
                  <p className={`text-sm font-semibold ${
                    step === item.id ? 'text-emerald-600' : step > item.id ? 'text-emerald-500' : 'text-gray-500'
                  }`}>
                    Step {item.id}
                  </p>
                  <p className={`text-xs ${
                    step === item.id ? 'text-gray-900' : 'text-gray-600'
                  }`}>
                    {item.title}
                  </p>
                </div>
                {index < steps.length - 1 && (
                  <div className={`mx-4 h-0.5 w-8 sm:w-16 transition-colors duration-300 ${
                    step > item.id ? 'bg-emerald-300' : 'bg-gray-300'
                  }`}></div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* School Selection for Super Admin */}
        {isSuperAdmin && (
          <div className="mb-8 rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Select School</h3>
            <select
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            >
              <option value="">Choose a school...</option>
              {schools?.items.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name} ({school.code})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Form Content */}
        <div className="rounded-2xl bg-white p-8 shadow-xl ring-1 ring-gray-200">
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900">Employee Profile</h2>
                <p className="mt-2 text-gray-600">Basic user information and credentials</p>
              </div>
              
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">User Category *</label>
                  <select
                    value={form.roleName}
                    onChange={(e) => setForm({ ...form, roleName: e.target.value as typeof form.roleName })}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  >
                    <option value="SCHOOL_ADMIN">School Admin</option>
                    <option value="TEACHER">Teacher</option>
                    <option value="ACCOUNTANT">Accountant</option>
                    <option value="LIBRARIAN">Librarian</option>
                    <option value="STAFF">Other Staff</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email Address *</label>
                  <input
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="teacher@school.com"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
                {isTeacherRole ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Employee Number</label>
                  <input
                    value={form.employeeNo}
                    onChange={(e) => setForm({ ...form, employeeNo: e.target.value })}
                    placeholder="EMP001"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
                ) : null}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                  <input
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: toTitleCase(e.target.value) })}
                    placeholder="John"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                  <input
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: toTitleCase(e.target.value) })}
                    placeholder="Doe"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900">Contact Information</h2>
                <p className="mt-2 text-gray-600">Phone and address details</p>
              </div>
              
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label>
                  <input
                    value={form.phone}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      setForm({ ...form, phone: value });
                    }}
                    placeholder="9876543210"
                    maxLength={10}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Address *</label>
                  <textarea
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: toTitleCase(e.target.value) })}
                    placeholder="Complete address with city and state"
                    rows={3}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900">Banking Details</h2>
                <p className="mt-2 text-gray-600">Optional account information</p>
              </div>
              {!isBankingRole ? (
                <div className="rounded-xl border border-slate/200 bg-slate-50 p-6 text-center text-sm text-slate">
                  Banking details are captured for Teacher and School Admin categories.
                </div>
              ) : (
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Account Holder Name</label>
                  <input
                    value={form.accountHolderName}
                    onChange={(e) => setForm({ ...form, accountHolderName: toUpperCase(e.target.value) })}
                    placeholder="JOHN DOE"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Account Number</label>
                  <input
                    value={form.accountNumber}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      if (value.length <= 18) setForm({ ...form, accountNumber: value });
                    }}
                    placeholder="123456789012345"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">IFSC Code</label>
                  <input
                    value={form.ifscCode}
                    onChange={(e) => {
                      const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                      if (value.length <= 11) setForm({ ...form, ifscCode: value });
                    }}
                    placeholder="SBIN0001234"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Account Type</label>
                  <select
                    value={form.accountType}
                    onChange={(e) => setForm({ ...form, accountType: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  >
                    <option value="">Select account type</option>
                    <option value="Savings">Savings</option>
                    <option value="Current">Current</option>
                    <option value="Salary">Salary</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bank Name</label>
                  <select
                    value={form.bankName}
                    onChange={(e) => setForm({ ...form, bankName: e.target.value, customBankName: '' })}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  >
                    <option value="">Select bank</option>
                    {indianBanks.map((bank) => (
                      <option key={bank} value={bank}>{bank}</option>
                    ))}
                  </select>
                </div>
                {form.bankName === 'Others' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Custom Bank Name</label>
                    <input
                      value={form.customBankName}
                      onChange={(e) => setForm({ ...form, customBankName: toUpperCase(e.target.value) })}
                      placeholder="ENTER BANK NAME"
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Branch Name</label>
                  <input
                    value={form.branchName}
                    onChange={(e) => setForm({ ...form, branchName: toUpperCase(e.target.value) })}
                    placeholder="MAIN BRANCH"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">PAN Number</label>
                  <input
                    value={form.panNumber}
                    onChange={(e) => {
                      const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                      if (value.length <= 10) setForm({ ...form, panNumber: value });
                    }}
                    placeholder="ABCDE1234F"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
              </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900">Review Details</h2>
                <p className="mt-2 text-gray-600">Please verify all information before proceeding</p>
              </div>
              
              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
                  <h3 className="mb-4 flex items-center text-lg font-semibold text-emerald-800">
                    <span className="mr-2">👤</span> Profile Information
                  </h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">Email:</span> {summary.profile.email || '—'}</p>
                    <p><span className="font-medium">Category:</span> {summary.profile.roleName || '—'}</p>
                    <p><span className="font-medium">Name:</span> {summary.profile.firstName} {summary.profile.lastName}</p>
                    <p><span className="font-medium">Employee No:</span> {summary.profile.employeeNo || '—'}</p>
                  </div>
                </div>
                
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
                  <h3 className="mb-4 flex items-center text-lg font-semibold text-blue-800">
                    <span className="mr-2">📞</span> Contact Information
                  </h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">Phone:</span> {summary.contact.phone || '—'}</p>
                    <p><span className="font-medium">Address:</span> {summary.contact.address || '—'}</p>
                  </div>
                </div>
                
                <div className="md:col-span-2 rounded-xl border border-purple-200 bg-purple-50 p-6">
                  <h3 className="mb-4 flex items-center text-lg font-semibold text-purple-800">
                    <span className="mr-2">🏦</span> Banking Details
                  </h3>
                  <div className="grid gap-4 md:grid-cols-3 text-sm">
                    <p><span className="font-medium">Account:</span> {summary.banking.accountNumber || '—'}</p>
                    <p><span className="font-medium">IFSC:</span> {summary.banking.ifscCode || '—'}</p>
                    <p><span className="font-medium">Bank:</span> {summary.banking.bankName || '—'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6 text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center justify-center">
                <span className="text-2xl text-white">✅</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Ready to Create</h2>
              <p className="text-gray-600">All information has been validated. Click below to create the employee profile and generate login credentials.</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-8 flex items-center justify-between">
            {step > 1 ? (
              <button
                onClick={prevStep}
                className="flex items-center rounded-xl border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>
            ) : (
              <div></div>
            )}
            
            <button
              onClick={() => {
                if (step < 5) return nextStep();
                if (!validateBeforeCreate()) return;
                createMutation.mutate();
              }}
              disabled={createMutation.isPending || !effectiveSchoolId}
              className={`flex items-center rounded-xl px-8 py-3 text-sm font-semibold text-white transition-all ${
                step < 5
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg hover:shadow-xl'
                  : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg hover:shadow-xl'
              }`}
            >
              {step < 5 ? (
                <>
                  Continue
                  <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </>
              ) : createMutation.isPending ? (
                <>
                  <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating...
                </>
              ) : (
                <>
                  Create Employee
                  <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Success Message */}
        {createdTeacher && (
          <div className="mt-8 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-8 shadow-lg">
            <div className="text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <svg className="h-8 w-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-emerald-800 mb-2">Employee Created Successfully!</h3>
              <div className="rounded-xl bg-white p-4 text-left">
                <p className="text-sm text-gray-600 mb-2">Login credentials:</p>
                <p className="font-mono text-sm"><span className="font-semibold">Email:</span> {createdTeacher.email}</p>
                <p className="font-mono text-sm"><span className="font-semibold">Password:</span> {createdTeacher.tempPassword}</p>
                {createdTeacher.manualShareUrl ? (
                  <a
                    href={createdTeacher.manualShareUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1 rounded-lg border border-emerald-300 px-2 py-1 text-xs font-semibold text-emerald-800"
                  >
                    Share via WhatsApp
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
