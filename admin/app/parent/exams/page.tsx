'use client';

import { useContext, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listParentExams } from '../../../services/parentPortal.service';
import { ParentChildContext } from '../../../components/ParentPortalLayout';

export default function ParentExamsPage() {
  const [academicYearId, setAcademicYearId] = useState('');
  const { activeChildId, children } = useContext(ParentChildContext);
  const activeChild = useMemo(() => children?.find((child) => child.id === activeChildId), [children, activeChildId]);

  const { data: exams } = useQuery({
    queryKey: ['parent-exams', activeChild?.id, academicYearId],
    queryFn: () => listParentExams(activeChild?.id, academicYearId || undefined),
    enabled: Boolean(activeChild?.id),
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Exams & Results</h1>
        <p className="text-sm text-slate">View published exams and results.</p>
      </header>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={academicYearId}
            onChange={(e) => setAcademicYearId(e.target.value)}
            placeholder="Academic Year ID"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate">
              <tr>
                <th className="py-2">Exam</th>
                <th>Status</th>
                <th>Result</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {(exams ?? []).map((exam: any) => (
                <tr key={exam.id} className="border-t border-slate/10">
                  <td className="py-3">{exam.name}</td>
                  <td>{exam.status}</td>
                  <td>{exam.resultStatus ?? '—'}</td>
                  <td className="text-right">
                    <button className="rounded-lg border border-slate/20 px-3 py-1 text-xs font-semibold">
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {!exams?.length ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate">
                    No exams found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
