'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../../components/PageHeader';
import { useNotify } from '../../../components/NotificationProvider';
import { getSession } from '../../../services/auth.service';
import { listSchools } from '../../../services/school.service';
import {
  commitImport,
  downloadImportTemplate,
  listImports,
  listImportTypes,
  previewImport,
  type BulkImportType,
  type ImportDefinition,
  type ImportResult,
} from '../../../services/import.service';

const inputClass = 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100';
const buttonClass = 'inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-bold shadow-sm disabled:cursor-not-allowed disabled:opacity-50';
const typePermissions: Record<BulkImportType, string[]> = {
  CLASS: ['academic.class.create', 'academics.setup'],
  SECTION: ['academic.section.create', 'academics.setup'],
  SUBJECT: ['academic.subject.create', 'academics.setup'],
  STUDENT: ['student.import'],
  TEACHER: ['teachers.add'],
  EXPENSE_CATEGORY: ['expenses.categories.create'],
  EXPENSE: ['expenses.create'],
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const canUseType = (definition: ImportDefinition, role?: string | null, codes: string[] = []) => {
  if (role === 'SUPER_ADMIN' || role === 'SCHOOL_ADMIN') return true;
  return typePermissions[definition.type]?.some((code) => codes.includes(code)) ?? false;
};

export default function BulkImportsPage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState<BulkImportType>('STUDENT');
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const { data: session } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSuperAdmin = session?.role === 'SUPER_ADMIN';
  const activeSchoolId = isSuperAdmin ? selectedSchoolId : session?.schoolId ?? undefined;

  const { data: schools } = useQuery({
    queryKey: ['schools', 'import-selector'],
    queryFn: () => listSchools({ limit: 100 }),
    enabled: Boolean(isSuperAdmin),
  });
  const { data: definitions = [] } = useQuery({ queryKey: ['import-types'], queryFn: listImportTypes });
  const visibleDefinitions = useMemo(
    () => definitions.filter((definition) => canUseType(definition, session?.role, session?.permissionCodes ?? [])),
    [definitions, session?.permissionCodes, session?.role],
  );
  const selectedDefinition = visibleDefinitions.find((definition) => definition.type === selectedType) ?? visibleDefinitions[0];

  const importsQuery = useQuery({
    queryKey: ['imports', activeSchoolId],
    queryFn: () => listImports({ schoolId: activeSchoolId, limit: 20 }),
    enabled: Boolean(activeSchoolId),
  });

  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDefinition) throw new Error('Select an import type.');
      if (!file) throw new Error('Choose a CSV or Excel file.');
      if (isSuperAdmin && !activeSchoolId) throw new Error('Select a school first.');
      return previewImport(selectedDefinition.type, file, activeSchoolId);
    },
    onSuccess: (data) => {
      setResult(data);
      notify.success('Preview ready', `${data.validCount} valid rows, ${data.failedCount} row errors.`);
    },
    onError: (error: any) => notify.error('Preview failed', error?.response?.data?.error?.message ?? error.message ?? 'Unable to preview import.'),
  });

  const commitMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDefinition) throw new Error('Select an import type.');
      if (!file) throw new Error('Choose a CSV or Excel file.');
      if (isSuperAdmin && !activeSchoolId) throw new Error('Select a school first.');
      return commitImport(selectedDefinition.type, file, activeSchoolId);
    },
    onSuccess: (data) => {
      setResult(data);
      notify.success('Import completed', `${data.successCount} imported, ${data.failedCount} row errors.`);
      queryClient.invalidateQueries({ queryKey: ['imports'] });
    },
    onError: (error: any) => notify.error('Import failed', error?.response?.data?.error?.message ?? error.message ?? 'Unable to import file.'),
  });

  const handleTemplate = async () => {
    if (!selectedDefinition) return;
    const blob = await downloadImportTemplate(selectedDefinition.type);
    downloadBlob(blob, `${selectedDefinition.type.toLowerCase()}-import-template.csv`);
  };

  const disabled = !selectedDefinition || !file || previewMutation.isPending || commitMutation.isPending || (isSuperAdmin && !activeSchoolId);

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-6 lg:px-8">
        <PageHeader
          title="Bulk Imports"
          subtitle="Upload CSV or Excel files for academic setup, students, teachers, and expenses."
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Bulk Imports' }]}
        />

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              {isSuperAdmin ? (
                <select className={inputClass} value={selectedSchoolId} onChange={(event) => setSelectedSchoolId(event.target.value)}>
                  <option value="">Select school</option>
                  {(schools?.items ?? []).map((school) => <option key={school.id} value={school.id}>{school.name} ({school.code})</option>)}
                </select>
              ) : null}
              <select
                className={inputClass}
                value={selectedDefinition?.type ?? ''}
                onChange={(event) => {
                  setSelectedType(event.target.value as BulkImportType);
                  setResult(null);
                  setFile(null);
                }}
              >
                {visibleDefinitions.map((definition) => <option key={definition.type} value={definition.type}>{definition.label}</option>)}
              </select>
            </div>

            {selectedDefinition ? (
              <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-950">{selectedDefinition.label}</h2>
                    <p className="mt-1 text-sm text-slate-600">{selectedDefinition.description}</p>
                  </div>
                  <button type="button" onClick={handleTemplate} className={`${buttonClass} border border-violet-200 bg-violet-50 text-violet-700`}>
                    Download Template
                  </button>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-500">Required Columns</p>
                    <p className="mt-1 text-sm text-slate-800">{selectedDefinition.requiredFields.join(', ')}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-500">Optional Columns</p>
                    <p className="mt-1 text-sm text-slate-800">{selectedDefinition.optionalFields.join(', ') || 'None'}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                No import types are enabled for your role.
              </div>
            )}

            <div className="mt-5 rounded-2xl border-2 border-dashed border-slate-200 bg-white p-6 text-center">
              <input id="bulk-import-file" type="file" accept=".csv,.xlsx" className="hidden" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setResult(null); }} />
              <label htmlFor="bulk-import-file" className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-slate-800">
                Choose CSV / Excel
              </label>
              <p className="mt-3 text-sm text-slate-600">{file ? file.name : 'No file selected'}</p>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button type="button" disabled={disabled} onClick={() => previewMutation.mutate()} className={`${buttonClass} border border-slate-200 bg-white text-slate-700`}>
                {previewMutation.isPending ? 'Previewing...' : 'Preview'}
              </button>
              <button type="button" disabled={disabled} onClick={() => commitMutation.mutate()} className={`${buttonClass} bg-[var(--theme-button-bg)] text-[var(--theme-button-text)]`}>
                {commitMutation.isPending ? 'Importing...' : 'Import Valid Rows'}
              </button>
            </div>

            {result ? (
              <div className="mt-5 grid gap-3 md:grid-cols-4">
                {[
                  ['Rows', result.totalRows],
                  ['Valid', result.validCount],
                  ['Imported', result.successCount],
                  ['Errors', result.failedCount],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
                    <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {result?.errors?.length ? (
              <section className="mt-5 overflow-hidden rounded-2xl border border-red-100 bg-red-50">
                <div className="border-b border-red-100 px-4 py-3">
                  <h2 className="text-sm font-bold text-red-900">Row Errors</h2>
                </div>
                <div className="max-h-72 overflow-auto p-4 text-sm text-red-800">
                  {result.errors.slice(0, 100).map((error, index) => (
                    <p key={`${error.rowNumber}-${error.field}-${index}`}>Row {error.rowNumber}: {error.field ? `${error.field} - ` : ''}{error.message}</p>
                  ))}
                </div>
              </section>
            ) : null}
          </section>

          <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Recent Imports</h2>
            <div className="mt-4 space-y-3">
              {(importsQuery.data ?? []).map((job) => (
                <div key={job.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-slate-900">{job.type}</p>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{job.status}</span>
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-500">{job.originalName}</p>
                  <p className="mt-2 text-xs text-slate-600">{job.successCount} imported, {job.errorCount} errors</p>
                </div>
              ))}
              {!importsQuery.data?.length ? <p className="text-sm text-slate-500">No imports found for this school.</p> : null}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
