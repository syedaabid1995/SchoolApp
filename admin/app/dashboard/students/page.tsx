'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listStudents, createStudent, changeStudentStatus, linkParent, listParents } from '../../../services/student.service';
import { listClasses, listSections } from '../../../services/academic.service';
import { listSchools } from '../../../services/school.service';
import { getSession } from '../../../services/auth.service';

export default function StudentsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    admissionNo: '',
    firstName: '',
    lastName: '',
    dob: '',
    classId: '',
    sectionId: '',
  });
  const [link, setLink] = useState({ studentId: '', parentId: '' });

  const [schoolId, setSchoolId] = useState('');
  const { data: session } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSuperAdmin = session?.role === 'SUPER_ADMIN';
  const effectiveSchoolId = isSuperAdmin ? schoolId : session?.schoolId ?? undefined;

  const { data: schools } = useQuery({
    queryKey: ['schools', 'all'],
    queryFn: () => listSchools({ limit: 100 }),
    enabled: isSuperAdmin,
  });

  const { data: students } = useQuery({
    queryKey: ['students', effectiveSchoolId],
    queryFn: () => listStudents({ schoolId: effectiveSchoolId }),
    enabled: Boolean(effectiveSchoolId),
  });
  const { data: parents } = useQuery({
    queryKey: ['parents', effectiveSchoolId],
    queryFn: () => listParents({ schoolId: effectiveSchoolId }),
    enabled: Boolean(effectiveSchoolId),
  });
  const { data: classes } = useQuery({
    queryKey: ['classes', effectiveSchoolId],
    queryFn: () => listClasses({ schoolId: effectiveSchoolId }),
    enabled: Boolean(effectiveSchoolId),
  });
  const { data: sections } = useQuery({
    queryKey: ['sections', effectiveSchoolId],
    queryFn: () => listSections({ schoolId: effectiveSchoolId }),
    enabled: Boolean(effectiveSchoolId),
  });

  const createMutation = useMutation({
    mutationFn: createStudent,
    onSuccess: () => {
      setForm({ admissionNo: '', firstName: '', lastName: '', dob: '', classId: '', sectionId: '' });
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'TRANSFERRED' | 'EXITED' }) =>
      changeStudentStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['students'] }),
  });

  const linkMutation = useMutation({
    mutationFn: () => linkParent(link.studentId, link.parentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['students'] }),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Students</h1>
        <p className="text-sm text-slate">Enroll students, map parents, and review face status.</p>
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
        <h2 className="text-lg font-semibold">Enroll Student</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input
            value={form.admissionNo}
            onChange={(e) => setForm({ ...form, admissionNo: e.target.value })}
            placeholder="Admission No"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
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
            value={form.dob}
            onChange={(e) => setForm({ ...form, dob: e.target.value })}
            placeholder="DOB (YYYY-MM-DD)"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
          <select
            value={form.classId}
            onChange={(e) => setForm({ ...form, classId: e.target.value })}
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
            value={form.sectionId}
            onChange={(e) => setForm({ ...form, sectionId: e.target.value })}
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          >
            <option value="">Select section</option>
            {sections?.map((section: { id: string; name: string }) => (
              <option key={section.id} value={section.id}>
                {section.name}
              </option>
            ))}
          </select>
        </div>
        <button
          className="mt-4 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
          onClick={() =>
            createMutation.mutate({
              admissionNo: form.admissionNo,
              firstName: form.firstName,
              lastName: form.lastName,
              dob: form.dob || undefined,
              classId: form.classId || null,
              sectionId: form.sectionId || null,
              schoolId: effectiveSchoolId,
            })
          }
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? 'Creating...' : 'Create Student'}
        </button>
      </section>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <h2 className="text-lg font-semibold">Parent Mapping</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <select
            value={link.studentId}
            onChange={(e) => setLink({ ...link, studentId: e.target.value })}
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          >
            <option value="">Select student</option>
            {students?.map((student) => (
              <option key={student.id} value={student.id}>
                {student.firstName} {student.lastName}
              </option>
            ))}
          </select>
          <select
            value={link.parentId}
            onChange={(e) => setLink({ ...link, parentId: e.target.value })}
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          >
            <option value="">Select parent</option>
            {parents?.map((parent: { id: string; firstName: string; lastName: string }) => (
              <option key={parent.id} value={parent.id}>
                {parent.firstName} {parent.lastName}
              </option>
            ))}
          </select>
        </div>
        <button
          className="mt-4 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
          onClick={() => linkMutation.mutate()}
          disabled={linkMutation.isPending}
        >
          {linkMutation.isPending ? 'Linking...' : 'Link Parent'}
        </button>
      </section>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <h2 className="text-lg font-semibold">Student Roster</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate">
              <tr>
                <th className="py-2">Name</th>
                <th>Admission No</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {students?.map((student) => (
                <tr key={student.id} className="border-t border-slate/10">
                  <td className="py-3">
                    {student.firstName} {student.lastName}
                  </td>
                  <td>{student.admissionNo}</td>
                  <td>{student.status}</td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        className="rounded-lg border border-slate/20 px-3 py-1 text-xs"
                        onClick={() => statusMutation.mutate({ id: student.id, status: 'TRANSFERRED' })}
                      >
                        Transfer
                      </button>
                      <button
                        className="rounded-lg border border-slate/20 px-3 py-1 text-xs"
                        onClick={() => statusMutation.mutate({ id: student.id, status: 'EXITED' })}
                      >
                        Exit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!students?.length ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate">
                    No students found.
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
