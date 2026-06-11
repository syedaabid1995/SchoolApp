'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../../components/PageHeader';
import { useNotify } from '../../../components/NotificationProvider';
import { getSession } from '../../../services/auth.service';
import { listClasses, listSections, listSubjects } from '../../../services/academic.service';
import { listSchools } from '../../../services/school.service';
import {
  createHomework,
  deleteHomework,
  getHomeworkEvaluation,
  getHomeworkEvaluationReport,
  listHomeworks,
  saveHomeworkEvaluation,
  updateHomework,
  uploadHomeworkAttachment,
  type Homework,
  type HomeworkCompletionStatus,
  type HomeworkEvaluationDetail,
  type HomeworkEvaluationReportRow,
  type HomeworkQualityStatus,
} from '../../../services/homework.service';

type AcademicOption = { id: string; name: string; classId?: string | null; code?: string | null };
type TabId = 'homework' | 'report';
type EvalMode = 'edit' | 'view';

type EvaluationFormRow = {
  studentId: string;
  admissionNo: string;
  fullName: string;
  marks: string;
  comments: string;
  qualityStatus: HomeworkQualityStatus;
  completionStatus: HomeworkCompletionStatus;
};

const emptyHomeworkForm = {
  id: '',
  classId: '',
  sectionId: '',
  subjectId: '',
  homeworkDate: '',
  submissionDate: '',
  marks: '',
  description: '',
  attachmentUrl: '',
  attachmentName: '',
  file: null as File | null,
};
const emptyFilters = { classId: '', sectionId: '', subjectId: '' };

const today = () => new Date().toISOString().slice(0, 10);
const toDateInput = (value?: string | null) => (value ? new Date(value).toISOString().slice(0, 10) : '');
const money = (value?: string | number | null) => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric.toFixed(2).replace(/\.00$/, '') : '0';
};
const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '-');
const displayStatus = (value: HomeworkCompletionStatus) => (value === 'COMPLETED' ? 'Complete' : 'Not Complete');
const displayQuality = (value: HomeworkQualityStatus) => (value === 'GOOD' ? 'Good' : 'Not Good');
const getErrorMessage = (error: unknown, fallback = 'Something went wrong') =>
  (error as any)?.response?.data?.error?.message ||
  (error as any)?.response?.data?.message ||
  (error instanceof Error ? error.message : fallback);

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-100 disabled:bg-slate-50 disabled:text-slate-400';

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
    {children}
  </label>
);

const PrimaryButton = ({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick?: () => void }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[var(--theme-button-bg)] to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
  >
    {children}
  </button>
);

const SecondaryButton = ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
  >
    {children}
  </button>
);

const DangerButton = ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
  >
    {children}
  </button>
);

const LoadingSkeleton = () => (
  <div className="space-y-3">
    {[0, 1, 2].map((item) => <div key={item} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}
  </div>
);

const EmptyState = ({ message }: { message: string }) => (
  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
    {message}
  </div>
);

export default function HomeworkPage() {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [activeTab, setActiveTab] = useState<TabId>('homework');
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [homeworkForm, setHomeworkForm] = useState({ ...emptyHomeworkForm, homeworkDate: today(), submissionDate: today() });
  const [filters, setFilters] = useState(emptyFilters);
  const [submittedFilters, setSubmittedFilters] = useState(emptyFilters);
  const [reportFilters, setReportFilters] = useState(emptyFilters);
  const [submittedReportFilters, setSubmittedReportFilters] = useState(emptyFilters);
  const [quickSearch, setQuickSearch] = useState('');
  const [evaluationHomeworkId, setEvaluationHomeworkId] = useState('');
  const [evaluationMode, setEvaluationMode] = useState<EvalMode>('edit');
  const [evaluationDate, setEvaluationDate] = useState(today());
  const [evaluationSearch, setEvaluationSearch] = useState('');
  const [evaluationRows, setEvaluationRows] = useState<EvaluationFormRow[]>([]);

  const { data: session, isLoading: sessionLoading } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSuperAdmin = session?.role === 'SUPER_ADMIN';
  const isSchoolAdmin = session?.role === 'SCHOOL_ADMIN';
  const permissionCodes = session?.permissionCodes ?? [];
  const schoolsQuery = useQuery({
    queryKey: ['schools', 'homework'],
    queryFn: () => listSchools({ limit: 100, status: 'ACTIVE' }),
    enabled: Boolean(isSuperAdmin),
  });

  useEffect(() => {
    if (isSuperAdmin && !selectedSchoolId && schoolsQuery.data?.items?.length) {
      setSelectedSchoolId(schoolsQuery.data.items[0].id);
    }
  }, [isSuperAdmin, schoolsQuery.data?.items, selectedSchoolId]);

  const effectiveSchoolId = isSuperAdmin ? selectedSchoolId : session?.schoolId ?? '';
  const scopedParams = effectiveSchoolId ? { schoolId: effectiveSchoolId } : undefined;
  const canUsePage = isSuperAdmin || isSchoolAdmin || permissionCodes.includes('homework.view');
  const canQuery = Boolean(canUsePage && effectiveSchoolId);

  const classesQuery = useQuery({
    queryKey: ['homework-classes', effectiveSchoolId],
    queryFn: () => listClasses(scopedParams),
    enabled: canQuery,
  });
  const subjectsQuery = useQuery({
    queryKey: ['homework-subjects', effectiveSchoolId],
    queryFn: () => listSubjects(scopedParams),
    enabled: canQuery,
  });
  const formSectionsQuery = useQuery({
    queryKey: ['homework-form-sections', effectiveSchoolId, homeworkForm.classId],
    queryFn: () => listSections({ ...scopedParams, classId: homeworkForm.classId }),
    enabled: canQuery && Boolean(homeworkForm.classId),
  });
  const filterSectionsQuery = useQuery({
    queryKey: ['homework-filter-sections', effectiveSchoolId, filters.classId],
    queryFn: () => listSections({ ...scopedParams, classId: filters.classId }),
    enabled: canQuery && Boolean(filters.classId),
  });
  const reportSectionsQuery = useQuery({
    queryKey: ['homework-report-sections', effectiveSchoolId, reportFilters.classId],
    queryFn: () => listSections({ ...scopedParams, classId: reportFilters.classId }),
    enabled: canQuery && Boolean(reportFilters.classId),
  });
  const homeworksQuery = useQuery({
    queryKey: ['homeworks', effectiveSchoolId, submittedFilters, quickSearch],
    queryFn: () => listHomeworks({ ...scopedParams, ...submittedFilters, search: quickSearch }),
    enabled: canQuery && Boolean(submittedFilters.classId && submittedFilters.sectionId && submittedFilters.subjectId),
  });
  const reportQuery = useQuery({
    queryKey: ['homework-evaluation-report', effectiveSchoolId, submittedReportFilters],
    queryFn: () => getHomeworkEvaluationReport({ ...scopedParams, ...submittedReportFilters }),
    enabled: canQuery && Boolean(submittedReportFilters.classId && submittedReportFilters.sectionId && submittedReportFilters.subjectId),
  });
  const evaluationQuery = useQuery({
    queryKey: ['homework-evaluation', effectiveSchoolId, evaluationHomeworkId],
    queryFn: () => getHomeworkEvaluation(evaluationHomeworkId, scopedParams),
    enabled: canQuery && Boolean(evaluationHomeworkId),
  });

  const classes = (classesQuery.data ?? []) as AcademicOption[];
  const subjects = (subjectsQuery.data ?? []) as AcademicOption[];
  const formSections = (formSectionsQuery.data ?? []) as AcademicOption[];
  const filterSections = (filterSectionsQuery.data ?? []) as AcademicOption[];
  const reportSections = (reportSectionsQuery.data ?? []) as AcademicOption[];
  const formSubjects = subjects.filter((subject) => !subject.classId || !homeworkForm.classId || subject.classId === homeworkForm.classId);
  const filterSubjects = subjects.filter((subject) => !subject.classId || !filters.classId || subject.classId === filters.classId);
  const reportSubjects = subjects.filter((subject) => !subject.classId || !reportFilters.classId || subject.classId === reportFilters.classId);

  useEffect(() => {
    if (!evaluationQuery.data) return;
    setEvaluationDate(toDateInput(evaluationQuery.data.homework.evaluationDate) || today());
    setEvaluationRows(
      evaluationQuery.data.rows.map((row) => ({
        studentId: row.student.id,
        admissionNo: row.student.admissionNo,
        fullName: row.student.fullName,
        marks: row.evaluation?.marks == null ? '' : String(row.evaluation.marks),
        comments: row.evaluation?.comments ?? '',
        qualityStatus: row.evaluation?.qualityStatus ?? 'GOOD',
        completionStatus: row.evaluation?.completionStatus ?? 'COMPLETED',
      })),
    );
  }, [evaluationQuery.data]);

  useEffect(() => {
    setHomeworkForm({ ...emptyHomeworkForm, homeworkDate: today(), submissionDate: today() });
    setFilters(emptyFilters);
    setSubmittedFilters(emptyFilters);
    setReportFilters(emptyFilters);
    setSubmittedReportFilters(emptyFilters);
    setQuickSearch('');
    setShowForm(false);
    setEvaluationHomeworkId('');
  }, [effectiveSchoolId]);

  useEffect(() => {
    setFilters((current) => ({ ...current, sectionId: '', subjectId: '' }));
  }, [filters.classId]);

  useEffect(() => {
    setReportFilters((current) => ({ ...current, sectionId: '', subjectId: '' }));
  }, [reportFilters.classId]);

  const invalidateHomework = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['homeworks'] }),
      queryClient.invalidateQueries({ queryKey: ['homework-evaluation-report'] }),
      queryClient.invalidateQueries({ queryKey: ['homework-evaluation'] }),
    ]);
  };

  const onSuccess = async (title: string) => {
    notify.success(title);
    await invalidateHomework();
  };
  const onError = (error: unknown) => notify.error('Action failed', getErrorMessage(error));

  const homeworkMutation = useMutation({
    mutationFn: async () => {
      let attachmentUrl = homeworkForm.attachmentUrl || null;
      let attachmentName = homeworkForm.attachmentName || null;
      if (homeworkForm.file) {
        const uploaded = await uploadHomeworkAttachment(homeworkForm.file, scopedParams);
        attachmentUrl = uploaded.url;
        attachmentName = uploaded.filename;
      }
      const payload = {
        ...scopedParams,
        classId: homeworkForm.classId,
        sectionId: homeworkForm.sectionId,
        subjectId: homeworkForm.subjectId,
        homeworkDate: homeworkForm.homeworkDate,
        submissionDate: homeworkForm.submissionDate,
        marks: Number(homeworkForm.marks),
        description: homeworkForm.description,
        attachmentUrl,
        attachmentName,
      };
      return homeworkForm.id ? updateHomework(homeworkForm.id, payload) : createHomework(payload);
    },
    onSuccess: () => {
      setHomeworkForm({ ...emptyHomeworkForm, homeworkDate: today(), submissionDate: today() });
      setShowForm(false);
      onSuccess('Homework saved');
    },
    onError,
  });

  const evaluationMutation = useMutation({
    mutationFn: () =>
      saveHomeworkEvaluation(evaluationHomeworkId, {
        ...scopedParams,
        evaluationDate,
        evaluations: evaluationRows.map((row) => ({
          studentId: row.studentId,
          marks: row.marks.trim() ? Number(row.marks) : null,
          comments: row.comments || null,
          qualityStatus: row.qualityStatus,
          completionStatus: row.completionStatus,
        })),
      }),
    onSuccess: () => onSuccess('Homework evaluation saved'),
    onError,
  });

  const validateHomework = () => {
    if (!effectiveSchoolId) return notify.error('Validation error', 'Select a school first.');
    if (!homeworkForm.classId) return notify.error('Validation error', 'Select class.');
    if (!homeworkForm.sectionId) return notify.error('Validation error', 'Select section.');
    if (!homeworkForm.subjectId) return notify.error('Validation error', 'Select subject.');
    if (!homeworkForm.homeworkDate) return notify.error('Validation error', 'Homework date is required.');
    if (!homeworkForm.submissionDate) return notify.error('Validation error', 'Submission date is required.');
    if (Number(homeworkForm.marks) < 0 || Number.isNaN(Number(homeworkForm.marks))) return notify.error('Validation error', 'Marks must be zero or greater.');
    if (!homeworkForm.description.trim()) return notify.error('Validation error', 'Description is required.');
    homeworkMutation.mutate();
  };

  const searchHomework = () => {
    if (!filters.classId || !filters.sectionId || !filters.subjectId) {
      return notify.error('Validation error', 'Select class, section, and subject.');
    }
    setSubmittedFilters(filters);
  };

  const searchReport = () => {
    if (!reportFilters.classId || !reportFilters.sectionId || !reportFilters.subjectId) {
      return notify.error('Validation error', 'Select class, section, and subject.');
    }
    setSubmittedReportFilters(reportFilters);
  };

  const openEvaluation = (homework: Homework, mode: EvalMode) => {
    setEvaluationMode(mode);
    setEvaluationHomeworkId(homework.id);
    setEvaluationSearch('');
  };

  const editHomework = (homework: Homework) => {
    setHomeworkForm({
      id: homework.id,
      classId: homework.classId,
      sectionId: homework.sectionId,
      subjectId: homework.subjectId,
      homeworkDate: toDateInput(homework.homeworkDate),
      submissionDate: toDateInput(homework.submissionDate),
      marks: String(homework.marks),
      description: homework.description,
      attachmentUrl: homework.attachmentUrl ?? '',
      attachmentName: homework.attachmentName ?? '',
      file: null,
    });
    setShowForm(true);
  };

  const confirmDelete = (homework: Homework) => {
    if (!window.confirm('Delete this homework?')) return;
    deleteHomework(homework.id, scopedParams)
      .then(() => onSuccess('Deleted'))
      .catch(onError);
  };

  const updateEvalRow = (studentId: string, patch: Partial<EvaluationFormRow>) => {
    setEvaluationRows((rows) => rows.map((row) => (row.studentId === studentId ? { ...row, ...patch } : row)));
  };

  const pageActions = isSuperAdmin ? (
    <select className={`${inputClass} min-w-64`} value={selectedSchoolId} onChange={(event) => setSelectedSchoolId(event.target.value)}>
      <option value="">Select school</option>
      {schoolsQuery.data?.items.map((school) => (
        <option key={school.id} value={school.id}>
          {school.name} ({school.code})
        </option>
      ))}
    </select>
  ) : null;

  if (sessionLoading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Checking homework access...</div>;
  }

  if (!canUsePage) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-xl font-bold text-slate-950">Homework is not available for your role.</h1>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Homework" subtitle="Create homework, evaluate students, and review homework completion reports." actions={pageActions} />

      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="grid gap-2 md:grid-cols-2">
          {[
            { id: 'homework' as TabId, label: 'Homework List', description: 'Search, add, edit, delete, and evaluate homework' },
            { id: 'report' as TabId, label: 'Evaluation Report', description: 'Review completion percentages and evaluation details' },
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-xl px-4 py-3 text-left transition ${
                  active ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                }`}
              >
                <span className="block text-sm font-bold">{tab.label}</span>
                <span className={`mt-1 block text-xs ${active ? 'text-purple-100' : 'text-slate-500'}`}>{tab.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      {!effectiveSchoolId ? <EmptyState message="Select a school to manage homework." /> : null}

      {effectiveSchoolId && activeTab === 'homework' ? (
        <div className="space-y-5">
          {showForm ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">{homeworkForm.id ? 'Edit Homework' : 'Add Homework'}</h2>
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <Field label="Select class *">
                <select className={inputClass} value={homeworkForm.classId} onChange={(e) => setHomeworkForm((p) => ({ ...p, classId: e.target.value, sectionId: '', subjectId: '' }))}>
                    <option value="">Select class</option>
                    {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </Field>
                <Field label="Select section *">
                  <select className={inputClass} value={homeworkForm.sectionId} disabled={!homeworkForm.classId} onChange={(e) => setHomeworkForm((p) => ({ ...p, sectionId: e.target.value }))}>
                    <option value="">Select section</option>
                    {formSections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </Field>
                <Field label="Select subjects *">
                  <select className={inputClass} value={homeworkForm.subjectId} onChange={(e) => setHomeworkForm((p) => ({ ...p, subjectId: e.target.value }))}>
                    <option value="">Select subject</option>
                    {formSubjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </Field>
                <Field label="Homework date *">
                  <input className={inputClass} type="date" value={homeworkForm.homeworkDate} onChange={(e) => setHomeworkForm((p) => ({ ...p, homeworkDate: e.target.value }))} />
                </Field>
                <Field label="Submission date *">
                  <input className={inputClass} type="date" value={homeworkForm.submissionDate} onChange={(e) => setHomeworkForm((p) => ({ ...p, submissionDate: e.target.value }))} />
                </Field>
                <Field label="Marks *">
                  <input className={inputClass} type="number" min={0} step="0.01" value={homeworkForm.marks} onChange={(e) => setHomeworkForm((p) => ({ ...p, marks: e.target.value }))} />
                </Field>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
                <Field label="Description *">
                  <textarea className={inputClass} rows={4} value={homeworkForm.description} onChange={(e) => setHomeworkForm((p) => ({ ...p, description: e.target.value }))} />
                </Field>
                <Field label="Attach file">
                  <input
                    className={inputClass}
                    type="file"
                    accept=".pdf,.doc,.docx,image/png,image/jpeg,image/webp"
                    onChange={(e) => setHomeworkForm((p) => ({ ...p, file: e.target.files?.[0] ?? null }))}
                  />
                  {homeworkForm.attachmentName ? <p className="mt-2 text-xs text-slate-500">Current: {homeworkForm.attachmentName}</p> : null}
                </Field>
              </div>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <PrimaryButton disabled={homeworkMutation.isPending} onClick={validateHomework}>Save Homework</PrimaryButton>
                <SecondaryButton onClick={() => { setHomeworkForm({ ...emptyHomeworkForm, homeworkDate: today(), submissionDate: today() }); setShowForm(false); }}>Cancel</SecondaryButton>
              </div>
            </section>
          ) : null}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <h2 className="text-lg font-bold text-slate-950">Select Criteria</h2>
              <PrimaryButton onClick={() => setShowForm(true)}>Add Homework</PrimaryButton>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
              <Field label="Select class *">
                <select className={inputClass} value={filters.classId} onChange={(e) => setFilters((p) => ({ ...p, classId: e.target.value }))}>
                  <option value="">Select class</option>
                  {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
              <Field label="Select section *">
                <select className={inputClass} value={filters.sectionId} disabled={!filters.classId} onChange={(e) => setFilters((p) => ({ ...p, sectionId: e.target.value }))}>
                  <option value="">Select section</option>
                  {filterSections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
              <Field label="Select subjects *">
                <select className={inputClass} value={filters.subjectId} onChange={(e) => setFilters((p) => ({ ...p, subjectId: e.target.value }))}>
                  <option value="">Select subject</option>
                  {filterSubjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
              <PrimaryButton onClick={searchHomework} disabled={homeworksQuery.isFetching}>Search</PrimaryButton>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-bold text-slate-950">Homework List</h2>
              <input className={`${inputClass} sm:max-w-xs`} placeholder="Quick search..." value={quickSearch} onChange={(event) => setQuickSearch(event.target.value)} />
            </div>
            <div className="mt-4">
              {homeworksQuery.isFetching ? <LoadingSkeleton /> : (
                <HomeworkTable
                  items={homeworksQuery.data ?? []}
                  searched={Boolean(submittedFilters.classId)}
                  onEvaluate={(item) => openEvaluation(item, 'edit')}
                  onEdit={editHomework}
                  onDelete={confirmDelete}
                />
              )}
            </div>
          </section>
        </div>
      ) : null}

      {effectiveSchoolId && activeTab === 'report' ? (
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Select Criteria</h2>
            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
              <Field label="Select class *">
                <select className={inputClass} value={reportFilters.classId} onChange={(e) => setReportFilters((p) => ({ ...p, classId: e.target.value }))}>
                  <option value="">Select class</option>
                  {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
              <Field label="Select section *">
                <select className={inputClass} value={reportFilters.sectionId} disabled={!reportFilters.classId} onChange={(e) => setReportFilters((p) => ({ ...p, sectionId: e.target.value }))}>
                  <option value="">Select section</option>
                  {reportSections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
              <Field label="Select subjects *">
                <select className={inputClass} value={reportFilters.subjectId} onChange={(e) => setReportFilters((p) => ({ ...p, subjectId: e.target.value }))}>
                  <option value="">Select subject</option>
                  {reportSubjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
              <PrimaryButton onClick={searchReport} disabled={reportQuery.isFetching}>Search</PrimaryButton>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Homework Evaluation Report</h2>
            <div className="mt-4">
              {reportQuery.isFetching ? <LoadingSkeleton /> : <ReportTable rows={reportQuery.data ?? []} searched={Boolean(submittedReportFilters.classId)} onView={(item) => openEvaluation(item.homework, 'view')} />}
            </div>
          </section>
        </div>
      ) : null}

      {evaluationHomeworkId ? (
        <EvaluationModal
          detail={evaluationQuery.data}
          isLoading={evaluationQuery.isFetching}
          mode={evaluationMode}
          rows={evaluationRows}
          search={evaluationSearch}
          evaluationDate={evaluationDate}
          isSaving={evaluationMutation.isPending}
          onClose={() => setEvaluationHomeworkId('')}
          onSearch={setEvaluationSearch}
          onDateChange={setEvaluationDate}
          onRowChange={updateEvalRow}
          onSave={() => {
            if (!evaluationDate) return notify.error('Validation error', 'Evaluation date is required.');
            if (!evaluationRows.length) return notify.error('Validation error', 'No students found for evaluation.');
            evaluationMutation.mutate();
          }}
        />
      ) : null}
    </div>
  );
}

function HomeworkTable({
  items,
  searched,
  onEvaluate,
  onEdit,
  onDelete,
}: {
  items: Homework[];
  searched: boolean;
  onEvaluate: (item: Homework) => void;
  onEdit: (item: Homework) => void;
  onDelete: (item: Homework) => void;
}) {
  if (!searched) return <EmptyState message="Select class, section, and subject to search homework." />;
  if (!items.length) return <EmptyState message="No homework found for this criteria." />;

  return (
    <DataTable headers={['Class', 'Sections', 'Subject', 'Marks', 'Homework Date', 'Submission Date', 'Evaluation Date', 'Created By', 'Action']}>
      {items.map((item) => (
        <tr key={item.id}>
          <Cell>{item.class?.name ?? '-'}</Cell>
          <Cell>{item.section?.name ?? '-'}</Cell>
          <Cell>{item.subject?.name ?? '-'}</Cell>
          <Cell>{money(item.marks)}</Cell>
          <Cell>{formatDate(item.homeworkDate)}</Cell>
          <Cell>{formatDate(item.submissionDate)}</Cell>
          <Cell>{formatDate(item.evaluationDate)}</Cell>
          <Cell>{item.createdBy?.email ?? '-'}</Cell>
          <td className="px-4 py-3">
            <div className="flex justify-end gap-2">
              <SecondaryButton onClick={() => onEvaluate(item)}>Evaluation</SecondaryButton>
              <SecondaryButton onClick={() => onEdit(item)}>Edit</SecondaryButton>
              <DangerButton onClick={() => onDelete(item)}>Delete</DangerButton>
            </div>
          </td>
        </tr>
      ))}
    </DataTable>
  );
}

function ReportTable({ rows, searched, onView }: { rows: HomeworkEvaluationReportRow[]; searched: boolean; onView: (item: HomeworkEvaluationReportRow) => void }) {
  if (!searched) return <EmptyState message="Select class, section, and subject to search evaluation reports." />;
  if (!rows.length) return <EmptyState message="No homework evaluation report found for this criteria." />;

  return (
    <DataTable headers={['Subject', 'Homework Date', 'Submission Date', 'Complete/Incomplete', 'Complete(%)', 'Action']}>
      {rows.map((item) => (
        <tr key={item.homework.id}>
          <Cell>{item.homework.subject?.name ?? '-'}</Cell>
          <Cell>{formatDate(item.homework.homeworkDate)}</Cell>
          <Cell>{formatDate(item.homework.submissionDate)}</Cell>
          <Cell>{item.completedCount}/{item.totalStudents}</Cell>
          <Cell>{item.percent}</Cell>
          <td className="px-4 py-3 text-right">
            <SecondaryButton onClick={() => onView(item)}>View</SecondaryButton>
          </td>
        </tr>
      ))}
    </DataTable>
  );
}

function EvaluationModal({
  detail,
  isLoading,
  mode,
  rows,
  search,
  evaluationDate,
  isSaving,
  onClose,
  onSearch,
  onDateChange,
  onRowChange,
  onSave,
}: {
  detail?: HomeworkEvaluationDetail;
  isLoading: boolean;
  mode: EvalMode;
  rows: EvaluationFormRow[];
  search: string;
  evaluationDate: string;
  isSaving: boolean;
  onClose: () => void;
  onSearch: (value: string) => void;
  onDateChange: (value: string) => void;
  onRowChange: (studentId: string, patch: Partial<EvaluationFormRow>) => void;
  onSave: () => void;
}) {
  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => `${row.admissionNo} ${row.fullName}`.toLowerCase().includes(term));
  }, [rows, search]);
  const readOnly = mode === 'view';
  const homework = detail?.homework;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 p-3">
      <div className="mx-auto min-h-full max-w-7xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-purple-600 to-fuchsia-500 px-6 py-5 text-white">
          <h2 className="text-lg font-bold">{readOnly ? 'View Evaluation Report' : 'Evaluation Homework'}</h2>
          <button type="button" className="text-2xl font-bold leading-none" onClick={onClose}>x</button>
        </div>
        <div className="grid gap-6 p-6 xl:grid-cols-[1fr_340px]">
          <div className="space-y-4">
            <input className={`${inputClass} max-w-md`} placeholder="Quick search..." value={search} onChange={(event) => onSearch(event.target.value)} />
            {isLoading ? <LoadingSkeleton /> : (
              <DataTable headers={['Admission No', 'Student Name', 'Marks', 'Comments', 'Homework Status']}>
                {filteredRows.map((row) => (
                  <tr key={row.studentId}>
                    <Cell>{row.admissionNo}</Cell>
                    <Cell strong>{row.fullName}</Cell>
                    <Cell>
                      {readOnly ? money(row.marks) : (
                        <input className={inputClass} type="number" min={0} step="0.01" value={row.marks} onChange={(event) => onRowChange(row.studentId, { marks: event.target.value })} />
                      )}
                    </Cell>
                    <Cell>
                      {readOnly ? (
                        <div className="space-y-1">
                          <span className="inline-flex rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-700">{displayQuality(row.qualityStatus)}</span>
                          {row.comments ? <p className="text-xs text-slate-500">{row.comments}</p> : null}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <select className={inputClass} value={row.qualityStatus} onChange={(event) => onRowChange(row.studentId, { qualityStatus: event.target.value as HomeworkQualityStatus })}>
                            <option value="GOOD">Good</option>
                            <option value="NOT_GOOD">Not Good</option>
                          </select>
                          <input className={inputClass} placeholder="Comment" value={row.comments} onChange={(event) => onRowChange(row.studentId, { comments: event.target.value })} />
                        </div>
                      )}
                    </Cell>
                    <Cell>
                      {readOnly ? (
                        <span className="inline-flex rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-700">{displayStatus(row.completionStatus)}</span>
                      ) : (
                        <select className={inputClass} value={row.completionStatus} onChange={(event) => onRowChange(row.studentId, { completionStatus: event.target.value as HomeworkCompletionStatus })}>
                          <option value="COMPLETED">Completed</option>
                          <option value="NOT_COMPLETED">Not Completed</option>
                        </select>
                      )}
                    </Cell>
                  </tr>
                ))}
              </DataTable>
            )}
            {!isLoading && !filteredRows.length ? <EmptyState message="No students found." /> : null}
            {!readOnly ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <Field label="Evaluation date *">
                  <input className={`${inputClass} sm:w-72`} type="date" value={evaluationDate} onChange={(event) => onDateChange(event.target.value)} />
                </Field>
                <PrimaryButton disabled={isSaving || isLoading} onClick={onSave}>Save Homework</PrimaryButton>
              </div>
            ) : null}
          </div>
          <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">{readOnly ? 'Summary' : 'Homework Summary'}</h3>
            {homework ? (
              <div className="mt-4 divide-y divide-slate-200 text-sm">
                <InfoRow label="Homework Date" value={formatDate(homework.homeworkDate)} />
                <InfoRow label="Submission Date" value={formatDate(homework.submissionDate)} />
                <InfoRow label="Evaluation Date" value={formatDate(homework.evaluationDate || evaluationDate)} />
                <InfoRow label="Created By" value={homework.createdBy?.email ?? '-'} />
                <InfoRow label="Evaluated By" value={homework.evaluatedBy?.email ?? '-'} />
                <InfoRow label="Class" value={homework.class?.name ?? '-'} />
                <InfoRow label="Section" value={homework.section?.name ?? '-'} />
                <InfoRow label="Subject" value={homework.subject?.name ?? '-'} />
                <InfoRow label="Marks" value={money(homework.marks)} />
                <InfoRow
                  label="Attach File"
                  value={homework.attachmentUrl ? <a href={homework.attachmentUrl} target="_blank" rel="noreferrer" className="font-semibold text-purple-700">Download</a> : '-'}
                />
                <InfoRow label="Description" value={homework.description} />
              </div>
            ) : <LoadingSkeleton />}
          </aside>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-3 py-3">
      <span className="font-semibold text-slate-500">{label}</span>
      <span className="min-w-0 text-slate-800">{value}</span>
    </div>
  );
}

function DataTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>{headers.map((header) => <th key={header} className={`px-4 py-3 ${header === 'Action' ? 'text-right' : ''}`}>{header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">{children}</tbody>
      </table>
    </div>
  );
}

function Cell({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  return <td className={`px-4 py-3 align-top ${strong ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>{children}</td>;
}
