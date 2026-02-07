'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listAcademicYears, listClasses, listExamTypes, listSections, listSubjects } from '../../../../services/academic.service';
import { listSchools } from '../../../../services/school.service';
import { getSession } from '../../../../services/auth.service';
import { createExam, listExams } from '../../../../services/report.service';
import { useNotify } from '../../../../components/NotificationProvider';
import FullPageLoader from '../../../../components/FullPageLoader';

type SubjectRow = {
  id: string;
  name: string;
  class?: { id: string; name: string } | null;
  academicYear?: { id: string; name: string } | null;
};

type SubjectSelection = {
  include: boolean;
  maxMarks: string;
  passMarks: string;
  scheduledAt: string;
};

const defaultMarks = { maxMarks: '100', passMarks: '35', scheduledAt: '' };

export default function ExamsPage() {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [schoolId, setSchoolId] = useState('');
  const [examBasics, setExamBasics] = useState({
    name: '',
    type: '',
    academicYearId: '',
    classId: '',
    sectionId: '',
    examDate: '',
    resultPublishDate: '',
    examMode: 'MARKS',
  });
  const [structure, setStructure] = useState({
    sameMarks: false,
    internalExternal: false,
    practical: false,
    internalMarks: '',
    externalMarks: '',
    practicalMarks: '',
  });
  const [subjectMap, setSubjectMap] = useState<Record<string, SubjectSelection>>({});
  const [stepError, setStepError] = useState('');

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
    queryFn: () => listExamTypes({ schoolId: effectiveSchoolId, activeOnly: true }),
    enabled: Boolean(effectiveSchoolId),
  });
  const { data: exams } = useQuery({
    queryKey: ['exams', effectiveSchoolId],
    queryFn: () => listExams(),
    enabled: Boolean(effectiveSchoolId),
  });

  useEffect(() => {
    if (!examBasics.type && examTypes?.length) {
      setExamBasics((prev) => ({ ...prev, type: examTypes[0].code }));
    }
  }, [examBasics.type, examTypes]);

  const classLookup = useMemo(() => {
    const map = new Map<string, string>();
    classes?.forEach((cls: { id: string; name: string }) => map.set(cls.id, cls.name));
    return map;
  }, [classes]);
  const yearLookup = useMemo(() => {
    const map = new Map<string, string>();
    years?.forEach((year: { id: string; name: string }) => map.set(year.id, year.name));
    return map;
  }, [years]);

  const filteredSubjects = useMemo(() => {
    const rows = (subjects ?? []) as SubjectRow[];
    if (!examBasics.classId || !examBasics.academicYearId) return [];
    return rows.filter(
      (subject) =>
        subject.class?.id === examBasics.classId &&
        subject.academicYear?.id === examBasics.academicYearId,
    );
  }, [subjects, examBasics.classId, examBasics.academicYearId]);

  const selectedSubjectIds = useMemo(
    () => Object.entries(subjectMap).filter(([, value]) => value.include).map(([id]) => id),
    [subjectMap],
  );

  const createExamMutation = useMutation({
    mutationFn: (payload: { status: 'DRAFT' | 'PUBLISHED' }) =>
      createExam({
        name: examBasics.name.trim() || undefined,
        type: examBasics.type,
        subjectMappings: selectedSubjectIds.map((subjectId) => ({
          subjectId,
          maxMarks: Number(subjectMap[subjectId]?.maxMarks ?? defaultMarks.maxMarks),
          passMarks: Number(subjectMap[subjectId]?.passMarks ?? defaultMarks.passMarks),
          scheduledAt: subjectMap[subjectId]?.scheduledAt || examBasics.examDate,
        })),
        academicYearId: examBasics.academicYearId,
        classId: examBasics.classId,
        sectionId: examBasics.sectionId || undefined,
        scheduledAt: examBasics.examDate || undefined,
        resultPublishAt: examBasics.resultPublishDate || undefined,
        status: payload.status,
      }),
    onSuccess: (data, variables) => {
      setStep(1);
      setExamBasics({
        name: '',
        type: '',
        academicYearId: '',
        classId: '',
        sectionId: '',
        examDate: '',
        resultPublishDate: '',
        examMode: 'MARKS',
      });
      setStructure({
        sameMarks: false,
        internalExternal: false,
        practical: false,
        internalMarks: '',
        externalMarks: '',
        practicalMarks: '',
      });
      setSubjectMap({});
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      
      const status = variables.status === 'DRAFT' ? 'saved as draft' : 'published';
      notify.success(`Exam ${status}!`, `${examBasics.name} has been ${status} successfully`);
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error?.message || error?.message || 'Failed to create exam';
      notify.error('Exam creation failed', message);
    },
  });

  const syncSubjectMap = () => {
    const next: Record<string, SubjectSelection> = {};
    filteredSubjects.forEach((subject) => {
      const existing = subjectMap[subject.id];
      next[subject.id] = existing ?? { include: true, ...defaultMarks, scheduledAt: examBasics.examDate };
    });
    setSubjectMap(next);
  };

  const handleContinueFromBasics = () => {
    let error = '';
    if (!examBasics.type) error = 'Select exam type.';
    else if (!examBasics.academicYearId) error = 'Select academic year.';
    else if (!examBasics.classId) error = 'Select class.';
    else if (!examBasics.examDate) error = 'Select exam date.';
    setStepError(error);
    if (error) {
      notify.error('Validation error', error);
      return;
    }
    syncSubjectMap();
    setStep(2);
    notify.success('Step saved', 'Exam details saved. Continue to subjects.');
  };

  const handleToggleSubject = (id: string) => {
    setSubjectMap((prev) => ({
      ...prev,
      [id]: {
        include: !prev[id]?.include,
        maxMarks: prev[id]?.maxMarks ?? defaultMarks.maxMarks,
        passMarks: prev[id]?.passMarks ?? defaultMarks.passMarks,
        scheduledAt: prev[id]?.scheduledAt ?? examBasics.examDate,
      },
    }));
  };

  const handleMarkChange = (id: string, field: 'maxMarks' | 'passMarks', value: string) => {
    setSubjectMap((prev) => ({
      ...prev,
      [id]: {
        include: prev[id]?.include ?? true,
        maxMarks: field === 'maxMarks' ? value : prev[id]?.maxMarks ?? defaultMarks.maxMarks,
        passMarks: field === 'passMarks' ? value : prev[id]?.passMarks ?? defaultMarks.passMarks,
        scheduledAt: prev[id]?.scheduledAt ?? examBasics.examDate,
      },
    }));
  };

  const resetSubjectMarks = (id: string) => {
    setSubjectMap((prev) => ({
      ...prev,
      [id]: { include: prev[id]?.include ?? true, ...defaultMarks, scheduledAt: examBasics.examDate },
    }));
  };

  const stats = {
    exams: exams?.length || 0,
    subjects: filteredSubjects.length,
    selected: selectedSubjectIds.length,
    pending: filteredSubjects.length - selectedSubjectIds.length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-red-50/40">
      {createExamMutation.isPending && <FullPageLoader label="Saving exam..." />}
      
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-orange-600 via-red-600 to-pink-700 px-6 py-16 text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative mx-auto max-w-6xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="mb-4 inline-flex items-center rounded-full bg-white/20 px-4 py-2 text-sm font-medium backdrop-blur-sm">
                <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Examination Management
              </div>
              <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
                Exams & Assessments
              </h1>
              <p className="max-w-2xl text-lg text-orange-100">
                Create comprehensive exams, map subjects, and configure assessment structures for your academic programs.
              </p>
            </div>
            
            <div className="hidden sm:flex gap-3">
              <Link
                href="/dashboard/academics"
                className="flex items-center rounded-xl bg-white/20 px-6 py-3 font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/30 hover:scale-105"
              >
                <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z" />
                </svg>
                Academics
              </Link>
              <Link
                href="/dashboard/academics/marks"
                className="flex items-center rounded-xl bg-white/20 px-6 py-3 font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/30 hover:scale-105"
              >
                <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Marks
              </Link>
            </div>
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
                <p className="text-blue-100">Total Exams</p>
                <p className="text-3xl font-bold">{stats.exams}</p>
              </div>
              <div className="rounded-full bg-white/20 p-3">
                <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100">Available Subjects</p>
                <p className="text-3xl font-bold">{stats.subjects}</p>
              </div>
              <div className="rounded-full bg-white/20 p-3">
                <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100">Selected Subjects</p>
                <p className="text-3xl font-bold">{stats.selected}</p>
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
                <p className="text-amber-100">Pending Setup</p>
                <p className="text-3xl font-bold">{stats.pending}</p>
              </div>
              <div className="rounded-full bg-white/20 p-3">
                <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
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
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
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

        {/* Create Exam Form */}
        <section className="mb-8 rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
          <div className="mb-6 flex items-center justify-center">
            <div className="flex items-center space-x-8">
              {[
                { id: 1, label: 'Exam Details', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
                { id: 2, label: 'Subject Mapping', icon: 'M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z' },
                { id: 3, label: 'Exam Structure', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
              ].map((item, index) => (
                <div key={item.id} className="flex items-center">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
                    step === item.id 
                      ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg' 
                      : step > item.id 
                      ? 'bg-green-500 text-white' 
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {step > item.id ? (
                      <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                      </svg>
                    )}
                  </div>
                  <div className="ml-4">
                    <p className={`text-sm font-medium ${
                      step === item.id ? 'text-orange-600' : step > item.id ? 'text-green-600' : 'text-gray-500'
                    }`}>
                      Step {item.id}
                    </p>
                    <p className={`text-xs ${
                      step === item.id ? 'text-orange-500' : step > item.id ? 'text-green-500' : 'text-gray-400'
                    }`}>
                      {item.label}
                    </p>
                  </div>
                  {index < 2 && (
                    <div className={`mx-8 h-0.5 w-16 ${
                      step > item.id ? 'bg-green-500' : 'bg-gray-200'
                    }`}></div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <h2 className="mb-6 text-xl font-semibold text-gray-900">Create New Exam</h2>

        {step === 1 ? (
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Exam Name</label>
                <input
                  value={examBasics.name}
                  onChange={(e) => setExamBasics({ ...examBasics, name: e.target.value })}
                  placeholder="Exam name"
                  className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Exam Type</label>
                <select
                  value={examBasics.type}
                  onChange={(e) => setExamBasics({ ...examBasics, type: e.target.value })}
                  className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
                >
                  {!examTypes?.length ? (
                    <option value="">No exam types configured</option>
                  ) : (
                    examTypes.map((type: { id: string; code: string; name: string }) => (
                      <option key={type.id} value={type.code}>
                        {type.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Academic Year</label>
                <select
                  value={examBasics.academicYearId}
                  onChange={(e) => setExamBasics({ ...examBasics, academicYearId: e.target.value })}
                  className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
                >
                  <option value="">Select academic year</option>
                  {years?.map((year: { id: string; name: string }) => (
                    <option key={year.id} value={year.id}>
                      {year.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Class</label>
                <select
                  value={examBasics.classId}
                  onChange={(e) => setExamBasics({ ...examBasics, classId: e.target.value, sectionId: '' })}
                  className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
                >
                  <option value="">Select class</option>
                  {classes?.map((cls: { id: string; name: string }) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Section</label>
                <select
                  value={examBasics.sectionId}
                  onChange={(e) => setExamBasics({ ...examBasics, sectionId: e.target.value })}
                  className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
                >
                  <option value="">All sections (optional)</option>
                  {sections
                    ?.filter((section: { classId: string }) => section.classId === examBasics.classId)
                    .map((section: { id: string; name: string }) => (
                      <option key={section.id} value={section.id}>
                        {section.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Exam Mode</label>
                <select
                  value={examBasics.examMode}
                  onChange={(e) => setExamBasics({ ...examBasics, examMode: e.target.value })}
                  className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
                >
                  <option value="MARKS">Marks</option>
                  <option value="GRADES">Grades</option>
                  <option value="MARKS_GRADES">Marks + Grades</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Exam Date</label>
                <input
                  type="date"
                  value={examBasics.examDate}
                  onChange={(e) => setExamBasics({ ...examBasics, examDate: e.target.value })}
                  className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Result Publish Date</label>
                <input
                  type="date"
                  value={examBasics.resultPublishDate}
                  onChange={(e) => setExamBasics({ ...examBasics, resultPublishDate: e.target.value })}
                  className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
                onClick={handleContinueFromBasics}
              >
                Save & Continue
              </button>
              <button
                className="rounded-lg border border-slate/20 px-4 py-2 text-sm"
                onClick={() => setStep(1)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="mt-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-ink">Assign Subjects to Exam</h3>
              <p className="text-xs text-slate">
                Subjects are auto-loaded from the selected class and academic year.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate">
                  <tr>
                    <th className="py-2">Subject</th>
                    <th>Include</th>
                    <th>Max Marks</th>
                    <th>Pass Marks</th>
                    <th>Exam Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubjects.map((subject) => {
                    const selection = subjectMap[subject.id] ?? { include: false, ...defaultMarks };
                    return (
                      <tr key={subject.id} className="border-t border-slate/10">
                        <td className="py-3">{subject.name}</td>
                        <td>
                          <input
                            type="checkbox"
                            checked={selection.include}
                            onChange={() => handleToggleSubject(subject.id)}
                          />
                        </td>
                        <td>
                          <input
                            className="w-24 rounded-md border border-slate/20 px-2 py-1 text-sm"
                            value={selection.maxMarks}
                            onChange={(e) => handleMarkChange(subject.id, 'maxMarks', e.target.value)}
                            disabled={!selection.include}
                          />
                        </td>
                        <td>
                          <input
                            className="w-24 rounded-md border border-slate/20 px-2 py-1 text-sm"
                            value={selection.passMarks}
                            onChange={(e) => handleMarkChange(subject.id, 'passMarks', e.target.value)}
                            disabled={!selection.include}
                          />
                        </td>
                        <td>
                          <input
                            type="date"
                            className="w-36 rounded-md border border-slate/20 px-2 py-1 text-sm"
                            value={selection.scheduledAt}
                            onChange={(e) =>
                              setSubjectMap((prev) => ({
                                ...prev,
                                [subject.id]: {
                                  include: selection.include,
                                  maxMarks: selection.maxMarks,
                                  passMarks: selection.passMarks,
                                  scheduledAt: e.target.value,
                                },
                              }))
                            }
                            disabled={!selection.include}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="text-xs font-semibold text-ink"
                            onClick={() => resetSubjectMarks(subject.id)}
                          >
                            Reset
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {!filteredSubjects.length ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate">
                        No subjects found for this class and academic year.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <button className="rounded-lg border border-slate/20 px-4 py-2 text-sm" onClick={() => setStep(1)}>
                Back
              </button>
              <button
                className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
                onClick={() => {
                  if (!selectedSubjectIds.length) {
                    const message = 'Select at least one subject.';
                    setStepError(message);
                    notify.error('Validation error', message);
                    return;
                  }
                  const missingDates = selectedSubjectIds.filter((id) => !subjectMap[id]?.scheduledAt);
                  if (missingDates.length) {
                    const message = 'Set exam date for every selected subject.';
                    setStepError(message);
                    notify.error('Validation error', message);
                    return;
                  }
                  setStepError('');
                  setStep(3);
                  notify.success('Step saved', 'Subject mapping saved. Continue to structure.');
                }}
              >
                Save & Continue
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="mt-4 space-y-4">
            <h3 className="text-sm font-semibold text-ink">Exam Structure (Optional)</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-slate">
                <input
                  type="checkbox"
                  checked={structure.sameMarks}
                  onChange={(e) => setStructure({ ...structure, sameMarks: e.target.checked })}
                />
                Same marks for all subjects
              </label>
              <label className="flex items-center gap-2 text-sm text-slate">
                <input
                  type="checkbox"
                  checked={structure.internalExternal}
                  onChange={(e) => setStructure({ ...structure, internalExternal: e.target.checked })}
                />
                Internal + External marks
              </label>
              <label className="flex items-center gap-2 text-sm text-slate">
                <input
                  type="checkbox"
                  checked={structure.practical}
                  onChange={(e) => setStructure({ ...structure, practical: e.target.checked })}
                />
                Practical marks
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {structure.internalExternal ? (
                <>
                  <input
                    className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
                    placeholder="Internal marks"
                    value={structure.internalMarks}
                    onChange={(e) => setStructure({ ...structure, internalMarks: e.target.value })}
                  />
                  <input
                    className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
                    placeholder="External marks"
                    value={structure.externalMarks}
                    onChange={(e) => setStructure({ ...structure, externalMarks: e.target.value })}
                  />
                </>
              ) : null}
              {structure.practical ? (
                <input
                  className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
                  placeholder="Practical marks"
                  value={structure.practicalMarks}
                  onChange={(e) => setStructure({ ...structure, practicalMarks: e.target.value })}
                />
              ) : null}
            </div>
            <div className="flex gap-2">
              <button className="rounded-lg border border-slate/20 px-4 py-2 text-sm" onClick={() => setStep(2)}>
                Back
              </button>
              <button
                className="rounded-lg border border-slate/20 px-4 py-2 text-sm"
                onClick={() => {
                  createExamMutation.mutate({ status: 'DRAFT' });
                }}
                disabled={createExamMutation.isPending}
              >
                Save Exam
              </button>
              <button
                className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
                onClick={() => {
                  createExamMutation.mutate({ status: 'PUBLISHED' });
                }}
                disabled={createExamMutation.isPending}
              >
                Publish Exam
              </button>
            </div>
          </div>
        ) : null}
      </section>

        {/* Existing Exams */}
        <section className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
          <h2 className="mb-6 text-xl font-semibold text-gray-900">Existing Exams</h2>
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Exam Name</th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Type</th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Class</th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Academic Year</th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {(exams ?? []).map((exam: any) => (
                  <tr key={exam.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{exam.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <span className="inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">
                        {exam.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{classLookup.get(exam.classId) ?? '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{yearLookup.get(exam.academicYearId) ?? '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                        exam.status === 'PUBLISHED' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {exam.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {!exams?.length && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-500">
                      No exams found. Create your first exam above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
