'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getStudent, updateStudent, uploadStudentPhoto, uploadStudentDocument, resolveUploadUrl, addStudentPhoto, deleteStudentPhoto } from '../../../../services/student.service';
import { City, State } from 'country-state-city';
import FullPageLoader from '../../../../components/FullPageLoader';
import { getSession } from '../../../../services/auth.service';

type Step = 1 | 2 | 3 | 4 | 5 | 6;

const steps: Array<{ id: Step; title: string }> = [
  { id: 1, title: 'Academic' },
  { id: 2, title: 'Student' },
  { id: 3, title: 'Parent' },
  { id: 4, title: 'Address' },
  { id: 5, title: 'Medical' },
  { id: 6, title: 'Documents' },
];

export default function StudentDetailPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const { data: session } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const schoolId = session?.schoolId ?? undefined;
  const [step, setStep] = useState<Step>(1);
  const [isEditing, setIsEditing] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [editData, setEditData] = useState({
    // Academic
    admissionNo: '',
    classId: '',
    sectionId: '',
    // Student
    fullName: '',
    dob: '',
    gender: '',
    bloodGroup: '',
    photoUrl: '',
    // Parent
    fatherName: '',
    motherName: '',
    guardianName: '',
    guardianRelationship: '',
    parentPhone: '',
    parentEmail: '',
    // Address
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
    emergencyContact: '',
    // Medical
    medicalConditions: '',
    allergies: '',
    doctorContact: '',
    // Documents
    docBirthCert: '',
    docTransferCert: '',
    docAadhaar: '',
    docReportCard: '',
  });
  const studentId = params.id as string;

  const { data: student, isLoading } = useQuery({
    queryKey: ['student', studentId],
    queryFn: () => getStudent(studentId, { schoolId }),
    enabled: Boolean(studentId),
    onSuccess: (data) => {
      setEditData({
        // Academic
        admissionNo: data.admissionNo,
        classId: data.classId || '',
        sectionId: data.sectionId || '',
        // Student
        fullName: data.fullName ?? `${data.firstName} ${data.lastName}`.trim(),
        dob: data.dob || '',
        gender: data.gender ?? '',
        bloodGroup: data.bloodGroup ?? '',
        photoUrl: data.photoUrl ?? '',
        // Parent
        fatherName: data.fatherName ?? '',
        motherName: data.motherName ?? '',
        guardianName: data.guardianName ?? '',
        guardianRelationship: data.guardianRelationship ?? '',
        parentPhone: data.parentPhone ?? '',
        parentEmail: data.parentEmail ?? '',
        // Address
        addressLine1: data.addressLine1 ?? '',
        addressLine2: data.addressLine2 ?? '',
        city: data.city ?? '',
        state: data.state ?? '',
        pincode: data.pincode ?? '',
        emergencyContact: data.emergencyContact ?? '',
        // Medical
        medicalConditions: data.medicalConditions ?? '',
        allergies: data.allergies ?? '',
        doctorContact: data.doctorContact ?? '',
        // Documents
        docBirthCert: data.docBirthCert ?? '',
        docTransferCert: data.docTransferCert ?? '',
        docAadhaar: data.docAadhaar ?? '',
        docReportCard: data.docReportCard ?? '',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof updateStudent>[1]) => updateStudent(studentId, payload, { schoolId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
      setIsEditing(false);
    },
  });

  const saveAll = () =>
    updateMutation.mutate({
      admissionNo: editData.admissionNo,
      fullName: editData.fullName,
      dob: editData.dob || null,
      gender: editData.gender || null,
      bloodGroup: editData.bloodGroup || null,
      photoUrl: editData.photoUrl || null,
      fatherName: editData.fatherName || null,
      motherName: editData.motherName || null,
      guardianName: editData.guardianName || null,
      guardianRelationship: editData.guardianRelationship || null,
      parentPhone: editData.parentPhone || null,
      parentEmail: editData.parentEmail || null,
      addressLine1: editData.addressLine1 || null,
      addressLine2: editData.addressLine2 || null,
      city: editData.city || null,
      state: editData.state || null,
      pincode: editData.pincode || null,
      emergencyContact: editData.emergencyContact || null,
      medicalConditions: editData.medicalConditions || null,
      allergies: editData.allergies || null,
      doctorContact: editData.doctorContact || null,
      docBirthCert: editData.docBirthCert || null,
      docTransferCert: editData.docTransferCert || null,
      docAadhaar: editData.docAadhaar || null,
      docReportCard: editData.docReportCard || null,
      classId: editData.classId || null,
      sectionId: editData.sectionId || null,
    });

  const quickUpdateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof updateStudent>[1]) => updateStudent(studentId, payload, { schoolId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
    },
  });

  const addPhotoMutation = useMutation({
    mutationFn: (url: string) => addStudentPhoto(studentId, url),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
    },
  });

  const deletePhotoMutation = useMutation({
    mutationFn: (photoId: string) => deleteStudentPhoto(studentId, photoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
    },
  });

  useEffect(() => {
    if (!isEditing || !student) return;
    setEditData({
      admissionNo: student.admissionNo,
      classId: student.classId || '',
      sectionId: student.sectionId || '',
      fullName: student.fullName ?? `${student.firstName} ${student.lastName}`.trim(),
      dob: student.dob ? new Date(student.dob).toISOString().slice(0, 10) : '',
      gender: student.gender ?? '',
      bloodGroup: student.bloodGroup ?? '',
      photoUrl: student.photoUrl ?? '',
      fatherName: student.fatherName ?? '',
      motherName: student.motherName ?? '',
      guardianName: student.guardianName ?? '',
      guardianRelationship: student.guardianRelationship ?? '',
      parentPhone: student.parentPhone ?? '',
      parentEmail: student.parentEmail ?? '',
      addressLine1: student.addressLine1 ?? '',
      addressLine2: student.addressLine2 ?? '',
      city: student.city ?? '',
      state: student.state ?? '',
      pincode: student.pincode ?? '',
      emergencyContact: student.emergencyContact ?? '',
      medicalConditions: student.medicalConditions ?? '',
      allergies: student.allergies ?? '',
      doctorContact: student.doctorContact ?? '',
      docBirthCert: student.docBirthCert ?? '',
      docTransferCert: student.docTransferCert ?? '',
      docAadhaar: student.docAadhaar ?? '',
      docReportCard: student.docReportCard ?? '',
    });
  }, [isEditing, student]);

  useEffect(() => {
    if (!student?.photoUrl) return;
    setPhotoPreview(resolveUploadUrl(student.photoUrl));
  }, [student?.photoUrl]);

  const stateOptions = useMemo(() => State.getStatesOfCountry('IN'), []);
  const selectedStateCode = useMemo(() => {
    const match = stateOptions.find((state) => state.name === editData.state);
    return match?.isoCode ?? '';
  }, [stateOptions, editData.state]);
  const cityOptions = useMemo(() => {
    if (!selectedStateCode) return [];
    return City.getCitiesOfState('IN', selectedStateCode);
  }, [selectedStateCode]);

  if (isLoading) {
    return <FullPageLoader label="Loading student details..." />;
  }

  if (!student) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-ink">Student Not Found</h1>
          <p className="text-sm text-slate">The requested student could not be found.</p>
        </header>
      </div>
    );
  }

  const displayName = student.fullName ?? `${student.firstName} ${student.lastName}`.trim();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-green-50/40">
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
                Student Profile
              </div>
              <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
                {displayName}
              </h1>
              <p className="max-w-2xl text-lg text-emerald-100">
                View and manage comprehensive student information, academic records, and personal details.
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
                    onClick={saveAll}
                    disabled={updateMutation.isPending}
                    className="rounded-xl bg-white/20 px-6 py-3 font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/30 hover:scale-105 disabled:opacity-50"
                  >
                    {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="rounded-xl bg-white/20 px-6 py-3 font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/30 hover:scale-105"
                >
                  <svg className="mr-2 inline h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Profile
                </button>
              )}
              <Link
                href="/dashboard/students"
                className="rounded-xl border border-white/30 px-6 py-3 font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/10"
              >
                <svg className="mr-2 inline h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to List
              </Link>
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
            {steps.map((item, index) => {
              const isActive = step === item.id;
              const stepIcons = {
                1: <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z" /></svg>,
                2: <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" /></svg>,
                3: <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" /></svg>,
                4: <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>,
                5: <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" /></svg>,
                6: <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm3 5a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm0 3a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
              };
              
              return (
                <div key={item.id} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => setStep(item.id)}
                      className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                        isActive 
                          ? 'border-emerald-500 bg-emerald-500 text-white' 
                          : 'border-gray-300 bg-white text-gray-400 hover:border-emerald-300 hover:text-emerald-500'
                      }`}
                    >
                      {stepIcons[item.id as keyof typeof stepIcons] || item.id}
                    </button>
                    <span className={`mt-2 text-xs font-medium ${
                      isActive ? 'text-emerald-600' : 'text-gray-500'
                    }`}>
                      {item.title}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
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
                <h2 className="text-2xl font-bold text-gray-900">Academic Information</h2>
                <p className="mt-2 text-sm text-gray-600">Student's academic details and class assignment information.</p>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Admission Number</label>
                  {isEditing ? (
                    <input
                      value={editData.admissionNo}
                      onChange={(e) => setEditData({ ...editData, admissionNo: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
                    />
                  ) : (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
                      {student.admissionNo}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Class</label>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
                    {student.class?.name || '—'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Section</label>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
                    {student.section?.name || '—'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      student.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {student.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Student Profile</h2>
                <p className="mt-2 text-sm text-gray-600">Personal information and student photo management.</p>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                  {isEditing ? (
                    <input
                      value={editData.fullName}
                      onChange={(e) => setEditData({ ...editData, fullName: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
                    />
                  ) : (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
                      {displayName}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
                  {isEditing ? (
                    <input
                      type="date"
                      value={editData.dob}
                      onChange={(e) => setEditData({ ...editData, dob: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
                    />
                  ) : (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
                      {student.dob ? new Date(student.dob).toLocaleDateString() : '—'}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                  {isEditing ? (
                    <select
                      value={editData.gender}
                      onChange={(e) => setEditData({ ...editData, gender: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
                    >
                      <option value="">Select Gender</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  ) : (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
                      {editData.gender || student.gender || '—'}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Blood Group</label>
                  {isEditing ? (
                    <select
                      value={editData.bloodGroup}
                      onChange={(e) => setEditData({ ...editData, bloodGroup: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
                    >
                      <option value="">Select Blood Group</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                    </select>
                  ) : (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
                      {editData.bloodGroup || '—'}
                    </div>
                  )}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Student Photo</label>
                  <p className="text-xs text-gray-500 mb-3">Upload a clear photo of the student (Max 10MB, JPG/PNG format)</p>
                  {isEditing ? (
                    <div className="space-y-4">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setPhotoPreview(URL.createObjectURL(file));
                          try {
                            const uploaded = await uploadStudentPhoto(file, { schoolId: student.schoolId, studentId: student.id });
                            const resolved = resolveUploadUrl(uploaded.url) ?? uploaded.url;
                            setEditData({ ...editData, photoUrl: uploaded.url });
                            setPhotoPreview(resolved);
                            quickUpdateMutation.mutate({ photoUrl: uploaded.url });
                          } catch {
                            // Keep preview but do not update url.
                          }
                        }}
                        className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
                      />
                      {photoPreview && (
                        <div className="relative inline-block">
                          <img src={photoPreview} alt="Student preview" className="h-24 w-24 rounded-xl object-cover ring-2 ring-emerald-200" />
                          <div className="absolute -top-2 -right-2 rounded-full bg-emerald-500 p-1">
                            <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                      {photoPreview ? (
                        <img
                          src={photoPreview}
                          alt="Student photo"
                          className="h-24 w-24 rounded-xl object-cover ring-2 ring-emerald-200"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-24 w-24 rounded-xl bg-gray-200 text-gray-400">
                          <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Additional Photos</label>
                  <p className="text-xs text-gray-500 mb-3">Upload up to 5 additional photos (Max 10MB each, JPG/PNG format)</p>
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-3">
                      {(student.photos ?? []).map((photo) => (
                        <div key={photo.id} className="relative">
                          <img
                            src={resolveUploadUrl(photo.url) ?? ''}
                            alt="Student"
                            className="h-20 w-20 rounded-xl object-cover ring-2 ring-emerald-200"
                          />
                          {isEditing && (
                            <button
                              type="button"
                              onClick={() => deletePhotoMutation.mutate(photo.id)}
                              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-lg hover:bg-red-600 transition-colors"
                              aria-label="Remove photo"
                            >
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {isEditing && (
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={async (e) => {
                          const files = Array.from(e.target.files ?? []);
                          if (!files.length) return;
                          const existing = student.photos?.length ?? 0;
                          const remaining = Math.max(0, 5 - existing);
                          const toUpload = files.slice(0, remaining);
                          for (const file of toUpload) {
                            const uploaded = await uploadStudentPhoto(file, { schoolId: student.schoolId, studentId: student.id });
                            await addPhotoMutation.mutateAsync(uploaded.url);
                          }
                        }}
                        className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
                      />
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Created Date</label>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
                    {new Date(student.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Parent Information</h2>
                <p className="mt-2 text-sm text-gray-600">Guardian and parent contact details for communication and emergencies.</p>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Father Name</label>
                  {isEditing ? (
                    <input
                      value={editData.fatherName}
                      onChange={(e) => setEditData({ ...editData, fatherName: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
                    />
                  ) : (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
                      {student.fatherName ?? '—'}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Mother Name</label>
                  {isEditing ? (
                    <input
                      value={editData.motherName}
                      onChange={(e) => setEditData({ ...editData, motherName: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
                    />
                  ) : (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
                      {student.motherName ?? '—'}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Guardian Name</label>
                  {isEditing ? (
                    <input
                      value={editData.guardianName}
                      onChange={(e) => setEditData({ ...editData, guardianName: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
                    />
                  ) : (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
                      {student.guardianName ?? '—'}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Relationship</label>
                  {isEditing ? (
                    <select
                      value={editData.guardianRelationship}
                      onChange={(e) => setEditData({ ...editData, guardianRelationship: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
                    >
                      <option value="">Select relationship</option>
                      <option value="FATHER">Father</option>
                      <option value="MOTHER">Mother</option>
                      <option value="GUARDIAN">Guardian</option>
                      <option value="OTHER">Other</option>
                    </select>
                  ) : (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
                      {student.guardianRelationship ?? '—'}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                  {isEditing ? (
                    <input
                      value={editData.parentPhone}
                      onChange={(e) => setEditData({ ...editData, parentPhone: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
                    />
                  ) : (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
                      {student.parentPhone ?? '—'}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                  {isEditing ? (
                    <input
                      type="email"
                      value={editData.parentEmail}
                      onChange={(e) => setEditData({ ...editData, parentEmail: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
                    />
                  ) : (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
                      {student.parentEmail ?? '—'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Address Information</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate mb-1">Address Line 1</label>
                  {isEditing ? (
                    <input
                      value={editData.addressLine1}
                      onChange={(e) => setEditData({ ...editData, addressLine1: e.target.value })}
                      className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
                    />
                  ) : (
                    <div className="rounded-lg border border-slate/20 px-3 py-2 text-sm bg-slate/5">
                      {student.addressLine1 ?? '—'}
                    </div>
                  )}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate mb-1">Address Line 2</label>
                  {isEditing ? (
                    <input
                      value={editData.addressLine2}
                      onChange={(e) => setEditData({ ...editData, addressLine2: e.target.value })}
                      className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
                    />
                  ) : (
                    <div className="rounded-lg border border-slate/20 px-3 py-2 text-sm bg-slate/5">
                      {student.addressLine2 ?? '—'}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate mb-1">City</label>
                  {isEditing ? (
                    <select
                      value={editData.city}
                      onChange={(e) => setEditData({ ...editData, city: e.target.value })}
                      className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
                      disabled={!editData.state || cityOptions.length === 0}
                    >
                      <option value="">
                        {!editData.state
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
                  ) : (
                    <div className="rounded-lg border border-slate/20 px-3 py-2 text-sm bg-slate/5">
                      {student.city ?? '—'}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate mb-1">State</label>
                  {isEditing ? (
                    <select
                      value={editData.state}
                      onChange={(e) => setEditData({ ...editData, state: e.target.value, city: '' })}
                      className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
                    >
                      <option value="">Select state</option>
                      {stateOptions.map((state) => (
                        <option key={state.isoCode} value={state.name}>
                          {state.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="rounded-lg border border-slate/20 px-3 py-2 text-sm bg-slate/5">
                      {student.state ?? '—'}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate mb-1">Pincode</label>
                  {isEditing ? (
                    <input
                      value={editData.pincode}
                      onChange={(e) => setEditData({ ...editData, pincode: e.target.value })}
                      className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
                    />
                  ) : (
                    <div className="rounded-lg border border-slate/20 px-3 py-2 text-sm bg-slate/5">
                      {student.pincode ?? '—'}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate mb-1">Emergency Contact</label>
                  {isEditing ? (
                    <input
                      value={editData.emergencyContact}
                      onChange={(e) => setEditData({ ...editData, emergencyContact: e.target.value })}
                      className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
                    />
                  ) : (
                    <div className="rounded-lg border border-slate/20 px-3 py-2 text-sm bg-slate/5">
                      {student.emergencyContact ?? '—'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Medical Information</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate mb-1">Medical Conditions</label>
                  {isEditing ? (
                    <textarea
                      value={editData.medicalConditions}
                      onChange={(e) => setEditData({ ...editData, medicalConditions: e.target.value })}
                      className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
                      rows={3}
                    />
                  ) : (
                    <div className="rounded-lg border border-slate/20 px-3 py-2 text-sm bg-slate/5 min-h-[80px]">
                      {student.medicalConditions ?? '—'}
                    </div>
                  )}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate mb-1">Allergies</label>
                  {isEditing ? (
                    <textarea
                      value={editData.allergies}
                      onChange={(e) => setEditData({ ...editData, allergies: e.target.value })}
                      className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
                      rows={3}
                    />
                  ) : (
                    <div className="rounded-lg border border-slate/20 px-3 py-2 text-sm bg-slate/5 min-h-[80px]">
                      {student.allergies ?? '—'}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate mb-1">Doctor Name</label>
                  {isEditing ? (
                    <input
                      value={editData.doctorContact}
                      onChange={(e) => setEditData({ ...editData, doctorContact: e.target.value })}
                      className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
                    />
                  ) : (
                    <div className="rounded-lg border border-slate/20 px-3 py-2 text-sm bg-slate/5">
                      {student.doctorContact ?? '—'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 6 && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Documents</h3>
              <p className="text-xs text-slate/70 -mt-3 mb-4">Max 20MB per file (PDF/DOC/DOCX/Images).</p>
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  { key: 'docBirthCert', label: 'Birth Certificate' },
                  { key: 'docTransferCert', label: 'Transfer Certificate' },
                  { key: 'docAadhaar', label: 'Aadhaar Card' },
                  { key: 'docReportCard', label: 'Report Card' },
                ].map((item) => (
                  <div key={item.key} className="flex flex-col gap-2 rounded-lg border border-slate/20 px-3 py-2">
                    <label className="text-sm font-medium text-slate">{item.label}</label>
                    {isEditing ? (
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const uploaded = await uploadStudentDocument(file, student.id, { schoolId: student.schoolId });
                            setEditData({ ...editData, [item.key]: uploaded.url });
                            quickUpdateMutation.mutate({ [item.key]: uploaded.url } as any);
                          } catch {
                            // ignore upload error in UI
                          }
                        }}
                        className="text-xs"
                      />
                    ) : (
                      <div className="text-sm bg-slate/5 px-2 py-1 rounded">
                        {(student as any)[item.key] ? (
                          <a
                            className="text-ink underline"
                            href={resolveUploadUrl((student as any)[item.key]) ?? undefined}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View document
                          </a>
                        ) : (
                          'No file uploaded'
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={() => setStep((prev) => (prev > 1 ? ((prev - 1) as Step) : prev))}
              disabled={step === 1}
              className="rounded-xl border border-gray-300 px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="mr-2 inline h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Previous
            </button>
            <button
              onClick={() => setStep((prev) => (prev < 6 ? ((prev + 1) as Step) : prev))}
              disabled={step === 6}
              className="rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 px-8 py-3 font-semibold text-white shadow-lg transition-all hover:from-emerald-700 hover:to-green-700 hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              Next
              <svg className="ml-2 inline h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
