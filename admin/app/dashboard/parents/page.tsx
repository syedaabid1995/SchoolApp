'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { listParents } from '../../../services/parent.service';
import { getSession } from '../../../services/auth.service';

export default function ParentsPage() {
  const [query, setQuery] = useState('');
  
  const { data: session } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const schoolId = session?.schoolId ?? undefined;

  const { data: parents, isLoading } = useQuery({
    queryKey: ['parents', schoolId, query],
    queryFn: () => listParents({ schoolId, query }),
    enabled: Boolean(schoolId),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Parents</h1>
        <p className="text-sm text-slate">Manage parent accounts and their linked students.</p>
      </header>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Parent Directory</h2>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search parents"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
        </div>
        
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate">
              <tr>
                <th className="py-2">Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Students</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate">
                    Loading...
                  </td>
                </tr>
              ) : !parents?.length ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate">
                    No parents found.
                  </td>
                </tr>
              ) : (
                parents.map((parent: any) => (
                  <tr key={parent.id} className="border-t border-slate/10">
                    <td className="py-3">
                      {parent.firstName} {parent.lastName}
                    </td>
                    <td>{parent.phone || '—'}</td>
                    <td>{parent.email || '—'}</td>
                    <td>{parent.students?.length || 0}</td>
                    <td className="text-right">
                      <Link
                        href={`/dashboard/parents/${parent.id}`}
                        className="rounded-lg border border-slate/20 px-3 py-1 text-xs hover:bg-slate/5"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}