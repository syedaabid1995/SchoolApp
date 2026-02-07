'use client';

import { useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listParentTimetable } from '../../../services/parentPortal.service';
import { ParentChildContext } from '../../../components/ParentPortalLayout';

export default function ParentTimetablePage() {
  const { activeChildId, children } = useContext(ParentChildContext);
  const activeChild = useMemo(() => children?.find((child) => child.id === activeChildId), [children, activeChildId]);

  const { data: timetable } = useQuery({
    queryKey: ['parent-timetable', activeChild?.id],
    queryFn: () => listParentTimetable(activeChild?.id),
    enabled: Boolean(activeChild?.id),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 5 * 60_000,
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Timetable</h1>
        <p className="text-sm text-slate">Weekly schedule (view only).</p>
      </header>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <div className="space-y-3 text-sm">
          {(timetable ?? []).map((entry: any) => (
            <div key={entry.id} className="rounded-lg border border-slate/10 px-4 py-3">
              <p className="font-semibold text-ink">{entry.day}</p>
              <p className="text-xs text-slate">{entry.period} • {entry.subject}</p>
            </div>
          ))}
          {!timetable?.length ? <p className="text-sm text-slate">No timetable entries found.</p> : null}
        </div>
      </section>
    </div>
  );
}
