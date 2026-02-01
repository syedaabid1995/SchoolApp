'use client';

import { useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listParentFees } from '../../../services/parentPortal.service';
import { ParentChildContext } from '../../../components/ParentPortalLayout';

export default function ParentFeesPage() {
  const { activeChildId, children } = useContext(ParentChildContext);
  const activeChild = useMemo(() => children?.find((child) => child.id === activeChildId), [children, activeChildId]);

  const { data: fees } = useQuery({
    queryKey: ['parent-fees', activeChild?.id],
    queryFn: () => listParentFees(activeChild?.id),
    enabled: Boolean(activeChild?.id),
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Fee Structure</h1>
        <p className="text-sm text-slate">View-only fee breakdown for the selected child.</p>
      </header>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate">
              <tr>
                <th className="py-2">Fee Head</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Due Date</th>
              </tr>
            </thead>
            <tbody>
              {(fees ?? []).map((fee: any) => (
                <tr key={fee.id} className="border-t border-slate/10">
                  <td className="py-3">{fee.title}</td>
                  <td>{fee.amount}</td>
                  <td>{fee.status}</td>
                  <td>{fee.dueDate || '—'}</td>
                </tr>
              ))}
              {!fees?.length ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate">
                    No fee records available.
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
