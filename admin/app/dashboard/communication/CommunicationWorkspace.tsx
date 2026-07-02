'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../../components/PageHeader';
import { useNotify } from '../../../components/NotificationProvider';
import { PermissionCodes as P } from '../../../config/permission-manifest';
import { listClasses, listSections } from '../../../services/academic.service';
import {
  createCommunicationNotice,
  createCommunicationTemplate,
  deleteCommunicationNotice,
  deleteCommunicationTemplate,
  listCommunicationLogs,
  listCommunicationNotices,
  listCommunicationScheduledLogs,
  listCommunicationTemplates,
  sendCommunicationEmail,
  sendCommunicationSms,
  sendLoginCredentialInstructions,
  updateCommunicationNotice,
  updateCommunicationTemplate,
  type CommunicationChannel,
  type CommunicationLog,
  type CommunicationNotice,
  type CommunicationTargetMode,
  type CommunicationTemplate,
  type RecipientGroup,
} from '../../../services/communication.service';
import { getSession } from '../../../services/auth.service';
import { listSchools } from '../../../services/school.service';

type CommunicationView =
  | 'notice-board'
  | 'send-email'
  | 'send-sms'
  | 'logs'
  | 'scheduled-logs'
  | 'login-credentials'
  | 'email-templates'
  | 'sms-templates';

type AcademicOption = { id: string; name: string };

const recipientOptions: Array<{ id: RecipientGroup; label: string }> = [
  { id: 'STUDENTS', label: 'Students' },
  { id: 'GUARDIANS', label: 'Guardians' },
  { id: 'ADMIN', label: 'Admin' },
  { id: 'TEACHER', label: 'Teacher' },
  { id: 'ACCOUNTANT', label: 'Accountant' },
  { id: 'LIBRARIAN', label: 'Librarian' },
  { id: 'RECEPTIONIST', label: 'Receptionist' },
  { id: 'STAFF', label: 'Staff' },
];

const audienceOptions = ['Students', 'Guardians', 'Admin', 'Teachers', 'Accountants', 'Librarians', 'Staff'];

const targetTabs: Array<{ id: CommunicationTargetMode; label: string }> = [
  { id: 'GROUP', label: 'Group' },
  { id: 'INDIVIDUAL', label: 'Individual' },
  { id: 'CLASS', label: 'Class' },
  { id: 'BIRTHDAY', label: "Today's Birthday" },
];

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-400';
const compactButtonClass =
  'inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';
const primaryButtonClass =
  'inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50';
const dangerButtonClass =
  'inline-flex items-center justify-center rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50';

const todayInput = () => new Date().toISOString().slice(0, 10);
const nowLocalInput = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};
const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '-';
const errorMessage = (error: unknown, fallback = 'Something went wrong') =>
  (error as any)?.response?.data?.error?.message ||
  (error as any)?.response?.data?.message ||
  (error instanceof Error ? error.message : fallback);

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function RichHtmlEditor({
  value,
  onChange,
  minHeightClass = 'min-h-80',
}: {
  value: string;
  onChange: (value: string) => void;
  minHeightClass?: string;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<'visual' | 'html' | 'preview'>('visual');

  useEffect(() => {
    if (!editorRef.current || mode !== 'visual') return;
    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [mode, value]);

  const runCommand = (command: string, commandValue?: string) => {
    if (mode !== 'visual') setMode('visual');
    requestAnimationFrame(() => {
      editorRef.current?.focus();
      document.execCommand(command, false, commandValue);
      onChange(editorRef.current?.innerHTML ?? '');
    });
  };

  const uploadImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result ?? '');
      if (!src) return;
      const imageHtml = `<img src="${src}" alt="${file.name.replace(/"/g, '&quot;')}" style="max-width:100%;height:auto;" />`;
      if (mode === 'html') {
        onChange(`${value}${imageHtml}`);
        return;
      }
      runCommand('insertHTML', imageHtml);
    };
    reader.readAsDataURL(file);
  };

  const downloadHtml = () => {
    const documentHtml = /<html[\s>]/i.test(value)
      ? value
      : `<!doctype html><html><head><meta charset="utf-8"><title>Email campaign</title></head><body>${value}</body></html>`;
    const url = URL.createObjectURL(new Blob([documentHtml], { type: 'text/html;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'email-campaign.html';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 p-2">
        <button type="button" className={compactButtonClass} onClick={() => runCommand('bold')} title="Bold">
          B
        </button>
        <button type="button" className={compactButtonClass} onClick={() => runCommand('italic')} title="Italic">
          I
        </button>
        <button type="button" className={compactButtonClass} onClick={() => runCommand('underline')} title="Underline">
          U
        </button>
        <button type="button" className={compactButtonClass} onClick={() => runCommand('insertUnorderedList')} title="Bullet list">
          List
        </button>
        <button type="button" className={compactButtonClass} onClick={() => runCommand('formatBlock', 'h2')} title="Heading">
          H2
        </button>
        <button type="button" className={compactButtonClass} onClick={() => runCommand('createLink', window.prompt('URL') || '')} title="Link">
          Link
        </button>
        <button type="button" className={compactButtonClass} onClick={() => fileInputRef.current?.click()} title="Insert image">
          Image
        </button>
        <button type="button" className={compactButtonClass} onClick={downloadHtml} title="Download HTML">
          Download HTML
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) uploadImage(file);
          }}
        />
        <div className="ml-auto flex rounded-lg border border-slate-200 bg-white p-1">
          {(['visual', 'html', 'preview'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              className={`rounded-md px-3 py-1.5 text-xs font-bold capitalize ${
                mode === item ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {item === 'html' ? 'HTML' : item}
            </button>
          ))}
        </div>
      </div>

      {mode === 'html' ? (
        <textarea
          className={`w-full ${minHeightClass} resize-y border-0 bg-white p-4 font-mono text-sm text-slate-900 outline-none`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
        />
      ) : mode === 'preview' ? (
        <iframe
          title="Email HTML preview"
          className={`w-full ${minHeightClass} bg-white`}
          sandbox=""
          srcDoc={value || '<p></p>'}
        />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          className={`prose max-w-none ${minHeightClass} overflow-auto p-4 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-100`}
          onInput={(event) => onChange(event.currentTarget.innerHTML)}
          onBlur={(event) => onChange(event.currentTarget.innerHTML)}
          suppressContentEditableWarning
        />
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'SENT' || status === 'PUBLISHED'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
      : status === 'FAILED' || status === 'ARCHIVED'
        ? 'bg-red-50 text-red-700 ring-red-200'
        : 'bg-amber-50 text-amber-700 ring-amber-200';
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${tone}`}>{status}</span>;
}

function SchoolScopeSelect({
  isSuperAdmin,
  selectedSchoolId,
  setSelectedSchoolId,
}: {
  isSuperAdmin: boolean;
  selectedSchoolId: string;
  setSelectedSchoolId: (value: string) => void;
}) {
  const schoolsQuery = useQuery({
    queryKey: ['schools', 'communication'],
    queryFn: () => listSchools({ limit: 100, status: 'ACTIVE' }),
    enabled: isSuperAdmin,
  });

  useEffect(() => {
    if (isSuperAdmin && !selectedSchoolId && schoolsQuery.data?.items?.length) {
      setSelectedSchoolId(schoolsQuery.data.items[0].id);
    }
  }, [isSuperAdmin, schoolsQuery.data?.items, selectedSchoolId, setSelectedSchoolId]);

  if (!isSuperAdmin) return null;
  return (
    <select className={inputClass} value={selectedSchoolId} onChange={(event) => setSelectedSchoolId(event.target.value)}>
      <option value="">Select school</option>
      {(schoolsQuery.data?.items ?? []).map((school) => (
        <option key={school.id} value={school.id}>
          {school.name}
        </option>
      ))}
    </select>
  );
}

function NoticeBoard({
  effectiveSchoolId,
  can,
}: {
  effectiveSchoolId: string;
  can: (code: string) => boolean;
}) {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    id: '',
    title: '',
    message: '',
    audience: ['Students', 'Guardians'],
    status: 'PUBLISHED',
    publishedAt: todayInput(),
    expiresAt: '',
  });

  const noticesQuery = useQuery({
    queryKey: ['communication-notices', effectiveSchoolId],
    queryFn: () => listCommunicationNotices(effectiveSchoolId),
    enabled: Boolean(effectiveSchoolId),
  });

  const resetForm = () =>
    setForm({ id: '', title: '', message: '', audience: ['Students', 'Guardians'], status: 'PUBLISHED', publishedAt: todayInput(), expiresAt: '' });

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        schoolId: effectiveSchoolId,
        title: form.title,
        message: form.message,
        audience: form.audience,
        status: form.status,
        publishedAt: form.publishedAt,
        expiresAt: form.expiresAt || null,
      };
      return form.id ? updateCommunicationNotice(form.id, payload) : createCommunicationNotice(payload);
    },
    onSuccess: async () => {
      notify.success(form.id ? 'Notice updated' : 'Notice published');
      resetForm();
      await queryClient.invalidateQueries({ queryKey: ['communication-notices', effectiveSchoolId] });
    },
    onError: (error) => notify.error('Unable to save notice', errorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (noticeId: string) => deleteCommunicationNotice(noticeId, effectiveSchoolId),
    onSuccess: async () => {
      notify.success('Notice deleted');
      await queryClient.invalidateQueries({ queryKey: ['communication-notices', effectiveSchoolId] });
    },
    onError: (error) => notify.error('Unable to delete notice', errorMessage(error)),
  });

  const canCreate = can(P.communicationNoticeBoardCreate);
  const canEdit = can(P.communicationNoticeBoardEdit);
  const canDelete = can(P.communicationNoticeBoardDelete);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-950">{form.id ? 'Edit Notice' : 'Create Notice'}</h2>
        <div className="mt-4 space-y-4">
          <Field label="Title">
            <input className={inputClass} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
          </Field>
          <Field label="Message">
            <textarea
              className={`${inputClass} min-h-40 resize-y`}
              value={form.message}
              onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Status">
              <select className={inputClass} value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                <option value="PUBLISHED">Published</option>
                <option value="DRAFT">Draft</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </Field>
            <Field label="Publish Date">
              <input className={inputClass} type="date" value={form.publishedAt} onChange={(event) => setForm((current) => ({ ...current, publishedAt: event.target.value }))} />
            </Field>
          </div>
          <Field label="Expires On">
            <input className={inputClass} type="date" value={form.expiresAt} onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))} />
          </Field>
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Audience</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {audienceOptions.map((audience) => (
                <label key={audience} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.audience.includes(audience)}
                    onChange={(event) => {
                      setForm((current) => ({
                        ...current,
                        audience: event.target.checked
                          ? Array.from(new Set([...current.audience, audience]))
                          : current.audience.filter((item) => item !== audience),
                      }));
                    }}
                  />
                  {audience}
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={primaryButtonClass}
              disabled={saveMutation.isPending || (!form.id && !canCreate) || Boolean(form.id && !canEdit)}
              onClick={() => saveMutation.mutate()}
            >
              {form.id ? 'Update Notice' : 'Publish Notice'}
            </button>
            {form.id ? (
              <button type="button" className={compactButtonClass} onClick={resetForm}>
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-950">Notice Board</h2>
        <div className="mt-4 space-y-3">
          {noticesQuery.isLoading ? (
            <EmptyState message="Loading notices..." />
          ) : noticesQuery.data?.length ? (
            noticesQuery.data.map((notice: CommunicationNotice) => (
              <div key={notice.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-slate-950">{notice.title}</h3>
                      <StatusBadge status={notice.status} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Published {formatDateTime(notice.publishedAt)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={compactButtonClass}
                      disabled={!canEdit}
                      onClick={() =>
                        setForm({
                          id: notice.id,
                          title: notice.title,
                          message: notice.message,
                          audience: notice.audience,
                          status: notice.status,
                          publishedAt: notice.publishedAt.slice(0, 10),
                          expiresAt: notice.expiresAt?.slice(0, 10) ?? '',
                        })
                      }
                    >
                      Edit
                    </button>
                    <button type="button" className={dangerButtonClass} disabled={!canDelete || deleteMutation.isPending} onClick={() => deleteMutation.mutate(notice.id)}>
                      Delete
                    </button>
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{notice.message}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {notice.audience.map((item) => (
                    <span key={item} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <EmptyState message="No notices found." />
          )}
        </div>
      </section>
    </div>
  );
}

function TemplateManager({
  channel,
  effectiveSchoolId,
  can,
}: {
  channel: CommunicationChannel;
  effectiveSchoolId: string;
  can: (code: string) => boolean;
}) {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const isEmail = channel === 'EMAIL';
  const [form, setForm] = useState({ id: '', name: '', subject: '', body: '' });
  const templatesQuery = useQuery({
    queryKey: ['communication-templates', channel, effectiveSchoolId],
    queryFn: () => listCommunicationTemplates(channel, effectiveSchoolId),
    enabled: Boolean(effectiveSchoolId),
  });
  const resetForm = () => setForm({ id: '', name: '', subject: '', body: '' });
  const createCode = isEmail ? P.communicationEmailTemplateCreate : P.communicationSmsTemplateCreate;
  const editCode = isEmail ? P.communicationEmailTemplateEdit : P.communicationSmsTemplateEdit;
  const deleteCode = isEmail ? P.communicationEmailTemplateDelete : P.communicationSmsTemplateDelete;

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = { schoolId: effectiveSchoolId, channel, name: form.name, subject: isEmail ? form.subject : null, body: form.body };
      return form.id ? updateCommunicationTemplate(form.id, payload) : createCommunicationTemplate(payload);
    },
    onSuccess: async () => {
      notify.success(form.id ? 'Template updated' : 'Template created');
      resetForm();
      await queryClient.invalidateQueries({ queryKey: ['communication-templates', channel, effectiveSchoolId] });
    },
    onError: (error) => notify.error('Unable to save template', errorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCommunicationTemplate(id, channel, effectiveSchoolId),
    onSuccess: async () => {
      notify.success('Template deleted');
      await queryClient.invalidateQueries({ queryKey: ['communication-templates', channel, effectiveSchoolId] });
    },
    onError: (error) => notify.error('Unable to delete template', errorMessage(error)),
  });

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-950">{form.id ? 'Edit Template' : `Create ${channel} Template`}</h2>
        <div className="mt-4 space-y-4">
          <Field label="Template Name">
            <input className={inputClass} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
          </Field>
          {isEmail ? (
            <Field label="Subject">
              <input className={inputClass} value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} />
            </Field>
          ) : null}
          <Field label="Message">
            {isEmail ? (
              <RichHtmlEditor
                value={form.body}
                minHeightClass="min-h-64"
                onChange={(body) => setForm((current) => ({ ...current, body }))}
              />
            ) : (
              <textarea className={`${inputClass} min-h-48 resize-y`} value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} />
            )}
          </Field>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
            Available variables: {'{{recipientName}}'}, {'{{recipientType}}'}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={primaryButtonClass}
              disabled={saveMutation.isPending || (!form.id && !can(createCode)) || Boolean(form.id && !can(editCode))}
              onClick={() => saveMutation.mutate()}
            >
              {form.id ? 'Update Template' : 'Create Template'}
            </button>
            {form.id ? (
              <button type="button" className={compactButtonClass} onClick={resetForm}>
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-950">{channel} Template List</h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                {isEmail ? <th className="px-4 py-3">Subject</th> : null}
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {(templatesQuery.data ?? []).map((template: CommunicationTemplate) => (
                <tr key={template.id}>
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {template.name}
                    {template.isSystem ? <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">System</span> : null}
                  </td>
                  {isEmail ? <td className="px-4 py-3 text-slate-600">{template.subject || '-'}</td> : null}
                  <td className="px-4 py-3 text-slate-500">{formatDateTime(template.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className={compactButtonClass}
                        disabled={template.isSystem || !can(editCode)}
                        onClick={() => setForm({ id: template.id, name: template.name, subject: template.subject ?? '', body: template.body })}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={dangerButtonClass}
                        disabled={template.isSystem || !can(deleteCode) || deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(template.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!templatesQuery.data?.length ? (
                <tr>
                  <td colSpan={isEmail ? 4 : 3} className="px-4 py-8 text-center text-slate-500">
                    No templates found.
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

function RecipientSelector({
  groups,
  setGroups,
}: {
  groups: RecipientGroup[];
  setGroups: (groups: RecipientGroup[]) => void;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-950">Message To</h2>
      <div className="mt-4 space-y-2">
        {recipientOptions.map((option) => (
          <label key={option.id} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={groups.includes(option.id)}
              onChange={(event) => {
                setGroups(event.target.checked ? Array.from(new Set([...groups, option.id])) : groups.filter((group) => group !== option.id));
              }}
            />
            {option.label}
          </label>
        ))}
      </div>
    </section>
  );
}

function SendMessage({
  channel,
  effectiveSchoolId,
}: {
  channel: CommunicationChannel;
  effectiveSchoolId: string;
}) {
  const notify = useNotify();
  const isEmail = channel === 'EMAIL';
  const [targetMode, setTargetMode] = useState<CommunicationTargetMode>('GROUP');
  const [recipientGroups, setRecipientGroups] = useState<RecipientGroup[]>(['STUDENTS', 'GUARDIANS']);
  const [templateId, setTemplateId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [individualRecipient, setIndividualRecipient] = useState('');
  const [sendMode, setSendMode] = useState<'now' | 'schedule'>('now');
  const [scheduledAt, setScheduledAt] = useState(nowLocalInput());
  const scopedParams = effectiveSchoolId ? { schoolId: effectiveSchoolId } : undefined;

  const templatesQuery = useQuery({
    queryKey: ['communication-templates', channel, effectiveSchoolId],
    queryFn: () => listCommunicationTemplates(channel, effectiveSchoolId),
    enabled: Boolean(effectiveSchoolId),
  });
  const classesQuery = useQuery({
    queryKey: ['communication-classes', effectiveSchoolId],
    queryFn: () => listClasses(scopedParams),
    enabled: Boolean(effectiveSchoolId && targetMode === 'CLASS'),
  });
  const sectionsQuery = useQuery({
    queryKey: ['communication-sections', effectiveSchoolId, classId],
    queryFn: () => listSections({ ...scopedParams, classId }),
    enabled: Boolean(effectiveSchoolId && targetMode === 'CLASS' && classId),
  });
  const selectedTemplate = templatesQuery.data?.find((template) => template.id === templateId);

  useEffect(() => {
    if (!selectedTemplate) return;
    setSubject(selectedTemplate.subject ?? '');
    setBody(selectedTemplate.body);
  }, [selectedTemplate]);

  useEffect(() => {
    if (targetMode !== 'CLASS') {
      setClassId('');
      setSectionId('');
    }
    if (targetMode !== 'INDIVIDUAL') {
      setIndividualRecipient('');
    }
  }, [targetMode]);

  const sendMutation = useMutation({
    mutationFn: () => {
      const payload = {
        schoolId: effectiveSchoolId,
        templateId: templateId || null,
        subject: isEmail ? subject : null,
        body,
        recipientGroups,
        targetMode,
        classId: classId || null,
        sectionId: sectionId || null,
        individualRecipient: individualRecipient || null,
        scheduledAt: sendMode === 'schedule' ? scheduledAt : null,
      };
      return isEmail ? sendCommunicationEmail(payload) : sendCommunicationSms(payload);
    },
    onSuccess: (result) => {
      notify.success(result.scheduled ? 'Message scheduled' : 'Message processed', `${result.recipientCount} recipient${result.recipientCount === 1 ? '' : 's'}`);
      if (!templateId) setBody('');
    },
    onError: (error) => notify.error(`Unable to send ${channel}`, errorMessage(error)),
  });

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 grid gap-2 sm:grid-cols-4">
          {targetTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTargetMode(tab.id)}
              className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${
                targetMode === tab.id ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="grid gap-4">
          <Field label={`${channel} Template`}>
            <select className={inputClass} value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
              <option value="">Select</option>
              {(templatesQuery.data ?? []).map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </Field>
          {targetMode === 'CLASS' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Class">
                <select className={inputClass} value={classId} onChange={(event) => setClassId(event.target.value)}>
                  <option value="">Select class</option>
                  {((classesQuery.data ?? []) as AcademicOption[]).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Section">
                <select className={inputClass} value={sectionId} onChange={(event) => setSectionId(event.target.value)}>
                  <option value="">All sections</option>
                  {((sectionsQuery.data ?? []) as AcademicOption[]).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          ) : null}
          {targetMode === 'INDIVIDUAL' ? (
            <Field label={isEmail ? 'Recipient Email' : 'Recipient Mobile'}>
              <input className={inputClass} value={individualRecipient} onChange={(event) => setIndividualRecipient(event.target.value)} />
            </Field>
          ) : null}
          {isEmail ? (
            <Field label="Title">
              <input className={inputClass} value={subject} onChange={(event) => setSubject(event.target.value)} />
            </Field>
          ) : null}
          <Field label="Message">
            {isEmail ? (
              <RichHtmlEditor value={body} onChange={setBody} />
            ) : (
              <textarea className={`${inputClass} min-h-80 resize-y`} value={body} onChange={(event) => setBody(event.target.value)} />
            )}
          </Field>
          <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-4 text-sm font-semibold text-slate-700">
              <label className="flex items-center gap-2">
                <input type="radio" checked={sendMode === 'now'} onChange={() => setSendMode('now')} />
                Send Now
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={sendMode === 'schedule'} onChange={() => setSendMode('schedule')} />
                Schedule
              </label>
            </div>
            {sendMode === 'schedule' ? (
              <input className={`${inputClass} sm:max-w-xs`} type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
            ) : null}
            <button type="button" className={primaryButtonClass} disabled={sendMutation.isPending} onClick={() => sendMutation.mutate()}>
              Submit
            </button>
          </div>
        </div>
      </section>
      <RecipientSelector groups={recipientGroups} setGroups={setRecipientGroups} />
    </div>
  );
}

function LoginCredentials({ effectiveSchoolId }: { effectiveSchoolId: string }) {
  const notify = useNotify();
  const [channel, setChannel] = useState<CommunicationChannel>('EMAIL');
  const [targetMode, setTargetMode] = useState<CommunicationTargetMode>('GROUP');
  const [recipientGroups, setRecipientGroups] = useState<RecipientGroup[]>(['STUDENTS', 'GUARDIANS']);
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [individualRecipient, setIndividualRecipient] = useState('');
  const [sendMode, setSendMode] = useState<'now' | 'schedule'>('now');
  const [scheduledAt, setScheduledAt] = useState(nowLocalInput());
  const scopedParams = effectiveSchoolId ? { schoolId: effectiveSchoolId } : undefined;
  const classesQuery = useQuery({
    queryKey: ['communication-login-classes', effectiveSchoolId],
    queryFn: () => listClasses(scopedParams),
    enabled: Boolean(effectiveSchoolId && targetMode === 'CLASS'),
  });
  const sectionsQuery = useQuery({
    queryKey: ['communication-login-sections', effectiveSchoolId, classId],
    queryFn: () => listSections({ ...scopedParams, classId }),
    enabled: Boolean(effectiveSchoolId && targetMode === 'CLASS' && classId),
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      sendLoginCredentialInstructions({
        schoolId: effectiveSchoolId,
        channel,
        recipientGroups,
        targetMode,
        classId: classId || null,
        sectionId: sectionId || null,
        individualRecipient: individualRecipient || null,
        scheduledAt: sendMode === 'schedule' ? scheduledAt : null,
      }),
    onSuccess: (result) => notify.success(result.scheduled ? 'Credential instructions scheduled' : 'Credential instructions processed', `${result.recipientCount} recipient${result.recipientCount === 1 ? '' : 's'}`),
    onError: (error) => notify.error('Unable to send credential instructions', errorMessage(error)),
  });

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Channel">
              <select className={inputClass} value={channel} onChange={(event) => setChannel(event.target.value as CommunicationChannel)}>
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS</option>
              </select>
            </Field>
            <Field label="Audience Mode">
              <select className={inputClass} value={targetMode} onChange={(event) => setTargetMode(event.target.value as CommunicationTargetMode)}>
                {targetTabs.map((tab) => (
                  <option key={tab.id} value={tab.id}>
                    {tab.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {targetMode === 'CLASS' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Class">
                <select className={inputClass} value={classId} onChange={(event) => setClassId(event.target.value)}>
                  <option value="">Select class</option>
                  {((classesQuery.data ?? []) as AcademicOption[]).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Section">
                <select className={inputClass} value={sectionId} onChange={(event) => setSectionId(event.target.value)}>
                  <option value="">All sections</option>
                  {((sectionsQuery.data ?? []) as AcademicOption[]).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          ) : null}
          {targetMode === 'INDIVIDUAL' ? (
            <Field label={channel === 'EMAIL' ? 'Recipient Email' : 'Recipient Mobile'}>
              <input className={inputClass} value={individualRecipient} onChange={(event) => setIndividualRecipient(event.target.value)} />
            </Field>
          ) : null}
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
            This sends a secure login instruction message. Existing passwords are never exposed; recipients are directed to the login page and Forgot Password flow if they need a reset.
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-4 text-sm font-semibold text-slate-700">
              <label className="flex items-center gap-2">
                <input type="radio" checked={sendMode === 'now'} onChange={() => setSendMode('now')} />
                Send Now
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={sendMode === 'schedule'} onChange={() => setSendMode('schedule')} />
                Schedule
              </label>
            </div>
            {sendMode === 'schedule' ? (
              <input className={`${inputClass} sm:max-w-xs`} type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
            ) : null}
            <button type="button" className={primaryButtonClass} disabled={sendMutation.isPending} onClick={() => sendMutation.mutate()}>
              Submit
            </button>
          </div>
        </div>
      </section>
      <RecipientSelector groups={recipientGroups} setGroups={setRecipientGroups} />
    </div>
  );
}

function LogsTable({ scheduled, effectiveSchoolId }: { scheduled: boolean; effectiveSchoolId: string }) {
  const [channel, setChannel] = useState<'' | CommunicationChannel>('');
  const logsQuery = useQuery({
    queryKey: [scheduled ? 'communication-scheduled-logs' : 'communication-logs', effectiveSchoolId, channel],
    queryFn: () =>
      scheduled
        ? listCommunicationScheduledLogs({ schoolId: effectiveSchoolId, channel: channel || undefined })
        : listCommunicationLogs({ schoolId: effectiveSchoolId, channel: channel || undefined }),
    enabled: Boolean(effectiveSchoolId),
  });

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold text-slate-950">{scheduled ? 'Scheduled Email / SMS Logs' : 'Email / SMS Logs'}</h2>
        <select className={`${inputClass} sm:max-w-48`} value={channel} onChange={(event) => setChannel(event.target.value as '' | CommunicationChannel)}>
          <option value="">All Channels</option>
          <option value="EMAIL">Email</option>
          <option value="SMS">SMS</option>
        </select>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Channel</th>
              <th className="px-4 py-3">Recipient</th>
              <th className="px-4 py-3">Message</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">{scheduled ? 'Scheduled' : 'Sent / Created'}</th>
              <th className="px-4 py-3">Error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {(logsQuery.data ?? []).map((log: CommunicationLog) => (
              <tr key={log.id}>
                <td className="px-4 py-3 font-bold text-slate-800">{log.channel}</td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-900">{log.recipientName || '-'}</p>
                  <p className="text-xs text-slate-500">{log.to}</p>
                </td>
                <td className="max-w-md px-4 py-3">
                  <p className="font-semibold text-slate-900">{log.subject || log.templateName || '-'}</p>
                  <p className="line-clamp-2 text-slate-600">{log.message}</p>
                </td>
                <td className="px-4 py-3"><StatusBadge status={log.status} /></td>
                <td className="px-4 py-3 text-slate-500">{formatDateTime(scheduled ? log.scheduledAt : log.sentAt || log.createdAt)}</td>
                <td className="px-4 py-3 text-xs text-red-600">{log.error || '-'}</td>
              </tr>
            ))}
            {!logsQuery.data?.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No logs found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const viewConfig: Record<CommunicationView, { title: string; subtitle: string }> = {
  'notice-board': { title: 'Notice Board', subtitle: 'Create and manage school notices for students, guardians, and staff.' },
  'send-email': { title: 'Send Email', subtitle: 'Send email immediately or schedule it for selected school audiences.' },
  'send-sms': { title: 'Send SMS', subtitle: 'Send SMS immediately or schedule it for selected school audiences.' },
  logs: { title: 'Email / SMS Log', subtitle: 'Review sent and failed communication delivery records.' },
  'scheduled-logs': { title: 'Schedule Email SMS Log', subtitle: 'Review queued scheduled email and SMS records.' },
  'login-credentials': { title: 'Login Credentials Send', subtitle: 'Send secure login instructions without exposing passwords.' },
  'email-templates': { title: 'Email Template', subtitle: 'Create reusable email templates for school communication.' },
  'sms-templates': { title: 'SMS Template', subtitle: 'Create reusable SMS templates for school communication.' },
};

export default function CommunicationWorkspace({ view }: { view: CommunicationView }) {
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const { data: session } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSuperAdmin = session?.role === 'SUPER_ADMIN';
  const permissionCodes = session?.permissionCodes ?? [];
  const effectiveSchoolId = isSuperAdmin ? selectedSchoolId : session?.schoolId ?? '';
  const config = viewConfig[view];
  const can = useMemo(() => {
    const allowed = new Set(permissionCodes);
    return (code: string) => session?.role === 'SUPER_ADMIN' || allowed.has(code);
  }, [permissionCodes, session?.role]);

  return (
    <div className="space-y-5">
      <PageHeader
        title={config.title}
        subtitle={config.subtitle}
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Communicate' }, { label: config.title }]}
        actions={<SchoolScopeSelect isSuperAdmin={Boolean(isSuperAdmin)} selectedSchoolId={selectedSchoolId} setSelectedSchoolId={setSelectedSchoolId} />}
      />

      {!effectiveSchoolId ? (
        <EmptyState message="Select a school to continue." />
      ) : view === 'notice-board' ? (
        <NoticeBoard effectiveSchoolId={effectiveSchoolId} can={can} />
      ) : view === 'send-email' ? (
        <SendMessage channel="EMAIL" effectiveSchoolId={effectiveSchoolId} />
      ) : view === 'send-sms' ? (
        <SendMessage channel="SMS" effectiveSchoolId={effectiveSchoolId} />
      ) : view === 'logs' ? (
        <LogsTable scheduled={false} effectiveSchoolId={effectiveSchoolId} />
      ) : view === 'scheduled-logs' ? (
        <LogsTable scheduled effectiveSchoolId={effectiveSchoolId} />
      ) : view === 'login-credentials' ? (
        <LoginCredentials effectiveSchoolId={effectiveSchoolId} />
      ) : view === 'email-templates' ? (
        <TemplateManager channel="EMAIL" effectiveSchoolId={effectiveSchoolId} can={can} />
      ) : (
        <TemplateManager channel="SMS" effectiveSchoolId={effectiveSchoolId} can={can} />
      )}
    </div>
  );
}
