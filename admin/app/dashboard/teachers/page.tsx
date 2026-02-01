'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listTeachers, updateTeacher, setTeacherStatus, deleteTeacher } from '../../../services/teacher.service';
import { listSchools } from '../../../services/school.service';
import { getSession } from '../../../services/auth.service';

export default function TeachersPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ query: '', status: '' });
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

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { isActive: boolean } }) => updateTeacher(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teachers'] }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => setTeacherStatus(id, isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teachers'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTeacher(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['teachers', effectiveSchoolId] });
      const previous = queryClient.getQueryData<any>(['teachers', effectiveSchoolId]);
      if (previous?.items) {
        queryClient.setQueryData(['teachers', effectiveSchoolId], {
          ...previous,
          items: previous.items.filter((teacher: any) => teacher.id !== id),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['teachers', effectiveSchoolId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Teachers</h1>
        <p className="text-sm text-slate">Teacher directory and status management.</p>
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

        <h2 className="text-lg font-semibold">Teacher Directory</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input
            value={filters.query}
            onChange={(e) => setFilters({ ...filters, query: e.target.value })}
            placeholder="Search by name or email"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
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
              {data?.items
                .filter((teacher) => {
                  const query = filters.query.trim().toLowerCase();
                  const name = `${teacher.firstName} ${teacher.lastName}`.toLowerCase();
                  const email = teacher.user.email.toLowerCase();
                  const matchesQuery = !query || name.includes(query) || email.includes(query);
                  const matchesStatus =
                    !filters.status ||
                    (filters.status === 'ACTIVE' ? teacher.isActive : !teacher.isActive);
                  return matchesQuery && matchesStatus;
                })
                .map((teacher) => (
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
                        <button
                          className="rounded-lg border border-rose-200 px-3 py-1 text-xs text-rose-600"
                          onClick={() => {
                            if (!window.confirm(`Delete "${teacher.firstName} ${teacher.lastName}"?`)) return;
                            deleteMutation.mutate(teacher.id);
                          }}
                        >
                          Delete
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
