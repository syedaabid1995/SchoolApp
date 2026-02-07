'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listConsents, type ConsentRecord } from '../../../../services/consent.service';

export default function ConsentPage() {
  const [parentId, setParentId] = useState('');
  const { data } = useQuery({
    queryKey: ['consents', parentId],
    queryFn: () => listConsents(parentId ? { parentId } : undefined),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 60_000,
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Consent Records</h1>
        <p className="text-sm text-slate">Review biometric and data processing consent status.</p>
      </header>
      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <div className="flex items-center gap-3">
          <input
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            placeholder="Filter by Parent ID"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate">
              <tr>
                <th className="py-2">Parent</th>
                <th>Type</th>
                <th>Status</th>
                <th>Version</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((record: ConsentRecord) => (
                <tr key={record.id} className="border-t border-slate/10">
                  <td className="py-3">{record.parentId}</td>
                  <td>{record.type}</td>
                  <td>{record.status}</td>
                  <td>{record.document?.version ?? 'N/A'}</td>
                </tr>
              ))}
              {!data?.length ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate">
                    No consent records found.
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
