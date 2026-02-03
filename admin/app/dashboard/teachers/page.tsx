'use client';

import { useState } from 'react';
import Link from 'next/link';
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

  const filteredTeachers = data?.items.filter((teacher) => {
    const query = filters.query.trim().toLowerCase();
    const name = `${teacher.firstName} ${teacher.lastName}`.toLowerCase();
    const email = teacher.user.email.toLowerCase();
    const matchesQuery = !query || name.includes(query) || email.includes(query);
    const matchesStatus =
      !filters.status ||
      (filters.status === 'ACTIVE' ? teacher.isActive : !teacher.isActive);
    return matchesQuery && matchesStatus;
  }) || [];

  const stats = {
    total: data?.items.length || 0,
    active: data?.items.filter(t => t.isActive).length || 0,
    inactive: data?.items.filter(t => !t.isActive).length || 0,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-pink-50/40">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-purple-600 via-pink-600 to-rose-700 px-6 py-16 text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative mx-auto max-w-6xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="mb-4 inline-flex items-center rounded-full bg-white/20 px-4 py-2 text-sm font-medium backdrop-blur-sm">
                <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                </svg>
                Faculty Management
              </div>
              <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
                Teachers Directory
              </h1>
              <p className="max-w-2xl text-lg text-purple-100">
                Manage your teaching staff, track assignments, and maintain comprehensive faculty records.
              </p>
            </div>
            
            <Link
              href="/dashboard/teachers/add"
              className="hidden sm:flex items-center rounded-xl bg-white/20 px-6 py-3 font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/30 hover:scale-105"
            >
              <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Teacher
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
        <div className="mb-8 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100">Total Teachers</p>
                <p className="text-3xl font-bold">{stats.total}</p>
              </div>
              <div className="rounded-full bg-white/20 p-3">
                <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100">Active</p>
                <p className="text-3xl font-bold">{stats.active}</p>
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
                <p className="text-amber-100">Inactive</p>
                <p className="text-3xl font-bold">{stats.inactive}</p>
              </div>
              <div className="rounded-full bg-white/20 p-3">
                <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="mb-8 rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 gap-4">
              {isSuperAdmin && (
                <select
                  value={schoolId}
                  onChange={(e) => setSchoolId(e.target.value)}
                  className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
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
                  placeholder="Search by name or email..."
                  className="w-full rounded-xl border border-gray-300 pl-10 pr-4 py-3 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                />
              </div>
              
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
              >
                <option value="">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
            
            <Link
              href="/dashboard/teachers/add"
              className="flex items-center justify-center rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:from-purple-700 hover:to-pink-700 hover:shadow-xl sm:hidden"
            >
              <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Teacher
            </Link>
          </div>
        </div>

        {/* Teachers Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredTeachers.map((teacher) => (
            <div
              key={teacher.id}
              className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200 transition-all hover:shadow-xl hover:scale-105"
            >
              {/* Status Badge */}
              <div className="absolute top-4 right-4">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  teacher.isActive
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  <span className={`mr-1.5 h-2 w-2 rounded-full ${
                    teacher.isActive ? 'bg-emerald-400' : 'bg-gray-400'
                  }`}></span>
                  {teacher.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Teacher Info */}
              <div className="mb-4">
                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-2xl font-bold text-white">
                  {teacher.firstName.charAt(0)}{teacher.lastName.charAt(0)}
                </div>
                
                <Link
                  href={`/dashboard/teachers/${teacher.id}${isSuperAdmin && effectiveSchoolId ? `?schoolId=${effectiveSchoolId}` : ''}`}
                  className="block"
                >
                  <h3 className="text-lg font-bold text-gray-900 group-hover:text-purple-600 transition-colors">
                    {teacher.firstName} {teacher.lastName}
                  </h3>
                </Link>
                
                <p className="text-sm text-gray-600">{teacher.user.email}</p>
                {teacher.employeeNo && (
                  <p className="text-xs text-gray-500">ID: {teacher.employeeNo}</p>
                )}
              </div>

              {/* Assignments */}
              <div className="mb-4 space-y-2">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Classes</p>
                  <p className="text-sm text-gray-700">
                    {teacher.classAssignments.length > 0
                      ? teacher.classAssignments.map((a) => a.class.name).join(', ')
                      : 'No assignments'
                    }
                  </p>
                </div>
                
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Subjects</p>
                  <p className="text-sm text-gray-700">
                    {teacher.subjectAssignments.length > 0
                      ? teacher.subjectAssignments.map((a) => a.subject.name).join(', ')
                      : 'No assignments'
                    }
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Link
                  href={`/dashboard/id-cards?entity=employee&id=${teacher.id}`}
                  className="rounded-lg bg-violet-100 px-3 py-2 text-xs font-semibold text-violet-800 transition-colors hover:bg-violet-200"
                >
                  ID Card
                </Link>
                <button
                  onClick={() => statusMutation.mutate({ id: teacher.id, isActive: !teacher.isActive })}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                    teacher.isActive
                      ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                      : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                  }`}
                >
                  {teacher.isActive ? 'Deactivate' : 'Activate'}
                </button>
                
                <button
                  onClick={() => {
                    if (!window.confirm(`Delete "${teacher.firstName} ${teacher.lastName}"?`)) return;
                    deleteMutation.mutate(teacher.id);
                  }}
                  className="rounded-lg bg-red-100 px-3 py-2 text-xs font-semibold text-red-800 transition-colors hover:bg-red-200"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredTeachers.length === 0 && (
          <div className="rounded-2xl bg-white p-12 text-center shadow-lg">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">No teachers found</h3>
            <p className="mb-6 text-gray-600">
              {data?.items.length === 0
                ? 'Get started by adding your first teacher to the system.'
                : 'Try adjusting your search criteria or filters.'
              }
            </p>
            {data?.items.length === 0 && (
              <Link
                href="/dashboard/teachers/add"
                className="inline-flex items-center rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:from-purple-700 hover:to-pink-700 hover:shadow-xl"
              >
                <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Your First Teacher
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
