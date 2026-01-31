'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getStudent, updateStudent } from '../../../../services/student.service';

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

const steps: Array<{ id: Step; title: string }> = [
  { id: 1, title: 'Academic' },
  { id: 2, title: 'Student' },
  { id: 3, title: 'Parent' },
  { id: 4, title: 'Address' },
  { id: 5, title: 'Medical' },
  { id: 6, title: 'Documents' },
  { id: 7, title: 'Access' },
  { id: 8, title: 'Summary' },
];

export default function StudentDetailPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>(1);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    // Academic
    admissionNo: '',
    classId: '',
    sectionId: '',
    // Student
    firstName: '',
    lastName: '',
    dob: '',
    gender: '',
    bloodGroup: '',
    // Parent
    fatherName: '',
    motherName: '',
    guardianName: '',
    relationship: '',
    phone: '',
    email: '',
    // Address
    line1: '',
    line2: '',
    city: '',
    state: '',
    pincode: '',
    emergency: '',
    // Medical
    conditions: '',
    allergies: '',
    doctor: '',
    // Documents
    birthCert: '',
    transferCert: '',
    aadhaar: '',
    reportCard: '',
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
        firstName: data.firstName,
        lastName: data.lastName,
        dob: data.dob || '',
        gender: '',
        bloodGroup: '',
        // Parent
        fatherName: data.parentLinks?.[0]?.parent?.firstName || '',
        motherName: '',
        guardianName: data.parentLinks?.[0]?.parent?.firstName || '',
        relationship: '',
        phone: data.parentLinks?.[0]?.parent?.phone || '',
        email: data.parentLinks?.[0]?.parent?.email || '',
        // Address
        line1: '',
        line2: '',
        city: '',
        state: '',
        pincode: '',
        emergency: '',
        // Medical
        conditions: '',
        allergies: '',
        doctor: '',
        // Documents
        birthCert: '',
        transferCert: '',
        aadhaar: '',
        reportCard: '',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => updateStudent(studentId, editData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
      setIsEditing(false);
    },
  });

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

  const primaryParent = student.parentLinks?.[0]?.parent;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">
            {student.firstName} {student.lastName}
          </h1>
          <p className="text-sm text-slate">Student details and information</p>
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
                onClick={() => updateMutation.mutate()}
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
              <h3 className="text-lg font-semibold mb-4">Student Information</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate mb-1">First Name</label>
                  {isEditing ? (
                    <input
                      value={editData.firstName}
                      onChange={(e) => setEditData({ ...editData, firstName: e.target.value })}
                      className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
                    />
                  ) : (
                    <div className="rounded-lg border border-slate/20 px-3 py-2 text-sm bg-slate/5">
                      {student.firstName}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate mb-1">Last Name</label>
                  {isEditing ? (
                    <input
                      value={editData.lastName}
                      onChange={(e) => setEditData({ ...editData, lastName: e.target.value })}
                      className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
                    />
                  ) : (
                    <div className="rounded-lg border border-slate/20 px-3 py-2 text-sm bg-slate/5">
                      {student.lastName}
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
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  ) : (
                    <div className="rounded-lg border border-slate/20 px-3 py-2 text-sm bg-slate/5">
                      {editData.gender || '—'}
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
                      {editData.fatherName || '—'}
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
                      {editData.motherName || '—'}
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
                      {editData.guardianName || '—'}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate mb-1">Relationship</label>
                  {isEditing ? (
                    <input
                      value={editData.relationship}
                      onChange={(e) => setEditData({ ...editData, relationship: e.target.value })}
                      className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
                    />
                  ) : (
                    <div className="rounded-lg border border-slate/20 px-3 py-2 text-sm bg-slate/5">
                      {editData.relationship || '—'}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate mb-1">Phone</label>
                  {isEditing ? (
                    <input
                      value={editData.phone}
                      onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                      className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
                    />
                  ) : (
                    <div className="rounded-lg border border-slate/20 px-3 py-2 text-sm bg-slate/5">
                      {editData.phone || '—'}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate mb-1">Email</label>
                  {isEditing ? (
                    <input
                      type="email"
                      value={editData.email}
                      onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                      className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
                    />
                  ) : (
                    <div className="rounded-lg border border-slate/20 px-3 py-2 text-sm bg-slate/5">
                      {editData.email || '—'}
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
                      value={editData.line1}
                      onChange={(e) => setEditData({ ...editData, line1: e.target.value })}
                      className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
                    />
                  ) : (
                    <div className="rounded-lg border border-slate/20 px-3 py-2 text-sm bg-slate/5">
                      {editData.line1 || '—'}
                    </div>
                  )}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate mb-1">Address Line 2</label>
                  {isEditing ? (
                    <input
                      value={editData.line2}
                      onChange={(e) => setEditData({ ...editData, line2: e.target.value })}
                      className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
                    />
                  ) : (
                    <div className="rounded-lg border border-slate/20 px-3 py-2 text-sm bg-slate/5">
                      {editData.line2 || '—'}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate mb-1">City</label>
                  {isEditing ? (
                    <input
                      value={editData.city}
                      onChange={(e) => setEditData({ ...editData, city: e.target.value })}
                      className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
                    />
                  ) : (
                    <div className="rounded-lg border border-slate/20 px-3 py-2 text-sm bg-slate/5">
                      {editData.city || '—'}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate mb-1">State</label>
                  {isEditing ? (
                    <input
                      value={editData.state}
                      onChange={(e) => setEditData({ ...editData, state: e.target.value })}
                      className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
                    />
                  ) : (
                    <div className="rounded-lg border border-slate/20 px-3 py-2 text-sm bg-slate/5">
                      {editData.state || '—'}
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
                      {editData.pincode || '—'}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate mb-1">Emergency Contact</label>
                  {isEditing ? (
                    <input
                      value={editData.emergency}
                      onChange={(e) => setEditData({ ...editData, emergency: e.target.value })}
                      className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
                    />
                  ) : (
                    <div className="rounded-lg border border-slate/20 px-3 py-2 text-sm bg-slate/5">
                      {editData.emergency || '—'}
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
                      value={editData.conditions}
                      onChange={(e) => setEditData({ ...editData, conditions: e.target.value })}
                      className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
                      rows={3}
                    />
                  ) : (
                    <div className="rounded-lg border border-slate/20 px-3 py-2 text-sm bg-slate/5 min-h-[80px]">
                      {editData.conditions || '—'}
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
                      {editData.allergies || '—'}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate mb-1">Doctor Name</label>
                  {isEditing ? (
                    <input
                      value={editData.doctor}
                      onChange={(e) => setEditData({ ...editData, doctor: e.target.value })}
                      className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
                    />
                  ) : (
                    <div className="rounded-lg border border-slate/20 px-3 py-2 text-sm bg-slate/5">
                      {editData.doctor || '—'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 6 && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Documents</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  { key: 'birthCert', label: 'Birth Certificate' },
                  { key: 'transferCert', label: 'Transfer Certificate' },
                  { key: 'aadhaar', label: 'Aadhaar Card' },
                  { key: 'reportCard', label: 'Report Card' },
                ].map((item) => (
                  <div key={item.key} className="flex flex-col gap-2 rounded-lg border border-slate/20 px-3 py-2">
                    <label className="text-sm font-medium text-slate">{item.label}</label>
                    {isEditing ? (
                      <input
                        type="file"
                        onChange={(e) => setEditData({ ...editData, [item.key]: e.target.files?.[0]?.name ?? '' })}
                        className="text-xs"
                      />
                    ) : (
                      <div className="text-sm bg-slate/5 px-2 py-1 rounded">
                        {editData[item.key as keyof typeof editData] || 'No file uploaded'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 7 && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Access Information</h3>
              <p className="text-slate">Access and login settings for student and parent accounts.</p>
            </div>
          )}

          {step === 8 && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Summary</h3>
              <div className="space-y-4">
                <div className="rounded-lg border border-slate/10 p-4">
                  <h4 className="font-medium mb-2">Academic Details</h4>
                  <p className="text-sm text-slate">
                    Admission: {student.admissionNo} | Class: {student.class?.name || '—'} | 
                    Section: {student.section?.name || '—'} | Status: {student.status}
                  </p>
                </div>
                <div className="rounded-lg border border-slate/10 p-4">
                  <h4 className="font-medium mb-2">Student Details</h4>
                  <p className="text-sm text-slate">
                    Name: {student.firstName} {student.lastName} | 
                    DOB: {student.dob ? new Date(student.dob).toLocaleDateString() : '—'}
                  </p>
                </div>
                {primaryParent && (
                  <div className="rounded-lg border border-slate/10 p-4">
                    <h4 className="font-medium mb-2">Parent Details</h4>
                    <p className="text-sm text-slate">
                      Name: {primaryParent.firstName} {primaryParent.lastName} | 
                      Phone: {primaryParent.phone || '—'} | Email: {primaryParent.email || '—'}
                    </p>
                  </div>
                )}
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
            onClick={() => setStep((prev) => (prev < 8 ? ((prev + 1) as Step) : prev))}
            disabled={step === 8}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-ink/90"
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
}