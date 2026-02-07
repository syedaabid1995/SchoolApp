'use client';

import { useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listParentSubjects } from '../../../services/parentPortal.service';
import { ParentChildContext } from '../../../components/ParentPortalLayout';

export default function ParentSubjectsPage() {
  const { activeChildId, children } = useContext(ParentChildContext);
  const activeChild = useMemo(() => children?.find((child) => child.id === activeChildId), [children, activeChildId]);

  const { data: subjects } = useQuery({
    queryKey: ['parent-subjects', activeChild?.id],
    queryFn: () => listParentSubjects(activeChild?.id),
    enabled: Boolean(activeChild?.id),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 5 * 60_000,
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Subjects</h1>
        <p className="text-sm text-slate">View subject list for the selected child.</p>
      </header>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <div className="grid gap-3 md:grid-cols-2">
          {(subjects ?? []).map((subject: any) => (
            <div key={subject.id} className="rounded-lg border border-slate/10 px-4 py-3 text-sm">
              <p className="font-semibold text-ink">{subject.name}</p>
              <p className="text-xs text-slate">{subject.teacherName || '—'}</p>
            </div>
          ))}
          {!subjects?.length ? <p className="text-sm text-slate">No subjects found.</p> : null}
        </div>
      </section>
    </div>
  );
}
