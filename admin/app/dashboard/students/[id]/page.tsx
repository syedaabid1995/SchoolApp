'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getStudent, updateStudent, uploadStudentPhoto, uploadStudentDocument, resolveUploadUrl, addStudentPhoto, deleteStudentPhoto } from '../../../../services/student.service';
import { City, State } from 'country-state-city';

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
    queryFn: () => getStudent(studentId),
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
    mutationFn: (payload: Parameters<typeof updateStudent>[1]) => updateStudent(studentId, payload),
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
    mutationFn: (payload: Parameters<typeof updateStudent>[1]) => updateStudent(studentId, payload),
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
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate/20 rounded w-48 mb-2"></div>
          <div className="h-4 bg-slate/20 rounded w-64"></div>
        </div>
      </div>
    );
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
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">
            {displayName}
          </h1>
          
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(false)}
                className="rounded-lg border border-slate/20 px-4 py-2 text-sm font-medium hover:bg-slate/5"
              >
                Cancel
              </button>
              <button
                onClick={saveAll}
                disabled={updateMutation.isPending}
                className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink/90 disabled:opacity-50"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink/90"
            >
              Edit
            </button>
          )}
          <Link
            href="/dashboard/students"
            className="rounded-lg border border-slate/20 px-4 py-2 text-sm font-medium hover:bg-slate/5"
          >
            Back to List
          </Link>
        </div>
      </header>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            {steps.map((item) => (
              <button
                key={item.id}
                onClick={() => setStep(item.id)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  step === item.id ? 'bg-ink text-white' : 'bg-sand text-slate hover:bg-slate/10'
                }`}
              >
                {item.title}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {step === 1 && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Academic Information</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate mb-1">Admission Number</label>
                  {isEditing ? (
                    <input
                      value={editData.admissionNo}
                      onChange={(e) => setEditData({ ...editData, admissionNo: e.target.value })}
                      className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
                    />
                  ) : (
                    <div className="rounded-lg border border-slate/20 px-3 py-2 text-sm bg-slate/5">
                      {student.admissionNo}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate mb-1">Class</label>
                  <div className="rounded-lg border border-slate/20 px-3 py-2 text-sm bg-slate/5">
                    {student.class?.name || '—'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate mb-1">Section</label>
                  <div className="rounded-lg border border-slate/20 px-3 py-2 text-sm bg-slate/5">
                    {student.section?.name || '—'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate mb-1">Status</label>
                  <div className="rounded-lg border border-slate/20 px-3 py-2 text-sm bg-slate/5">
                    {student.status}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate mb-1">Full Name</label>
                  {isEditing ? (
                    <input
                      value={editData.fullName}
                      onChange={(e) => setEditData({ ...editData, fullName: e.target.value })}
                      className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
                    />
                  ) : (
                    <div className="rounded-lg border border-slate/20 px-3 py-2 text-sm bg-slate/5">
                      {displayName}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate mb-1">Date of Birth</label>
                  {isEditing ? (
                    <input
                      type="date"
                      value={editData.dob}
                      onChange={(e) => setEditData({ ...editData, dob: e.target.value })}
                      className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
                    />
                  ) : (
                    <div className="rounded-lg border border-slate/20 px-3 py-2 text-sm bg-slate/5">
                      {student.dob ? new Date(student.dob).toLocaleDateString() : '—'}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate mb-1">Gender</label>
                  {isEditing ? (
                    <select
                      value={editData.gender}
                      onChange={(e) => setEditData({ ...editData, gender: e.target.value })}
                      className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
                    >
                      <option value="">Select Gender</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  ) : (
                    <div className="rounded-lg border border-slate/20 px-3 py-2 text-sm bg-slate/5">
                      {editData.gender || student.gender || '—'}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate mb-1">Blood Group</label>
                  {isEditing ? (
                    <select
                      value={editData.bloodGroup}
                      onChange={(e) => setEditData({ ...editData, bloodGroup: e.target.value })}
                      className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
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
                    <div className="rounded-lg border border-slate/20 px-3 py-2 text-sm bg-slate/5">
                      {editData.bloodGroup || '—'}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate mb-1">Photo</label>
                  <p className="text-xs text-slate/70 mb-2">Max 10MB per image (JPG/PNG).</p>
                  {isEditing ? (
                    <div className="space-y-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setPhotoPreview(URL.createObjectURL(file));
                          try {
                            const uploaded = await uploadStudentPhoto(file);
                            const resolved = resolveUploadUrl(uploaded.url) ?? uploaded.url;
                            setEditData({ ...editData, photoUrl: uploaded.url });
                            setPhotoPreview(resolved);
                            quickUpdateMutation.mutate({ photoUrl: uploaded.url });
                          } catch {
                            // Keep preview but do not update url.
                          }
                        }}
                        className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
                      />
                      {photoPreview ? (
                        <img src={photoPreview} alt="Student preview" className="h-24 w-24 rounded-lg object-cover" />
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-slate/20 bg-slate/5 p-2">
                      {photoPreview ? (
                        <img
                          src={photoPreview}
                          alt="Student photo"
                          className="h-24 w-24 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="text-sm text-slate">No photo</div>
                      )}
                    </div>
                  )}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate mb-1">Additional Photos (max 5)</label>
                  <p className="text-xs text-slate/70 mb-2">Max 10MB per image (JPG/PNG).</p>
                  <div className="flex flex-wrap gap-2">
                    {(student.photos ?? []).map((photo) => (
                      <div key={photo.id} className="relative">
                        <img
                          src={resolveUploadUrl(photo.url) ?? ''}
                          alt="Student"
                          className="h-20 w-20 rounded-lg object-cover"
                        />
                        {isEditing ? (
                          <button
                            type="button"
                            onClick={() => deletePhotoMutation.mutate(photo.id)}
                            className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-semibold text-white shadow"
                            aria-label="Remove photo"
                          >
                            ×
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  {isEditing ? (
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
                          const uploaded = await uploadStudentPhoto(file);
                          await addPhotoMutation.mutateAsync(uploaded.url);
                        }
                      }}
                      className="mt-2 w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
                    />
                  ) : null}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate mb-1">Created</label>
                  <div className="rounded-lg border border-slate/20 px-3 py-2 text-sm bg-slate/5">
                    {new Date(student.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Parent Information</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate mb-1">Father Name</label>
                  {isEditing ? (
                    <input
                      value={editData.fatherName}
                      onChange={(e) => setEditData({ ...editData, fatherName: e.target.value })}
                      className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
                    />
                  ) : (
                    <div className="rounded-lg border border-slate/20 px-3 py-2 text-sm bg-slate/5">
                      {student.fatherName ?? '—'}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate mb-1">Mother Name</label>
                  {isEditing ? (
                    <input
                      value={editData.motherName}
                      onChange={(e) => setEditData({ ...editData, motherName: e.target.value })}
                      className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
                    />
                  ) : (
                    <div className="rounded-lg border border-slate/20 px-3 py-2 text-sm bg-slate/5">
                      {student.motherName ?? '—'}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate mb-1">Guardian Name</label>
                  {isEditing ? (
                    <input
                      value={editData.guardianName}
                      onChange={(e) => setEditData({ ...editData, guardianName: e.target.value })}
                      className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
                    />
                  ) : (
                    <div className="rounded-lg border border-slate/20 px-3 py-2 text-sm bg-slate/5">
                      {student.guardianName ?? '—'}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate mb-1">Relationship</label>
                  {isEditing ? (
                    <select
                      value={editData.guardianRelationship}
                      onChange={(e) => setEditData({ ...editData, guardianRelationship: e.target.value })}
                      className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
                    >
                      <option value="">Relationship</option>
                      <option value="FATHER">Father</option>
                      <option value="MOTHER">Mother</option>
                      <option value="GUARDIAN">Guardian</option>
                      <option value="OTHER">Other</option>
                    </select>
                  ) : (
                    <div className="rounded-lg border border-slate/20 px-3 py-2 text-sm bg-slate/5">
                      {student.guardianRelationship ?? '—'}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate mb-1">Phone</label>
                  {isEditing ? (
                    <input
                      value={editData.parentPhone}
                      onChange={(e) => setEditData({ ...editData, parentPhone: e.target.value })}
                      className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
                    />
                  ) : (
                    <div className="rounded-lg border border-slate/20 px-3 py-2 text-sm bg-slate/5">
                      {student.parentPhone ?? '—'}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate mb-1">Email</label>
                  {isEditing ? (
                    <input
                      type="email"
                      value={editData.parentEmail}
                      onChange={(e) => setEditData({ ...editData, parentEmail: e.target.value })}
                      className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
                    />
                  ) : (
                    <div className="rounded-lg border border-slate/20 px-3 py-2 text-sm bg-slate/5">
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
                              const uploaded = await uploadStudentDocument(file);
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

        </div>

        <div className="flex justify-between mt-6 pt-6 border-t border-slate/10">
          <button
            onClick={() => setStep((prev) => (prev > 1 ? ((prev - 1) as Step) : prev))}
            disabled={step === 1}
            className="rounded-lg border border-slate/20 px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate/5"
          >
            Previous
          </button>
          <button
            onClick={() => setStep((prev) => (prev < 6 ? ((prev + 1) as Step) : prev))}
            disabled={step === 6}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-ink/90"
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
}
