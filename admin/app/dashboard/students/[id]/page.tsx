'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../../../components/PageHeader';
import FullPageLoader from '../../../../components/FullPageLoader';
import { useNotify } from '../../../../components/NotificationProvider';
import { getSession } from '../../../../services/auth.service';
import {
  addStudentDocument,
  addStudentTimeline,
  deleteStudentDocument,
  deleteStudentTimeline,
  getStudent,
  resolveUploadUrl,
  updateStudent,
  uploadStudentDocument,
} from '../../../../services/student.service';

type TabKey = 'profile' | 'fees' | 'exam' | 'documents' | 'timeline';

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'profile', label: 'Profile' },
  { key: 'fees', label: 'Fees' },
  { key: 'exam', label: 'Exam' },
  { key: 'documents', label: 'Documents' },
  { key: 'timeline', label: 'Timeline' },
];

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
};

const Icon = ({ path }: { path: string }) => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
  </svg>
);

const InfoRow = ({ label, value }: { label: string; value?: string | number | null }) => (
  <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 text-sm font-semibold text-slate-900">{value || '-'}</p>
  </div>
);

export default function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const studentId = params.id as string;
  const [tab, setTab] = useState<TabKey>('profile');
  const [editMode, setEditMode] = useState(searchParams.get('edit') === '1');
  const [editForm, setEditForm] = useState({ fullName: '', phone: '', email: '', category: '', presentAddress: '', permanentAddress: '' });
  const [documentForm, setDocumentForm] = useState({ title: '', file: null as File | null });
  const [timelineForm, setTimelineForm] = useState({ title: '', description: '', timelineDate: new Date().toISOString().slice(0, 10) });

  const { data: session, isLoading: isSessionLoading } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSchoolAdmin = session?.role === 'SCHOOL_ADMIN';

  useEffect(() => {
    if (!isSessionLoading && session?.role && !isSchoolAdmin) {
      router.replace('/dashboard');
    }
  }, [isSchoolAdmin, isSessionLoading, router, session?.role]);

  const studentQuery = useQuery({
    queryKey: ['student', studentId],
    queryFn: () => getStudent(studentId),
    enabled: Boolean(studentId) && isSchoolAdmin,
  });
  const student = studentQuery.data;
  const displayName = student ? student.fullName ?? `${student.firstName} ${student.lastName}`.trim() : '';

  useEffect(() => {
    if (!student) return;
    setEditForm({
      fullName: displayName,
      phone: student.phone ?? '',
      email: student.email ?? '',
      category: student.category ?? '',
      presentAddress: student.presentAddress ?? student.addressLine1 ?? '',
      permanentAddress: student.permanentAddress ?? student.addressLine2 ?? '',
    });
  }, [student, displayName]);

  const updateMutation = useMutation({
    mutationFn: () => updateStudent(studentId, editForm),
    onSuccess: () => {
      notify.success('Student updated', 'Profile changes were saved.');
      setEditMode(false);
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (error: any) => notify.error('Update failed', error?.response?.data?.error?.message ?? 'Unable to update student.'),
  });

  const documentMutation = useMutation({
    mutationFn: async () => {
      if (!documentForm.file) throw new Error('Select a document.');
      if (!documentForm.title.trim()) throw new Error('Document title is required.');
      const uploaded = await uploadStudentDocument(documentForm.file, studentId);
      return addStudentDocument(studentId, {
        title: documentForm.title.trim(),
        url: uploaded.url,
        fileName: uploaded.filename,
        mimeType: documentForm.file.type,
        sizeBytes: documentForm.file.size,
      });
    },
    onSuccess: () => {
      notify.success('Document uploaded', 'Student document was added.');
      setDocumentForm({ title: '', file: null });
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
    },
    onError: (error: any) => notify.error('Upload failed', error?.response?.data?.error?.message ?? error.message ?? 'Unable to upload document.'),
  });

  const timelineMutation = useMutation({
    mutationFn: () => {
      if (!timelineForm.title.trim()) throw new Error('Timeline title is required.');
      return addStudentTimeline(studentId, {
        title: timelineForm.title.trim(),
        description: timelineForm.description.trim() || null,
        timelineDate: timelineForm.timelineDate,
      });
    },
    onSuccess: () => {
      notify.success('Timeline added', 'Timeline item was saved.');
      setTimelineForm({ title: '', description: '', timelineDate: new Date().toISOString().slice(0, 10) });
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
    },
    onError: (error: any) => notify.error('Timeline failed', error?.response?.data?.error?.message ?? error.message ?? 'Unable to save timeline.'),
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: (documentId: string) => deleteStudentDocument(studentId, documentId),
    onSuccess: () => {
      notify.success('Document deleted', 'Student document was removed.');
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
    },
  });

  const deleteTimelineMutation = useMutation({
    mutationFn: (timelineId: string) => deleteStudentTimeline(studentId, timelineId),
    onSuccess: () => {
      notify.success('Timeline deleted', 'Timeline item was removed.');
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
    },
  });

  if (isSessionLoading || !session?.role || !isSchoolAdmin || studentQuery.isLoading) {
    return <FullPageLoader label="Loading student details..." />;
  }

  if (!student) {
    return (
      <div className="p-6">
        <PageHeader title="Student Not Found" breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Students', href: '/dashboard/students' }, { label: 'Not Found' }]} />
      </div>
    );
  }

  const photo = resolveUploadUrl(student.photoUrl);

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-6 lg:px-8">
        <PageHeader
          title={displayName}
          subtitle="View profile, fees, exam results, documents, and timeline."
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Students', href: '/dashboard/students' }, { label: displayName }]}
        />

        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="h-28 bg-gradient-to-r from-violet-600 to-indigo-600" />
            <div className="-mt-12 px-5 pb-5">
              <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-2xl border-4 border-white bg-violet-100 text-2xl font-bold text-violet-700 shadow">
                {photo ? <img src={photo} alt={displayName} className="h-full w-full object-cover" /> : displayName.slice(0, 2).toUpperCase()}
              </div>
              <h2 className="mt-4 text-xl font-bold text-slate-950">{displayName}</h2>
              <p className="text-sm text-slate-500">Admission: {student.admissionNo}</p>
              <div className="mt-4 space-y-2 text-sm">
                <InfoRow label="Roll number" value={student.rollNo} />
                <InfoRow label="Class" value={`${student.class?.name ?? '-'}${student.section?.name ? ` - ${student.section.name}` : ''}`} />
                <InfoRow label="Gender" value={student.gender} />
                <InfoRow label="Status" value={student.status} />
              </div>
              <div className="mt-5 flex gap-2">
                <button onClick={() => setEditMode(true)} className="flex-1 rounded-xl bg-[var(--theme-button-bg)] px-4 py-2 text-sm font-bold text-[var(--theme-button-text)]">Edit</button>
                <Link href="/dashboard/students" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700">Back</Link>
              </div>
            </div>
          </aside>

          <main className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
              <div className="flex flex-wrap gap-2">
                {tabs.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setTab(item.key)}
                    className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === item.key ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {editMode && (
              <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-950">Edit Basic Profile</h2>
                  <button onClick={() => setEditMode(false)} className="text-sm font-semibold text-slate-500">Cancel</button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <input value={editForm.fullName} onChange={(event) => setEditForm({ ...editForm, fullName: event.target.value })} placeholder="Full name" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  <input value={editForm.category} onChange={(event) => setEditForm({ ...editForm, category: event.target.value })} placeholder="Type / category" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  <input value={editForm.phone} onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })} placeholder="Phone" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  <input value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} placeholder="Email" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  <textarea value={editForm.presentAddress} onChange={(event) => setEditForm({ ...editForm, presentAddress: event.target.value })} placeholder="Present address" className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2" />
                  <textarea value={editForm.permanentAddress} onChange={(event) => setEditForm({ ...editForm, permanentAddress: event.target.value })} placeholder="Permanent address" className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2" />
                </div>
                <button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} className="mt-4 rounded-xl bg-violet-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">
                  {updateMutation.isPending ? 'Saving...' : 'Save changes'}
                </button>
              </section>
            )}

            {tab === 'profile' && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-slate-950">Profile</h2>
                <div className="grid gap-4 md:grid-cols-3">
                  <InfoRow label="Admission date" value={formatDate(student.admissionDate)} />
                  <InfoRow label="Date of birth" value={formatDate(student.dob)} />
                  <InfoRow label="Type" value={student.category ?? 'Regular'} />
                  <InfoRow label="Religion" value={student.religion} />
                  <InfoRow label="Phone number" value={student.phone ?? student.parentPhone} />
                  <InfoRow label="Email address" value={student.email ?? student.parentEmail} />
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <InfoRow label="Present address" value={student.presentAddress ?? student.addressLine1} />
                  <InfoRow label="Permanent address" value={student.permanentAddress ?? student.addressLine2} />
                </div>
                <h3 className="mt-6 text-base font-bold text-slate-950">Sibling Information</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {student.siblings?.length ? student.siblings.map((item) => (
                    <div key={item.sibling.id} className="rounded-xl border border-slate-100 p-3">
                      <p className="font-semibold text-slate-900">{item.sibling.fullName}</p>
                      <p className="text-sm text-slate-500">{item.sibling.class?.name ?? '-'} {item.sibling.section?.name ?? ''}</p>
                    </div>
                  )) : <p className="text-sm text-slate-500">No sibling linked.</p>}
                </div>
              </section>
            )}

            {tab === 'fees' && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-slate-950">Fees</h2>
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                  Fee groups, payments, discounts, fines, paid amount, balance, and grand total will appear here when the fees module is connected.
                </div>
              </section>
            )}

            {tab === 'exam' && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-slate-950">Exam</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr><th className="px-3 py-2">Exam</th><th className="px-3 py-2">Subject</th><th className="px-3 py-2">Marks</th><th className="px-3 py-2">Grade</th><th className="px-3 py-2">Status</th></tr>
                    </thead>
                    <tbody>
                      {student.marks?.length ? student.marks.map((mark) => (
                        <tr key={mark.id} className="border-b border-slate-100">
                          <td className="px-3 py-2">{mark.examPaper?.exam?.name ?? '-'}</td>
                          <td className="px-3 py-2">{mark.examPaper?.subject?.name ?? '-'}</td>
                          <td className="px-3 py-2">{mark.marks} / {mark.examPaper?.maxMarks ?? '-'}</td>
                          <td className="px-3 py-2">{mark.grade ?? '-'}</td>
                          <td className="px-3 py-2">{mark.status ?? '-'}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">No exam results found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {tab === 'documents' && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-slate-950">Documents</h2>
                <div className="mb-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                  <input value={documentForm.title} onChange={(event) => setDocumentForm({ ...documentForm, title: event.target.value })} placeholder="Document title" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  <input type="file" accept=".pdf,.doc,.docx,image/*" onChange={(event) => setDocumentForm({ ...documentForm, file: event.target.files?.[0] ?? null })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  <button onClick={() => documentMutation.mutate()} disabled={documentMutation.isPending} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Upload</button>
                </div>
                <div className="grid gap-3">
                  {student.documents?.length ? student.documents.map((document) => (
                    <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3">
                      <div>
                        <p className="font-semibold text-slate-900">{document.title}</p>
                        <p className="text-xs text-slate-500">{formatDate(document.createdAt)}</p>
                      </div>
                      <div className="flex gap-2">
                        <a href={resolveUploadUrl(document.url) ?? undefined} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">Download</a>
                        <button onClick={() => window.confirm('Delete this document?') && deleteDocumentMutation.mutate(document.id)} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600">Delete</button>
                      </div>
                    </div>
                  )) : <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">No documents uploaded.</p>}
                </div>
              </section>
            )}

            {tab === 'timeline' && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-slate-950">Timeline</h2>
                <div className="mb-5 grid gap-3 md:grid-cols-[1fr_160px_auto]">
                  <input value={timelineForm.title} onChange={(event) => setTimelineForm({ ...timelineForm, title: event.target.value })} placeholder="Title" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  <input type="date" value={timelineForm.timelineDate} onChange={(event) => setTimelineForm({ ...timelineForm, timelineDate: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  <button onClick={() => timelineMutation.mutate()} disabled={timelineMutation.isPending} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Add</button>
                  <textarea value={timelineForm.description} onChange={(event) => setTimelineForm({ ...timelineForm, description: event.target.value })} placeholder="Description" className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-3" />
                </div>
                <div className="space-y-3">
                  {student.timelines?.length ? student.timelines.map((item) => (
                    <div key={item.id} className="rounded-xl border border-slate-100 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-bold text-slate-950">{item.title}</p>
                          <p className="text-xs font-semibold uppercase text-violet-600">{formatDate(item.timelineDate)}</p>
                          <p className="mt-2 text-sm text-slate-600">{item.description || '-'}</p>
                        </div>
                        <button onClick={() => window.confirm('Delete this timeline item?') && deleteTimelineMutation.mutate(item.id)} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600">
                          <Icon path="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6" />
                        </button>
                      </div>
                    </div>
                  )) : <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">No timeline items found.</p>}
                </div>
              </section>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
