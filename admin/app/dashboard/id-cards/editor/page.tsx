'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getSession } from '../../../../services/auth.service';
import { getStudent, resolveUploadUrl } from '../../../../services/student.service';
import { getTeacher } from '../../../../services/teacher.service';
import IdCardEditor from '../../../../id_cards/IdCardEditor';
import type { IdCardRecord, IdCardTemplate } from '../../../../id_cards/types';

async function listTemplates() {
  const res = await fetch('/api/id-cards/templates');
  if (!res.ok) throw new Error('Failed to load templates');
  return (await res.json()) as IdCardTemplate[];
}

export default function IdCardEditorPage() {
  const searchParams = useSearchParams();
  const entity = searchParams.get('entity') === 'employee' ? 'employee' : 'student';
  const recordId = searchParams.get('id') ?? '';
  const templateSlug = searchParams.get('template') ?? '';

  const { data: session } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const schoolId = session?.schoolId ?? undefined;

  const { data: templates = [] } = useQuery({
    queryKey: ['id-card-templates'],
    queryFn: listTemplates,
  });

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
  
  const [currentTemplate, setCurrentTemplate] = useState<IdCardTemplate | null>(null);
  
  useMemo(() => {
    if (selectedTemplate && !currentTemplate) {
      setCurrentTemplate(selectedTemplate);
    }
  }, [selectedTemplate, currentTemplate]);

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

  if (!selectedRecord || !currentTemplate) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/id-cards" className="text-blue-600 hover:text-blue-800 font-medium">
            ← Back to ID Cards
          </Link>
        </div>
        
        <div className="rounded-xl border border-dashed border-slate-300 px-6 py-16 text-center">
          <p className="text-slate-600">Loading editor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/id-cards" className="text-blue-600 hover:text-blue-800 font-medium">
            ← Back to ID Cards
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">ID Card Editor</h1>
            <p className="text-slate-600">
              Editing {entity === 'student' ? 'Student' : 'Employee'}: {selectedRecord.name}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            Print
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <IdCardEditor
          template={currentTemplate}
          record={selectedRecord}
          photoUrl={photoUrl}
          onTemplateChange={setCurrentTemplate}
        />
      </div>
    </div>
  );
}