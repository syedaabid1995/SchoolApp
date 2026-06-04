'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '../../../components/PageHeader';
import { listReportCatalog } from '../../../services/report.service';

const categories = ['Students', 'Parents', 'Attendance', 'Exams', 'Staff', 'Academics', 'Homework', 'Library', 'Transport', 'Dormitory', 'Fees', 'Payroll'];

export default function ReportsPage() {
  const [category, setCategory] = useState('Students');
  const [search, setSearch] = useState('');
  const { data: reports = [], isLoading } = useQuery({ queryKey: ['reports-catalog'], queryFn: () => listReportCatalog() });

  const visibleReports = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return reports.filter((report) => {
      if (report.category !== category) return false;
      if (!normalizedSearch) return true;
      return `${report.title} ${report.description} ${report.key}`.toLowerCase().includes(normalizedSearch);
    });
  }, [category, reports, search]);

  const counts = useMemo(() => {
    return reports.reduce<Record<string, number>>((result, report) => {
      result[report.category] = (result[report.category] ?? 0) + 1;
      return result;
    }, {});
  }, [reports]);

  return (
    <main className="min-h-screen bg-slate-50 pb-10">
      <div className="mx-auto max-w-7xl pr-6">
        <PageHeader title="Reports" subtitle="Operational report catalog with JSON views and CSV/PDF exports." />

        <section className="mb-4 border-b border-slate-200">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ${
                  category === item ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-700'
                }`}
              >
                {item} {counts[item] ? <span className="ml-1 text-xs opacity-75">{counts[item]}</span> : null}
              </button>
            ))}
          </div>
        </section>

        <section className="mb-4">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search reports"
            className="w-full max-w-md rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {isLoading ? <div className="text-sm text-slate-500">Loading reports...</div> : null}
          {!isLoading && !visibleReports.length ? <div className="text-sm text-slate-500">No reports in this category.</div> : null}
          {visibleReports.map((report) => (
            <article key={report.key} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">{report.key}</p>
                  <h2 className="mt-1 text-base font-semibold text-slate-900">{report.title}</h2>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${report.available ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  {report.available ? 'Available' : 'Unavailable'}
                </span>
              </div>
              <p className="mt-2 min-h-10 text-sm leading-6 text-slate-600">{report.description}</p>
              {report.unavailableReason ? <p className="mt-2 text-xs leading-5 text-amber-700">{report.unavailableReason}</p> : null}
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-xs text-slate-500">{report.formats.length ? report.formats.join(', ').toUpperCase() : 'No exports'}</span>
                {report.available ? (
                  <Link href={`/dashboard/reports/${encodeURIComponent(report.key)}`} className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white">
                    Open
                  </Link>
                ) : (
                  <button type="button" disabled className="cursor-not-allowed rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-400">
                    Open
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
