'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listTeachers,
  createTeacher,
  updateTeacher,
  setTeacherStatus,
  assignClass,
  assignSubject,
  unassignClass,
  unassignSubject,
} from '../../../services/teacher.service';
import { listClasses, listSubjects } from '../../../services/academic.service';
import { listSchools } from '../../../services/school.service';
import { getSession } from '../../../services/auth.service';

export default function TeachersPage() {
  const queryClient = useQueryClient();
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
    branchName: '',
    panNumber: '',
  });
  const [createdTeacher, setCreatedTeacher] = useState<{ email: string; tempPassword: string } | null>(null);
  const [selection, setSelection] = useState({ teacherId: '', classId: '', subjectId: '' });

  const [schoolId, setSchoolId] = useState('');
  const { data: session } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSuperAdmin = session?.role === 'SUPER_ADMIN';
  const effectiveSchoolId = isSuperAdmin ? schoolId : session?.schoolId ?? undefined;

  const { data: schools } = useQuery({
    queryKey: ['schools', 'all'],
    queryFn: () => listSchools({ limit: 100 }),
    enabled: isSuperAdmin,
  });

  const { data } = useQuery({
    queryKey: ['teachers', effectiveSchoolId],
    queryFn: () => listTeachers({ limit: 50, schoolId: effectiveSchoolId }),
    enabled: Boolean(effectiveSchoolId),
  });
  const { data: classes } = useQuery({
    queryKey: ['classes', effectiveSchoolId],
    queryFn: () => listClasses({ schoolId: effectiveSchoolId }),
    enabled: Boolean(effectiveSchoolId),
  });
  const { data: subjects } = useQuery({
    queryKey: ['subjects', effectiveSchoolId],
    queryFn: () => listSubjects({ schoolId: effectiveSchoolId }),
    enabled: Boolean(effectiveSchoolId),
  });

  const createMutation = useMutation({
    mutationFn: createTeacher,
    onSuccess: (result) => {
      setForm({
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
        branchName: '',
        panNumber: '',
      });
      if (result?.user?.email && result?.tempPassword) {
        setCreatedTeacher({ email: result.user.email, tempPassword: result.tempPassword });
      } else {
        setCreatedTeacher(null);
      }
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { isActive: boolean } }) => updateTeacher(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teachers'] }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => setTeacherStatus(id, isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teachers'] }),
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (selection.teacherId && selection.classId) {
        await assignClass({ teacherId: selection.teacherId, classId: selection.classId });
      }
      if (selection.teacherId && selection.subjectId) {
        await assignSubject({ teacherId: selection.teacherId, subjectId: selection.subjectId });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teachers'] }),
  });

  const unassignMutation = useMutation({
    mutationFn: async () => {
      if (selection.teacherId && selection.classId) {
        await unassignClass({ teacherId: selection.teacherId, classId: selection.classId });
      }
      if (selection.teacherId && selection.subjectId) {
        await unassignSubject({ teacherId: selection.teacherId, subjectId: selection.subjectId });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teachers'] }),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Teachers</h1>
        <p className="text-sm text-slate">Assign classes, subjects, and manage availability.</p>
      </header>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        {isSuperAdmin ? (
          <div className="mb-4">
            <select
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
            >
              <option value="">Select school</option>
              {schools?.items.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name} ({school.code})
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <h2 className="text-lg font-semibold">Add Teacher</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            placeholder="First name"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
          <input
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            placeholder="Last name"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
          <input
            value={form.employeeNo}
            onChange={(e) => setForm({ ...form, employeeNo: e.target.value })}
            placeholder="Employee No"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-ink">Contact info</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Email"
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
            />
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Phone"
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
            />
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Address"
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-ink">Banking details (optional)</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <input
              value={form.accountHolderName}
              onChange={(e) => setForm({ ...form, accountHolderName: e.target.value })}
              placeholder="Account holder name"
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
            />
            <input
              value={form.accountNumber}
              onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
              placeholder="Account number"
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
            />
            <input
              value={form.ifscCode}
              onChange={(e) => setForm({ ...form, ifscCode: e.target.value })}
              placeholder="IFSC code"
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
            />
            <input
              value={form.accountType}
              onChange={(e) => setForm({ ...form, accountType: e.target.value })}
              placeholder="Account type"
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
            />
            <input
              value={form.bankName}
              onChange={(e) => setForm({ ...form, bankName: e.target.value })}
              placeholder="Bank name"
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
            />
            <input
              value={form.branchName}
              onChange={(e) => setForm({ ...form, branchName: e.target.value })}
              placeholder="Branch name"
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
            />
            <input
              value={form.panNumber}
              onChange={(e) => setForm({ ...form, panNumber: e.target.value })}
              placeholder="PAN number"
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <button
          className="mt-4 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
          onClick={() =>
            createMutation.mutate({
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
                bankName: form.bankName || null,
                branchName: form.branchName || null,
                panNumber: form.panNumber || null,
              },
              schoolId: effectiveSchoolId,
            })
          }
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? 'Creating...' : 'Create Teacher'}
        </button>
        {createdTeacher ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <div className="font-semibold">Teacher created</div>
            <div className="mt-1">Email: {createdTeacher.email}</div>
            <div className="mt-1">Temporary password: {createdTeacher.tempPassword}</div>
            <div className="mt-2 text-xs text-emerald-700">
              Share this once. It will not be shown again.
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <h2 className="text-lg font-semibold">Assignments</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <select
            value={selection.teacherId}
            onChange={(e) => setSelection({ ...selection, teacherId: e.target.value })}
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          >
            <option value="">Select teacher</option>
            {data?.items.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.firstName} {teacher.lastName}
              </option>
            ))}
          </select>
          <select
            value={selection.classId}
            onChange={(e) => setSelection({ ...selection, classId: e.target.value })}
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          >
            <option value="">Select class</option>
            {classes?.map((cls: { id: string; name: string }) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
          <select
            value={selection.subjectId}
            onChange={(e) => setSelection({ ...selection, subjectId: e.target.value })}
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          >
            <option value="">Select subject</option>
            {subjects?.map((subject: { id: string; name: string }) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
            onClick={() => assignMutation.mutate()}
            disabled={assignMutation.isPending}
          >
            Assign
          </button>
          <button
            className="rounded-lg border border-slate/20 px-4 py-2 text-sm"
            onClick={() => unassignMutation.mutate()}
            disabled={unassignMutation.isPending}
          >
            Unassign
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <h2 className="text-lg font-semibold">Teacher Directory</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate">
              <tr>
                <th className="py-2">Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Assignments</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((teacher) => (
                <tr key={teacher.id} className="border-t border-slate/10">
                  <td className="py-3">
                    {teacher.firstName} {teacher.lastName}
                  </td>
                  <td>{teacher.user.email}</td>
                  <td>{teacher.isActive ? 'Active' : 'Inactive'}</td>
                  <td className="text-xs text-slate">
                    {teacher.classAssignments.map((a) => a.class.name).join(', ') || '—'} |{' '}
                    {teacher.subjectAssignments.map((a) => a.subject.name).join(', ') || '—'}
                  </td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        className="rounded-lg border border-slate/20 px-3 py-1 text-xs"
                        onClick={() => updateMutation.mutate({ id: teacher.id, payload: { isActive: !teacher.isActive } })}
                      >
                        Toggle Profile
                      </button>
                      <button
                        className="rounded-lg border border-slate/20 px-3 py-1 text-xs"
                        onClick={() => statusMutation.mutate({ id: teacher.id, isActive: !teacher.isActive })}
                      >
                        {teacher.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!data?.items.length ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate">
                    No teachers found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
