'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import FullPageLoader from '../../../../components/FullPageLoader';
import PageHeader from '../../../../components/PageHeader';
import { useNotify } from '../../../../components/NotificationProvider';
import { getSession } from '../../../../services/auth.service';
import { listSetupClasses, listSetupSections } from '../../../../services/academic-setup.service';
import { deleteDisabledStudent, listDisabledStudents, restoreDisabledStudent } from '../../../../services/student-operations.service';
import { SchoolAdminOnly } from '../_components/SchoolAdminOnly';

export default function DisabledStudentsPage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ classId: '', sectionId: '', search: '' });
  const { data: session, isLoading: sessionLoading } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSchoolAdmin = session?.role === 'SCHOOL_ADMIN';
  const classesQuery = useQuery({ queryKey: ['setup-classes'], queryFn: () => listSetupClasses(), enabled: isSchoolAdmin });
  const sectionsQuery = useQuery({ queryKey: ['setup-sections'], queryFn: () => listSetupSections(), enabled: isSchoolAdmin });
  const studentsQuery = useQuery({
    queryKey: ['disabled-students', filters],
    queryFn: () => listDisabledStudents({ classId: filters.classId || undefined, sectionId: filters.sectionId || undefined, search: filters.search || undefined }),
    enabled: isSchoolAdmin,
  });

  const sections = useMemo(
    () => (sectionsQuery.data ?? []).filter((section) => (filters.classId ? section.classSections?.some((link) => link.classId === filters.classId) || section.classId === filters.classId : true)),
    [filters.classId, sectionsQuery.data],
  );

  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreDisabledStudent(id, { reason: 'Restored by School Admin' }),
    onSuccess: () => {
      notify.success('Student restored', 'The student is back in active lists.');
      queryClient.invalidateQueries({ queryKey: ['disabled-students'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (error: any) => notify.error('Restore failed', error?.response?.data?.error?.message ?? 'Unable to restore student.'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDisabledStudent,
    onSuccess: () => {
      notify.success('Student deleted', 'Disabled student record was removed.');
      queryClient.invalidateQueries({ queryKey: ['disabled-students'] });
    },
    onError: (error: any) => notify.error('Delete failed', error?.response?.data?.error?.message ?? 'Unable to delete student.'),
  });

  if (sessionLoading || !session?.role) return <FullPageLoader label="Checking disabled student access..." />;
  if (!isSchoolAdmin) return <SchoolAdminOnly moduleName="disabled student records" />;

  const students = studentsQuery.data ?? [];

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-6 lg:px-8">
        <PageHeader
          title="Disabled Students"
          subtitle="Review disabled students, restore records, or remove disabled records after confirmation."
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Students', href: '/dashboard/students' }, { label: 'Disabled Students' }]}
        />

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Select Criteria</h2>
              <p className="text-sm text-slate-500">Disabled students do not appear in the active student list.</p>
            </div>
            <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">{students.length} disabled</span>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <select value={filters.classId} onChange={(event) => setFilters({ ...filters, classId: event.target.value, sectionId: '' })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="">All Classes</option>
              {(classesQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <select value={filters.sectionId} onChange={(event) => setFilters({ ...filters, sectionId: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="">All Sections</option>
              {sections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Name, admission no, roll no" className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2" />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-slate-950">Disabled Student List</h2>
            <div className="flex gap-2">
              <button onClick={() => studentsQuery.refetch()} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">Refresh</button>
              <button onClick={() => window.print()} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">Print</button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Admission No</th>
                  <th className="px-4 py-3">Roll No</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Last Action</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {studentsQuery.isLoading ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">Loading disabled students...</td></tr>
                ) : students.length ? (
                  students.map((student: any) => (
                    <tr key={student.id}>
                      <td className="px-4 py-3 font-semibold">{student.admissionNo}</td>
                      <td className="px-4 py-3">{student.rollNo ?? '-'}</td>
                      <td className="px-4 py-3">{student.fullName || `${student.firstName} ${student.lastName}`.trim()}</td>
                      <td className="px-4 py-3">{student.class?.name ?? '-'} / {student.section?.name ?? '-'}</td>
                      <td className="px-4 py-3">{student.disabledLogs?.[0]?.action ?? 'DISABLED'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex flex-wrap justify-end gap-2">
                          <Link href={`/dashboard/students/${student.id}`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700">View</Link>
                          <Link href={`/dashboard/students/add?id=${student.id}`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700">Edit</Link>
                          <button onClick={() => window.confirm('Restore this student?') && restoreMutation.mutate(student.id)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">Restore</button>
                          <button onClick={() => window.confirm('Delete this disabled student permanently?') && deleteMutation.mutate(student.id)} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">No disabled students found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
