'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import FullPageLoader from '../../../components/FullPageLoader';
import { useNotify } from '../../../components/NotificationProvider';
import PageHeader from '../../../components/PageHeader';
import { getSession } from '../../../services/auth.service';
import { listAcademicYears } from '../../../services/academic.service';
import { listSetupClasses, listSetupSections } from '../../../services/academic-setup.service';
import {
  deleteStudent,
  downloadStudentImportSample,
  importStudents,
  listStudents,
  resolveUploadUrl,
  type Student,
} from '../../../services/student.service';

const pageSizes = [10, 20, 50];

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
};

const exportCsv = (rows: Student[]) => {
  const headers = ['Admission No', 'Roll No', 'Name', 'Class', 'Father Name', 'Date of Birth', 'Gender', 'Type', 'Phone'];
  const body = rows.map((student) =>
    [
      student.admissionNo,
      student.rollNo ?? '',
      student.fullName ?? `${student.firstName} ${student.lastName}`.trim(),
      student.class?.name ?? '',
      student.fatherName ?? '',
      formatDate(student.dob),
      student.gender ?? '',
      student.category ?? '',
      student.phone ?? student.parentPhone ?? '',
    ]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(','),
  );
  const blob = new Blob([[headers.join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'students.csv';
  anchor.click();
  URL.revokeObjectURL(url);
};

const Icon = ({ path }: { path: string }) => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
  </svg>
);

const SkeletonRows = () => (
  <>
    {Array.from({ length: 6 }).map((_, index) => (
      <tr key={index} className="animate-pulse border-b border-slate-100">
        {Array.from({ length: 10 }).map((__, cell) => (
          <td key={cell} className="px-4 py-4">
            <div className="h-3 rounded bg-slate-200" />
          </td>
        ))}
      </tr>
    ))}
  </>
);

export default function StudentsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [filters, setFilters] = useState({
    search: '',
    classId: '',
    sectionId: '',
    academicSessionId: '',
    status: '',
  });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importForm, setImportForm] = useState({
    academicSessionId: '',
    classId: '',
    sectionId: '',
    file: null as File | null,
  });

  const { data: session, isLoading: isSessionLoading } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSchoolAdmin = session?.role === 'SCHOOL_ADMIN';

  useEffect(() => {
    if (!isSessionLoading && session?.role && !isSchoolAdmin) {
      router.replace('/dashboard');
    }
  }, [isSchoolAdmin, isSessionLoading, router, session?.role]);

  const studentsQuery = useQuery({
    queryKey: ['students', filters],
    queryFn: () =>
      listStudents({
        search: filters.search || undefined,
        status: filters.status || undefined,
        classId: filters.classId || undefined,
        sectionId: filters.sectionId || undefined,
        academicSessionId: filters.academicSessionId || undefined,
      }),
    enabled: isSchoolAdmin,
  });
  const yearsQuery = useQuery({ queryKey: ['academic-years'], queryFn: () => listAcademicYears(), enabled: isSchoolAdmin });
  const classesQuery = useQuery({ queryKey: ['setup-classes'], queryFn: () => listSetupClasses(), enabled: isSchoolAdmin });
  const sectionsQuery = useQuery({ queryKey: ['setup-sections'], queryFn: () => listSetupSections(), enabled: isSchoolAdmin });

  const sections = sectionsQuery.data ?? [];
  const students = studentsQuery.data ?? [];
  const filteredSections = useMemo(
    () =>
      filters.classId
        ? sections.filter((section) => section.classSections?.some((link) => link.classId === filters.classId) || section.classId === filters.classId)
        : sections,
    [sections, filters.classId],
  );
  const importSections = useMemo(
    () =>
      importForm.classId
        ? sections.filter((section) => section.classSections?.some((link) => link.classId === importForm.classId) || section.classId === importForm.classId)
        : sections,
    [sections, importForm.classId],
  );
  const totalPages = Math.max(1, Math.ceil(students.length / limit));
  const paginated = students.slice((page - 1) * limit, page * limit);

  const deleteMutation = useMutation({
    mutationFn: deleteStudent,
    onSuccess: () => {
      notify.success('Student deleted', 'The student record was removed.');
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (error: any) => notify.error('Delete failed', error?.response?.data?.error?.message ?? 'Unable to delete student.'),
  });

  const importMutation = useMutation({
    mutationFn: () => {
      if (!importForm.file) throw new Error('Select a CSV or Excel file.');
      return importStudents({
        academicSessionId: importForm.academicSessionId,
        classId: importForm.classId,
        sectionId: importForm.sectionId,
        file: importForm.file,
      });
    },
    onSuccess: (result) => {
      notify.success('Import completed', `${result.successCount} imported, ${result.failedCount} failed.`);
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (error: any) => notify.error('Import failed', error?.response?.data?.error?.message ?? error.message ?? 'Unable to import students.'),
  });

  const resetFilters = () => {
    setFilters({ search: '', classId: '', sectionId: '', academicSessionId: '', status: '' });
    setPage(1);
  };

  const handleDownloadSample = async () => {
    const blob = await downloadStudentImportSample();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'student-import-sample.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (isSessionLoading || !session?.role || !isSchoolAdmin) {
    return <FullPageLoader label="Checking student access..." />;
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-6 lg:px-8">
        <PageHeader
          title="Student Information"
          subtitle="Manage admissions, imports, enrollments, documents, and student records."
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Students' }]}
        />
        <div className="mb-4 flex flex-wrap justify-end gap-2">
          <button onClick={() => studentsQuery.refetch()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
            <Icon path="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            Refresh
          </button>
          <button onClick={() => exportCsv(students)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
            <Icon path="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
            Export
          </button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
            <Icon path="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z" />
            Print
          </button>
          <button onClick={() => setImportOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700 shadow-sm hover:bg-violet-100">
            <Icon path="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 4v12m0-12l-4 4m4-4l4 4" />
            Import
          </button>
          <Link href="/dashboard/students/add" className="inline-flex items-center gap-2 rounded-xl bg-[var(--theme-button-bg)] px-4 py-2 text-sm font-semibold text-[var(--theme-button-text)] shadow-sm hover:opacity-90">
            <Icon path="M12 4v16m8-8H4" />
            Add Student
          </Link>
        </div>

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Select Criteria</h2>
              <p className="text-sm text-slate-500">Search by class, section, session, student name, or roll number.</p>
            </div>
            <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">{students.length} students</span>
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            <select value={filters.academicSessionId} onChange={(event) => { setFilters({ ...filters, academicSessionId: event.target.value }); setPage(1); }} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="">All Sessions</option>
              {(yearsQuery.data ?? []).map((year: any) => <option key={year.id} value={year.id}>{year.name}</option>)}
            </select>
            <select value={filters.classId} onChange={(event) => { setFilters({ ...filters, classId: event.target.value, sectionId: '' }); setPage(1); }} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="">All Classes</option>
              {(classesQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <select value={filters.sectionId} onChange={(event) => { setFilters({ ...filters, sectionId: event.target.value }); setPage(1); }} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="">All Sections</option>
              {filteredSections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
            </select>
            <select value={filters.status} onChange={(event) => { setFilters({ ...filters, status: event.target.value }); setPage(1); }} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="">All Status</option>
              <option value="ENROLLED">Enrolled</option>
              <option value="TRANSFERRED">Transferred</option>
              <option value="EXITED">Exited</option>
            </select>
            <input value={filters.search} onChange={(event) => { setFilters({ ...filters, search: event.target.value }); setPage(1); }} placeholder="Quick search..." className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={resetFilters} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Reset</button>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-950">Student List</h2>
            <select value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1); }} className="rounded-lg border border-slate-200 px-2 py-1 text-sm">
              {pageSizes.map((size) => <option key={size} value={size}>{size} / page</option>)}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  {['Admission No', 'Roll No', 'Name', 'Class', 'Father Name', 'Date of Birth', 'Gender', 'Type', 'Phone', 'Actions'].map((header) => (
                    <th key={header} className="px-4 py-3">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {studentsQuery.isLoading ? <SkeletonRows /> : null}
                {!studentsQuery.isLoading && paginated.map((student) => {
                  const name = student.fullName ?? `${student.firstName} ${student.lastName}`.trim();
                  return (
                    <tr key={student.id} className="border-b border-slate-100 align-middle hover:bg-slate-50/70">
                      <td className="px-4 py-4 font-semibold text-slate-900">{student.admissionNo}</td>
                      <td className="px-4 py-4 text-slate-600">{student.rollNo ?? '-'}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-violet-100 text-sm font-bold text-violet-700">
                            {student.photoUrl ? <img src={resolveUploadUrl(student.photoUrl) ?? undefined} alt={name} className="h-full w-full object-cover" /> : name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{name}</p>
                            <p className="text-xs text-slate-500">{student.email ?? student.parentEmail ?? '-'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-600">{student.class?.name ?? '-'} {student.section?.name ? `- ${student.section.name}` : ''}</td>
                      <td className="px-4 py-4 text-slate-600">{student.fatherName ?? '-'}</td>
                      <td className="px-4 py-4 text-slate-600">{formatDate(student.dob)}</td>
                      <td className="px-4 py-4 text-slate-600">{student.gender ?? '-'}</td>
                      <td className="px-4 py-4 text-slate-600">{student.category ?? 'Regular'}</td>
                      <td className="px-4 py-4 text-slate-600">{student.phone ?? student.parentPhone ?? '-'}</td>
                      <td className="relative px-4 py-4">
                        <button onClick={() => setOpenActionId(openActionId === student.id ? null : student.id)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white">
                          <Icon path="M12 6h.01M12 12h.01M12 18h.01" />
                          Action
                        </button>
                        {openActionId === student.id && (
                          <div className="absolute right-4 z-20 mt-2 w-40 rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                            <Link href={`/dashboard/students/${student.id}`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                              <Icon path="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              View
                            </Link>
                            <Link href={`/dashboard/students/${student.id}?edit=1`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                              <Icon path="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                              Edit
                            </Link>
                            <button onClick={() => { setOpenActionId(null); if (window.confirm(`Delete ${name}? This cannot be undone.`)) deleteMutation.mutate(student.id); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50">
                              <Icon path="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m2 0H7m3 0V5a2 2 0 012-2h0a2 2 0 012 2v2" />
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!studentsQuery.isLoading && paginated.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-14 text-center">
                      <div className="mx-auto max-w-sm">
                        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-400">
                          <Icon path="M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.422A12.083 12.083 0 0118 20.944M12 14L5.84 10.578A12.083 12.083 0 006 20.944" />
                        </div>
                        <h3 className="font-bold text-slate-900">No students found.</h3>
                        <p className="mt-1 text-sm text-slate-500">Adjust filters or add a new admission.</p>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 text-sm text-slate-600">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border border-slate-200 px-3 py-1 font-semibold disabled:opacity-50">Previous</button>
              <button disabled={page === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded-lg border border-slate-200 px-3 py-1 font-semibold disabled:opacity-50">Next</button>
            </div>
          </div>
        </section>
      </div>

      {importOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-950">Bulk Student Import</h2>
                <p className="text-sm text-slate-500">Upload CSV or Excel. Dates must use YYYY-MM-DD.</p>
              </div>
              <button onClick={() => setImportOpen(false)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
                <Icon path="M6 18L18 6M6 6l12 12" />
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <select value={importForm.academicSessionId} onChange={(event) => setImportForm({ ...importForm, academicSessionId: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <option value="">Select session</option>
                {(yearsQuery.data ?? []).map((year: any) => <option key={year.id} value={year.id}>{year.name}</option>)}
              </select>
              <select value={importForm.classId} onChange={(event) => setImportForm({ ...importForm, classId: event.target.value, sectionId: '' })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <option value="">Select class</option>
                {(classesQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <select value={importForm.sectionId} onChange={(event) => setImportForm({ ...importForm, sectionId: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <option value="">Select section</option>
                {importSections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
              </select>
            </div>
            <div className="mt-5 rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/40 p-6 text-center">
              <input id="student-import-file" type="file" accept=".csv,.xlsx" className="hidden" onChange={(event) => setImportForm({ ...importForm, file: event.target.files?.[0] ?? null })} />
              <label htmlFor="student-import-file" className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-violet-700">
                <Icon path="M7 16a4 4 0 01.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M12 12v9m0 0l-3-3m3 3l3-3" />
                Choose CSV / Excel
              </label>
              <p className="mt-3 text-sm text-slate-600">{importForm.file ? importForm.file.name : 'No file selected'}</p>
              <button onClick={handleDownloadSample} className="mt-3 text-sm font-semibold text-violet-700 underline">Download sample file</button>
            </div>
            {importMutation.data?.errors?.length ? (
              <div className="mt-4 max-h-44 overflow-auto rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                {importMutation.data.errors.slice(0, 20).map((error, index) => (
                  <p key={`${error.rowNumber}-${error.field}-${index}`}>Row {error.rowNumber}: {error.field ? `${error.field} - ` : ''}{error.message}</p>
                ))}
              </div>
            ) : null}
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setImportOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
              <button
                disabled={!importForm.academicSessionId || !importForm.classId || !importForm.sectionId || !importForm.file || importMutation.isPending}
                onClick={() => importMutation.mutate()}
                className="rounded-xl bg-[var(--theme-button-bg)] px-5 py-2 text-sm font-bold text-[var(--theme-button-text)] disabled:opacity-50"
              >
                {importMutation.isPending ? 'Importing...' : 'Save bulk students'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
