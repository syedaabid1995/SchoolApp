'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getSession } from '../../../services/auth.service';
import { listStudents, getStudent, resolveUploadUrl } from '../../../services/student.service';
import { listTeachers, getTeacher } from '../../../services/teacher.service';
import IdCardPreview from '../../../id_cards/IdCardPreview';
import type { IdCardRecord, IdCardTemplate } from '../../../id_cards/types';
import PageHeader from '../../../components/PageHeader';

async function listTemplates() {
  const res = await fetch('/api/id-cards/templates');
  if (!res.ok) throw new Error('Failed to load templates');
  return (await res.json()) as IdCardTemplate[];
}

export default function IdCardsPage() {
  const searchParams = useSearchParams();
  const initialEntity = searchParams.get('entity') === 'employee' ? 'employee' : 'student';
  const initialId = searchParams.get('id') ?? '';

  const [entity, setEntity] = useState<'student' | 'employee'>(initialEntity);
  const [recordId, setRecordId] = useState(initialId);
  const [templateSlug, setTemplateSlug] = useState('');

  const { data: session } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const schoolId = session?.schoolId ?? undefined;

  const { data: templates = [] } = useQuery({
    queryKey: ['id-card-templates'],
    queryFn: listTemplates,
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students', schoolId],
    queryFn: () => listStudents({ schoolId }),
    enabled: entity === 'student' && Boolean(schoolId),
  });

  const { data: teachersResp } = useQuery({
    queryKey: ['teachers', schoolId],
    queryFn: () => listTeachers({ schoolId, limit: 200 }),
    enabled: entity === 'employee' && Boolean(schoolId),
  });

  const teachers = teachersResp?.items ?? [];

  const { data: selectedStudent } = useQuery({
    queryKey: ['student', recordId, schoolId],
    queryFn: () => getStudent(recordId, { schoolId }),
    enabled: entity === 'student' && Boolean(recordId),
  });

  const { data: selectedTeacher } = useQuery({
    queryKey: ['teacher', recordId, schoolId],
    queryFn: () => getTeacher(recordId, { schoolId }),
    enabled: entity === 'employee' && Boolean(recordId),
  });

  const selectedTemplate = useMemo(() => templates.find((item) => item.slug === templateSlug) ?? templates[0], [templateSlug, templates]);

  const selectedRecord: IdCardRecord | null = useMemo(() => {
    if (entity === 'student' && selectedStudent) {
      return {
        id: selectedStudent.id,
        name: selectedStudent.fullName || `${selectedStudent.firstName} ${selectedStudent.lastName}`.trim(),
        role: 'Student',
        schoolName: session?.schoolName ?? undefined,
        admissionNo: selectedStudent.admissionNo,
        phone: selectedStudent.parentPhone,
        email: selectedStudent.parentEmail,
        address: [selectedStudent.addressLine1, selectedStudent.city, selectedStudent.state]
          .filter(Boolean)
          .join(', '),
        bloodGroup: selectedStudent.bloodGroup,
        dob: selectedStudent.dob,
        photoUrl: selectedStudent.photoUrl,
      };
    }

    if (entity === 'employee' && selectedTeacher) {
      return {
        id: selectedTeacher.id,
        name: `${selectedTeacher.firstName} ${selectedTeacher.lastName}`.trim(),
        role: selectedTeacher.user?.status === 'ACTIVE' ? 'Teacher' : 'Employee',
        schoolName: session?.schoolName ?? undefined,
        employeeNo: selectedTeacher.employeeNo,
        phone: selectedTeacher.phone,
        email: selectedTeacher.user.email,
        address: selectedTeacher.address,
        photoUrl: null,
      };
    }

    return null;
  }, [entity, selectedStudent, selectedTeacher, session?.schoolName]);

  const photoUrl = resolveUploadUrl(selectedRecord?.photoUrl ?? null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/30 to-purple-50/40">
      <div className="mx-auto max-w-7xl pr-6 pb-12">
        <PageHeader
          title="ID Cards"
          subtitle="Generate and print professional ID cards for students and employees with customizable templates."
        />
        <div className="space-y-6">
      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate/70">Entity Type</p>
            <select
              value={entity}
              onChange={(event) => {
                const next = event.target.value === 'employee' ? 'employee' : 'student';
                setEntity(next);
                setRecordId('');
              }}
              className="mt-1 rounded-lg border border-slate/20 px-3 py-2 text-sm"
            >
              <option value="student">Student</option>
              <option value="employee">Employee</option>
            </select>
          </div>

          <div className="min-w-72 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate/70">Select {entity === 'student' ? 'Student' : 'Employee'}</p>
            <select
              value={recordId}
              onChange={(event) => setRecordId(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
            >
              <option value="">Choose...</option>
              {entity === 'student'
                ? students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.firstName} {student.lastName} ({student.admissionNo})
                    </option>
                  ))
                : teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.firstName} {teacher.lastName} ({teacher.employeeNo || teacher.user.email})
                    </option>
                  ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!selectedRecord || !selectedTemplate}
              className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Print
            </button>
            
            <Link
              href={`/dashboard/id-cards/editor?entity=${entity}&id=${recordId}&template=${templateSlug}`}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                !selectedRecord || !selectedTemplate
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              Custom Edit
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <h2 className="text-base font-semibold text-ink">Template Library (Dynamic)</h2>
        <p className="mt-1 text-sm text-slate/70">Add a new template JSON under `admin/id_cards/templates` and it appears here automatically.</p>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => (
            <button
              key={template.slug}
              onClick={() => setTemplateSlug(template.slug)}
              className={`rounded-xl border p-3 text-left transition ${
                selectedTemplate?.slug === template.slug ? 'border-ink bg-sand/40 shadow-sm' : 'border-slate/20 hover:border-slate/40'
              }`}
            >
              <p className="font-semibold text-ink">{template.name}</p>
              <p className="mt-1 text-xs text-slate/70">{template.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-ink">Preview</h3>
          {entity === 'student' && recordId ? <Link href={`/dashboard/students/${recordId}`} className="text-xs font-semibold text-brand">Open Student</Link> : null}
          {entity === 'employee' && recordId ? <Link href={`/dashboard/teachers/${recordId}`} className="text-xs font-semibold text-brand">Open Employee</Link> : null}
        </div>

        {!selectedRecord || !selectedTemplate ? (
          <div className="rounded-xl border border-dashed border-slate/30 px-6 py-16 text-center text-sm text-slate/60">
            Select an entity and template to preview printable ID card.
          </div>
        ) : (
          <div className="print-area flex justify-center">
            <IdCardPreview template={selectedTemplate} record={selectedRecord} photoUrl={photoUrl} />
          </div>
        )}
      </section>
        </div>
      </div>
    </div>
  );
}
