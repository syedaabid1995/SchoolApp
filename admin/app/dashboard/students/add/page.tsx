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
      notify.info('Creating student...', 'Please wait while we process your request');
      
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
          const uploaded = await uploadStudentPhoto(photoFile, { schoolId, studentId: createdStudentId });
          await updateStudent(createdStudentId, { photoUrl: uploaded.url });
        }
        if (additionalPhotoFiles.length) {
          for (const file of additionalPhotoFiles) {
            const uploaded = await uploadStudentPhoto(file, { schoolId, studentId: createdStudentId });
            await addStudentPhoto(createdStudentId, uploaded.url);
          }
        }
        const docUpdates: Record<string, string> = {};
        if (documentFiles.birthCert) {
          const uploaded = await uploadStudentDocument(documentFiles.birthCert, createdStudentId, { schoolId });
          docUpdates.docBirthCert = uploaded.url;
        }
        if (documentFiles.transferCert) {
          const uploaded = await uploadStudentDocument(documentFiles.transferCert, createdStudentId, { schoolId });
          docUpdates.docTransferCert = uploaded.url;
        }
        if (documentFiles.aadhaar) {
          const uploaded = await uploadStudentDocument(documentFiles.aadhaar, createdStudentId, { schoolId });
          docUpdates.docAadhaar = uploaded.url;
        }
        if (documentFiles.reportCard) {
          const uploaded = await uploadStudentDocument(documentFiles.reportCard, createdStudentId, { schoolId });
          docUpdates.docReportCard = uploaded.url;
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
          sendVia: access.sendVia,
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
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Add Student</h1>
        <p className="text-sm text-slate">Step-by-step onboarding for accurate academic mapping.</p>
      </header>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
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
          <button
            className="rounded-lg border border-slate/20 px-3 py-1.5 text-xs font-semibold"
            onClick={() => setBulkOpen(true)}
          >
            Upload Students via Excel
          </button>
        </div>
      </section>

      {step === 1 ? (
        <section className="rounded-2xl border border-slate/10 bg-white p-6">
          <h2 className="text-lg font-semibold">Academic Information</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <select
              value={academic.yearId}
              onChange={(e) => setAcademic({ ...academic, yearId: e.target.value })}
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
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
            <select
              value={academic.classId}
              onChange={(e) => setAcademic({ ...academic, classId: e.target.value, sectionId: '' })}
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
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
            <select
              value={academic.sectionId}
              onChange={(e) => setAcademic({ ...academic, sectionId: e.target.value })}
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
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
            <input
              value={academic.admissionNo}
              onChange={(e) => setAcademic({ ...academic, admissionNo: e.target.value })}
              placeholder="Admission number"
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
            />
            <input
              value={academic.rollNo}
              onChange={(e) => setAcademic({ ...academic, rollNo: e.target.value })}
              placeholder="Roll number (optional)"
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
            />
          </div>
          <div className="mt-4 flex justify-end">
            <button className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white" onClick={nextStep}>
              Save &amp; Continue
            </button>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="rounded-2xl border border-slate/10 bg-white p-6">
          <h2 className="text-lg font-semibold">Student Profile</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input
              value={student.fullName}
              onChange={(e) => setStudent({ ...student, fullName: e.target.value })}
              placeholder="Student full name"
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
            />
            <select
              value={student.gender}
              onChange={(e) => setStudent({ ...student, gender: e.target.value })}
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
            >
              <option value="">Gender</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
            <input
              type="date"
              value={student.dob}
              onChange={(e) => setStudent({ ...student, dob: e.target.value })}
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
            />
            <select
              value={student.bloodGroup}
              onChange={(e) => setStudent({ ...student, bloodGroup: e.target.value })}
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
            >
              <option value="">Blood group (optional)</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
            </select>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate mb-1">Photo</label>
              <p className="text-xs text-slate/70 mb-2">Max 10MB per image (JPG/PNG).</p>
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
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
            />
            </div>
            {photoPreview ? (
              <div className="md:col-span-2">
                <img src={photoPreview} alt="Student preview" className="h-24 w-24 rounded-lg object-cover" />
              </div>
            ) : null}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate mb-1">Additional Photos (max 5)</label>
              <p className="text-xs text-slate/70 mb-2">Max 10MB per image (JPG/PNG).</p>
              <div className="flex flex-wrap gap-2">
                {additionalPhotos.map((photo) => (
                  <img key={photo} src={photo} alt="Student" className="h-20 w-20 rounded-lg object-cover" />
                ))}
              </div>
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
                className="mt-2 w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
              />
            </div>
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
          <h2 className="text-lg font-semibold">Parent / Guardian Information</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input
              value={parent.fatherName}
              onChange={(e) => setParent({ ...parent, fatherName: e.target.value })}
              placeholder="Father name"
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
            />
            <input
              value={parent.motherName}
              onChange={(e) => setParent({ ...parent, motherName: e.target.value })}
              placeholder="Mother name"
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
            />
            <input
              value={parent.guardianName}
              onChange={(e) => setParent({ ...parent, guardianName: e.target.value })}
              placeholder="Primary guardian name"
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
            />
            <select
              value={parent.relationship}
              onChange={(e) => setParent({ ...parent, relationship: e.target.value })}
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
            >
              <option value="">Relationship</option>
              <option value="FATHER">Father</option>
              <option value="MOTHER">Mother</option>
              <option value="GUARDIAN">Guardian</option>
              <option value="OTHER">Other</option>
            </select>
            <input
              value={parent.phone}
              onChange={(e) => setParent({ ...parent, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
              placeholder="Mobile number"
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
            />
            <input
              value={parent.email}
              onChange={(e) => setParent({ ...parent, email: e.target.value })}
              placeholder="Email (optional)"
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
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

      {step === 4 ? (
        <section className="rounded-2xl border border-slate/10 bg-white p-6">
          <h2 className="text-lg font-semibold">Address &amp; Communication</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input
              value={address.line1}
              onChange={(e) => setAddress({ ...address, line1: e.target.value })}
              placeholder="Address line 1"
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
            />
            <input
              value={address.line2}
              onChange={(e) => setAddress({ ...address, line2: e.target.value })}
              placeholder="Address line 2"
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
            />
            <select
              value={address.state}
              onChange={(e) => setAddress({ ...address, state: e.target.value, city: '' })}
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
            >
              <option value="">Select state</option>
              {stateOptions.map((state) => (
                <option key={state.isoCode} value={state.name}>
                  {state.name}
                </option>
              ))}
            </select>
            <select
              value={address.city}
              onChange={(e) => setAddress({ ...address, city: e.target.value })}
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
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
            <input
              value={address.pincode}
              onChange={(e) => setAddress({ ...address, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
              placeholder="Pincode"
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
            />
            <input
              value={address.emergency}
              onChange={(e) => setAddress({ ...address, emergency: e.target.value.replace(/\D/g, '').slice(0, 10) })}
              placeholder="Emergency contact number"
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
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

      {step === 5 ? (
        <section className="rounded-2xl border border-slate/10 bg-white p-6">
          <h2 className="text-lg font-semibold">Health Information</h2>
          <div className="mt-4 grid gap-3">
            <textarea
              value={medical.conditions}
              onChange={(e) => setMedical({ ...medical, conditions: e.target.value })}
              placeholder="Medical conditions"
              rows={3}
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
            />
            <textarea
              value={medical.allergies}
              onChange={(e) => setMedical({ ...medical, allergies: e.target.value })}
              placeholder="Allergies"
              rows={3}
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
            />
            <input
              value={medical.doctor}
              onChange={(e) => setMedical({ ...medical, doctor: e.target.value })}
              placeholder="Doctor name / contact"
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
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

      {step === 6 ? (
        <section className="rounded-2xl border border-slate/10 bg-white p-6">
          <h2 className="text-lg font-semibold">Documents Upload</h2>
          <p className="text-xs text-slate/70 mt-1">Max 20MB per file (PDF/DOC/DOCX/Images).</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[
              { key: 'birthCert', label: 'Birth Certificate' },
              { key: 'transferCert', label: 'Transfer Certificate' },
              { key: 'aadhaar', label: 'Aadhaar (optional)' },
              { key: 'reportCard', label: 'Previous Report Card' },
            ].map((item) => (
              <label key={item.key} className="flex flex-col gap-2 rounded-lg border border-slate/20 px-3 py-2 text-sm">
                <span>{item.label}</span>
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
                  className="text-xs"
                />
                {documents[item.key as keyof typeof documents] ? (
                  <span className="text-xs text-slate">Selected</span>
                ) : null}
              </label>
            ))}
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

      {step === 7 ? (
        <section className="rounded-2xl border border-slate/10 bg-white p-6">
          <h2 className="text-lg font-semibold">App Access</h2>
          <div className="mt-4 space-y-3 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={access.studentLogin}
                onChange={(e) => setAccess({ ...access, studentLogin: e.target.checked })}
              />
              Enable Student Login
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={access.parentLogin}
                onChange={(e) => setAccess({ ...access, parentLogin: e.target.checked })}
              />
              Enable Parent Login
            </label>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <select
              value={access.sendVia}
              onChange={(e) => setAccess({ ...access, sendVia: e.target.value })}
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              disabled={!access.studentLogin && !access.parentLogin}
            >
              <option value="SMS">Send via SMS</option>
              <option value="EMAIL">Send via Email</option>
              <option value="BOTH">Send via SMS & Email</option>
            </select>
          </div>
          <div className="mt-6 rounded-xl border border-slate/10 p-4">
            <p className="text-sm font-semibold text-ink">Parent Login Lookup</p>
            <p className="text-xs text-slate">Enter 10-digit mobile number to link an existing parent.</p>
            <input
              value={parent.phone}
              onChange={(e) => {
                setParent({ ...parent, phone: e.target.value });
                setSelectedParentUserId('');
              }}
              placeholder="Parent mobile (10 digits)"
              className="mt-3 w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
            />
            {parent.phone.trim().length === 10 ? (
              parentMatches.length ? (
                <div className="mt-3 space-y-2">
                  {parentMatches.map((p: any) => (
                    <button
                      key={p.userId}
                      type="button"
                      onClick={() => setSelectedParentUserId(p.userId)}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                        selectedParentUserId === p.userId ? 'border-ink bg-sand' : 'border-slate/10'
                      }`}
                    >
                      <p className="font-semibold text-ink">{p.displayName || 'Parent account found'}</p>
                      <p className="text-xs text-slate">{p.phone || parent.phone || '—'}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-slate">No parent found. A new parent profile will be created.</p>
              )
            ) : null}
            {selectedParentUserId ? (
              <p className="mt-3 text-xs font-semibold text-emerald-600">Existing parent selected.</p>
            ) : null}
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

      {step === 8 ? (
        <section className="rounded-2xl border border-slate/10 bg-white p-6">
          <h2 className="text-lg font-semibold">Review Student Details</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 text-sm text-slate">
            <div className="rounded-xl border border-slate/10 p-4">
              <p className="text-xs uppercase text-slate">Academic</p>
              <p className="mt-2">Year: {yearLookup.get(summary.academic.yearId) || '—'}</p>
              <p>Class: {classLookup.get(summary.academic.classId) || '—'}</p>
              <p>Section: {sectionLookup.get(summary.academic.sectionId) || '—'}</p>
              <p>Admission: {summary.academic.admissionNo || '—'}</p>
            </div>
            <div className="rounded-xl border border-slate/10 p-4">
              <p className="text-xs uppercase text-slate">Student</p>
              <p className="mt-2">Name: {summary.student.fullName || '—'}</p>
              <p>Gender: {summary.student.gender || '—'}</p>
              <p>DOB: {summary.student.dob || '—'}</p>
            </div>
            <div className="rounded-xl border border-slate/10 p-4">
              <p className="text-xs uppercase text-slate">Parent</p>
              <p className="mt-2">Guardian: {summary.parent.guardianName || '—'}</p>
              <p>Phone: {summary.parent.phone || '—'}</p>
              <p>Email: {summary.parent.email || '—'}</p>
            </div>
            <div className="rounded-xl border border-slate/10 p-4">
              <p className="text-xs uppercase text-slate">Address</p>
              <p className="mt-2">{summary.address.line1 || '—'}</p>
              <p>{summary.address.city || '—'}</p>
              <p>{summary.address.pincode || '—'}</p>
            </div>
          </div>
          <div className="mt-4 flex justify-between">
            <button className="rounded-lg border border-slate/20 px-4 py-2 text-sm" onClick={prevStep}>
              Back
            </button>
            <button
              className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
              onClick={handleConfirmCreate}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Confirm & Create Student'}
            </button>
          </div>
          {errorMessage ? (
            <p className="mt-3 text-sm font-semibold text-rose-600">{errorMessage}</p>
          ) : null}
          {createStatus === 'success' ? (
            <p className="mt-3 text-sm font-semibold text-emerald-600">Student created successfully.</p>
          ) : null}
        </section>
      ) : null}

      {bulkOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate/40 px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Bulk Student Upload</h3>
              <button className="text-sm text-slate" onClick={() => setBulkOpen(false)}>
                Close
              </button>
            </div>
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <p className="font-semibold text-ink">Step 1: Download Template</p>
                <button className="mt-2 rounded-lg border border-slate/20 px-3 py-2 text-xs font-semibold">
                  Download Template
                </button>
              </div>
              <div>
                <p className="font-semibold text-ink">Step 2: Upload Excel</p>
                <input type="file" accept=".xls,.xlsx,.csv" className="mt-2 text-xs" />
              </div>
              <div>
                <p className="font-semibold text-ink">Step 3: Preview</p>
                <div className="mt-2 rounded-lg border border-dashed border-slate/20 bg-sand px-4 py-6 text-xs text-slate">
                  Preview data will appear here.
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded-lg border border-slate/20 px-4 py-2 text-sm" onClick={() => setBulkOpen(false)}>
                Cancel
              </button>
              <button className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white">
                Confirm Import
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
