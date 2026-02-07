'use client';

import { useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listParentNotices } from '../../../services/parentPortal.service';
import { ParentChildContext } from '../../../components/ParentPortalLayout';

export default function ParentNoticesPage() {
  const { activeChildId, children } = useContext(ParentChildContext);
  const activeChild = useMemo(() => children?.find((child) => child.id === activeChildId), [children, activeChildId]);

  const { data: notices } = useQuery({
    queryKey: ['parent-notices', activeChild?.id],
    queryFn: () => listParentNotices(activeChild?.id),
    enabled: Boolean(activeChild?.id),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 5 * 60_000,
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Notices</h1>
        <p className="text-sm text-slate">School announcements and circulars.</p>
      </header>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <div className="space-y-3 text-sm">
          {(notices ?? []).map((notice: any) => (
            <div key={notice.id} className="rounded-lg border border-slate/10 px-4 py-3">
              <p className="font-semibold text-ink">{notice.title}</p>
              <p className="text-xs text-slate">{notice.date}</p>
              <p className="mt-2 text-sm text-slate">{notice.summary || '—'}</p>
            </div>
          ))}
          {!notices?.length ? <p className="text-sm text-slate">No notices available.</p> : null}
        </div>
      </section>
    </div>
  );
}
