'use client';

import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { listAcademicYears, listClasses, listSections } from '../../../../services/academic.service';
import { getSession } from '../../../../services/auth.service';
import { createParent, createStudent, linkParent, lookupParentByPhone } from '../../../../services/student.service';

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
    if (step === 1) {
      if (!academic.yearId) error = 'Academic year is required.';
      else if (!academic.classId) error = 'Class is required.';
      else if (!academic.sectionId) error = 'Section is required.';
      else if (!academic.admissionNo.trim()) error = 'Admission number is required.';
    }
    if (step === 2) {
      if (!student.fullName.trim()) error = 'Student full name is required.';
      else if (!student.gender) error = 'Gender is required.';
      else if (!student.dob) error = 'Date of birth is required.';
    }
    if (step === 3) {
      if (!parent.fatherName.trim()) error = 'Father name is required.';
      else if (!parent.motherName.trim()) error = 'Mother name is required.';
      else if (!parent.guardianName.trim()) error = 'Primary guardian name is required.';
      else if (!parent.relationship.trim()) error = 'Relationship is required.';
      else if (!parent.phone.trim()) error = 'Mobile number is required.';
    }
    if (step === 4) {
      if (!address.line1.trim()) error = 'Address line 1 is required.';
      else if (!address.city.trim()) error = 'City is required.';
      else if (!address.state.trim()) error = 'State is required.';
      else if (!address.pincode.trim()) error = 'Pincode is required.';
      else if (!address.emergency.trim()) error = 'Emergency contact number is required.';
    }
    if (step === 7) {
      if (access.parentLogin) {
        const phone = parent.phone.trim();
        if (phone.length !== 10) {
          error = 'Enter a valid 10-digit parent mobile number.';
        } else if (parentMatches.length > 0 && !selectedParentUserId) {
          error = 'Select an existing parent to continue.';
        }
      }
    }
    setStepError(error);
    if (error) return;
    setStep((prev) => (prev < 8 ? ((prev + 1) as Step) : prev));
  };
  const prevStep = () => {
    setStepError('');
    setStep((prev) => (prev > 1 ? ((prev - 1) as Step) : prev));
  };

  const createMutation = useMutation({
    mutationFn: createStudent,
  });

  const handleConfirmCreate = async () => {
    const nameParts = student.fullName.trim().split(/\s+/);
    const firstName = nameParts[0] ?? '';
    const lastName = nameParts.slice(1).join(' ') || 'Student';
    try {
      setErrorMessage('');
      const createdStudent = await createMutation.mutateAsync({
        admissionNo: academic.admissionNo,
        firstName,
        lastName,
        dob: student.dob || undefined,
        classId: academic.classId || undefined,
        sectionId: academic.sectionId || undefined,
        schoolId,
      });

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
      setTimeout(() => router.push('/dashboard/students'), 800);
    } catch (error: any) {
      setCreateStatus('idle');
      const message =
        error?.response?.data?.error?.message ||
        error?.message ||
        'Something went wrong. Please check the form.';
      setErrorMessage(message);
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
          {stepError ? <p className="mt-3 text-sm font-semibold text-rose-600">{stepError}</p> : null}
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
            <input
              value={student.bloodGroup}
              onChange={(e) => setStudent({ ...student, bloodGroup: e.target.value })}
              placeholder="Blood group (optional)"
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
            />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setStudent({ ...student, photo: e.target.files?.[0]?.name ?? '' })}
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
          {stepError ? <p className="mt-3 text-sm font-semibold text-rose-600">{stepError}</p> : null}
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
            <input
              value={parent.relationship}
              onChange={(e) => setParent({ ...parent, relationship: e.target.value })}
              placeholder="Relationship"
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
            />
            <input
              value={parent.phone}
              onChange={(e) => setParent({ ...parent, phone: e.target.value })}
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
          {stepError ? <p className="mt-3 text-sm font-semibold text-rose-600">{stepError}</p> : null}
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
            <input
              value={address.city}
              onChange={(e) => setAddress({ ...address, city: e.target.value })}
              placeholder="City"
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
            />
            <input
              value={address.state}
              onChange={(e) => setAddress({ ...address, state: e.target.value })}
              placeholder="State"
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
            />
            <input
              value={address.pincode}
              onChange={(e) => setAddress({ ...address, pincode: e.target.value })}
              placeholder="Pincode"
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
            />
            <input
              value={address.emergency}
              onChange={(e) => setAddress({ ...address, emergency: e.target.value })}
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
          {stepError ? <p className="mt-3 text-sm font-semibold text-rose-600">{stepError}</p> : null}
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
          {stepError ? <p className="mt-3 text-sm font-semibold text-rose-600">{stepError}</p> : null}
        </section>
      ) : null}

      {step === 6 ? (
        <section className="rounded-2xl border border-slate/10 bg-white p-6">
          <h2 className="text-lg font-semibold">Documents Upload</h2>
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
                  onChange={(e) => setDocuments({ ...documents, [item.key]: e.target.files?.[0]?.name ?? '' })}
                  className="text-xs"
                />
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
          {stepError ? <p className="mt-3 text-sm font-semibold text-rose-600">{stepError}</p> : null}
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
