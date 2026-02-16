'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listAcademicYears,
  createAcademicYear,
  deleteAcademicYear,
  listClasses,
  createClass,
  deleteClass,
  listSections,
  createSection,
  deleteSection,
  listSubjects,
  createSubject,
  deleteSubject,
  listExamTypes,
  createExamType,
  updateExamType,
} from '../../../services/academic.service';
import { listSchools } from '../../../services/school.service';
import { getSession } from '../../../services/auth.service';
import PageHeader from '../../../components/PageHeader';
import Button from '../../../components/Button';

type AcademicTab = 'years' | 'classes' | 'examTypes' | 'sections' | 'subjects';

export default function AcademicsPage() {
  const [activeTab, setActiveTab] = useState<AcademicTab>('years');
  const [createModal, setCreateModal] = useState<AcademicTab | null>(null);
  const queryClient = useQueryClient();
  const [yearForm, setYearForm] = useState({ name: '', startDate: '', endDate: '' });
  const [className, setClassName] = useState('');
  const [classYearId, setClassYearId] = useState('');
  const [sectionForm, setSectionForm] = useState({ name: '', classId: '' });
  const [subjectForm, setSubjectForm] = useState({ name: '', classId: '', academicYearId: '' });
  const [examTypeForm, setExamTypeForm] = useState({ name: '', code: '', isActive: true });
  const [yearError, setYearError] = useState('');
  const [classError, setClassError] = useState('');
  const [sectionError, setSectionError] = useState('');
  const [subjectError, setSubjectError] = useState('');
  const [examTypeError, setExamTypeError] = useState('');

  const [schoolId, setSchoolId] = useState('');
  const { data: session } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSuperAdmin = session?.role === 'SUPER_ADMIN';
  const effectiveSchoolId = isSuperAdmin ? schoolId : session?.schoolId ?? undefined;

  const { data: schools } = useQuery({
    queryKey: ['schools', 'all'],
    queryFn: () => listSchools({ limit: 100 }),
    enabled: isSuperAdmin,
  });

  const { data: years } = useQuery({
    queryKey: ['academic-years', effectiveSchoolId],
    queryFn: () => listAcademicYears({ schoolId: effectiveSchoolId }),
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
  const { data: subjects } = useQuery({
    queryKey: ['subjects', effectiveSchoolId],
    queryFn: () => listSubjects({ schoolId: effectiveSchoolId }),
    enabled: Boolean(effectiveSchoolId),
  });
  const { data: examTypes } = useQuery({
    queryKey: ['exam-types', effectiveSchoolId],
    queryFn: () => listExamTypes({ schoolId: effectiveSchoolId }),
    enabled: Boolean(effectiveSchoolId),
  });

  const createYearMutation = useMutation({
    mutationFn: createAcademicYear,
    onSuccess: () => {
      setYearForm({ name: '', startDate: '', endDate: '' });
      setYearError('');
      setCreateModal(null);
      queryClient.invalidateQueries({ queryKey: ['academic-years'] });
    },
  });

  const deleteYearMutation = useMutation({
    mutationFn: (id: string) => deleteAcademicYear(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['academic-years', effectiveSchoolId] });
      const previous = queryClient.getQueryData<any[]>(['academic-years', effectiveSchoolId]);
      if (previous) {
        queryClient.setQueryData(
          ['academic-years', effectiveSchoolId],
          previous.filter((year) => year.id !== id),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['academic-years', effectiveSchoolId], context.previous);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['academic-years'] }),
  });

  const createClassMutation = useMutation({
    mutationFn: createClass,
    onSuccess: () => {
      setClassName('');
      setClassYearId('');
      setClassError('');
      setCreateModal(null);
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
  });

  const deleteClassMutation = useMutation({
    mutationFn: (id: string) => deleteClass(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['classes', effectiveSchoolId] });
      const previous = queryClient.getQueryData<any[]>(['classes', effectiveSchoolId]);
      if (previous) {
        queryClient.setQueryData(
          ['classes', effectiveSchoolId],
          previous.filter((cls) => cls.id !== id),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['classes', effectiveSchoolId], context.previous);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['classes'] }),
  });

  const createSectionMutation = useMutation({
    mutationFn: createSection,
    onSuccess: () => {
      setSectionForm({ name: '', classId: '' });
      setSectionError('');
      setCreateModal(null);
      queryClient.invalidateQueries({ queryKey: ['sections'] });
    },
  });

  const deleteSectionMutation = useMutation({
    mutationFn: (id: string) => deleteSection(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['sections', effectiveSchoolId] });
      const previous = queryClient.getQueryData<any[]>(['sections', effectiveSchoolId]);
      if (previous) {
        queryClient.setQueryData(
          ['sections', effectiveSchoolId],
          previous.filter((section) => section.id !== id),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['sections', effectiveSchoolId], context.previous);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['sections'] }),
  });

  const createSubjectMutation = useMutation({
    mutationFn: createSubject,
    onSuccess: () => {
      setSubjectForm({ name: '', classId: '', academicYearId: '' });
      setSubjectError('');
      setCreateModal(null);
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
    },
  });

  const deleteSubjectMutation = useMutation({
    mutationFn: (id: string) => deleteSubject(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['subjects', effectiveSchoolId] });
      const previous = queryClient.getQueryData<any[]>(['subjects', effectiveSchoolId]);
      if (previous) {
        queryClient.setQueryData(
          ['subjects', effectiveSchoolId],
          previous.filter((subject) => subject.id !== id),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['subjects', effectiveSchoolId], context.previous);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['subjects'] }),
  });

  const createExamTypeMutation = useMutation({
    mutationFn: createExamType,
    onSuccess: () => {
      setExamTypeForm({ name: '', code: '', isActive: true });
      setExamTypeError('');
      setCreateModal(null);
      queryClient.invalidateQueries({ queryKey: ['exam-types'] });
    },
  });

  const updateExamTypeMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { name?: string; isActive?: boolean; schoolId?: string } }) =>
      updateExamType(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exam-types'] });
    },
  });

  const requireSchool = () => {
    if (isSuperAdmin && !effectiveSchoolId) return 'Select a school first.';
    return '';
  };

  const stats = {
    years: years?.length || 0,
    classes: classes?.length || 0,
    sections: sections?.length || 0,
    subjects: subjects?.length || 0,
    examTypes: examTypes?.length || 0,
  };

  const openCreateModal = (tab: AcademicTab) => {
    setYearError('');
    setClassError('');
    setSectionError('');
    setSubjectError('');
    setExamTypeError('');
    setCreateModal(tab);
  };

  const closeCreateModal = () => setCreateModal(null);

  const handleCreateYear = () => {
    let error = requireSchool();
    if (!error && !yearForm.name.trim()) error = 'Year name is required.';
    else if (!error && !yearForm.startDate) error = 'Start date is required.';
    else if (!error && !yearForm.endDate) error = 'End date is required.';
    else if (!error && yearForm.startDate && yearForm.endDate && yearForm.startDate > yearForm.endDate) {
      error = 'End date must be after start date.';
    }
    setYearError(error);
    if (error) return;
    createYearMutation.mutate({ ...yearForm, schoolId: effectiveSchoolId });
  };

  const handleCreateClass = () => {
    let error = requireSchool();
    if (!error && !className.trim()) error = 'Class name is required.';
    else if (!error && !classYearId) error = 'Select an academic year.';
    setClassError(error);
    if (error) return;
    createClassMutation.mutate({ name: className, academicYearId: classYearId, schoolId: effectiveSchoolId });
  };

  const handleCreateExamType = () => {
    let error = requireSchool();
    if (!error && !examTypeForm.name.trim()) error = 'Exam type name is required.';
    else if (!error && !examTypeForm.code.trim()) error = 'Exam type code is required.';
    setExamTypeError(error);
    if (error) return;
    createExamTypeMutation.mutate({
      name: examTypeForm.name,
      code: examTypeForm.code,
      isActive: examTypeForm.isActive,
      schoolId: effectiveSchoolId,
    });
  };

  const handleCreateSection = () => {
    let error = requireSchool();
    if (!error && !sectionForm.name.trim()) error = 'Section name is required.';
    else if (!error && !sectionForm.classId) error = 'Select a class.';
    setSectionError(error);
    if (error) return;
    createSectionMutation.mutate({ name: sectionForm.name, classId: sectionForm.classId, schoolId: effectiveSchoolId });
  };

  const handleCreateSubject = () => {
    let error = requireSchool();
    if (!error && !subjectForm.name.trim()) error = 'Subject name is required.';
    else if (!error && !subjectForm.academicYearId) error = 'Select an academic year.';
    else if (!error && !subjectForm.classId) error = 'Select a class.';
    setSubjectError(error);
    if (error) return;
    createSubjectMutation.mutate({
      name: subjectForm.name,
      classId: subjectForm.classId || undefined,
      academicYearId: subjectForm.academicYearId || undefined,
      schoolId: effectiveSchoolId,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
      <div className="mx-auto max-w-7xl pr-6 pb-12">
        <PageHeader
          title="Academic Structure"
          subtitle="Configure academic years, classes, sections, and subjects to build your school's educational framework."
        />
        {/* Stats Cards */}
        <div className="mb-8 grid gap-6 md:grid-cols-4">
          <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100">Academic Years</p>
                <p className="text-3xl font-bold">{stats.years}</p>
              </div>
              <div className="rounded-full bg-white/20 p-3">
                <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100">Classes</p>
                <p className="text-3xl font-bold">{stats.classes}</p>
              </div>
              <div className="rounded-full bg-white/20 p-3">
                <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100">Sections</p>
                <p className="text-3xl font-bold">{stats.sections}</p>
              </div>
              <div className="rounded-full bg-white/20 p-3">
                <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100">Subjects</p>
                <p className="text-3xl font-bold">{stats.subjects}</p>
              </div>
              <div className="rounded-full bg-white/20 p-3">
                <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* School Selection for Super Admin */}
        {isSuperAdmin && (
          <div className="mb-8 rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">School Selection</h2>
            <select
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="">Select school...</option>
              {schools?.items.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name} ({school.code})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-8 rounded-2xl bg-white p-2 shadow-lg ring-1 ring-gray-200">
          <div className="flex gap-2">
            <button onClick={() => setActiveTab('years')} className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${activeTab === 'years' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg' : 'text-gray-600 hover:bg-gray-100'}`}>Academic Years</button>
            <button onClick={() => setActiveTab('classes')} className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${activeTab === 'classes' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg' : 'text-gray-600 hover:bg-gray-100'}`}>Classes</button>
            <button onClick={() => setActiveTab('examTypes')} className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${activeTab === 'examTypes' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg' : 'text-gray-600 hover:bg-gray-100'}`}>Exam Types</button>
            <button onClick={() => setActiveTab('sections')} className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${activeTab === 'sections' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg' : 'text-gray-600 hover:bg-gray-100'}`}>Sections</button>
            <button onClick={() => setActiveTab('subjects')} className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${activeTab === 'subjects' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg' : 'text-gray-600 hover:bg-gray-100'}`}>Subjects</button>
          </div>
        </div>

        {activeTab === 'years' && (
        <section className="mb-8 rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-gray-900">Academic Years</h2>
            <Button
              variant="primary"
              size="sm"
              onClick={() => openCreateModal('years')}
              icon={
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              }
            >
              Add Academic Year
            </Button>
          </div>
          <div className="mt-6 overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Academic Year</th>
                  <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {years?.map((year: { id: string; name: string }) => (
                  <tr key={year.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{year.name}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                        onClick={() => {
                          if (!window.confirm(`Delete academic year "${year.name}"?`)) return;
                          deleteYearMutation.mutate(year.id);
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {!years?.length && (
                  <tr>
                    <td colSpan={2} className="px-6 py-12 text-center text-sm text-gray-500">
                      No academic years found. Use the Add Academic Year button to create one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        )}

        {activeTab === 'classes' && (
        <section className="mb-8 rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-gray-900">Classes</h2>
            <Button
              variant="primary"
              size="sm"
              onClick={() => openCreateModal('classes')}
              icon={
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              }
            >
              Add Class
            </Button>
          </div>
          <div className="mt-6 overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Class</th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Academic Year</th>
                  <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {classes?.map((cls: { id: string; name: string; academicYear?: { id: string; name: string } | null }) => (
                  <tr key={cls.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                          <svg className="h-5 w-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z" />
                          </svg>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{cls.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {cls.academicYear?.name ? (
                        <span className="inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">
                          {cls.academicYear.name}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium">
                      <button
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                        onClick={() => {
                          if (!window.confirm(`Delete class "${cls.name}"?`)) return;
                          deleteClassMutation.mutate(cls.id);
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {!classes?.length && (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <svg className="h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No classes found</h3>
                        <p className="mt-1 text-sm text-gray-500">Get started by creating your first class.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
      </section>
      )}

      {activeTab === 'examTypes' && (
      <section className="mt-8 rounded-2xl border border-slate/10 bg-white p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Exam Types</h2>
          <Button
            variant="primary"
            size="sm"
            onClick={() => openCreateModal('examTypes')}
            icon={
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            }
          >
            Add Exam Type
          </Button>
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-gray-200">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Name</th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Code</th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {(examTypes ?? []).map((type: { id: string; name: string; code: string; isActive: boolean }) => (
                <tr key={type.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{type.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{type.code}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${type.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                      {type.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium">
                    <button
                      className="rounded-lg border border-slate/200 px-3 py-1 text-xs font-medium"
                      onClick={() =>
                        updateExamTypeMutation.mutate({
                          id: type.id,
                          payload: { isActive: !type.isActive, schoolId: effectiveSchoolId },
                        })
                      }
                    >
                      {type.isActive ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
              {!examTypes?.length && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <svg className="h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No exam types found</h3>
                      <p className="mt-1 text-sm text-gray-500">Add your first exam type for this school.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {activeTab === 'sections' && (
      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Sections</h2>
          <Button
            variant="primary"
            size="sm"
            onClick={() => openCreateModal('sections')}
            icon={
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            }
          >
            Add Section
          </Button>
        </div>
          <div className="mt-6 overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Section</th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Class</th>
                  <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {sections?.map((section: { id: string; name: string; classId: string }) => {
                  const className = classes?.find((cls: { id: string; name: string }) => cls.id === section.classId)?.name;
                  return (
                    <tr key={section.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
                            <svg className="h-5 w-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{section.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {className ? (
                          <span className="inline-flex rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
                            {className}
                          </span>
                        ) : (
                          <span className="text-gray-400">All classes</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium">
                        <button
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                          onClick={() => {
                            if (!window.confirm(`Delete section "${section.name}"?`)) return;
                            deleteSectionMutation.mutate(section.id);
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!sections?.length && (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <svg className="h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No sections found</h3>
                        <p className="mt-1 text-sm text-gray-500">Get started by creating your first section.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
      </section>
      )}

      {activeTab === 'subjects' && (
      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Subjects</h2>
          <Button
            variant="primary"
            size="sm"
            onClick={() => openCreateModal('subjects')}
            icon={
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            }
          >
            Add Subject
          </Button>
        </div>
          <div className="mt-6 overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Subject</th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Class</th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Academic Year</th>
                  <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {subjects?.map(
                  (subject: {
                    id: string;
                    name: string;
                    classId?: string | null;
                    academicYear?: { id: string; name: string } | null;
                  }) => {
                  const className = subject.classId
                    ? classes?.find((cls: { id: string; name: string }) => cls.id === subject.classId)?.name
                    : null;
                  return (
                    <tr key={subject.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                            <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{subject.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {className ? (
                          <span className="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                            {className}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {subject.academicYear?.name ? (
                          <span className="inline-flex rounded-full bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-800">
                            {subject.academicYear.name}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium">
                        <button
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                          onClick={() => {
                            if (!window.confirm(`Delete subject "${subject.name}"?`)) return;
                            deleteSubjectMutation.mutate(subject.id);
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!subjects?.length && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <svg className="h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No subjects found</h3>
                        <p className="mt-1 text-sm text-gray-500">Get started by creating your first subject.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
      </section>
      )}

      {createModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-gray-200">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">
                {createModal === 'years' && 'Add Academic Year'}
                {createModal === 'classes' && 'Add Class'}
                {createModal === 'examTypes' && 'Add Exam Type'}
                {createModal === 'sections' && 'Add Section'}
                {createModal === 'subjects' && 'Add Subject'}
              </h3>
              <button
                onClick={closeCreateModal}
                className="rounded-lg border border-gray-300 px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
              >
                Close
              </button>
            </div>

            {createModal === 'years' && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Year Name</label>
                    <input
                      value={yearForm.name}
                      onChange={(e) => setYearForm({ ...yearForm, name: e.target.value })}
                      placeholder="e.g., 2024-2025"
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Start Date</label>
                    <input
                      value={yearForm.startDate}
                      onChange={(e) => setYearForm({ ...yearForm, startDate: e.target.value })}
                      type="date"
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">End Date</label>
                    <input
                      value={yearForm.endDate}
                      onChange={(e) => setYearForm({ ...yearForm, endDate: e.target.value })}
                      type="date"
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                </div>
                {yearError ? <p className="text-sm font-semibold text-rose-600">{yearError}</p> : null}
                <div className="flex justify-end gap-3">
                  <Button variant="outline" size="sm" onClick={closeCreateModal}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleCreateYear} loading={createYearMutation.isPending}>
                    Create Academic Year
                  </Button>
                </div>
              </div>
            )}

            {createModal === 'classes' && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <input
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    placeholder="Class name"
                    className="rounded-xl border border-slate/20 px-4 py-3 text-sm"
                  />
                  <select
                    value={classYearId}
                    onChange={(e) => setClassYearId(e.target.value)}
                    className="rounded-xl border border-slate/20 px-4 py-3 text-sm"
                  >
                    <option value="">Select academic year</option>
                    {years?.map((year: { id: string; name: string }) => (
                      <option key={year.id} value={year.id}>
                        {year.name}
                      </option>
                    ))}
                  </select>
                </div>
                {classError ? <p className="text-sm font-semibold text-rose-600">{classError}</p> : null}
                <div className="flex justify-end gap-3">
                  <Button variant="outline" size="sm" onClick={closeCreateModal}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleCreateClass} loading={createClassMutation.isPending}>
                    Create Class
                  </Button>
                </div>
              </div>
            )}

            {createModal === 'examTypes' && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <input
                    value={examTypeForm.name}
                    onChange={(e) => setExamTypeForm({ ...examTypeForm, name: e.target.value })}
                    placeholder="Exam type name"
                    className="rounded-xl border border-slate/20 px-4 py-3 text-sm"
                  />
                  <input
                    value={examTypeForm.code}
                    onChange={(e) => setExamTypeForm({ ...examTypeForm, code: e.target.value.toUpperCase() })}
                    placeholder="Code (e.g., MIDTERM)"
                    className="rounded-xl border border-slate/20 px-4 py-3 text-sm uppercase"
                  />
                  <label className="flex items-center gap-2 rounded-xl border border-slate/20 px-4 py-3 text-sm text-slate">
                    <input
                      type="checkbox"
                      checked={examTypeForm.isActive}
                      onChange={(e) => setExamTypeForm({ ...examTypeForm, isActive: e.target.checked })}
                    />
                    Active
                  </label>
                </div>
                {examTypeError ? <p className="text-sm font-semibold text-rose-600">{examTypeError}</p> : null}
                <div className="flex justify-end gap-3">
                  <Button variant="outline" size="sm" onClick={closeCreateModal}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleCreateExamType}
                    loading={createExamTypeMutation.isPending}
                  >
                    Create Exam Type
                  </Button>
                </div>
              </div>
            )}

            {createModal === 'sections' && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <input
                    value={sectionForm.name}
                    onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })}
                    placeholder="Section name"
                    className="rounded-xl border border-slate/20 px-4 py-3 text-sm"
                  />
                  <select
                    value={sectionForm.classId}
                    onChange={(e) => setSectionForm({ ...sectionForm, classId: e.target.value })}
                    className="rounded-xl border border-slate/20 px-4 py-3 text-sm"
                  >
                    <option value="">Select class</option>
                    {classes?.map((cls: { id: string; name: string }) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}
                      </option>
                    ))}
                  </select>
                </div>
                {sectionError ? <p className="text-sm font-semibold text-rose-600">{sectionError}</p> : null}
                <div className="flex justify-end gap-3">
                  <Button variant="outline" size="sm" onClick={closeCreateModal}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleCreateSection}
                    loading={createSectionMutation.isPending}
                  >
                    Create Section
                  </Button>
                </div>
              </div>
            )}

            {createModal === 'subjects' && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <input
                    value={subjectForm.name}
                    onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                    placeholder="Subject name"
                    className="rounded-xl border border-slate/20 px-4 py-3 text-sm"
                  />
                  <select
                    value={subjectForm.academicYearId}
                    onChange={(e) => setSubjectForm({ ...subjectForm, academicYearId: e.target.value })}
                    className="rounded-xl border border-slate/20 px-4 py-3 text-sm"
                  >
                    <option value="">Select academic year</option>
                    {years?.map((year: { id: string; name: string }) => (
                      <option key={year.id} value={year.id}>
                        {year.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={subjectForm.classId}
                    onChange={(e) => setSubjectForm({ ...subjectForm, classId: e.target.value })}
                    className="rounded-xl border border-slate/20 px-4 py-3 text-sm"
                  >
                    <option value="">Select class</option>
                    {classes?.map((cls: { id: string; name: string }) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}
                      </option>
                    ))}
                  </select>
                </div>
                {subjectError ? <p className="text-sm font-semibold text-rose-600">{subjectError}</p> : null}
                <div className="flex justify-end gap-3">
                  <Button variant="outline" size="sm" onClick={closeCreateModal}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleCreateSubject} loading={createSubjectMutation.isPending}>
                    Create Subject
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
    </div>
  );
}
