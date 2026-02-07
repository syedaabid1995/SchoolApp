'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'next/navigation';
import { getSession } from '../../../../services/auth.service';
import { getTeacher, updateTeacher } from '../../../../services/teacher.service';
import { getUserById } from '../../../../services/user.service';
import { useNotify } from '../../../../components/NotificationProvider';

type Step = 1 | 2 | 3 | 4 | 5;

const toTitleCase = (str: string) => {
  return str.replace(/\w\S*/g, (txt) =>
    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
};

const toUpperCase = (str: string) => str.toUpperCase();

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
  const [saveAndContinue, setSaveAndContinue] = useState(false);
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
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const { data: session } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSuperAdmin = session?.role === 'SUPER_ADMIN';
  const schoolIdParam = searchParams.get('schoolId') ?? undefined;
  const effectiveSchoolId = isSuperAdmin ? schoolIdParam : session?.schoolId ?? undefined;

  const { data: employee } = useQuery({
    queryKey: ['employee', teacherId],
    queryFn: () => getUserById(teacherId),
    enabled: Boolean(teacherId),
    retry: false,
  });

  const { data: teacher, refetch } = useQuery({
    queryKey: ['teacher', teacherId, effectiveSchoolId],
    queryFn: () => getTeacher(teacherId, effectiveSchoolId ? { schoolId: effectiveSchoolId } : undefined),
    enabled: Boolean(teacherId) && (Boolean(effectiveSchoolId) || !isSuperAdmin),
    retry: false,
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
      notify.success('Employee updated', 'Changes saved successfully.');
      if (saveAndContinue) {
        setSaveAndContinue(false);
        setIsEditing(true);
        nextStep();
      } else {
        setIsEditing(false);
      }
      refetch();
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error?.message || error?.message || 'Failed to update teacher';
      notify.error('Update failed', message);
    },
  });

  const validateBeforeSave = () => {
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
    if (error) notify.error('Validation error', error);
    return !error;
  };

  const nextStep = () => setStep((prev) => (prev < 3 ? ((prev + 1) as Step) : prev));
  const prevStep = () => setStep((prev) => (prev > 1 ? ((prev - 1) as Step) : prev));

  useEffect(() => {
    if (!employee || teacher) return;
    const [first, ...rest] = (employee.displayName ?? '').split(' ');
    setForm((prev) => ({
      ...prev,
      email: employee.email ?? '',
      firstName: first ?? '',
      lastName: rest.join(' ').trim(),
    }));
  }, [employee, teacher]);

  const activeSteps = steps;
  const headerName = teacher
    ? `${teacher.firstName} ${teacher.lastName}`
    : employee?.displayName ?? employee?.email ?? 'Employee Details';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-pink-50/40">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-purple-600 via-pink-600 to-rose-700 px-6 py-16 text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative mx-auto max-w-6xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="mb-4 inline-flex items-center rounded-full bg-white/20 px-4 py-2 text-sm font-medium backdrop-blur-sm">
                <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                </svg>
                Employee Profile
              </div>
              <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
                {headerName}
              </h1>
              <p className="max-w-2xl text-lg text-purple-100">
                View and manage comprehensive employee information, contact details, and banking information.
              </p>
            </div>
            
            <div className="hidden sm:flex gap-3">
              {isEditing ? (
                <>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="rounded-xl border border-white/30 px-6 py-3 font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (!validateBeforeSave()) return;
                      updateMutation.mutate();
                    }}
                    disabled={updateMutation.isPending}
                    className="rounded-xl bg-white/20 px-6 py-3 font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/30 hover:scale-105 disabled:opacity-50"
                  >
                    {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="rounded-xl bg-white/20 px-6 py-3 font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/30 hover:scale-105 disabled:opacity-50"
                >
                  <svg className="mr-2 inline h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Profile
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Animated background elements */}
        <div className="absolute -top-10 -left-10 h-40 w-40 rounded-full bg-white/10 animate-pulse"></div>
        <div className="absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-white/10 animate-bounce"></div>
        <div className="absolute top-1/2 left-1/3 h-6 w-6 rounded-full bg-white/20 animate-ping"></div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-12">
        {/* Enhanced Stepper */}
        <div className="mb-8 rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
          <div className="flex items-center justify-between overflow-x-auto pb-2">
            {activeSteps.map((item, index) => {
              const isActive = step === item.id;
              const stepIcons = {
                1: <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" /></svg>,
                2: <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" /></svg>,
                3: <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" /></svg>
              };
              
              return (
                <div key={item.id} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => setStep(item.id)}
                      className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                        isActive 
                          ? 'border-purple-500 bg-purple-500 text-white' 
                          : 'border-gray-300 bg-white text-gray-400 hover:border-purple-300 hover:text-purple-500'
                      }`}
                    >
                      {stepIcons[item.id as keyof typeof stepIcons] || item.id}
                    </button>
                    <span className={`mt-2 text-xs font-medium ${
                      isActive ? 'text-purple-600' : 'text-gray-500'
                    }`}>
                      {item.title}
                    </span>
                  </div>
                  {index < activeSteps.length - 1 && (
                    <div className="mx-4 h-0.5 w-12 bg-gray-300" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content Sections */}
        <div className="rounded-2xl bg-white p-8 shadow-lg ring-1 ring-gray-200">
          {step === 1 && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Profile Information</h2>
                <p className="mt-2 text-sm text-gray-600">
                  Basic employee profile details and identification information.
                </p>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                  <input
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="Enter email address"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 transition-colors"
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Employee Number</label>
                  <input
                    value={form.employeeNo}
                    onChange={(e) => setForm({ ...form, employeeNo: e.target.value })}
                    placeholder="Enter employee number"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 transition-colors"
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                  <input
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: toTitleCase(e.target.value) })}
                    placeholder="Enter first name"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 transition-colors"
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                  <input
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: toTitleCase(e.target.value) })}
                    placeholder="Enter last name"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 transition-colors"
                    disabled={!isEditing}
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Contact Information</h2>
                <p className="mt-2 text-sm text-gray-600">Phone number and address details for communication.</p>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                  <input
                    value={form.phone}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      setForm({ ...form, phone: value });
                    }}
                    maxLength={10}
                    placeholder="Enter phone number"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 transition-colors"
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                  <input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: toTitleCase(e.target.value) })}
                    placeholder="Enter complete address"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 transition-colors"
                    disabled={!isEditing}
                  />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Banking Details</h2>
                <p className="mt-2 text-sm text-gray-600">Bank account information for salary and payment processing.</p>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Account Holder Name</label>
                  <input
                    value={form.accountHolderName}
                    onChange={(e) => setForm({ ...form, accountHolderName: toUpperCase(e.target.value) })}
                    placeholder="Enter account holder name"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 transition-colors"
                    disabled={!isEditing}
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
                    placeholder="Enter account number"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 transition-colors"
                    disabled={!isEditing}
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
                    placeholder="Enter IFSC code"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 transition-colors"
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Account Type</label>
                  <select
                    value={form.accountType}
                    onChange={(e) => setForm({ ...form, accountType: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 transition-colors"
                    disabled={!isEditing}
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
                    onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 transition-colors"
                    disabled={!isEditing}
                  >
                    <option value="">Select bank name</option>
                    {indianBanks.map((bank) => (
                      <option key={bank} value={bank}>
                        {bank}
                      </option>
                    ))}
                  </select>
                </div>
                {form.bankName === 'Others' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Custom Bank Name</label>
                    <input
                      value={form.customBankName}
                      onChange={(e) => setForm({ ...form, customBankName: toUpperCase(e.target.value) })}
                      placeholder="Enter bank name"
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 transition-colors"
                      disabled={!isEditing}
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Branch Name</label>
                  <input
                    value={form.branchName}
                    onChange={(e) => setForm({ ...form, branchName: toUpperCase(e.target.value) })}
                    placeholder="Enter branch name"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 transition-colors"
                    disabled={!isEditing}
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
                    placeholder="Enter PAN number"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 transition-colors"
                    disabled={!isEditing}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={prevStep}
              disabled={step === 1}
              className="rounded-xl border border-gray-300 px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="mr-2 inline h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Previous
            </button>
            {isEditing ? (
              <button
                onClick={() => {
                  if (!validateBeforeSave()) return;
                  setSaveAndContinue(true);
                  updateMutation.mutate();
                }}
                disabled={updateMutation.isPending}
                className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-8 py-3 font-semibold text-white shadow-lg transition-all hover:from-purple-700 hover:to-pink-700 hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {updateMutation.isPending ? 'Saving...' : step === 3 ? 'Save' : 'Save & Next'}
                {step === 3 ? null : (
                  <svg className="ml-2 inline h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </button>
            ) : (
              <button
                onClick={nextStep}
                disabled={step === 3}
                className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-8 py-3 font-semibold text-white shadow-lg transition-all hover:from-purple-700 hover:to-pink-700 hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                Next
                <svg className="ml-2 inline h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
