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
import { createStudent, listStudents, uploadStudentPhoto } from '../../../../services/student.service';

const genders = ['Male', 'Female', 'Other'];
const bloodGroups = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const categories = ['Regular', 'RTE', 'Management', 'Scholarship', 'Transport'];

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
  height: string;
  weight: string;
  photoUrl: string;
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
  presentAddress: string;
  permanentAddress: string;
  siblingIds: string[];
};

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
  height: '',
  weight: '',
  photoUrl: '',
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

export default function AddStudentPage() {
  const router = useRouter();
  const notify = useNotify();
  const [form, setForm] = useState<AdmissionForm>(initialForm);
  const [sameAddress, setSameAddress] = useState(false);

  const { data: session, isLoading: isSessionLoading } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSchoolAdmin = session?.role === 'SCHOOL_ADMIN';

  useEffect(() => {
    if (!isSessionLoading && session?.role && !isSchoolAdmin) {
      router.replace('/dashboard');
    }
  }, [isSchoolAdmin, isSessionLoading, router, session?.role]);

  const yearsQuery = useQuery({ queryKey: ['academic-years'], queryFn: () => listAcademicYears(), enabled: isSchoolAdmin });
  const classesQuery = useQuery({ queryKey: ['setup-classes'], queryFn: () => listSetupClasses(), enabled: isSchoolAdmin });
  const sectionsQuery = useQuery({ queryKey: ['setup-sections'], queryFn: () => listSetupSections(), enabled: isSchoolAdmin });
  const siblingsQuery = useQuery({ queryKey: ['students', 'sibling-options'], queryFn: () => listStudents(), enabled: isSchoolAdmin });

  const sections = sectionsQuery.data ?? [];
  const classSections = useMemo(
    () =>
      form.classId
        ? sections.filter((section) => section.classSections?.some((link) => link.classId === form.classId) || section.classId === form.classId)
        : [],
    [sections, form.classId],
  );

  const createMutation = useMutation({
    mutationFn: () =>
      createStudent({
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
      }),
    onSuccess: (student) => {
      notify.success('Student admitted', 'Enrollment was created for the selected session.');
      router.push(`/dashboard/students/${student.id}`);
    },
    onError: (error: any) => notify.error('Admission failed', error?.response?.data?.error?.message ?? 'Unable to save student.'),
  });

  const setValue = (key: keyof AdmissionForm, value: string | string[]) => setForm((prev) => ({ ...prev, [key]: value }));

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
    if (!form.presentAddress.trim()) return 'Present address is required.';
    return '';
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

  if (isSessionLoading || !session?.role || !isSchoolAdmin) {
    return <FullPageLoader label="Checking student access..." />;
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-8">
        <PageHeader
          title="Student Admission"
          subtitle="Create student profile, guardian details, and session enrollment."
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Students', href: '/dashboard/students' }, { label: 'Admission' }]}
        />

        <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-slate-950">Academic Details</h2>
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Session" required>
                  <select value={form.academicSessionId} onChange={(event) => setValue('academicSessionId', event.target.value)} className={inputClass}>
                    <option value="">Select session</option>
                    {(yearsQuery.data ?? []).map((year: any) => <option key={year.id} value={year.id}>{year.name}</option>)}
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
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-slate-950">Student Information</h2>
              <div className="grid gap-4 md:grid-cols-4">
                <Field label="First name" required><input value={form.firstName} onChange={(event) => setValue('firstName', event.target.value)} className={inputClass} /></Field>
                <Field label="Last name" required><input value={form.lastName} onChange={(event) => setValue('lastName', event.target.value)} className={inputClass} /></Field>
                <Field label="Gender" required><select value={form.gender} onChange={(event) => setValue('gender', event.target.value)} className={inputClass}><option value="">Select</option>{genders.map((item) => <option key={item}>{item}</option>)}</select></Field>
                <Field label="Date of birth" required><input type="date" value={form.dob} onChange={(event) => setValue('dob', event.target.value)} className={inputClass} /></Field>
                <Field label="Blood group"><select value={form.bloodGroup} onChange={(event) => setValue('bloodGroup', event.target.value)} className={inputClass}>{bloodGroups.map((item) => <option key={item} value={item}>{item || 'Select'}</option>)}</select></Field>
                <Field label="Religion"><input value={form.religion} onChange={(event) => setValue('religion', event.target.value)} className={inputClass} /></Field>
                <Field label="Caste"><input value={form.caste} onChange={(event) => setValue('caste', event.target.value)} className={inputClass} /></Field>
                <Field label="Category"><select value={form.category} onChange={(event) => setValue('category', event.target.value)} className={inputClass}>{categories.map((item) => <option key={item}>{item}</option>)}</select></Field>
                <Field label="Email"><input type="email" value={form.email} onChange={(event) => setValue('email', event.target.value)} className={inputClass} /></Field>
                <Field label="Phone"><input value={form.phone} onChange={(event) => setValue('phone', event.target.value)} className={inputClass} /></Field>
                <Field label="Height"><input type="number" min="0" step="0.1" value={form.height} onChange={(event) => setValue('height', event.target.value)} className={inputClass} /></Field>
                <Field label="Weight"><input type="number" min="0" step="0.1" value={form.weight} onChange={(event) => setValue('weight', event.target.value)} className={inputClass} /></Field>
              </div>
            </section>

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
                <Field label="Parent email"><input type="email" value={form.parentEmail} onChange={(event) => setValue('parentEmail', event.target.value)} className={inputClass} /></Field>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-slate-950">Address & Siblings</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Present address" required><textarea value={form.presentAddress} onChange={(event) => setValue('presentAddress', event.target.value)} rows={4} className={inputClass} /></Field>
                <Field label="Permanent address"><textarea value={sameAddress ? form.presentAddress : form.permanentAddress} onChange={(event) => setValue('permanentAddress', event.target.value)} rows={4} disabled={sameAddress} className={inputClass} /></Field>
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input type="checkbox" checked={sameAddress} onChange={(event) => setSameAddress(event.target.checked)} />
                Permanent address is same as present address
              </label>
              <div className="mt-4">
                <Field label="Add Parents / sibling linking">
                  <select multiple value={form.siblingIds} onChange={(event) => setValue('siblingIds', Array.from(event.target.selectedOptions).map((option) => option.value))} className={`${inputClass} min-h-28`}>
                    {(siblingsQuery.data ?? []).map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.fullName ?? `${student.firstName} ${student.lastName}`.trim()} ({student.admissionNo})
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </section>
          </div>

          <aside className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-slate-950">Photos</h2>
              {[
                ['Student photo', 'photoUrl'],
                ['Father photo', 'fatherPhotoUrl'],
                ['Mother photo', 'motherPhotoUrl'],
              ].map(([label, field]) => (
                <div key={field} className="mb-4 rounded-xl border border-slate-100 p-3">
                  <p className="mb-2 text-sm font-bold text-slate-800">{label}</p>
                  <input type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && uploadImage(event.target.files[0], field as keyof AdmissionForm)} className="text-sm" />
                  {form[field as keyof AdmissionForm] ? <p className="mt-2 text-xs font-semibold text-emerald-600">Uploaded</p> : null}
                </div>
              ))}
            </section>

            <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">Admission Summary</h2>
              <div className="mt-4 space-y-3 text-sm">
                <p><span className="font-semibold text-slate-500">Name:</span> {`${form.firstName} ${form.lastName}`.trim() || '-'}</p>
                <p><span className="font-semibold text-slate-500">Admission:</span> {form.admissionNo || '-'}</p>
                <p><span className="font-semibold text-slate-500">Roll:</span> {form.rollNo || '-'}</p>
                <p><span className="font-semibold text-slate-500">Guardian:</span> {form.guardianName || form.fatherName || form.motherName || '-'}</p>
              </div>
              <div className="mt-6 flex flex-col gap-2">
                <button onClick={submit} disabled={createMutation.isPending} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--theme-button-bg)] px-5 py-3 text-sm font-bold text-[var(--theme-button-text)] shadow-sm disabled:opacity-50">
                  <Icon path="M5 13l4 4L19 7" />
                  {createMutation.isPending ? 'Saving...' : 'Save student'}
                </button>
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
