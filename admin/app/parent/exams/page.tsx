'use client';

import { useContext, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listParentExams, listParentResults } from '../../../services/parentPortal.service';
import { listAcademicYears } from '../../../services/academic.service';
import { ParentChildContext } from '../../../components/ParentPortalLayout';

export default function ParentExamsPage() {
  const [academicYearId, setAcademicYearId] = useState('');
  const [activeTab, setActiveTab] = useState<'COMPLETED' | 'ONGOING' | 'UPCOMING'>('COMPLETED');
  const [expandedExamId, setExpandedExamId] = useState<string | null>(null);
  const { activeChildId, children } = useContext(ParentChildContext);
  const activeChild = useMemo(() => children?.find((child) => child.id === activeChildId), [children, activeChildId]);

  const { data: exams } = useQuery({
    queryKey: ['parent-exams', activeChild?.id, academicYearId],
    queryFn: () => listParentExams(activeChild?.id, academicYearId || undefined),
    enabled: Boolean(activeChild?.id),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 60_000,
  });
  const { data: results } = useQuery({
    queryKey: ['parent-results', activeChild?.id],
    queryFn: () => listParentResults(activeChild?.id),
    enabled: Boolean(activeChild?.id),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 60_000,
  });
  const { data: academicYears } = useQuery({
    queryKey: ['parent-academic-years', activeChild?.schoolId],
    queryFn: () => listAcademicYears({ schoolId: activeChild?.schoolId }),
    enabled: Boolean(activeChild?.schoolId),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 5 * 60_000,
  });

  const today = new Date();
  const resultsByExamId = useMemo(() => {
    const map = new Map<string, any>();
    (results?.items ?? []).forEach((item: any) => map.set(item.examId, item));
    return map;
  }, [results]);

  const filteredExams = useMemo(() => {
    const items = exams ?? [];
    const filteredByYear = academicYearId ? items.filter((item: any) => item.academicYearId === academicYearId) : items;
    return filteredByYear.filter((item: any) => {
      if (!item.scheduledAt) return activeTab === 'COMPLETED';
      const examDate = new Date(item.scheduledAt);
      if (activeTab === 'COMPLETED') return examDate < today;
      if (activeTab === 'ONGOING') return examDate.toDateString() === today.toDateString();
      return examDate > today;
    });
  }, [exams, academicYearId, activeTab, today]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-pink-50/40">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-purple-600 via-pink-600 to-rose-700 px-6 py-12 text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative mx-auto max-w-6xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="rounded-full bg-white/20 p-3 backdrop-blur-sm">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Exams & Results</h1>
              <p className="text-purple-100">View published exams and results.</p>
            </div>
          </div>
        </div>
        <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/10 animate-pulse"></div>
        <div className="absolute -bottom-5 -left-5 h-20 w-20 rounded-full bg-white/10 animate-bounce"></div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        {/* Filter Section */}
        <div className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-full bg-purple-100 p-2">
              <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
          </div>
          <select
            value={academicYearId}
            onChange={(e) => setAcademicYearId(e.target.value)}
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All Academic Years</option>
            {academicYears?.map((year: { id: string; name: string }) => (
              <option key={year.id} value={year.id}>
                {year.name}
              </option>
            ))}
          </select>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-3">
          {(['COMPLETED', 'ONGOING', 'UPCOMING'] as const).map((tab) => {
            return (
              <button
                key={tab}
                className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all ${
                  activeTab === tab
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => setActiveTab(tab)}
              >
                <span className="inline-flex h-2 w-2 rounded-full bg-current opacity-70" aria-hidden="true" />
                {tab.charAt(0) + tab.slice(1).toLowerCase()}
              </button>
            );
          })}
        </div>

        {/* Results Grid */}
        <div className="space-y-4">
          {filteredExams.map((exam: any) => {
            const result = resultsByExamId.get(exam.id);
            const examDateLabel = exam.scheduledAt ? new Date(exam.scheduledAt).toLocaleDateString() : '';
            const isExpanded = expandedExamId === exam.id;
            
            return (
              <div
                key={exam.id}
                className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200 transition-all hover:shadow-xl"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="rounded-full bg-gradient-to-br from-purple-100 to-pink-100 p-3">
                      <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{exam.name}</h3>
                      <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                        <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700">
                          {exam.type}
                        </span>
                        {examDateLabel && <span>• {examDateLabel}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {result ? (
                      <div className="text-right">
                        <div className="text-sm text-gray-500">Total Score</div>
                        <div className="text-2xl font-bold text-gray-900">
                          {result.totalMarks}
                          <span className="text-lg text-gray-400">/{result.totalMaxMarks}</span>
                        </div>
                        {typeof result.percentage === 'number' && (
                          <div className="mt-1 inline-flex items-center rounded-full bg-gradient-to-r from-emerald-500 to-green-500 px-3 py-1 text-sm font-bold text-white shadow-md">
                            {result.percentage}%
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2">
                        <p className="text-sm font-medium text-amber-700">Marks Pending</p>
                      </div>
                    )}

                    {activeTab === 'COMPLETED' && (
                      <button
                        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg"
                        onClick={() => setExpandedExamId((prev) => (prev === exam.id ? null : exam.id))}
                      >
                        {isExpanded ? (
                          <>
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                            Hide Details
                          </>
                        ) : (
                          <>
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                            View Details
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && activeTab === 'COMPLETED' && (
                  <div className="mt-6 rounded-xl bg-gradient-to-br from-slate-50 to-purple-50 p-4 border border-gray-200">
                    {result ? (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b-2 border-gray-200">
                              <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Subject</th>
                              <th className="pb-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-600">Marks</th>
                              <th className="pb-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-600">Max</th>
                              <th className="pb-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-600">Pass</th>
                              <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">Exam Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {(result.subjects ?? []).map((row: any) => (
                              <tr key={row.subjectId} className="transition-colors hover:bg-white/50">
                                <td className="py-3 text-sm font-medium text-gray-900">{row.subjectName}</td>
                                <td className="py-3 text-center text-sm font-bold text-purple-600">{row.marks}</td>
                                <td className="py-3 text-center text-sm text-gray-600">{row.maxMarks}</td>
                                <td className="py-3 text-center text-sm text-gray-600">{row.passMarks}</td>
                                <td className="py-3 text-right text-sm text-gray-500">
                                  {row.scheduledAt ? new Date(row.scheduledAt).toLocaleDateString() : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="rounded-full bg-gray-100 p-4 mb-3">
                          <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                        </div>
                        <p className="text-sm font-medium text-gray-600">Marks not uploaded yet</p>
                        <p className="text-xs text-gray-400 mt-1">Check back later for results</p>
                      </div>
                    )}
                  </div>
                )}

                {result?.examTypeActive === false && (
                  <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2">
                    <p className="text-xs font-medium text-amber-700">⚠️ Exam type is inactive but kept for historical results</p>
                  </div>
                )}
              </div>
            );
          })}

          {!filteredExams.length && (
            <div className="flex flex-col items-center justify-center rounded-2xl bg-white p-12 shadow-lg ring-1 ring-gray-200 text-center">
              <div className="rounded-full bg-gray-100 p-6 mb-4">
                <svg className="h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-700">No exams found</h3>
              <p className="mt-1 text-sm text-gray-500">There are no {activeTab.toLowerCase()} exams to display</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
