'use client';

import { useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listParentFees } from '../../../services/parentPortal.service';
import { ParentChildContext } from '../../../components/ParentPortalLayout';

const money = (value?: string | number | null) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value ?? 0));

export default function ParentFeesPage() {
  const { activeChildId, children } = useContext(ParentChildContext);
  const activeChild = useMemo(() => children?.find((child) => child.id === activeChildId), [children, activeChildId]);

  const { data: fees } = useQuery({
    queryKey: ['parent-fees', activeChild?.id],
    queryFn: () => listParentFees(activeChild?.id),
    enabled: Boolean(activeChild?.id),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 5 * 60_000,
  });

  const items = fees?.items ?? [];
  const summary = fees?.summary ?? { total: 0, paid: 0, due: 0 };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Fee Statement</h1>
        <p className="text-sm text-slate">Invoice, payment, and outstanding fee summary for the selected child.</p>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate/10 bg-white p-5">
          <p className="text-xs font-bold uppercase text-slate">Total Invoiced</p>
          <p className="mt-2 text-2xl font-black text-ink">{money(summary.total)}</p>
        </div>
        <div className="rounded-2xl border border-slate/10 bg-white p-5">
          <p className="text-xs font-bold uppercase text-slate">Paid</p>
          <p className="mt-2 text-2xl font-black text-emerald-700">{money(summary.paid)}</p>
        </div>
        <div className="rounded-2xl border border-slate/10 bg-white p-5">
          <p className="text-xs font-bold uppercase text-slate">Outstanding</p>
          <p className="mt-2 text-2xl font-black text-red-700">{money(summary.due)}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate">
              <tr>
                <th className="py-2">Invoice</th>
                <th>Fee Head</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Due</th>
                <th>Status</th>
                <th>Due Date</th>
              </tr>
            </thead>
            <tbody>
              {items.map((fee: any) => (
                <tr key={fee.id} className="border-t border-slate/10">
                  <td className="py-3 font-semibold text-ink">{fee.invoiceNumber}</td>
                  <td>{fee.title}</td>
                  <td>{money(fee.amount)}</td>
                  <td>{money(fee.paidAmount)}</td>
                  <td className="font-semibold text-ink">{money(fee.dueAmount)}</td>
                  <td>{String(fee.status ?? '').replace(/_/g, ' ')}</td>
                  <td>{fee.dueDate ? new Date(fee.dueDate).toLocaleDateString() : '-'}</td>
                </tr>
              ))}
              {!items.length ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate">
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
