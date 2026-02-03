'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteStudent, createTransferRequest, listStudents, listTransferTargets, resolveUploadUrl } from '../../../services/student.service';
import { listSchools } from '../../../services/school.service';
import { getSession } from '../../../services/auth.service';
import { listClasses, listSections } from '../../../services/academic.service';

export default function StudentsPage() {
  const queryClient = useQueryClient();
  const [schoolId, setSchoolId] = useState('');
  const [transfer, setTransfer] = useState({ open: false, studentId: '', toSchoolId: '', reason: '' });
  const [transferError, setTransferError] = useState('');
  const [filters, setFilters] = useState({ query: '', status: '', classId: '', sectionId: '' });
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

  const { data: transferTargets } = useQuery({
    queryKey: ['transfer-targets', effectiveSchoolId],
    queryFn: () => listTransferTargets({ schoolId: effectiveSchoolId }),
    enabled: Boolean(effectiveSchoolId),
  });

  const transferMutation = useMutation({
    mutationFn: () =>
      createTransferRequest(transfer.studentId, {
        toSchoolId: transfer.toSchoolId,
        reason: transfer.reason || undefined,
        schoolId: effectiveSchoolId,
      }),
    onSuccess: () => {
      setTransferError('');
      setTransfer({ open: false, studentId: '', toSchoolId: '', reason: '' });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error?.message ?? error?.message ?? 'Unable to create transfer request.';
      setTransferError(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ studentId }: { studentId: string }) => deleteStudent(studentId),
    onMutate: async ({ studentId }) => {
      await queryClient.cancelQueries({ queryKey: ['students', effectiveSchoolId] });
      const previous = queryClient.getQueryData<any[]>(['students', effectiveSchoolId]);
      if (previous) {
        queryClient.setQueryData(
          ['students', effectiveSchoolId],
          previous.filter((student) => student.id !== studentId),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['students', effectiveSchoolId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });

  const filteredStudents = (students ?? []).filter((student) => {
    const query = filters.query.trim().toLowerCase();
    const name = `${student.firstName} ${student.lastName}`.toLowerCase();
    const matchesQuery = !query || name.includes(query) || student.admissionNo.toLowerCase().includes(query);
    const matchesStatus = !filters.status || student.status === filters.status;
    const matchesClass = !filters.classId || student.classId === filters.classId;
    const matchesSection = !filters.sectionId || student.sectionId === filters.sectionId;
    return matchesQuery && matchesStatus && matchesClass && matchesSection;
  });

  const stats = {
    total: students?.length || 0,
    enrolled: students?.filter(s => s.status === 'ENROLLED').length || 0,
    transferred: students?.filter(s => s.status === 'TRANSFERRED').length || 0,
    exited: students?.filter(s => s.status === 'EXITED').length || 0,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50/30 to-emerald-50/40">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-green-600 via-emerald-600 to-teal-700 px-6 py-16 text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative mx-auto max-w-6xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="mb-4 inline-flex items-center rounded-full bg-white/20 px-4 py-2 text-sm font-medium backdrop-blur-sm">
                <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Student Management
              </div>
              <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
                Students Directory
              </h1>
              <p className="max-w-2xl text-lg text-green-100">
                Manage student enrollment, track academic progress, and maintain comprehensive student records.
              </p>
            </div>
            
            <Link
              href="/dashboard/students/add"
              className="hidden sm:flex items-center rounded-xl bg-white/20 px-6 py-3 font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/30 hover:scale-105"
            >
              <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Student
            </Link>
          </div>
        </div>
        
        {/* Animated background elements */}
        <div className="absolute -top-10 -left-10 h-40 w-40 rounded-full bg-white/10 animate-pulse"></div>
        <div className="absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-white/10 animate-bounce"></div>
        <div className="absolute top-1/2 left-1/3 h-6 w-6 rounded-full bg-white/20 animate-ping"></div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* Stats Cards */}
        <div className="mb-8 grid gap-6 md:grid-cols-4">
          <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100">Total Students</p>
                <p className="text-3xl font-bold">{stats.total}</p>
              </div>
              <div className="rounded-full bg-white/20 p-3">
                <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100">Enrolled</p>
                <p className="text-3xl font-bold">{stats.enrolled}</p>
              </div>
              <div className="rounded-full bg-white/20 p-3">
                <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100">Transferred</p>
                <p className="text-3xl font-bold">{stats.transferred}</p>
              </div>
              <div className="rounded-full bg-white/20 p-3">
                <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="rounded-2xl bg-gradient-to-br from-red-500 to-red-600 p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100">Exited</p>
                <p className="text-3xl font-bold">{stats.exited}</p>
              </div>
              <div className="rounded-full bg-white/20 p-3">
                <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="mb-8 rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
          <div className="flex flex-col gap-4">
            <div className="flex flex-1 gap-4">
              {isSuperAdmin && (
                <select
                  value={schoolId}
                  onChange={(e) => setSchoolId(e.target.value)}
                  className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                >
                  <option value="">Select school...</option>
                  {schools?.items.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name} ({school.code})
                    </option>
                  ))}
                </select>
              )}
              
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  value={filters.query}
                  onChange={(e) => setFilters({ ...filters, query: e.target.value })}
                  placeholder="Search by name or admission number..."
                  className="w-full rounded-xl border border-gray-300 pl-10 pr-4 py-3 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                />
              </div>
            </div>
            
            <div className="grid gap-4 md:grid-cols-4">
              <select
                value={filters.classId}
                onChange={(e) => setFilters({ ...filters, classId: e.target.value, sectionId: '' })}
                className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
              >
                <option value="">All Classes</option>
                {classes?.map((cls: { id: string; name: string }) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
              
              <select
                value={filters.sectionId}
                onChange={(e) => setFilters({ ...filters, sectionId: e.target.value })}
                className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                disabled={!filters.classId}
              >
                <option value="">All Sections</option>
                {(sections ?? [])
                  .filter((section: { classId: string }) => section.classId === filters.classId)
                  .map((section: { id: string; name: string }) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
              </select>
              
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
              >
                <option value="">All Status</option>
                <option value="ENROLLED">Enrolled</option>
                <option value="TRANSFERRED">Transferred</option>
                <option value="EXITED">Exited</option>
              </select>
              
              <Link
                href="/dashboard/students/add"
                className="flex items-center justify-center rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:from-green-700 hover:to-emerald-700 hover:shadow-xl sm:hidden"
              >
                <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Student
              </Link>
            </div>
          </div>
        </div>

        {/* Students Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredStudents.map((student) => {
            const primaryParent = student.parentLinks?.[0]?.parent;
            return (
              <div
                key={student.id}
                className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200 transition-all hover:shadow-xl hover:scale-105"
              >
                {/* Status Badge */}
                <div className="absolute top-4 right-4">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    student.status === 'ENROLLED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : student.status === 'TRANSFERRED'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    <span className={`mr-1.5 h-2 w-2 rounded-full ${
                      student.status === 'ENROLLED'
                        ? 'bg-emerald-400'
                        : student.status === 'TRANSFERRED'
                        ? 'bg-amber-400'
                        : 'bg-red-400'
                    }`}></span>
                    {student.status}
                  </span>
                </div>

                {/* Student Info */}
                <div className="mb-4">
                  <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-500 text-2xl font-bold text-white overflow-hidden">
                    {student.photoUrl ? (
                      <img
                        src={resolveUploadUrl(student.photoUrl) ?? undefined}
                        alt={`${student.firstName} ${student.lastName}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <>
                        {student.firstName.charAt(0)}
                        {student.lastName.charAt(0)}
                      </>
                    )}
                  </div>
                  
                  <Link
                    href={`/dashboard/students/${student.id}`}
                    className="block"
                  >
                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-green-600 transition-colors">
                      {student.firstName} {student.lastName}
                    </h3>
                  </Link>
                  
                  <p className="text-sm text-gray-600">Admission: {student.admissionNo}</p>
                  <p className="text-xs text-gray-500">
                    {student.class?.name ?? '—'} {student.section?.name ? `- ${student.section.name}` : ''}
                  </p>
                </div>

                {/* Parent Info */}
                <div className="mb-4 space-y-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Parent/Guardian</p>
                  {primaryParent ? (
                    <>
                      <Link
                        href={`/dashboard/parents/${primaryParent.id}`}
                        className="text-sm font-medium text-gray-700 hover:text-green-600 transition-colors"
                      >
                        {primaryParent.firstName} {primaryParent.lastName}
                      </Link>
                      <p className="text-xs text-gray-500">{primaryParent.phone ?? '—'}</p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">No parent linked</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Link
                    href={`/dashboard/id-cards?entity=student&id=${student.id}`}
                    className="rounded-lg bg-violet-100 px-3 py-2 text-xs font-semibold text-violet-800 transition-colors hover:bg-violet-200"
                  >
                    ID Card
                  </Link>
                  <button
                    onClick={() => setTransfer({ open: true, studentId: student.id, toSchoolId: '', reason: '' })}
                    className="flex-1 rounded-lg bg-blue-100 px-3 py-2 text-xs font-semibold text-blue-800 transition-colors hover:bg-blue-200"
                  >
                    Transfer
                  </button>
                  
                  <button
                    onClick={() => {
                      if (!window.confirm(`Delete "${student.firstName} ${student.lastName}"?`)) return;
                      deleteMutation.mutate({ studentId: student.id });
                    }}
                    className="rounded-lg bg-red-100 px-3 py-2 text-xs font-semibold text-red-800 transition-colors hover:bg-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredStudents.length === 0 && (
          <div className="rounded-2xl bg-white p-12 text-center shadow-lg">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">No students found</h3>
            <p className="mb-6 text-gray-600">
              {students?.length === 0
                ? 'Get started by adding your first student to the system.'
                : 'Try adjusting your search criteria or filters.'
              }
            </p>
            {students?.length === 0 && (
              <Link
                href="/dashboard/students/add"
                className="inline-flex items-center rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:from-green-700 hover:to-emerald-700 hover:shadow-xl"
              >
                <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Your First Student
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Transfer Modal */}
      {transfer.open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Transfer Student</h3>
            <p className="text-gray-600 mb-6">Select the destination school to create a transfer request.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Destination School</label>
                <select
                  value={transfer.toSchoolId}
                  onChange={(e) => setTransfer({ ...transfer, toSchoolId: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                >
                  <option value="">Select destination school</option>
                  {transferTargets?.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name} ({school.code})
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reason (Optional)</label>
                <input
                  value={transfer.reason}
                  onChange={(e) => setTransfer({ ...transfer, reason: e.target.value })}
                  placeholder="Enter reason for transfer"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                />
              </div>
              
              {transferError && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                  <p className="text-sm text-red-800">{transferError}</p>
                </div>
              )}
            </div>
            
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-xl border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                onClick={() => setTransfer({ open: false, studentId: '', toSchoolId: '', reason: '' })}
              >
                Cancel
              </button>
              <button
                className="rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:from-green-700 hover:to-emerald-700 hover:shadow-xl disabled:opacity-50"
                onClick={() => transferMutation.mutate()}
                disabled={!transfer.toSchoolId || transferMutation.isPending}
              >
                {transferMutation.isPending ? (
                  <>
                    <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Submitting...
                  </>
                ) : (
                  'Submit Request'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
