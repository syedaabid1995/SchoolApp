'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listAuditLogs } from '../../../services/audit.service';

export default function AuditPage() {
  const [filters, setFilters] = useState({
    entityType: '',
    actorRole: '',
    action: '',
    page: 1,
  });

  const { data } = useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () =>
      listAuditLogs({
        entityType: filters.entityType || undefined,
        actorRole: filters.actorRole || undefined,
        action: filters.action || undefined,
        page: filters.page,
      }),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Audit Logs</h1>
        <p className="text-sm text-slate">Filter immutable logs by entity, action, or date.</p>
      </header>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <div className="grid gap-3 md:grid-cols-3">
          <input
            value={filters.entityType}
            onChange={(e) => setFilters({ ...filters, entityType: e.target.value, page: 1 })}
            placeholder="Entity type"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
          <input
            value={filters.actorRole}
            onChange={(e) => setFilters({ ...filters, actorRole: e.target.value, page: 1 })}
            placeholder="Actor role"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
          <input
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value, page: 1 })}
            placeholder="Action"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate">
              <tr>
                <th className="py-2">Time</th>
                <th>Actor</th>
                <th>Entity</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((log) => (
                <tr key={log.id} className="border-t border-slate/10">
                  <td className="py-3">{new Date(log.createdAt).toLocaleString()}</td>
                  <td>{log.actorRole}</td>
                  <td>{log.entityType}</td>
                  <td>{log.action}</td>
                </tr>
              ))}
              {!data?.items.length ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate">
                    No logs found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-between text-sm">
          <button
            className="rounded-lg border border-slate/20 px-3 py-1"
            onClick={() => setFilters({ ...filters, page: Math.max(1, filters.page - 1) })}
            disabled={filters.page <= 1}
          >
            Previous
          </button>
          <span>
            Page {data?.page ?? filters.page} of {data?.pages ?? 1}
          </span>
          <button
            className="rounded-lg border border-slate/20 px-3 py-1"
            onClick={() => setFilters({ ...filters, page: (data?.page ?? 1) + 1 })}
            disabled={(data?.page ?? 1) >= (data?.pages ?? 1)}
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
}
