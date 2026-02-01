'use client';

import { useMemo, use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getParent } from '../../../../services/parent.service';
import { listStudents } from '../../../../services/student.service';
import { getSession } from '../../../../services/auth.service';

export default function ParentDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const parentId = use(params).id;
  const { data: session } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const schoolId = session?.schoolId ?? undefined;

  const { data: parent } = useQuery({
    queryKey: ['parent', parentId],
    queryFn: () => getParent(parentId),
  });

  const { data: students } = useQuery({
    queryKey: ['students', schoolId],
    queryFn: () => listStudents({ schoolId }),
    enabled: Boolean(schoolId),
  });

  const linkedStudents = useMemo(() => {
    return (students ?? []).filter((student) =>
      (student.parentLinks ?? []).some((link) => link.parentId === parentId),
    );
  }, [students, parentId]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Parent Details</h1>
        <p className="text-sm text-slate">Profile and linked students.</p>
      </header>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <h2 className="text-lg font-semibold">Parent Profile</h2>
        <div className="mt-4 grid gap-3 text-sm text-slate md:grid-cols-2">
          <div>
            <p className="text-xs uppercase text-slate">Name</p>
            <p className="mt-1 text-ink">{parent ? `${parent.firstName} ${parent.lastName}` : '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate">Phone</p>
            <p className="mt-1 text-ink">{parent?.phone ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate">Email</p>
            <p className="mt-1 text-ink">{parent?.email ?? '—'}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <h2 className="text-lg font-semibold">Linked Students</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate">
              <tr>
                <th className="py-2">Name</th>
                <th>Admission No</th>
                <th>Class</th>
                <th>Section</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {linkedStudents.map((student) => (
                <tr key={student.id} className="border-t border-slate/10">
                  <td className="py-3">
                    {student.firstName} {student.lastName}
                  </td>
                  <td>{student.admissionNo}</td>
                  <td>{student.class?.name ?? '—'}</td>
                  <td>{student.section?.name ?? '—'}</td>
                  <td>{student.status}</td>
                </tr>
              ))}
              {!linkedStudents.length ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate">
                    No linked students found.
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
