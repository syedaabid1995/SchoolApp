'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Button from '../../../../components/Button';
import PageHeader from '../../../../components/PageHeader';
import { useNotify } from '../../../../components/NotificationProvider';
import { exportReportCsv, exportReportPdf, getReportData, listReportCatalog, type ReportFilterKey, type ReportQueryParams } from '../../../../services/report.service';

const labels: Record<ReportFilterKey, string> = {
  schoolId: 'School ID',
  academicYearId: 'Academic Year ID',
  classId: 'Class ID',
  sectionId: 'Section ID',
  studentId: 'Student ID',
  teacherId: 'Teacher ID',
  examId: 'Exam ID',
  subjectId: 'Subject ID',
  fromDate: 'From Date',
  toDate: 'To Date',
  status: 'Status',
};

const saveBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const formatCell = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return value.slice(0, 10);
  return String(value);
};

export default function ReportViewerPage() {
  const notify = useNotify();
  const params = useParams<{ reportKey: string }>();
  const reportKey = decodeURIComponent(params.reportKey);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [appliedFilters, setAppliedFilters] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState<'csv' | 'pdf' | ''>('');

  const queryParams = useMemo<ReportQueryParams>(() => ({ ...appliedFilters, page, pageSize: 25 }), [appliedFilters, page]);
  const { data: catalog = [] } = useQuery({ queryKey: ['reports-catalog'], queryFn: () => listReportCatalog() });
  const catalogReport = catalog.find((report) => report.key === reportKey);
  const { data, isLoading, error } = useQuery({
    queryKey: ['report-data', reportKey, queryParams],
    queryFn: () => getReportData(reportKey, queryParams),
    enabled: Boolean(reportKey),
  });

  const report = data?.report ?? catalogReport;

  const applyFilters = () => {
    setPage(1);
    setAppliedFilters(Object.fromEntries(Object.entries(filters).filter(([, value]) => value.trim() !== '')));
  };

  const download = async (format: 'csv' | 'pdf') => {
    try {
      setExporting(format);
      const blob = format === 'csv' ? await exportReportCsv(reportKey, { ...appliedFilters, pageSize: 1000 }) : await exportReportPdf(reportKey, { ...appliedFilters, pageSize: 500 });
      saveBlob(blob, `${reportKey}.${format}`);
      notify.success('Export ready', `${format.toUpperCase()} export downloaded.`);
    } catch (downloadError: any) {
      notify.error('Export failed', downloadError?.response?.data?.error?.message || 'Unable to export report.');
    } finally {
      setExporting('');
    }
  };

  if (error) {
    return (
      <main className="min-h-screen bg-slate-50 pb-10">
        <div className="mx-auto max-w-7xl pr-6">
          <PageHeader title="Report" subtitle="This report could not be loaded." />
          <Link href="/dashboard/reports" className="text-sm font-semibold text-slate-700">Back to reports</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-10">
      <div className="mx-auto max-w-7xl pr-6">
        <PageHeader
          title={report?.title ?? 'Report'}
          subtitle={report?.description ?? reportKey}
          actions={<Link href="/dashboard/reports" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">Back</Link>}
        />

        {report ? (
          <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-4">
              {report.filters.filter((filter) => filter !== 'schoolId').map((filter) => (
                <label key={filter} className="text-sm font-medium text-slate-700">
                  {labels[filter]}
                  <input
                    type={filter === 'fromDate' || filter === 'toDate' ? 'date' : 'text'}
                    value={filters[filter] ?? ''}
                    onChange={(event) => setFilters((current) => ({ ...current, [filter]: event.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                  />
                </label>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={applyFilters}>Apply Filters</Button>
              <Button size="sm" variant="outline" onClick={() => { setFilters({}); setAppliedFilters({}); setPage(1); }}>Clear</Button>
              {report.formats.includes('csv') ? <Button size="sm" variant="outline" onClick={() => download('csv')} loading={exporting === 'csv'}>Export CSV</Button> : null}
              {report.formats.includes('pdf') ? <Button size="sm" variant="outline" onClick={() => download('pdf')} loading={exporting === 'pdf'}>Export PDF</Button> : null}
            </div>
          </section>
        ) : null}

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>{report?.columns.map((column) => <th key={column.key} className="p-3">{column.label}</th>)}</tr>
              </thead>
              <tbody>
                {isLoading ? <tr><td className="p-4 text-slate-500" colSpan={report?.columns.length ?? 1}>Loading report...</td></tr> : null}
                {!isLoading && !data?.rows.length ? <tr><td className="p-4 text-slate-500" colSpan={report?.columns.length ?? 1}>No rows found.</td></tr> : null}
                {data?.rows.map((row, index) => (
                  <tr key={index} className="border-t border-slate-100">
                    {report?.columns.map((column) => <td key={column.key} className="p-3 align-top text-slate-700">{formatCell(row[column.key])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 p-3 text-sm text-slate-600">
            <span>{data ? `${data.pagination.total} rows` : 'Rows'}</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</Button>
              <span>Page {data?.pagination.page ?? page} of {data?.pagination.totalPages || 1}</span>
              <Button size="sm" variant="outline" disabled={!data || page >= data.pagination.totalPages} onClick={() => setPage((current) => current + 1)}>Next</Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
