'use client';

import { useMemo, useState } from 'react';
import { City, State } from 'country-state-city';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { listAcademicYears, listClasses, listSections } from '../../../../services/academic.service';
import { getSession } from '../../../../services/auth.service';
import { createParent, createStudent, linkParent, lookupParentByPhone, deleteStudent, uploadStudentPhoto, uploadStudentDocument, resolveUploadUrl, addStudentPhoto, updateStudent } from '../../../../services/student.service';
import { useNotify } from '../../../../components/NotificationProvider';
import FullPageLoader from '../../../../components/FullPageLoader';

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

const steps: Array<{ id: Step; title: string }> = [
  { id: 1, title: 'Academic' },
  { id: 2, title: 'Student' },
  { id: 3, title: 'Parent' },
  { id: 4, title: 'Address' },
  { id: 5, title: 'Medical' },
  { id: 6, title: 'Documents' },
  { id: 7, title: 'Access' },
  { id: 8, title: 'Review' },
];

export default function StudentOnboardingPage() {
  const router = useRouter();
  const notify = useNotify();
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [academic, setAcademic] = useState({
    yearId: '',
    classId: '',
    sectionId: '',
    admissionNo: '',
    rollNo: '',
  });
  const [student, setStudent] = useState({
    fullName: '',
    gender: '',
    dob: '',
    bloodGroup: '',
    photo: '',
  });
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [additionalPhotoFiles, setAdditionalPhotoFiles] = useState<File[]>([]);
  const [additionalPhotos, setAdditionalPhotos] = useState<string[]>([]);
  const [parent, setParent] = useState({
    fatherName: '',
    motherName: '',
    guardianName: '',
    relationship: '',
    phone: '',
    email: '',
  });
  const [address, setAddress] = useState({
    line1: '',
    line2: '',
    city: '',
    state: '',
    pincode: '',
    emergency: '',
  });
  const [medical, setMedical] = useState({
    conditions: '',
    allergies: '',
    doctor: '',
  });
  const [documents, setDocuments] = useState({
    birthCert: '',
    transferCert: '',
    aadhaar: '',
    reportCard: '',
  });
  const [documentFiles, setDocumentFiles] = useState<{
    birthCert: File | null;
    transferCert: File | null;
    aadhaar: File | null;
    reportCard: File | null;
  }>({
    birthCert: null,
    transferCert: null,
    aadhaar: null,
    reportCard: null,
  });
  const [access, setAccess] = useState({
    studentLogin: false,
    parentLogin: true,
    sendVia: 'SMS',
  });
  const [bulkOpen, setBulkOpen] = useState(false);
  const [createStatus, setCreateStatus] = useState<'idle' | 'success'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedParentUserId, setSelectedParentUserId] = useState('');
  const [stepError, setStepError] = useState('');

  const { data: session } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const schoolId = session?.schoolId ?? undefined;

  const { data: years } = useQuery({
    queryKey: ['academic-years', schoolId],
    queryFn: () => listAcademicYears({ schoolId }),
    enabled: Boolean(schoolId),
  });
  const { data: classes } = useQuery({
    queryKey: ['classes', schoolId],
    queryFn: () => listClasses({ schoolId }),
    enabled: Boolean(schoolId),
  });
  const { data: sections } = useQuery({
    queryKey: ['sections', schoolId],
    queryFn: () => listSections({ schoolId }),
    enabled: Boolean(schoolId),
  });
  const phoneForLookup = (parent.phone || '').trim();
  const { data: parentLookup } = useQuery({
    queryKey: ['parent-lookup', phoneForLookup],
    queryFn: () => lookupParentByPhone(phoneForLookup),
    enabled: access.parentLogin && phoneForLookup.length === 10,
  });

  const classOptions = useMemo(() => classes ?? [], [classes]);
  const sectionOptions = useMemo(
    () => (sections ?? []).filter((section: { classId: string }) => section.classId === academic.classId),
    [sections, academic.classId],
  );
  const stateOptions = useMemo(() => State.getStatesOfCountry('IN'), []);
  const selectedStateCode = useMemo(() => {
    const match = stateOptions.find((state) => state.name === address.state);
    return match?.isoCode ?? '';
  }, [stateOptions, address.state]);
  const cityOptions = useMemo(() => {
    if (!selectedStateCode) return [];
    return City.getCitiesOfState('IN', selectedStateCode);
  }, [selectedStateCode]);

  const yearLookup = useMemo(() => {
    const map = new Map<string, string>();
    (years ?? []).forEach((year: { id: string; name: string }) => map.set(year.id, year.name));
    return map;
  }, [years]);

  const classLookup = useMemo(() => {
    const map = new Map<string, string>();
    (classes ?? []).forEach((cls: { id: string; name: string }) => map.set(cls.id, cls.name));
    return map;
  }, [classes]);

  const sectionLookup = useMemo(() => {
    const map = new Map<string, string>();
    (sections ?? []).forEach((section: { id: string; name: string }) => map.set(section.id, section.name));
    return map;
  }, [sections]);

  const parentMatches = useMemo(() => {
    if (!parentLookup?.found) return [];
    return [parentLookup];
  }, [parentLookup]);

  const summary = useMemo(
    () => ({
      academic,
      student,
      parent,
      address,
      medical,
      documents,
      access,
    }),
    [academic, student, parent, address, medical, documents, access],
  );

  const nextStep = () => {
    let error = '';
    const nameMin = 3;
    const isNameValid = (value: string) => value.trim().length >= nameMin;
    const isPhoneValid = (value: string) => /^[0-9]{10}$/.test(value.trim());
    const isEmailValid = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
    if (step === 1) {
      if (!academic.yearId) error = 'Academic year is required.';
      else if (!academic.classId) error = 'Class is required.';
      else if (sectionOptions.length > 0 && !academic.sectionId) error = 'Section is required.';
      else if (!academic.admissionNo.trim()) error = 'Admission number is required.';
      else if (academic.admissionNo.trim().length < 3) error = 'Admission number must be at least 3 characters.';
      else if (academic.rollNo.trim() && academic.rollNo.trim().length < 1) error = 'Roll number is invalid.';
    }
    if (step === 2) {
      if (!student.fullName.trim()) error = 'Student full name is required.';
      else if (!isNameValid(student.fullName)) error = 'Student name must be at least 3 characters.';
      else if (!student.gender) error = 'Gender is required.';
      else if (!student.dob) error = 'Date of birth is required.';
      else if (student.bloodGroup && !student.bloodGroup.trim()) error = 'Blood group is invalid.';
    }
    if (step === 3) {
      if (!parent.fatherName.trim()) error = 'Father name is required.';
      else if (!isNameValid(parent.fatherName)) error = 'Father name must be at least 3 characters.';
      else if (!parent.motherName.trim()) error = 'Mother name is required.';
      else if (!isNameValid(parent.motherName)) error = 'Mother name must be at least 3 characters.';
      else if (!parent.guardianName.trim()) error = 'Primary guardian name is required.';
      else if (!isNameValid(parent.guardianName)) error = 'Primary guardian name must be at least 3 characters.';
      else if (!parent.relationship.trim()) error = 'Relationship is required.';
      else if (!parent.phone.trim()) error = 'Mobile number is required.';
      else if (!isPhoneValid(parent.phone)) error = 'Mobile number must be 10 digits.';
      else if (parent.email.trim() && !isEmailValid(parent.email)) error = 'Email address is invalid.';
    }
    if (step === 4) {
      if (!address.line1.trim()) error = 'Address line 1 is required.';
      else if (!address.state.trim()) error = 'State is required.';
      else if (cityOptions.length > 0 && !address.city.trim()) error = 'City is required.';
      else if (!address.pincode.trim()) error = 'Pincode is required.';
      else if (!/^[0-9]{6}$/.test(address.pincode.trim())) error = 'Pincode must be 6 digits.';
      else if (!address.emergency.trim()) error = 'Emergency contact number is required.';
      else if (!isPhoneValid(address.emergency)) error = 'Emergency contact must be 10 digits.';
    }
    if (step === 7) {
      if (access.parentLogin) {
        const phone = parent.phone.trim();
        if (!isPhoneValid(phone)) {
          error = 'Enter a valid 10-digit parent mobile number.';
        } else if (parentMatches.length > 0 && !selectedParentUserId) {
          error = 'Select an existing parent to continue.';
        }
      }
    }
    setStepError(error);
    if (error) {
      notify.error('Validation error', error);
      return;
    }
    setStep((prev) => (prev < 8 ? ((prev + 1) as Step) : prev));
    notify.success('Step saved', 'Continue to the next section.');
  };
  const prevStep = () => {
    setStepError('');
    setStep((prev) => (prev > 1 ? ((prev - 1) as Step) : prev));
  };

  const createMutation = useMutation({
    mutationFn: createStudent,
  });

  const handleConfirmCreate = async () => {
    let createdStudentId: string | null = null;
    try {
      setErrorMessage('');
      setSubmitting(true);
      const createdStudent = await createMutation.mutateAsync({
        admissionNo: academic.admissionNo,
        fullName: student.fullName,
        dob: student.dob || undefined,
        gender: student.gender || undefined,
        bloodGroup: student.bloodGroup || undefined,
        photoUrl: undefined,
        fatherName: parent.fatherName || undefined,
        motherName: parent.motherName || undefined,
        guardianName: parent.guardianName || undefined,
        guardianRelationship: parent.relationship || undefined,
        parentPhone: parent.phone || undefined,
        parentEmail: parent.email || undefined,
        addressLine1: address.line1 || undefined,
        addressLine2: address.line2 || undefined,
        city: address.city || undefined,
        state: address.state || undefined,
        pincode: address.pincode || undefined,
        emergencyContact: address.emergency || undefined,
        medicalConditions: medical.conditions || undefined,
        allergies: medical.allergies || undefined,
        doctorContact: medical.doctor || undefined,
        docBirthCert: undefined,
        docTransferCert: undefined,
        docAadhaar: undefined,
        docReportCard: undefined,
        classId: academic.classId || undefined,
        sectionId: academic.sectionId || undefined,
        schoolId,
      });
      createdStudentId = createdStudent?.id ?? null;

      if (createdStudentId) {
        if (photoFile) {
          try {
            const uploaded = await uploadStudentPhoto(photoFile, { schoolId, studentId: createdStudentId });
            await updateStudent(createdStudentId, { photoUrl: uploaded.url });
            notify.success('Photo uploaded', 'Student photo uploaded successfully.');
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Photo upload failed';
            notify.error('Photo upload failed', message);
          }
        }
        if (additionalPhotoFiles.length) {
          let successCount = 0;
          for (const file of additionalPhotoFiles) {
            try {
              const uploaded = await uploadStudentPhoto(file, { schoolId, studentId: createdStudentId });
              await addStudentPhoto(createdStudentId, uploaded.url);
              successCount += 1;
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Additional photo upload failed';
              notify.error('Additional photo failed', message);
            }
          }
          if (successCount > 0) {
            notify.success('Additional photos uploaded', `${successCount} photo(s) added.`);
          }
        }
        const docUpdates: Record<string, string> = {};
        if (documentFiles.birthCert) {
          try {
            const uploaded = await uploadStudentDocument(documentFiles.birthCert, createdStudentId, { schoolId });
            docUpdates.docBirthCert = uploaded.url;
            notify.success('Document uploaded', 'Birth certificate uploaded.');
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Birth certificate upload failed';
            notify.error('Document upload failed', message);
          }
        }
        if (documentFiles.transferCert) {
          try {
            const uploaded = await uploadStudentDocument(documentFiles.transferCert, createdStudentId, { schoolId });
            docUpdates.docTransferCert = uploaded.url;
            notify.success('Document uploaded', 'Transfer certificate uploaded.');
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Transfer certificate upload failed';
            notify.error('Document upload failed', message);
          }
        }
        if (documentFiles.aadhaar) {
          try {
            const uploaded = await uploadStudentDocument(documentFiles.aadhaar, createdStudentId, { schoolId });
            docUpdates.docAadhaar = uploaded.url;
            notify.success('Document uploaded', 'Aadhaar uploaded.');
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Aadhaar upload failed';
            notify.error('Document upload failed', message);
          }
        }
        if (documentFiles.reportCard) {
          try {
            const uploaded = await uploadStudentDocument(documentFiles.reportCard, createdStudentId, { schoolId });
            docUpdates.docReportCard = uploaded.url;
            notify.success('Document uploaded', 'Report card uploaded.');
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Report card upload failed';
            notify.error('Document upload failed', message);
          }
        }
        if (Object.keys(docUpdates).length) {
          await updateStudent(createdStudentId, docUpdates);
        }
      }

      const guardianName = parent.guardianName || parent.fatherName || parent.motherName;
      if (selectedParentUserId) {
        const parentParts = guardianName?.trim().split(/\s+/) ?? [];
        const parentFirst = parentParts[0] ?? 'Parent';
        const parentLast = parentParts.slice(1).join(' ') || 'Account';
        const createdParent = await createParent({
          firstName: parentFirst,
          lastName: parentLast,
          phone: parent.phone || undefined,
          email: parent.email || undefined,
          userId: selectedParentUserId,
          createLogin: false,
          schoolId,
        });
        if (createdParent?.id) {
          await linkParent(createdStudent.id, createdParent.id);
        }
      } else if (guardianName || parent.phone || parent.email) {
        const parentParts = guardianName?.trim().split(/\s+/) ?? [];
        const parentFirst = parentParts[0] ?? 'Parent';
        const parentLast = parentParts.slice(1).join(' ') || 'Account';
          const createdParent = await createParent({
            firstName: parentFirst,
            lastName: parentLast,
          phone: parent.phone || undefined,
          email: parent.email || undefined,
          createLogin: access.parentLogin,
          sendVia: access.sendVia as 'SMS' | 'EMAIL' | 'BOTH',
          schoolId,
        });
        if (createdParent?.id && createdStudent?.id) {
          await linkParent(createdStudent.id, createdParent.id);
        }
      }

      setCreateStatus('success');
      notify.success('Student created successfully!', `${student.fullName} has been added to the system`);
      setTimeout(() => router.push('/dashboard/students'), 800);
    } catch (error: any) {
      if (createdStudentId) {
        try {
          await deleteStudent(createdStudentId);
        } catch {
          // Best-effort rollback.
        }
      }
      setCreateStatus('idle');
      const message =
        error?.response?.data?.error?.message ||
        error?.message ||
        'Something went wrong. Please check the form.';
      setErrorMessage(message);
      notify.error('Failed to create student', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-green-50/40">
      {submitting ? <FullPageLoader label="Saving student..." /> : null}
      
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-600 via-green-600 to-teal-700 px-6 py-16 text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative mx-auto max-w-6xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="mb-4 inline-flex items-center rounded-full bg-white/20 px-4 py-2 text-sm font-medium backdrop-blur-sm">
                <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                </svg>
                Student Enrollment
              </div>
              <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
                Add New Student
              </h1>
              <p className="max-w-2xl text-lg text-emerald-100">
                Complete step-by-step enrollment process for accurate academic mapping and comprehensive student records.
              </p>
            </div>
            
            <button
              onClick={() => setBulkOpen(true)}
              className="hidden sm:flex items-center rounded-xl bg-white/20 px-6 py-3 font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/30 hover:scale-105"
            >
              <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              Bulk Upload
            </button>
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
            {steps.map((item, index) => {
              const isActive = step === item.id;
              const isCompleted = step > item.id;
              const stepIcons = {
                1: <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" /></svg>,
                2: <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" /></svg>,
                3: <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" /></svg>,
                4: <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>,
                5: <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" /></svg>,
                6: <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm3 5a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm0 3a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" clipRule="evenodd" /></svg>,
                7: <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-4 4-4-4 4-4 .257-.257A6 6 0 1118 8zm-6-2a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>,
                8: <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
              };
              
              return (
                <div key={item.id} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                      isCompleted 
                        ? 'border-emerald-500 bg-emerald-500 text-white' 
                        : isActive 
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-600' 
                        : 'border-gray-300 bg-white text-gray-400'
                    }`}>
                      {isCompleted ? (
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        stepIcons[item.id as keyof typeof stepIcons] || item.id
                      )}
                    </div>
                    <span className={`mt-2 text-xs font-medium ${
                      isActive ? 'text-emerald-600' : isCompleted ? 'text-emerald-500' : 'text-gray-500'
                    }`}>
                      {item.title}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`mx-4 h-0.5 w-12 transition-colors ${
                      step > item.id ? 'bg-emerald-500' : 'bg-gray-300'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

      {step === 1 ? (
        <div className="rounded-2xl bg-white p-8 shadow-lg ring-1 ring-gray-200">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Academic Information</h2>
            <p className="mt-2 text-sm text-gray-600">Set up the academic details and class assignment for the student.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Academic Year *</label>
              <select
                value={academic.yearId}
                onChange={(e) => setAcademic({ ...academic, yearId: e.target.value })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
                disabled={!years?.length}
              >
                <option value="">
                  {years?.length ? 'Select academic year' : 'No academic years available'}
                </option>
                {years?.map((year: { id: string; name: string }) => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Class *</label>
              <select
                value={academic.classId}
                onChange={(e) => setAcademic({ ...academic, classId: e.target.value, sectionId: '' })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
                disabled={!classOptions.length}
              >
                <option value="">
                  {classOptions.length ? 'Select class' : 'No classes available'}
                </option>
                {classOptions.map((cls: { id: string; name: string }) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Section</label>
              <select
                value={academic.sectionId}
                onChange={(e) => setAcademic({ ...academic, sectionId: e.target.value })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
                disabled={!academic.classId || !sectionOptions.length}
              >
                <option value="">
                  {sectionOptions.length ? 'Select section' : 'No sections available'}
                </option>
                {sectionOptions.map((section: { id: string; name: string }) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Admission Number *</label>
              <input
                value={academic.admissionNo}
                onChange={(e) => setAcademic({ ...academic, admissionNo: e.target.value })}
                placeholder="Enter admission number"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Roll Number</label>
              <input
                value={academic.rollNo}
                onChange={(e) => setAcademic({ ...academic, rollNo: e.target.value })}
                placeholder="Enter roll number (optional)"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
              />
            </div>
          </div>
          <div className="mt-8 flex justify-end">
            <button 
              className="rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 px-8 py-3 font-semibold text-white shadow-lg transition-all hover:from-emerald-700 hover:to-green-700 hover:shadow-xl hover:scale-105" 
              onClick={nextStep}
            >
              Save & Continue
              <svg className="ml-2 inline h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="rounded-2xl bg-white p-8 shadow-lg ring-1 ring-gray-200">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Student Profile</h2>
            <p className="mt-2 text-sm text-gray-600">Enter the student's personal information and upload their photo.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
              <input
                value={student.fullName}
                onChange={(e) => setStudent({ ...student, fullName: e.target.value })}
                placeholder="Enter student's full name"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Gender *</label>
              <select
                value={student.gender}
                onChange={(e) => setStudent({ ...student, gender: e.target.value })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
              >
                <option value="">Select gender</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth *</label>
              <input
                type="date"
                value={student.dob}
                onChange={(e) => setStudent({ ...student, dob: e.target.value })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Blood Group</label>
              <select
                value={student.bloodGroup}
                onChange={(e) => setStudent({ ...student, bloodGroup: e.target.value })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
              >
                <option value="">Select blood group (optional)</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Student Photo</label>
              <p className="text-xs text-gray-500 mb-3">Upload a clear photo of the student (Max 10MB, JPG/PNG format)</p>
              <div className="flex items-center gap-4">
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setPhotoFile(file);
                    setPhotoPreview(URL.createObjectURL(file));
                    notify.success('Photo selected', 'Student photo ready to upload.');
                  }}
                  className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
                />
                {photoPreview && (
                  <div className="relative">
                    <img src={photoPreview} alt="Student preview" className="h-16 w-16 rounded-xl object-cover ring-2 ring-emerald-200" />
                    <div className="absolute -top-2 -right-2 rounded-full bg-emerald-500 p-1">
                      <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Additional Photos</label>
              <p className="text-xs text-gray-500 mb-3">Upload up to 5 additional photos (Max 10MB each, JPG/PNG format)</p>
              <div className="space-y-3">
                {additionalPhotos.length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {additionalPhotos.map((photo, index) => (
                      <div key={index} className="relative">
                        <img src={photo} alt={`Additional ${index + 1}`} className="h-20 w-20 rounded-xl object-cover ring-2 ring-emerald-200" />
                        <div className="absolute -top-2 -right-2 rounded-full bg-emerald-500 p-1">
                          <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={async (e) => {
                    const files = Array.from(e.target.files ?? []);
                    if (!files.length) return;
                    const remaining = Math.max(0, 5 - additionalPhotoFiles.length);
                    const toStore = files.slice(0, remaining);
                    setAdditionalPhotoFiles((prev) => [...prev, ...toStore]);
                    const previews = toStore.map((file) => URL.createObjectURL(file));
                    setAdditionalPhotos((prev) => [...prev, ...previews]);
                  }}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
                />
              </div>
            </div>
          </div>
          <div className="mt-8 flex justify-between">
            <button 
              className="rounded-xl border border-gray-300 px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50" 
              onClick={prevStep}
            >
              <svg className="mr-2 inline h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <button 
              className="rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 px-8 py-3 font-semibold text-white shadow-lg transition-all hover:from-emerald-700 hover:to-green-700 hover:shadow-xl hover:scale-105" 
              onClick={nextStep}
            >
              Save & Continue
              <svg className="ml-2 inline h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="rounded-2xl bg-white p-8 shadow-lg ring-1 ring-gray-200">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Parent / Guardian Information</h2>
            <p className="mt-2 text-sm text-gray-600">Enter parent and guardian details for communication and emergency contacts.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Father Name *</label>
              <input
                value={parent.fatherName}
                onChange={(e) => setParent({ ...parent, fatherName: e.target.value })}
                placeholder="Enter father's full name"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Mother Name *</label>
              <input
                value={parent.motherName}
                onChange={(e) => setParent({ ...parent, motherName: e.target.value })}
                placeholder="Enter mother's full name"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Primary Guardian Name *</label>
              <input
                value={parent.guardianName}
                onChange={(e) => setParent({ ...parent, guardianName: e.target.value })}
                placeholder="Enter primary guardian's name"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Relationship *</label>
              <select
                value={parent.relationship}
                onChange={(e) => setParent({ ...parent, relationship: e.target.value })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
              >
                <option value="">Select relationship</option>
                <option value="FATHER">Father</option>
                <option value="MOTHER">Mother</option>
                <option value="GUARDIAN">Guardian</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Mobile Number *</label>
              <input
                value={parent.phone}
                onChange={(e) => setParent({ ...parent, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                placeholder="Enter 10-digit mobile number"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
              <input
                value={parent.email}
                onChange={(e) => setParent({ ...parent, email: e.target.value })}
                placeholder="Enter email address (optional)"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
              />
            </div>
          </div>
          <div className="mt-8 flex justify-between">
            <button 
              className="rounded-xl border border-gray-300 px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50" 
              onClick={prevStep}
            >
              <svg className="mr-2 inline h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <button 
              className="rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 px-8 py-3 font-semibold text-white shadow-lg transition-all hover:from-emerald-700 hover:to-green-700 hover:shadow-xl hover:scale-105" 
              onClick={nextStep}
            >
              Save & Continue
              <svg className="ml-2 inline h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="rounded-2xl bg-white p-8 shadow-lg ring-1 ring-gray-200">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Address & Communication</h2>
            <p className="mt-2 text-sm text-gray-600">Provide residential address and emergency contact information.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Address Line 1 *</label>
              <input
                value={address.line1}
                onChange={(e) => setAddress({ ...address, line1: e.target.value })}
                placeholder="Enter house number, street name"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Address Line 2</label>
              <input
                value={address.line2}
                onChange={(e) => setAddress({ ...address, line2: e.target.value })}
                placeholder="Enter area, locality (optional)"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">State *</label>
              <select
                value={address.state}
                onChange={(e) => setAddress({ ...address, state: e.target.value, city: '' })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
              >
                <option value="">Select state</option>
                {stateOptions.map((state) => (
                  <option key={state.isoCode} value={state.name}>
                    {state.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
              <select
                value={address.city}
                onChange={(e) => setAddress({ ...address, city: e.target.value })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
                disabled={!address.state || cityOptions.length === 0}
              >
                <option value="">
                  {!address.state
                    ? 'Select state first'
                    : cityOptions.length
                    ? 'Select city'
                    : 'No cities available'}
                </option>
                {cityOptions.map((city) => (
                  <option key={`${city.name}-${city.latitude}-${city.longitude}`} value={city.name}>
                    {city.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Pincode *</label>
              <input
                value={address.pincode}
                onChange={(e) => setAddress({ ...address, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                placeholder="Enter 6-digit pincode"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Emergency Contact *</label>
              <input
                value={address.emergency}
                onChange={(e) => setAddress({ ...address, emergency: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                placeholder="Enter 10-digit emergency number"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
              />
            </div>
          </div>
          <div className="mt-8 flex justify-between">
            <button 
              className="rounded-xl border border-gray-300 px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50" 
              onClick={prevStep}
            >
              <svg className="mr-2 inline h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <button 
              className="rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 px-8 py-3 font-semibold text-white shadow-lg transition-all hover:from-emerald-700 hover:to-green-700 hover:shadow-xl hover:scale-105" 
              onClick={nextStep}
            >
              Save & Continue
              <svg className="ml-2 inline h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      ) : null}

      {step === 5 ? (
        <div className="rounded-2xl bg-white p-8 shadow-lg ring-1 ring-gray-200">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Health Information</h2>
            <p className="mt-2 text-sm text-gray-600">Provide medical details for emergency situations and health monitoring.</p>
          </div>
          <div className="grid gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Medical Conditions</label>
              <textarea
                value={medical.conditions}
                onChange={(e) => setMedical({ ...medical, conditions: e.target.value })}
                placeholder="List any known medical conditions (optional)"
                rows={3}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Allergies</label>
              <textarea
                value={medical.allergies}
                onChange={(e) => setMedical({ ...medical, allergies: e.target.value })}
                placeholder="List any known allergies (optional)"
                rows={3}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Doctor Contact</label>
              <input
                value={medical.doctor}
                onChange={(e) => setMedical({ ...medical, doctor: e.target.value })}
                placeholder="Family doctor name and contact (optional)"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
              />
            </div>
          </div>
          <div className="mt-8 flex justify-between">
            <button 
              className="rounded-xl border border-gray-300 px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50" 
              onClick={prevStep}
            >
              <svg className="mr-2 inline h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <button 
              className="rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 px-8 py-3 font-semibold text-white shadow-lg transition-all hover:from-emerald-700 hover:to-green-700 hover:shadow-xl hover:scale-105" 
              onClick={nextStep}
            >
              Save & Continue
              <svg className="ml-2 inline h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      ) : null}

      {step === 6 ? (
        <div className="rounded-2xl bg-white p-8 shadow-lg ring-1 ring-gray-200">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Documents Upload</h2>
            <p className="mt-2 text-sm text-gray-600">Upload required documents for student verification and records.</p>
            <p className="text-xs text-gray-500 mt-1">Maximum file size: 20MB per file. Supported formats: PDF, DOC, DOCX, Images</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {[
              { key: 'birthCert', label: 'Birth Certificate', required: true },
              { key: 'transferCert', label: 'Transfer Certificate', required: true },
              { key: 'aadhaar', label: 'Aadhaar Card', required: false },
              { key: 'reportCard', label: 'Previous Report Card', required: true },
            ].map((item) => (
              <div key={item.key} className="rounded-xl border border-gray-200 p-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  {item.label} {item.required && <span className="text-red-500">*</span>}
                </label>
                <div className="space-y-3">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setDocumentFiles((prev) => ({ ...prev, [item.key]: file }));
                      setDocuments((prev) => ({ ...prev, [item.key]: file.name }));
                      notify.success('Document selected', `${item.label} ready to upload.`);
                    }}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
                  />
                  {documents[item.key as keyof typeof documents] && (
                    <div className="flex items-center text-xs text-emerald-600">
                      <svg className="mr-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      File selected: {documents[item.key as keyof typeof documents]}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 flex justify-between">
            <button 
              className="rounded-xl border border-gray-300 px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50" 
              onClick={prevStep}
            >
              <svg className="mr-2 inline h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <button 
              className="rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 px-8 py-3 font-semibold text-white shadow-lg transition-all hover:from-emerald-700 hover:to-green-700 hover:shadow-xl hover:scale-105" 
              onClick={nextStep}
            >
              Save & Continue
              <svg className="ml-2 inline h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      ) : null}

      {step === 7 ? (
        <div className="rounded-2xl bg-white p-8 shadow-lg ring-1 ring-gray-200">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">App Access & Login</h2>
            <p className="mt-2 text-sm text-gray-600">Configure login access for student and parent accounts.</p>
          </div>
          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Login Permissions</h3>
              <div className="space-y-4">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={access.studentLogin}
                    onChange={(e) => setAccess({ ...access, studentLogin: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">Enable Student Login</span>
                    <p className="text-xs text-gray-500">Allow student to access their account and view academic information</p>
                  </div>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={access.parentLogin}
                    onChange={(e) => setAccess({ ...access, parentLogin: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">Enable Parent Login</span>
                    <p className="text-xs text-gray-500">Allow parent to access student information and communicate with school</p>
                  </div>
                </label>
              </div>
            </div>
            
            <div className="rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Notification Method</h3>
              <select
                value={access.sendVia}
                onChange={(e) => setAccess({ ...access, sendVia: e.target.value })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
                disabled={!access.studentLogin && !access.parentLogin}
              >
                <option value="SMS">Send login credentials via SMS</option>
                <option value="EMAIL">Send login credentials via Email</option>
                <option value="BOTH">Send via both SMS & Email</option>
              </select>
            </div>
            
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-6">
              <h3 className="text-lg font-semibold text-emerald-900 mb-4">Parent Account Lookup</h3>
              <p className="text-sm text-gray-600 mb-4">Enter the parent's mobile number to check if they already have an account.</p>
              <input
                value={parent.phone}
                onChange={(e) => {
                  setParent({ ...parent, phone: e.target.value });
                  setSelectedParentUserId('');
                }}
                placeholder="Enter 10-digit mobile number"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
              />
              {parent.phone.trim().length === 10 && (
                <div className="mt-4">
                  {parentMatches.length ? (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-emerald-700">Existing parent account found:</p>
                      {parentMatches.map((p: any) => (
                        <button
                          key={p.userId}
                          type="button"
                          onClick={() => setSelectedParentUserId(p.userId)}
                          className={`w-full rounded-xl border p-4 text-left transition-colors ${
                            selectedParentUserId === p.userId 
                              ? 'border-emerald-500 bg-emerald-100' 
                              : 'border-gray-300 hover:border-emerald-300'
                          }`}
                        >
                          <p className="font-semibold text-gray-900">{p.displayName || 'Parent Account'}</p>
                          <p className="text-sm text-gray-600">{p.phone || parent.phone}</p>
                          {selectedParentUserId === p.userId && (
                            <p className="text-xs text-emerald-600 mt-1">✓ Selected for linking</p>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                      <p className="text-sm text-blue-800">No existing parent account found. A new account will be created.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="mt-8 flex justify-between">
            <button 
              className="rounded-xl border border-gray-300 px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50" 
              onClick={prevStep}
            >
              <svg className="mr-2 inline h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <button 
              className="rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 px-8 py-3 font-semibold text-white shadow-lg transition-all hover:from-emerald-700 hover:to-green-700 hover:shadow-xl hover:scale-105" 
              onClick={nextStep}
            >
              Save & Continue
              <svg className="ml-2 inline h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      ) : null}

      {step === 8 ? (
        <div className="rounded-2xl bg-white p-8 shadow-lg ring-1 ring-gray-200">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Review Student Details</h2>
            <p className="mt-2 text-sm text-gray-600">Please review all information before creating the student profile.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-6">
              <div className="mb-4 flex items-center">
                <div className="rounded-full bg-emerald-100 p-2 mr-3">
                  <svg className="h-5 w-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-emerald-900">Academic Information</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Academic Year:</span>
                  <span className="font-medium text-gray-900">{yearLookup.get(summary.academic.yearId) || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Class:</span>
                  <span className="font-medium text-gray-900">{classLookup.get(summary.academic.classId) || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Section:</span>
                  <span className="font-medium text-gray-900">{sectionLookup.get(summary.academic.sectionId) || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Admission No:</span>
                  <span className="font-medium text-gray-900">{summary.academic.admissionNo || '—'}</span>
                </div>
              </div>
            </div>
            
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-6">
              <div className="mb-4 flex items-center">
                <div className="rounded-full bg-blue-100 p-2 mr-3">
                  <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-blue-900">Student Profile</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Full Name:</span>
                  <span className="font-medium text-gray-900">{summary.student.fullName || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Gender:</span>
                  <span className="font-medium text-gray-900">{summary.student.gender || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Date of Birth:</span>
                  <span className="font-medium text-gray-900">{summary.student.dob || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Blood Group:</span>
                  <span className="font-medium text-gray-900">{summary.student.bloodGroup || '—'}</span>
                </div>
              </div>
            </div>
            
            <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-6">
              <div className="mb-4 flex items-center">
                <div className="rounded-full bg-purple-100 p-2 mr-3">
                  <svg className="h-5 w-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-purple-900">Parent Information</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Guardian:</span>
                  <span className="font-medium text-gray-900">{summary.parent.guardianName || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Phone:</span>
                  <span className="font-medium text-gray-900">{summary.parent.phone || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Email:</span>
                  <span className="font-medium text-gray-900">{summary.parent.email || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Relationship:</span>
                  <span className="font-medium text-gray-900">{summary.parent.relationship || '—'}</span>
                </div>
              </div>
            </div>
            
            <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-6">
              <div className="mb-4 flex items-center">
                <div className="rounded-full bg-orange-100 p-2 mr-3">
                  <svg className="h-5 w-5 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-orange-900">Address Details</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Address:</span>
                  <span className="font-medium text-gray-900">{summary.address.line1 || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">City:</span>
                  <span className="font-medium text-gray-900">{summary.address.city || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">State:</span>
                  <span className="font-medium text-gray-900">{summary.address.state || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Pincode:</span>
                  <span className="font-medium text-gray-900">{summary.address.pincode || '—'}</span>
                </div>
              </div>
            </div>
          </div>
          
          {errorMessage && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-center">
                <svg className="h-5 w-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-sm font-medium text-red-800">{errorMessage}</p>
              </div>
            </div>
          )}
          
          {createStatus === 'success' && (
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center">
                <svg className="h-5 w-5 text-emerald-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <p className="text-sm font-medium text-emerald-800">Student created successfully! Redirecting...</p>
              </div>
            </div>
          )}
          
          <div className="mt-8 flex justify-between">
            <button 
              className="rounded-xl border border-gray-300 px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50" 
              onClick={prevStep}
            >
              <svg className="mr-2 inline h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <button
              className="rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 px-8 py-3 font-semibold text-white shadow-lg transition-all hover:from-emerald-700 hover:to-green-700 hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              onClick={handleConfirmCreate}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <>
                  <svg className="mr-2 inline h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating Student...
                </>
              ) : (
                <>
                  <svg className="mr-2 inline h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Confirm & Create Student
                </>
              )}
            </button>
          </div>
        </div>
      ) : null}

      {bulkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-8 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Bulk Student Upload</h3>
                <p className="mt-1 text-sm text-gray-600">Upload multiple students at once using Excel template</p>
              </div>
              <button 
                className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors" 
                onClick={() => setBulkOpen(false)}
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-6">
                <div className="mb-4 flex items-center">
                  <div className="rounded-full bg-emerald-100 p-2 mr-3">
                    <span className="text-lg font-bold text-emerald-600">1</span>
                  </div>
                  <h4 className="text-lg font-semibold text-emerald-900">Download Template</h4>
                </div>
                <p className="mb-4 text-sm text-gray-600">Download the Excel template with all required fields and sample data.</p>
                <button className="rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:bg-emerald-700 hover:shadow-xl hover:scale-105">
                  <svg className="mr-2 inline h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download Excel Template
                </button>
              </div>
              
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-6">
                <div className="mb-4 flex items-center">
                  <div className="rounded-full bg-blue-100 p-2 mr-3">
                    <span className="text-lg font-bold text-blue-600">2</span>
                  </div>
                  <h4 className="text-lg font-semibold text-blue-900">Upload Excel File</h4>
                </div>
                <p className="mb-4 text-sm text-gray-600">Select your completed Excel file with student data.</p>
                <div className="rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 p-6 text-center">
                  <svg className="mx-auto h-12 w-12 text-blue-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                  <input 
                    type="file" 
                    accept=".xls,.xlsx,.csv" 
                    className="hidden" 
                    id="bulk-upload"
                  />
                  <label 
                    htmlFor="bulk-upload" 
                    className="cursor-pointer rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl hover:scale-105"
                  >
                    Choose Excel File
                  </label>
                  <p className="mt-2 text-xs text-gray-500">Supports .xls, .xlsx, and .csv files</p>
                </div>
              </div>
              
              <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-6">
                <div className="mb-4 flex items-center">
                  <div className="rounded-full bg-purple-100 p-2 mr-3">
                    <span className="text-lg font-bold text-purple-600">3</span>
                  </div>
                  <h4 className="text-lg font-semibold text-purple-900">Preview & Import</h4>
                </div>
                <p className="mb-4 text-sm text-gray-600">Review the data before importing to ensure accuracy.</p>
                <div className="rounded-xl border border-dashed border-purple-300 bg-purple-50 p-8 text-center">
                  <svg className="mx-auto h-8 w-8 text-purple-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm text-gray-500">Upload a file to see preview data here</p>
                </div>
              </div>
            </div>
            
            <div className="mt-8 flex justify-end gap-4">
              <button 
                className="rounded-xl border border-gray-300 px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50" 
                onClick={() => setBulkOpen(false)}
              >
                Cancel
              </button>
              <button className="rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 px-8 py-3 font-semibold text-white shadow-lg transition-all hover:from-emerald-700 hover:to-green-700 hover:shadow-xl hover:scale-105">
                <svg className="mr-2 inline h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Confirm Import
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
