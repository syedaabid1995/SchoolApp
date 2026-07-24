'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import FullPageLoader from '../../../../components/FullPageLoader';
import PageHeader from '../../../../components/PageHeader';
import { useNotify } from '../../../../components/NotificationProvider';
import { getSession } from '../../../../services/auth.service';
import { listAcademicYears } from '../../../../services/academic.service';
import { listSetupClasses, listSetupSections } from '../../../../services/academic-setup.service';
import { listFeeDiscounts, listFeeGroups, listFeeMasters, type FeeDiscount, type FeeMaster } from '../../../../services/fee-management.service';
import { createParent, createStudent, linkParent, listStudents, uploadStudentPhoto } from '../../../../services/student.service';
import { getSchoolSystemSettings } from '../../../../services/system-settings.service';

const categories = ['Regular', 'RTE', 'Management', 'Scholarship', 'Transport'];
type ParentLoginSource = 'father' | 'mother' | 'guardian';
type AdmissionStep = 'academic' | 'fees' | 'student' | 'parents' | 'photos' | 'address' | 'review';

const admissionSteps: Array<{ key: AdmissionStep; label: string; description: string }> = [
  { key: 'academic', label: 'Academic', description: 'Session, class, roll number' },
  { key: 'fees', label: 'Fees Details', description: 'Groups, discounts, invoice preview' },
  { key: 'student', label: 'Student', description: 'Profile and base setup details' },
  { key: 'parents', label: 'Parents', description: 'Guardian and login access' },
  { key: 'photos', label: 'Photos', description: 'Student and parent photos' },
  { key: 'address', label: 'Address', description: 'Address and sibling linking' },
  { key: 'review', label: 'Review', description: 'Check and save admission' },
];

type AdmissionForm = {
  academicSessionId: string;
  classId: string;
  sectionId: string;
  admissionNo: string;
  rollNo: string;
  firstName: string;
  lastName: string;
  gender: string;
  dob: string;
  bloodGroup: string;
  religion: string;
  caste: string;
  email: string;
  phone: string;
  admissionDate: string;
  category: string;
  feeGroupIds: string[];
  discountIds: string[];
  generateFeeInvoices: boolean;
  height: string;
  weight: string;
  photoUrl: string;
  facePhotoUrls: string[];
  fatherName: string;
  fatherOccupation: string;
  fatherPhone: string;
  fatherPhotoUrl: string;
  motherName: string;
  motherOccupation: string;
  motherPhone: string;
  motherPhotoUrl: string;
  guardianName: string;
  guardianRelationship: string;
  parentPhone: string;
  parentEmail: string;
  createParentLogin: boolean;
  parentLoginSource: ParentLoginSource;
  parentLoginFirstName: string;
  parentLoginLastName: string;
  parentLoginPhone: string;
  parentLoginEmail: string;
  parentLoginSendVia: 'SMS' | 'EMAIL' | 'BOTH';
  presentAddress: string;
  permanentAddress: string;
  siblingIds: string[];
};
type SelectedSiblingSummary = { id: string; name: string; admissionNo: string };

const initialForm: AdmissionForm = {
  academicSessionId: '',
  classId: '',
  sectionId: '',
  admissionNo: '',
  rollNo: '',
  firstName: '',
  lastName: '',
  gender: '',
  dob: '',
  bloodGroup: '',
  religion: '',
  caste: '',
  email: '',
  phone: '',
  admissionDate: new Date().toISOString().slice(0, 10),
  category: 'Regular',
  feeGroupIds: [],
  discountIds: [],
  generateFeeInvoices: true,
  height: '',
  weight: '',
  photoUrl: '',
  facePhotoUrls: [],
  fatherName: '',
  fatherOccupation: '',
  fatherPhone: '',
  fatherPhotoUrl: '',
  motherName: '',
  motherOccupation: '',
  motherPhone: '',
  motherPhotoUrl: '',
  guardianName: '',
  guardianRelationship: 'Father',
  parentPhone: '',
  parentEmail: '',
  createParentLogin: false,
  parentLoginSource: 'father',
  parentLoginFirstName: '',
  parentLoginLastName: '',
  parentLoginPhone: '',
  parentLoginEmail: '',
  parentLoginSendVia: 'SMS',
  presentAddress: '',
  permanentAddress: '',
  siblingIds: [],
};

const Icon = ({ path }: { path: string }) => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
  </svg>
);

const Field = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
      {label}{required ? <span className="text-red-500">*</span> : null}
    </span>
    {children}
  </label>
);

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100';

const toAmount = (value: number | string | null | undefined) => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
};

const isExpired = (value?: string | null) => {
  if (!value) return false;
  const expiry = new Date(value);
  if (Number.isNaN(expiry.getTime())) return false;
  expiry.setHours(23, 59, 59, 999);
  return expiry.getTime() < Date.now();
};

export default function AddStudentPage() {
  const router = useRouter();
  const notify = useNotify();
  const [form, setForm] = useState<AdmissionForm>(initialForm);
  const [currentStep, setCurrentStep] = useState<AdmissionStep>('academic');
  const [sameAddress, setSameAddress] = useState(false);
  const [siblingFilters, setSiblingFilters] = useState({ classId: '', sectionId: '', search: '' });
  const [selectedSiblingSummaries, setSelectedSiblingSummaries] = useState<Record<string, SelectedSiblingSummary>>({});

  const { data: session, isLoading: isSessionLoading } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSchoolAdmin = session?.role === 'SCHOOL_ADMIN';
  const permissionCodes = session?.permissionCodes ?? [];
  const canCreateStudent = isSchoolAdmin || permissionCodes.includes('students.add') || permissionCodes.includes('student.create');

  const yearsQuery = useQuery({ queryKey: ['academic-years'], queryFn: () => listAcademicYears(), enabled: canCreateStudent });
  useEffect(() => {
    const years = yearsQuery.data ?? [];
    if (!years.length || form.academicSessionId) return;
    const active = years.find((y: any) => y.isActive) ?? years[0];
    if (active) setValue('academicSessionId', active.id);
  }, [yearsQuery.data]);
  const classesQuery = useQuery({ queryKey: ['setup-classes'], queryFn: () => listSetupClasses(), enabled: canCreateStudent });
  const sectionsQuery = useQuery({ queryKey: ['setup-sections'], queryFn: () => listSetupSections(), enabled: canCreateStudent });
  const systemSettingsQuery = useQuery({
    queryKey: ['school-system-settings', 'student-admission-base-setup'],
    queryFn: () => getSchoolSystemSettings(),
    enabled: canCreateStudent,
  });
  const feeGroupsQuery = useQuery({
    queryKey: ['admission-fee-groups', form.academicSessionId],
    queryFn: () => listFeeGroups({ academicSessionId: form.academicSessionId, status: 'ACTIVE', limit: 100 }),
    enabled: canCreateStudent && Boolean(form.academicSessionId),
  });
  const feeMastersQuery = useQuery({
    queryKey: ['admission-fee-masters', form.academicSessionId],
    queryFn: () => listFeeMasters({ academicSessionId: form.academicSessionId, status: 'ACTIVE', limit: 100 }),
    enabled: canCreateStudent && Boolean(form.academicSessionId),
  });
  const feeDiscountsQuery = useQuery({
    queryKey: ['admission-fee-discounts', form.academicSessionId],
    queryFn: () => listFeeDiscounts({ academicSessionId: form.academicSessionId, limit: 100 }),
    enabled: canCreateStudent && Boolean(form.academicSessionId),
  });
  const siblingsQuery = useQuery({
    queryKey: ['students', 'sibling-options', siblingFilters],
    queryFn: () => listStudents({
      classId: siblingFilters.classId,
      sectionId: siblingFilters.sectionId,
      search: siblingFilters.search.trim() || undefined,
    }),
    enabled: canCreateStudent && Boolean(siblingFilters.classId && siblingFilters.sectionId),
  });
  const filteredSiblingOptions = (siblingsQuery.data ?? []).filter((student) => !form.siblingIds.includes(student.id));
  const feeGroups = useMemo(() => feeGroupsQuery.data?.items ?? [], [feeGroupsQuery.data]);
  const feeMasters = useMemo(() => feeMastersQuery.data?.items ?? [], [feeMastersQuery.data]);
  const feeDiscounts: FeeDiscount[] = useMemo(
    () => (Array.isArray(feeDiscountsQuery.data) ? feeDiscountsQuery.data : feeDiscountsQuery.data?.items ?? []),
    [feeDiscountsQuery.data],
  );
  const feeGroupSummaries = useMemo(() => {
    const summaries = new Map<string, { total: number; masters: number }>();
    feeMasters.forEach((master) => {
      const current = summaries.get(master.feeGroupId) ?? { total: 0, masters: 0 };
      summaries.set(master.feeGroupId, {
        total: current.total + toAmount(master.amount),
        masters: current.masters + 1,
      });
    });
    return summaries;
  }, [feeMasters]);
  const selectedFeeMasters = useMemo(() => {
    const selectedGroups = new Set(form.feeGroupIds);
    const masters = new Map<string, FeeMaster>();
    feeMasters.forEach((master) => {
      if (selectedGroups.has(master.feeGroupId)) masters.set(master.id, master);
    });
    return Array.from(masters.values()).sort((a, b) => {
      const dueDateCompare = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      if (dueDateCompare) return dueDateCompare;
      return a.name.localeCompare(b.name);
    });
  }, [feeMasters, form.feeGroupIds]);
  const activeStudentEligibleDiscounts = useMemo(
    () =>
      feeDiscounts.filter((discount) => {
        const approvalStatus = discount.approvalStatus;
        const isActive = approvalStatus === 'ACTIVE' || approvalStatus === 'APPROVED';
        return isActive;
      }),
    [feeDiscounts],
  );
  const selectedDiscounts = useMemo(
    () => activeStudentEligibleDiscounts.filter((discount) => form.discountIds.includes(discount.id)),
    [activeStudentEligibleDiscounts, form.discountIds],
  );
  const feeSubTotal = useMemo(
    () => selectedFeeMasters.reduce((sum, master) => sum + toAmount(master.amount), 0),
    [selectedFeeMasters],
  );
  const rawDiscountTotal = useMemo(
    () =>
      selectedDiscounts.reduce((sum, discount) => {
        const value = discount.valueType === 'PERCENTAGE' ? toAmount(discount.value) : toAmount(discount.amount ?? discount.value);
        return sum + (discount.valueType === 'PERCENTAGE' ? (feeSubTotal * value) / 100 : value);
      }, 0),
    [selectedDiscounts, feeSubTotal],
  );
  const feeDiscountTotal = Math.min(rawDiscountTotal, feeSubTotal);
  const feeNetPayable = Math.max(feeSubTotal - feeDiscountTotal, 0);

  const sections = useMemo(() => sectionsQuery.data ?? [], [sectionsQuery.data]);
  const baseSetups = systemSettingsQuery.data?.baseSetups;
  const genderOptions = baseSetups?.gender ?? [];
  const bloodGroupOptions = baseSetups?.bloodGroup ?? [];
  const religionOptions = baseSetups?.religion ?? [];
  const casteOptions = baseSetups?.caste ?? [];
  const currentStepIndex = admissionSteps.findIndex((step) => step.key === currentStep);
  const isFirstStep = currentStepIndex <= 0;
  const isLastStep = currentStep === 'review';
  const classSections = useMemo(
    () =>
      form.classId
        ? sections.filter((section) => section.classSections?.some((link) => link.classId === form.classId) || section.classId === form.classId)
        : [],
    [sections, form.classId],
  );
  const siblingClassSections = useMemo(
    () =>
      siblingFilters.classId
        ? sections.filter((section) => section.classSections?.some((link) => link.classId === siblingFilters.classId) || section.classId === siblingFilters.classId)
        : [],
    [sections, siblingFilters.classId],
  );
  const getParentLoginName = () => {
    const fallbackName = form.guardianName || form.fatherName || form.motherName || 'Parent';
    const fullName = `${form.parentLoginFirstName} ${form.parentLoginLastName}`.trim() || fallbackName;
    const [firstName, ...rest] = fullName.trim().split(/\s+/);
    return {
      firstName: firstName || 'Parent',
      lastName: rest.join(' ') || 'Guardian',
    };
  };
  const getParentLoginSourceData = (source: ParentLoginSource) => {
    if (source === 'mother') {
      const [firstName, ...rest] = form.motherName.trim().split(/\s+/);
      return {
        firstName: firstName || '',
        lastName: rest.join(' '),
        phone: form.motherPhone,
        email: form.parentEmail,
      };
    }
    if (source === 'guardian') {
      const [firstName, ...rest] = form.guardianName.trim().split(/\s+/);
      return {
        firstName: firstName || '',
        lastName: rest.join(' '),
        phone: form.parentPhone || form.fatherPhone || form.motherPhone,
        email: form.parentEmail,
      };
    }
    const [firstName, ...rest] = form.fatherName.trim().split(/\s+/);
    return {
      firstName: firstName || '',
      lastName: rest.join(' '),
      phone: form.fatherPhone || form.parentPhone,
      email: form.parentEmail,
    };
  };
  const applyParentLoginSource = (source: ParentLoginSource) => {
    const sourceData = getParentLoginSourceData(source);
    setForm((prev) => ({
      ...prev,
      parentLoginSource: source,
      parentLoginFirstName: sourceData.firstName,
      parentLoginLastName: sourceData.lastName,
      parentLoginPhone: sourceData.phone,
      parentLoginEmail: sourceData.email,
    }));
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const student = await createStudent({
        academicSessionId: form.academicSessionId,
        classId: form.classId,
        sectionId: form.sectionId,
        admissionNo: form.admissionNo.trim(),
        rollNo: form.rollNo.trim(),
        fullName: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
        dob: form.dob,
        gender: form.gender,
        bloodGroup: form.bloodGroup || undefined,
        religion: form.religion || undefined,
        caste: form.caste || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        admissionDate: form.admissionDate,
        category: form.category,
        height: form.height ? Number(form.height) : undefined,
        weight: form.weight ? Number(form.weight) : undefined,
        photoUrl: form.photoUrl || undefined,
        facePhotoUrls: form.facePhotoUrls.length ? form.facePhotoUrls : undefined,
        fatherName: form.fatherName || undefined,
        fatherOccupation: form.fatherOccupation || undefined,
        fatherPhone: form.fatherPhone || undefined,
        fatherPhotoUrl: form.fatherPhotoUrl || undefined,
        motherName: form.motherName || undefined,
        motherOccupation: form.motherOccupation || undefined,
        motherPhone: form.motherPhone || undefined,
        motherPhotoUrl: form.motherPhotoUrl || undefined,
        guardianName: form.guardianName || form.fatherName || form.motherName || undefined,
        guardianRelationship: form.guardianRelationship || undefined,
        parentPhone: form.parentPhone || form.fatherPhone || form.motherPhone || undefined,
        parentEmail: form.parentEmail || undefined,
        presentAddress: form.presentAddress || undefined,
        permanentAddress: sameAddress ? form.presentAddress : form.permanentAddress || undefined,
        addressLine1: form.presentAddress || undefined,
        siblingIds: form.siblingIds,
        feeGroupIds: form.feeGroupIds,
        discountIds: form.discountIds,
        generateInvoices: form.generateFeeInvoices,
      });

      let parentLogin: Awaited<ReturnType<typeof createParent>> | null = null;
      let parentLoginError: unknown = null;
      if (form.createParentLogin) {
        try {
          const parentName = getParentLoginName();
          parentLogin = await createParent({
            firstName: parentName.firstName,
            lastName: parentName.lastName,
            phone: form.parentLoginPhone || form.parentPhone || form.fatherPhone || form.motherPhone || undefined,
            email: form.parentLoginEmail || form.parentEmail || undefined,
            createLogin: true,
            sendVia: form.parentLoginSendVia,
          });
          await linkParent(student.id, parentLogin.id);
        } catch (error) {
          parentLoginError = error;
        }
      }

      return { student, parentLogin, parentLoginError };
    },
    onSuccess: ({ student, parentLogin, parentLoginError }) => {
      notify.success('Student admitted', 'Enrollment was created for the selected session.');
      if (student.faceRegistration?.success) {
        notify.success('Face registration complete', `${student.faceRegistration.sampleCount} face sample${student.faceRegistration.sampleCount === 1 ? '' : 's'} registered for AI attendance.`);
      } else if (student.faceRegistration) {
        notify.error('Face registration failed', student.faceRegistration.error ?? 'Student was saved, but AI attendance face registration failed.');
      }
      if (parentLogin) {
        const passwordText = parentLogin.tempPassword ? ` Temporary password: ${parentLogin.tempPassword}` : '';
        notify.success(
          parentLogin.reusedExisting ? 'Parent login linked' : 'Parent login created',
          `${parentLogin.reusedExisting ? 'Existing parent login' : 'Parent login'} was linked to this student.${passwordText}`,
        );
      }
      if (parentLoginError) {
        notify.error('Parent login not created', (parentLoginError as any)?.response?.data?.error?.message ?? 'Student was saved, but parent login creation failed.');
      }
      router.push(`/dashboard/students/${student.id}`);
    },
    onError: (error: any) => notify.error('Admission failed', error?.response?.data?.error?.message ?? 'Unable to save student.'),
  });

  const setValue = (key: keyof AdmissionForm, value: string | string[]) => setForm((prev) => ({ ...prev, [key]: value }));
  const toggleFeeGroup = (groupId: string) => {
    setForm((prev) => {
      const selected = prev.feeGroupIds.includes(groupId);
      const feeGroupIds = selected ? prev.feeGroupIds.filter((id) => id !== groupId) : [...prev.feeGroupIds, groupId];
      return {
        ...prev,
        feeGroupIds,
        discountIds: feeGroupIds.length ? prev.discountIds : [],
      };
    });
  };
  const toggleFeeDiscount = (discount: FeeDiscount) => {
    if (!form.feeGroupIds.length) {
      notify.error('Select a fee master first', 'Discounts can only be selected after at least one fee master is selected.');
      return;
    }
    if (isExpired(discount.expiryDate ?? discount.validTo)) {
      notify.error('Discount expired', 'Expired discounts cannot be selected during admission.');
      return;
    }
    setForm((prev) => {
      const selected = prev.discountIds.includes(discount.id);
      return {
        ...prev,
        discountIds: selected ? prev.discountIds.filter((id) => id !== discount.id) : [...prev.discountIds, discount.id],
      };
    });
  };
  const toggleSibling = (student: NonNullable<typeof siblingsQuery.data>[number]) => {
    const selected = form.siblingIds.includes(student.id);
    const name = student.fullName ?? `${student.firstName} ${student.lastName}`.trim();
    setValue('siblingIds', selected ? form.siblingIds.filter((id) => id !== student.id) : [...form.siblingIds, student.id]);
    setSelectedSiblingSummaries((prev) => {
      if (selected) {
        const next = { ...prev };
        delete next[student.id];
        return next;
      }
      return { ...prev, [student.id]: { id: student.id, name, admissionNo: student.admissionNo } };
    });
  };
  const removeSibling = (id: string) => {
    setValue('siblingIds', form.siblingIds.filter((item) => item !== id));
    setSelectedSiblingSummaries((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const validate = () => {
    if (!form.academicSessionId) return 'Session is required.';
    if (!form.classId) return 'Class is required.';
    if (!form.sectionId) return 'Section is required.';
    if (!form.admissionNo.trim()) return 'Admission number is required.';
    if (!form.rollNo.trim()) return 'Roll number is required.';
    if (!form.firstName.trim()) return 'First name is required.';
    if (!form.lastName.trim()) return 'Last name is required.';
    if (!form.gender) return 'Gender is required.';
    if (!form.dob) return 'Date of birth is required.';
    if (!form.admissionDate) return 'Admission date is required.';
    if (!form.fatherName.trim() && !form.motherName.trim() && !form.guardianName.trim()) return 'At least one parent or guardian name is required.';
    if (form.createParentLogin && !(form.parentLoginPhone || form.parentPhone || form.fatherPhone || form.motherPhone).trim()) return 'Parent login phone is required.';
    if (!form.presentAddress.trim()) return 'Present address is required.';
    if (form.discountIds.length && !form.feeGroupIds.length) return 'Select at least one fee master before selecting discounts.';
    if (new Set(form.feeGroupIds).size !== form.feeGroupIds.length) return 'Duplicate fee masters are not allowed.';
    if (new Set(form.discountIds).size !== form.discountIds.length) return 'Duplicate fee discounts are not allowed.';
    if (selectedDiscounts.some((discount) => isExpired(discount.expiryDate ?? discount.validTo))) return 'Expired discounts cannot be selected.';
    return '';
  };
  const validateCurrentStep = () => {
    if (currentStep === 'academic') {
      if (!form.academicSessionId) return 'Session is required.';
      if (!form.classId) return 'Class is required.';
      if (!form.sectionId) return 'Section is required.';
      if (!form.admissionNo.trim()) return 'Admission number is required.';
      if (!form.rollNo.trim()) return 'Roll number is required.';
      if (!form.admissionDate) return 'Admission date is required.';
    }
    if (currentStep === 'student') {
      if (!form.firstName.trim()) return 'First name is required.';
      if (!form.lastName.trim()) return 'Last name is required.';
      if (!form.gender) return 'Gender is required.';
      if (!form.dob) return 'Date of birth is required.';
    }
    if (currentStep === 'parents') {
      if (!form.fatherName.trim() && !form.motherName.trim() && !form.guardianName.trim()) return 'At least one parent or guardian name is required.';
      if (form.createParentLogin && !(form.parentLoginPhone || form.parentPhone || form.fatherPhone || form.motherPhone).trim()) return 'Parent login phone is required.';
    }
    if (currentStep === 'fees') {
      if (form.discountIds.length && !form.feeGroupIds.length) return 'Select at least one fee master before selecting discounts.';
      if (new Set(form.feeGroupIds).size !== form.feeGroupIds.length) return 'Duplicate fee masters are not allowed.';
      if (new Set(form.discountIds).size !== form.discountIds.length) return 'Duplicate fee discounts are not allowed.';
      if (selectedDiscounts.some((discount) => isExpired(discount.expiryDate ?? discount.validTo))) return 'Expired discounts cannot be selected.';
    }
    if (currentStep === 'address' && !form.presentAddress.trim()) return 'Present address is required.';
    return '';
  };

  const goToNextStep = () => {
    const error = validateCurrentStep();
    if (error) {
      notify.error('Validation error', error);
      return;
    }
    const nextStep = admissionSteps[currentStepIndex + 1];
    if (nextStep) setCurrentStep(nextStep.key);
  };

  const goToPreviousStep = () => {
    const previousStep = admissionSteps[currentStepIndex - 1];
    if (previousStep) setCurrentStep(previousStep.key);
  };

  const submit = () => {
    const error = validate();
    if (error) {
      notify.error('Validation error', error);
      return;
    }
    createMutation.mutate();
  };

  const uploadImage = async (file: File, field: keyof AdmissionForm) => {
    if (!file.type.startsWith('image/')) {
      notify.error('Invalid image', 'Only image files are allowed.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      notify.error('Image too large', 'Use an image smaller than 3 MB.');
      return;
    }
    try {
      const uploaded = await uploadStudentPhoto(file);
      setValue(field, uploaded.url);
      notify.success('Image uploaded', 'The image was uploaded successfully.');
    } catch (error: any) {
      notify.error('Upload failed', error?.response?.data?.error?.message ?? 'Unable to upload image.');
    }
  };

  if (isSessionLoading || !session?.role) {
    return <FullPageLoader label="Checking student access..." />;
  }
  if (!canCreateStudent) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm font-semibold text-amber-800">
        Student admission is not enabled for your role. Ask a School Admin to update Role Permissions.
      </section>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-8">
        <PageHeader
          title="Student Admission"
          subtitle="Create student profile, guardian details, and session enrollment."
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Students', href: '/dashboard/students' }, { label: 'Admission' }]}
        />

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-2 md:grid-cols-7">
            {admissionSteps.map((step, index) => {
              const isActive = step.key === currentStep;
              const isComplete = index < currentStepIndex;
              return (
                <button
                  key={step.key}
                  type="button"
                  disabled={index > currentStepIndex}
                  onClick={() => index <= currentStepIndex && setCurrentStep(step.key)}
                  className={`rounded-xl border px-3 py-3 text-left transition ${
                    isActive
                      ? 'border-violet-300 bg-violet-50 text-violet-800 shadow-sm'
                      : isComplete
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70'
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm font-black">
                    <span className={`grid h-6 w-6 place-items-center rounded-full text-xs ${isActive ? 'bg-violet-600 text-white' : isComplete ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      {isComplete ? '✓' : index + 1}
                    </span>
                    {step.label}
                  </span>
                  <span className="mt-1 block text-xs">{step.description}</span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="space-y-5">
            {currentStep === 'academic' ? <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-slate-950">Academic Details</h2>
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Session" required>
                  <select value={form.academicSessionId} onChange={(event) => setValue('academicSessionId', event.target.value)} className={inputClass}>
                    <option value="">Select session</option>
                    {(yearsQuery.data ?? []).map((year: any) => <option key={year.id} value={year.id}>{year.name}{year.isActive ? ' (Active)' : ''}</option>)}
                  </select>
                </Field>
                <Field label="Class" required>
                  <select value={form.classId} onChange={(event) => setForm((prev) => ({ ...prev, classId: event.target.value, sectionId: '' }))} className={inputClass}>
                    <option value="">Select class</option>
                    {(classesQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </Field>
                <Field label="Section" required>
                  <select value={form.sectionId} onChange={(event) => setValue('sectionId', event.target.value)} className={inputClass}>
                    <option value="">Select section</option>
                    {classSections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
                  </select>
                </Field>
                <Field label="Admission number" required>
                  <input value={form.admissionNo} onChange={(event) => setValue('admissionNo', event.target.value)} className={inputClass} />
                </Field>
                <Field label="Roll number" required>
                  <input value={form.rollNo} onChange={(event) => setValue('rollNo', event.target.value)} className={inputClass} />
                </Field>
                <Field label="Admission date" required>
                  <input type="date" value={form.admissionDate} onChange={(event) => setValue('admissionDate', event.target.value)} className={inputClass} />
                </Field>
              </div>
            </section> : null}

            {currentStep === 'fees' ? <section className="space-y-5">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-950">Fee Masters</h2>
                    <p className="mt-1 text-sm text-slate-500">Select one or more active fee masters to assign to this admission.</p>
                  </div>
                  <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.generateFeeInvoices}
                      disabled={!form.feeGroupIds.length}
                      onChange={(event) => setForm((prev) => ({ ...prev, generateFeeInvoices: event.target.checked }))}
                    />
                    Generate invoices
                  </label>
                </div>
                <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="w-16 px-4 py-3 text-left">Select</th>
                        <th className="px-4 py-3 text-left">Fee Master</th>
                        <th className="px-4 py-3 text-left">Group</th>
                        <th className="px-4 py-3 text-left">Fee Type</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                        <th className="px-4 py-3 text-left">Due Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {feeMasters.map((master) => (
                        <tr key={master.id} className={form.feeGroupIds.includes(master.feeGroupId) ? 'bg-violet-50/50' : undefined}>
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={form.feeGroupIds.includes(master.feeGroupId)}
                              onChange={() => toggleFeeGroup(master.feeGroupId)}
                            />
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-900">{master.name}</td>
                          <td className="px-4 py-3 text-slate-600">{master.feeGroup?.name ?? '-'}</td>
                          <td className="px-4 py-3 text-slate-600">{master.feeType?.name ?? '-'}</td>
                          <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(toAmount(master.amount))}</td>
                          <td className="px-4 py-3 text-slate-600">{master.dueDate ? new Date(master.dueDate).toLocaleDateString() : '-'}</td>
                        </tr>
                      ))}
                      {!form.academicSessionId ? <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Select a session to load fee masters.</td></tr> : null}
                      {form.academicSessionId && feeMastersQuery.isFetching ? <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Loading fee masters...</td></tr> : null}
                      {form.academicSessionId && !feeMastersQuery.isFetching && !feeMasters.length ? <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No active fee masters found.</td></tr> : null}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-slate-950">Fee Discounts</h2>
                <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="w-16 px-4 py-3 text-left">Select</th>
                        <th className="px-4 py-3 text-left">Discount Name</th>
                        <th className="px-4 py-3 text-left">Code</th>
                        <th className="px-4 py-3 text-left">Type</th>
                        <th className="px-4 py-3 text-right">Value</th>
                        <th className="px-4 py-3 text-left">Expiry Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {activeStudentEligibleDiscounts.map((discount) => {
                        const expired = isExpired(discount.expiryDate ?? discount.validTo);
                        return (
                          <tr key={discount.id} className={form.discountIds.includes(discount.id) ? 'bg-emerald-50/50' : expired ? 'opacity-60' : undefined}>
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={form.discountIds.includes(discount.id)}
                                disabled={expired || !form.feeGroupIds.length}
                                onChange={() => toggleFeeDiscount(discount)}
                              />
                            </td>
                            <td className="px-4 py-3 font-bold text-slate-900">{discount.discountName ?? 'Fee discount'}</td>
                            <td className="px-4 py-3 text-slate-700">{discount.code ?? '-'}</td>
                            <td className="px-4 py-3 text-slate-700">{discount.valueType === 'PERCENTAGE' ? 'Percentage' : 'Fixed'}</td>
                            <td className="px-4 py-3 text-right font-bold text-slate-900">{discount.valueType === 'PERCENTAGE' ? `${toAmount(discount.value)}%` : formatCurrency(toAmount(discount.amount ?? discount.value))}</td>
                            <td className="px-4 py-3 text-slate-700">{formatDate(discount.expiryDate ?? discount.validTo)}{expired ? <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600">Expired</span> : null}</td>
                          </tr>
                        );
                      })}
                      {!form.academicSessionId ? <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Select a session to load discounts.</td></tr> : null}
                      {form.academicSessionId && feeDiscountsQuery.isFetching ? <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Loading discounts...</td></tr> : null}
                      {form.academicSessionId && !feeDiscountsQuery.isFetching && !activeStudentEligibleDiscounts.length ? <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No active student-eligible discounts found.</td></tr> : null}
                    </tbody>
                  </table>
                </div>
                {!form.feeGroupIds.length ? <p className="mt-3 text-xs font-semibold text-amber-700">Select a fee master before selecting discounts.</p> : null}
              </section>

              <section className="grid gap-5 xl:grid-cols-[1fr_320px]">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-bold text-slate-950">Fee Details</h2>
                  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3 text-left">Fee Group</th>
                          <th className="px-4 py-3 text-left">Fee Master</th>
                          <th className="px-4 py-3 text-left">Fee Type</th>
                          <th className="px-4 py-3 text-left">Due Date</th>
                          <th className="px-4 py-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {selectedFeeMasters.map((master) => (
                          <tr key={master.id}>
                            <td className="px-4 py-3 text-slate-700">{master.feeGroup?.name ?? feeGroups.find((group) => group.id === master.feeGroupId)?.name ?? '-'}</td>
                            <td className="px-4 py-3 font-bold text-slate-900">{master.name}</td>
                            <td className="px-4 py-3 text-slate-700">{master.feeType?.name ?? '-'}</td>
                            <td className="px-4 py-3 text-slate-700">{formatDate(master.dueDate)}</td>
                            <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(toAmount(master.amount))}</td>
                          </tr>
                        ))}
                        {!selectedFeeMasters.length ? <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Select fee groups to preview fee masters.</td></tr> : null}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-bold text-slate-950">Fee Summary</h2>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-500">Sub Total</span>
                      <span className="font-black text-slate-950">{formatCurrency(feeSubTotal)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-500">Discount Total</span>
                      <span className="font-black text-emerald-700">{formatCurrency(feeDiscountTotal)}</span>
                    </div>
                    <div className="border-t border-dashed border-slate-200 pt-3">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-slate-700">Net Payable</span>
                        <span className="text-xl font-black text-violet-700">{formatCurrency(feeNetPayable)}</span>
                      </div>
                    </div>
                  </div>
                  {rawDiscountTotal > feeSubTotal ? (
                    <p className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                      Discount total was capped so payable amount does not go below zero.
                    </p>
                  ) : null}
                  <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs font-semibold text-slate-600">
                    {selectedFeeMasters.length} fee master{selectedFeeMasters.length === 1 ? '' : 's'} selected from {form.feeGroupIds.length} group{form.feeGroupIds.length === 1 ? '' : 's'}.
                  </div>
                </div>
              </section>
            </section> : null}

            {currentStep === 'student' ? <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-slate-950">Student Information</h2>
              <div className="grid gap-4 md:grid-cols-4">
                <Field label="First name" required><input value={form.firstName} onChange={(event) => setValue('firstName', event.target.value)} className={inputClass} /></Field>
                <Field label="Last name" required><input value={form.lastName} onChange={(event) => setValue('lastName', event.target.value)} className={inputClass} /></Field>
                <Field label="Gender" required><select value={form.gender} onChange={(event) => setValue('gender', event.target.value)} className={inputClass}><option value="">Select gender</option>{genderOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></Field>
                <Field label="Date of birth" required><input type="date" value={form.dob} onChange={(event) => setValue('dob', event.target.value)} className={inputClass} /></Field>
                <Field label="Blood group"><select value={form.bloodGroup} onChange={(event) => setValue('bloodGroup', event.target.value)} className={inputClass}><option value="">Select blood group</option>{bloodGroupOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></Field>
                <Field label="Religion"><select value={form.religion} onChange={(event) => setValue('religion', event.target.value)} className={inputClass}><option value="">Select religion</option>{religionOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></Field>
                <Field label="Caste"><select value={form.caste} onChange={(event) => setValue('caste', event.target.value)} className={inputClass}><option value="">Select caste</option>{casteOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></Field>
                <Field label="Category"><select value={form.category} onChange={(event) => setValue('category', event.target.value)} className={inputClass}>{categories.map((item) => <option key={item}>{item}</option>)}</select></Field>
                <Field label="Email"><input type="email" value={form.email} onChange={(event) => setValue('email', event.target.value)} className={inputClass} /></Field>
                <Field label="Phone"><input value={form.phone} onChange={(event) => setValue('phone', event.target.value)} className={inputClass} /></Field>
                <Field label="Height"><input type="number" min="0" step="0.1" value={form.height} onChange={(event) => setValue('height', event.target.value)} className={inputClass} /></Field>
                <Field label="Weight"><input type="number" min="0" step="0.1" value={form.weight} onChange={(event) => setValue('weight', event.target.value)} className={inputClass} /></Field>
              </div>
            </section> : null}

            {currentStep === 'parents' ? <>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-slate-950">Parent / Guardian Information</h2>
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Father name"><input value={form.fatherName} onChange={(event) => setValue('fatherName', event.target.value)} className={inputClass} /></Field>
                <Field label="Father occupation"><input value={form.fatherOccupation} onChange={(event) => setValue('fatherOccupation', event.target.value)} className={inputClass} /></Field>
                <Field label="Father phone"><input value={form.fatherPhone} onChange={(event) => setValue('fatherPhone', event.target.value)} className={inputClass} /></Field>
                <Field label="Mother name"><input value={form.motherName} onChange={(event) => setValue('motherName', event.target.value)} className={inputClass} /></Field>
                <Field label="Mother occupation"><input value={form.motherOccupation} onChange={(event) => setValue('motherOccupation', event.target.value)} className={inputClass} /></Field>
                <Field label="Mother phone"><input value={form.motherPhone} onChange={(event) => setValue('motherPhone', event.target.value)} className={inputClass} /></Field>
                <Field label="Guardian name"><input value={form.guardianName} onChange={(event) => setValue('guardianName', event.target.value)} className={inputClass} /></Field>
                <Field label="Guardian relation"><input value={form.guardianRelationship} onChange={(event) => setValue('guardianRelationship', event.target.value)} className={inputClass} /></Field>
                <Field label="Parent phone"><input value={form.parentPhone} onChange={(event) => setValue('parentPhone', event.target.value)} className={inputClass} /></Field>
                <Field label="Parent email"><input type="email" value={form.parentEmail} onChange={(event) => setValue('parentEmail', event.target.value)} className={inputClass} /></Field>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-950">Parent Login Access</h2>
                  <p className="mt-1 text-sm text-slate-500">Create a parent portal login during admission and link it to this student.</p>
                </div>
                <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.createParentLogin}
                    onChange={(event) => setForm((prev) => ({
                      ...prev,
                      createParentLogin: event.target.checked,
                      parentLoginFirstName: prev.parentLoginFirstName || getParentLoginSourceData(prev.parentLoginSource).firstName,
                      parentLoginLastName: prev.parentLoginLastName || getParentLoginSourceData(prev.parentLoginSource).lastName,
                      parentLoginPhone: prev.parentLoginPhone || getParentLoginSourceData(prev.parentLoginSource).phone,
                      parentLoginEmail: prev.parentLoginEmail || getParentLoginSourceData(prev.parentLoginSource).email,
                    }))}
                  />
                  Create parent login
                </label>
              </div>
              {form.createParentLogin ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Use details from</p>
                    <div className="flex flex-wrap gap-2">
                      {([
                        ['father', 'Father'],
                        ['mother', 'Mother'],
                        ['guardian', 'Guardian'],
                      ] as Array<[ParentLoginSource, string]>).map(([value, label]) => (
                        <label key={value} className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition ${form.parentLoginSource === value ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                          <input
                            type="radio"
                            name="parentLoginSource"
                            checked={form.parentLoginSource === value}
                            onChange={() => applyParentLoginSource(value)}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Login first name" required><input value={form.parentLoginFirstName} onChange={(event) => setValue('parentLoginFirstName', event.target.value)} className={inputClass} /></Field>
                  <Field label="Login last name"><input value={form.parentLoginLastName} onChange={(event) => setValue('parentLoginLastName', event.target.value)} className={inputClass} /></Field>
                  <Field label="Login phone" required><input value={form.parentLoginPhone} onChange={(event) => setValue('parentLoginPhone', event.target.value)} className={inputClass} /></Field>
                  <Field label="Login email"><input type="email" value={form.parentLoginEmail} onChange={(event) => setValue('parentLoginEmail', event.target.value)} className={inputClass} /></Field>
                  <Field label="Send credentials by">
                    <select value={form.parentLoginSendVia} onChange={(event) => setValue('parentLoginSendVia', event.target.value)} className={inputClass}>
                      <option value="SMS">SMS / WhatsApp</option>
                      <option value="EMAIL">Email</option>
                      <option value="BOTH">Both</option>
                    </select>
                  </Field>
                  </div>
                  <p className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                    Temporary password will be generated as first 4 letters of parent name + @ + last 4 digits of mobile.
                  </p>
                </div>
              ) : null}
            </section>
            </> : null}

            {currentStep === 'photos' ? <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-slate-950">Photos</h2>
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  ['Student photo', 'photoUrl'],
                  ['Father photo', 'fatherPhotoUrl'],
                  ['Mother photo', 'motherPhotoUrl'],
                ].map(([label, field]) => (
                  <div key={field} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <p className="mb-2 text-sm font-bold text-slate-800">{label}</p>
                    <input type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && uploadImage(event.target.files[0], field as keyof AdmissionForm)} className="text-sm" />
                    {form[field as keyof AdmissionForm] ? <p className="mt-2 text-xs font-semibold text-emerald-600">Uploaded</p> : <p className="mt-2 text-xs text-slate-500">Optional image upload</p>}
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-xl border border-violet-100 bg-violet-50 p-4">
                <p className="mb-1 text-sm font-bold text-violet-900">Face photos for attendance</p>
                <p className="mb-3 text-xs text-violet-700">Upload multiple clear face photos from different angles. Used for facial attendance recognition.</p>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="text-sm"
                  onChange={async (event) => {
                    const files = Array.from(event.target.files ?? []);
                    if (!files.length) return;
                    const remainingSlots = 4 - form.facePhotoUrls.length;
                    if (remainingSlots <= 0) {
                      notify.error('Face photo limit reached', 'A student can have a maximum of 4 face photos.');
                      event.target.value = '';
                      return;
                    }
                    if (files.length > remainingSlots) {
                      notify.error('Too many face photos', `You can add ${remainingSlots} more face photo${remainingSlots === 1 ? '' : 's'} for this student.`);
                      event.target.value = '';
                      return;
                    }
                    const oversized = files.find((f) => f.size > 3 * 1024 * 1024);
                    if (oversized) { notify.error('Image too large', `"${oversized.name}" exceeds 3 MB.`); return; }
                    try {
                      const uploaded = await Promise.all(files.map((f) => uploadStudentPhoto(f)));
                      setForm((prev) => ({ ...prev, facePhotoUrls: [...prev.facePhotoUrls, ...uploaded.map((u) => u.url)] }));
                      notify.success('Face photos uploaded', `${files.length} photo${files.length > 1 ? 's' : ''} uploaded successfully.`);
                    } catch (error: any) {
                      notify.error('Upload failed', error?.response?.data?.error?.message ?? 'Unable to upload face photos.');
                    }
                    event.target.value = '';
                  }}
                />
                {form.facePhotoUrls.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-2 text-xs font-semibold text-violet-800">{form.facePhotoUrls.length} face photo{form.facePhotoUrls.length > 1 ? 's' : ''} uploaded</p>
                    <div className="flex flex-wrap gap-2">
                      {form.facePhotoUrls.map((url, index) => (
                        <div key={url} className="group relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={`Face ${index + 1}`} className="h-16 w-16 rounded-lg border border-violet-200 object-cover" />
                          <button
                            type="button"
                            onClick={() => setForm((prev) => ({ ...prev, facePhotoUrls: prev.facePhotoUrls.filter((_, i) => i !== index) }))}
                            className="absolute -right-1 -top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white group-hover:flex"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section> : null}

            {currentStep === 'address' ? <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-slate-950">Address & Siblings</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Present address" required><textarea value={form.presentAddress} onChange={(event) => setValue('presentAddress', event.target.value)} rows={4} className={inputClass} /></Field>
                <Field label="Permanent address"><textarea value={sameAddress ? form.presentAddress : form.permanentAddress} onChange={(event) => setValue('permanentAddress', event.target.value)} rows={4} disabled={sameAddress} className={inputClass} /></Field>
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input type="checkbox" checked={sameAddress} onChange={(event) => setSameAddress(event.target.checked)} />
                Permanent address is same as present address
              </label>
              <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <h3 className="text-base font-bold text-slate-950">Sibling Linking</h3>
                <p className="mt-1 text-sm text-slate-500">Select class and section first, then choose students from that filtered list.</p>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <Field label="Sibling class">
                    <select
                      value={siblingFilters.classId}
                      onChange={(event) => {
                        setSiblingFilters({ classId: event.target.value, sectionId: '', search: '' });
                      }}
                      className={inputClass}
                    >
                      <option value="">Select class</option>
                      {(classesQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Sibling section">
                    <select
                      value={siblingFilters.sectionId}
                      onChange={(event) => setSiblingFilters((prev) => ({ ...prev, sectionId: event.target.value }))}
                      disabled={!siblingFilters.classId}
                      className={inputClass}
                    >
                      <option value="">Select section</option>
                      {siblingClassSections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Search student">
                    <input
                      value={siblingFilters.search}
                      onChange={(event) => setSiblingFilters((prev) => ({ ...prev, search: event.target.value }))}
                      disabled={!siblingFilters.sectionId}
                      placeholder="Name or admission no"
                      className={inputClass}
                    />
                  </Field>
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="mb-2 text-sm font-bold text-slate-800">Filtered students</p>
                    {!siblingFilters.classId || !siblingFilters.sectionId ? (
                      <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">Choose class and section to load students.</p>
                    ) : siblingsQuery.isFetching ? (
                      <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">Loading students...</p>
                    ) : filteredSiblingOptions.length ? (
                      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                        {filteredSiblingOptions.map((student) => {
                          const name = student.fullName ?? `${student.firstName} ${student.lastName}`.trim();
                          return (
                            <button
                              key={student.id}
                              type="button"
                              onClick={() => toggleSibling(student)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                            >
                              <span className="font-bold">{name}</span>
                              <span className="ml-2 text-xs text-slate-500">({student.admissionNo})</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">No students found for this class and section.</p>
                    )}
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="mb-2 text-sm font-bold text-slate-800">Selected siblings</p>
                    {form.siblingIds.length ? (
                      <div className="space-y-2">
                        {form.siblingIds.map((id) => {
                          const student = selectedSiblingSummaries[id];
                          const name = student?.name ?? 'Selected student';
                          return (
                            <div key={id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                              <span className="font-semibold text-slate-800">{name}{student?.admissionNo ? <span className="ml-2 text-xs font-normal text-slate-500">({student.admissionNo})</span> : null}</span>
                              <button type="button" onClick={() => removeSibling(id)} className="text-xs font-bold text-red-600">Remove</button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">No sibling selected.</p>
                    )}
                  </div>
                </div>
              </div>
            </section> : null}

            {currentStep === 'review' ? <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-slate-950">Review Admission</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <h3 className="mb-3 font-bold text-slate-950">Academic</h3>
                  <p className="text-sm text-slate-600">Admission: <span className="font-semibold text-slate-900">{form.admissionNo || '-'}</span></p>
                  <p className="text-sm text-slate-600">Roll: <span className="font-semibold text-slate-900">{form.rollNo || '-'}</span></p>
                  <p className="text-sm text-slate-600">Admission date: <span className="font-semibold text-slate-900">{form.admissionDate || '-'}</span></p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <h3 className="mb-3 font-bold text-slate-950">Fees Details</h3>
                  <p className="text-sm text-slate-600">Fee groups: <span className="font-semibold text-slate-900">{form.feeGroupIds.length}</span></p>
                  <p className="text-sm text-slate-600">Discounts: <span className="font-semibold text-slate-900">{form.discountIds.length}</span></p>
                  <p className="text-sm text-slate-600">Net payable: <span className="font-semibold text-slate-900">{formatCurrency(feeNetPayable)}</span></p>
                  <p className="text-sm text-slate-600">Generate invoices: <span className="font-semibold text-slate-900">{form.generateFeeInvoices && form.feeGroupIds.length ? 'Yes' : 'No'}</span></p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <h3 className="mb-3 font-bold text-slate-950">Student</h3>
                  <p className="text-sm text-slate-600">Name: <span className="font-semibold text-slate-900">{`${form.firstName} ${form.lastName}`.trim() || '-'}</span></p>
                  <p className="text-sm text-slate-600">Gender: <span className="font-semibold text-slate-900">{form.gender || '-'}</span></p>
                  <p className="text-sm text-slate-600">DOB: <span className="font-semibold text-slate-900">{form.dob || '-'}</span></p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <h3 className="mb-3 font-bold text-slate-950">Parents</h3>
                  <p className="text-sm text-slate-600">Guardian: <span className="font-semibold text-slate-900">{form.guardianName || form.fatherName || form.motherName || '-'}</span></p>
                  <p className="text-sm text-slate-600">Parent login: <span className="font-semibold text-slate-900">{form.createParentLogin ? 'Will be created' : 'Not enabled'}</span></p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <h3 className="mb-3 font-bold text-slate-950">Address & Links</h3>
                  <p className="text-sm text-slate-600">Present address: <span className="font-semibold text-slate-900">{form.presentAddress || '-'}</span></p>
                  <p className="text-sm text-slate-600">Siblings selected: <span className="font-semibold text-slate-900">{form.siblingIds.length}</span></p>
                </div>
              </div>
            </section> : null}
          </div>

          <aside className="space-y-5">
            <section className="sticky top-24 rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">Admission Summary</h2>
              <div className="mt-4 space-y-3 text-sm">
                <p><span className="font-semibold text-slate-500">Step:</span> {currentStepIndex + 1} of {admissionSteps.length}</p>
                <p><span className="font-semibold text-slate-500">Name:</span> {`${form.firstName} ${form.lastName}`.trim() || '-'}</p>
                <p><span className="font-semibold text-slate-500">Admission:</span> {form.admissionNo || '-'}</p>
                <p><span className="font-semibold text-slate-500">Roll:</span> {form.rollNo || '-'}</p>
                <p><span className="font-semibold text-slate-500">Guardian:</span> {form.guardianName || form.fatherName || form.motherName || '-'}</p>
                <p><span className="font-semibold text-slate-500">Fee groups:</span> {form.feeGroupIds.length}</p>
                <p><span className="font-semibold text-slate-500">Net payable:</span> {formatCurrency(feeNetPayable)}</p>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-2">
                <button onClick={goToPreviousStep} disabled={isFirstStep || createMutation.isPending} className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">
                  Back
                </button>
                {isLastStep ? (
                  <button onClick={submit} disabled={createMutation.isPending} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--theme-button-bg)] px-5 py-3 text-sm font-bold text-[var(--theme-button-text)] shadow-sm disabled:opacity-50">
                    <Icon path="M5 13l4 4L19 7" />
                    {createMutation.isPending ? 'Saving...' : 'Save'}
                  </button>
                ) : (
                  <button onClick={goToNextStep} disabled={createMutation.isPending} className="inline-flex items-center justify-center rounded-xl bg-[var(--theme-button-bg)] px-5 py-3 text-sm font-bold text-[var(--theme-button-text)] shadow-sm disabled:opacity-50">
                    Next
                  </button>
                )}
              </div>
              <div className="mt-2">
                <Link href="/dashboard/students" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700">
                  Cancel
                </Link>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
