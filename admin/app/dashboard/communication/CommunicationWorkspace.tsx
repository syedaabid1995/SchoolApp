'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';
import { LinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { INSERT_UNORDERED_LIST_COMMAND, ListItemNode, ListNode } from '@lexical/list';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { $createHeadingNode, HeadingNode, QuoteNode } from '@lexical/rich-text';
import { $setBlocksType } from '@lexical/selection';
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  type LexicalEditor,
} from 'lexical';
import PageHeader from '../../../components/PageHeader';
import { useNotify } from '../../../components/NotificationProvider';
import { PermissionCodes as P } from '../../../config/permission-manifest';
import { listClasses, listSections } from '../../../services/academic.service';
import {
  createCommunicationNotice,
  createCommunicationTemplate,
  deleteCommunicationNotice,
  deleteCommunicationTemplate,
  listCommunicationRecipients,
  listCommunicationLogs,
  listCommunicationNotices,
  listCommunicationScheduledLogs,
  listCommunicationTemplates,
  listPushNotificationLogs,
  sendCommunicationEmail,
  sendCommunicationPush,
  sendCommunicationSms,
  sendLoginCredentialInstructions,
  updateCommunicationNotice,
  updateCommunicationTemplate,
  type CommunicationChannel,
  type CommunicationLog,
  type CommunicationNotice,
  type CommunicationRecipientOption,
  type CommunicationTargetMode,
  type CommunicationTemplate,
  type PushPriority,
  type PushNotificationLog,
  type RecipientGroup,
} from '../../../services/communication.service';
import { getSession } from '../../../services/auth.service';
import { listSchools } from '../../../services/school.service';

type CommunicationView =
  | 'notice-board'
  | 'send-email'
  | 'send-sms'
  | 'send-push'
  | 'logs'
  | 'push-logs'
  | 'scheduled-logs'
  | 'login-credentials'
  | 'email-templates'
  | 'sms-templates'
  | 'push-templates';
type LogsTab = 'delivery' | 'scheduled' | 'push';

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
const logsTabs: Array<{ id: LogsTab; label: string }> = [
  { id: 'delivery', label: 'Email / SMS' },
  { id: 'scheduled', label: 'Scheduled Email / SMS' },
  { id: 'push', label: 'Push Notifications' },
];
const pushPriorityOptions: Array<{ id: PushPriority; label: string }> = [
  { id: 'normal', label: 'Normal' },
  { id: 'high', label: 'High' },
  { id: 'urgent', label: 'Urgent' },
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

type EditorToolIconName = 'bold' | 'italic' | 'underline' | 'list' | 'heading' | 'link' | 'image' | 'download';

function EditorToolIcon({ name }: { name: EditorToolIconName }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, strokeWidth: 2 };
  if (name === 'bold') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
        <path {...common} d="M7 5h6.5a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7zM7 5v14" />
      </svg>
    );
  }
  if (name === 'italic') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
        <path {...common} d="M10 5h8M6 19h8M14 5l-4 14" />
      </svg>
    );
  }
  if (name === 'underline') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
        <path {...common} d="M7 5v6a5 5 0 0 0 10 0V5M6 20h12" />
      </svg>
    );
  }
  if (name === 'list') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
        <path {...common} d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
      </svg>
    );
  }
  if (name === 'heading') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
        <path {...common} d="M5 19V5M19 19V5M5 12h14M14 19h6" />
      </svg>
    );
  }
  if (name === 'link') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
        <path {...common} d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.1-1.1" />
      </svg>
    );
  }
  if (name === 'image') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
        <path {...common} d="M5 5h14v14H5zM8 14l2.5-2.5L14 15l2-2 3 3M9 9h.01" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path {...common} d="M12 5v10M8 11l4 4 4-4M5 19h14" />
    </svg>
  );
}

function LexicalHtmlSyncPlugin({ enabled, value, onChange }: { enabled: boolean; value: string; onChange: (value: string) => void }) {
  const [editor] = useLexicalComposerContext();
  const lastHtmlRef = useRef<string>('');

  useEffect(() => {
    if (!enabled) return;
    if (value === lastHtmlRef.current) return;
    lastHtmlRef.current = value;
    editor.update(() => {
      const parser = new DOMParser();
      const dom = parser.parseFromString(value || '<p></p>', 'text/html');
      const nodes = $generateNodesFromDOM(editor, dom);
      const root = $getRoot();
      root.clear();
      if (nodes.length) {
        root.append(...nodes);
      }
    });
  }, [editor, enabled, value]);

  if (!enabled) return null;

  return (
    <OnChangePlugin
      ignoreSelectionChange
      onChange={(editorState, activeEditor) => {
        editorState.read(() => {
          const html = $generateHtmlFromNodes(activeEditor);
          lastHtmlRef.current = html;
          onChange(html);
        });
      }}
    />
  );
}

function HtmlEditorToolbar({
  mode,
  setMode,
  value,
  onChange,
}: {
  mode: 'visual' | 'html' | 'preview';
  setMode: (mode: 'visual' | 'html' | 'preview') => void;
  value: string;
  onChange: (value: string) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [formats, setFormats] = useState({ bold: false, italic: false, underline: false });

  useEffect(
    () =>
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) {
            setFormats({ bold: false, italic: false, underline: false });
            return;
          }
          setFormats({
            bold: selection.hasFormat('bold'),
            italic: selection.hasFormat('italic'),
            underline: selection.hasFormat('underline'),
          });
        });
      }),
    [editor],
  );

  const runVisualCommand = (callback: (activeEditor: LexicalEditor) => void) => {
    if (mode !== 'visual') setMode('visual');
    requestAnimationFrame(() => {
      editor.focus();
      callback(editor);
    });
  };

  const insertImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result ?? '');
      if (!src) return;
      const alt = file.name.replace(/"/g, '&quot;');
      const imageHtml = `<img src="${src}" alt="${alt}" style="max-width:100%;height:auto;" />`;
      if (mode === 'html') {
        onChange(`${value}${imageHtml}`);
        return;
      }
      runVisualCommand((activeEditor) => {
        activeEditor.update(() => {
          const parser = new DOMParser();
          const dom = parser.parseFromString(imageHtml, 'text/html');
          const nodes = $generateNodesFromDOM(activeEditor, dom);
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            selection.insertNodes(nodes);
          } else {
            $getRoot().append(...nodes);
          }
        });
      });
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

  const toolClass = (active = false) =>
    `inline-flex h-9 w-9 items-center justify-center rounded-lg border text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 ${
      active ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white'
    }`;

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 p-2">
      <button type="button" className={toolClass(formats.bold)} onClick={() => runVisualCommand((activeEditor) => activeEditor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold'))} title="Bold" aria-label="Bold">
        <EditorToolIcon name="bold" />
      </button>
      <button type="button" className={toolClass(formats.italic)} onClick={() => runVisualCommand((activeEditor) => activeEditor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic'))} title="Italic" aria-label="Italic">
        <EditorToolIcon name="italic" />
      </button>
      <button type="button" className={toolClass(formats.underline)} onClick={() => runVisualCommand((activeEditor) => activeEditor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline'))} title="Underline" aria-label="Underline">
        <EditorToolIcon name="underline" />
      </button>
      <button type="button" className={toolClass()} onClick={() => runVisualCommand((activeEditor) => activeEditor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined))} title="Bullet list" aria-label="Bullet list">
        <EditorToolIcon name="list" />
      </button>
      <button
        type="button"
        className={toolClass()}
        onClick={() =>
          runVisualCommand((activeEditor) => {
            activeEditor.update(() => {
              const selection = $getSelection();
              if ($isRangeSelection(selection)) {
                $setBlocksType(selection, () => $createHeadingNode('h2'));
              }
            });
          })
        }
        title="Heading"
        aria-label="Heading"
      >
        <EditorToolIcon name="heading" />
      </button>
      <button
        type="button"
        className={toolClass()}
        onClick={() =>
          runVisualCommand((activeEditor) => {
            const url = window.prompt('URL');
            if (url !== null) {
              activeEditor.dispatchCommand(TOGGLE_LINK_COMMAND, url.trim() || null);
            }
          })
        }
        title="Link"
        aria-label="Link"
      >
        <EditorToolIcon name="link" />
      </button>
      <button type="button" className={toolClass()} onClick={() => fileInputRef.current?.click()} title="Insert image" aria-label="Insert image">
        <EditorToolIcon name="image" />
      </button>
      <button type="button" className={toolClass()} onClick={downloadHtml} title="Download HTML" aria-label="Download HTML">
        <EditorToolIcon name="download" />
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) insertImage(file);
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
  const [mode, setMode] = useState<'visual' | 'html' | 'preview'>('visual');
  const initialConfig = useMemo(
    () => ({
      namespace: 'EmailTemplateEditor',
      nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode],
      onError(error: Error) {
        throw error;
      },
      theme: {
        link: 'text-blue-700 underline',
        text: {
          bold: 'font-bold',
          italic: 'italic',
          underline: 'underline',
        },
      },
    }),
    [],
  );

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <HtmlEditorToolbar mode={mode} setMode={setMode} value={value} onChange={onChange} />
        <LexicalHtmlSyncPlugin enabled={mode === 'visual'} value={value} onChange={onChange} />
        <HistoryPlugin />
        <ListPlugin />
        <LinkPlugin />
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
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className={`email-template-editor ${minHeightClass} overflow-auto p-4 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-100`}
                aria-placeholder="Write email content"
                placeholder={<span />}
              />
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        )}
      </div>
    </LexicalComposer>
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
  includePlatform = false,
}: {
  isSuperAdmin: boolean;
  selectedSchoolId: string;
  setSelectedSchoolId: (value: string) => void;
  includePlatform?: boolean;
}) {
  const schoolsQuery = useQuery({
    queryKey: ['schools', 'communication'],
    queryFn: () => listSchools({ limit: 100, status: 'ACTIVE' }),
    enabled: isSuperAdmin,
  });

  useEffect(() => {
    if (includePlatform && isSuperAdmin && !selectedSchoolId) {
      setSelectedSchoolId('__platform__');
      return;
    }
    if (isSuperAdmin && !selectedSchoolId && schoolsQuery.data?.items?.length) {
      setSelectedSchoolId(schoolsQuery.data.items[0].id);
    }
  }, [includePlatform, isSuperAdmin, schoolsQuery.data?.items, selectedSchoolId, setSelectedSchoolId]);

  if (!isSuperAdmin) return null;
  return (
    <select className={inputClass} value={selectedSchoolId} onChange={(event) => setSelectedSchoolId(event.target.value)}>
      <option value="">Select school</option>
      {includePlatform ? <option value="__platform__">Platform default templates</option> : null}
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
  platformScope = false,
  can,
}: {
  channel: CommunicationChannel;
  effectiveSchoolId: string;
  platformScope?: boolean;
  can: (code: string) => boolean;
}) {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const isEmail = channel === 'EMAIL';
  const isPush = channel === 'PUSH';
  const [form, setForm] = useState({ id: '', name: '', subject: '', body: '' });
  const templatesQuery = useQuery({
    queryKey: ['communication-templates', channel, effectiveSchoolId, platformScope],
    queryFn: () => listCommunicationTemplates(channel, effectiveSchoolId, platformScope),
    enabled: Boolean(effectiveSchoolId || platformScope),
  });
  const resetForm = () => setForm({ id: '', name: '', subject: '', body: '' });
  const createCode = isEmail ? P.communicationEmailTemplateCreate : isPush ? P.communicationPushTemplateCreate : P.communicationSmsTemplateCreate;
  const editCode = isEmail ? P.communicationEmailTemplateEdit : isPush ? P.communicationPushTemplateEdit : P.communicationSmsTemplateEdit;
  const deleteCode = isEmail ? P.communicationEmailTemplateDelete : isPush ? P.communicationPushTemplateDelete : P.communicationSmsTemplateDelete;

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        schoolId: platformScope ? undefined : effectiveSchoolId,
        platform: platformScope,
        channel,
        name: form.name,
        subject: isEmail || isPush ? form.subject : null,
        body: form.body,
      };
      return form.id ? updateCommunicationTemplate(form.id, payload) : createCommunicationTemplate(payload);
    },
    onSuccess: async () => {
      notify.success(form.id ? 'Template updated' : 'Template created');
      resetForm();
      await queryClient.invalidateQueries({ queryKey: ['communication-templates', channel, effectiveSchoolId, platformScope] });
    },
    onError: (error) => notify.error('Unable to save template', errorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCommunicationTemplate(id, channel, effectiveSchoolId, platformScope),
    onSuccess: async () => {
      notify.success('Template deleted');
      await queryClient.invalidateQueries({ queryKey: ['communication-templates', channel, effectiveSchoolId, platformScope] });
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
          {isEmail || isPush ? (
            <Field label={isPush ? 'Title' : 'Subject'}>
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
                {isEmail || isPush ? <th className="px-4 py-3">{isPush ? 'Title' : 'Subject'}</th> : null}
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
                  {isEmail || isPush ? <td className="px-4 py-3 text-slate-600">{template.subject || '-'}</td> : null}
                  <td className="px-4 py-3 text-slate-500">{formatDateTime(template.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className={compactButtonClass}
                        disabled={(!platformScope && template.isSystem) || !can(editCode)}
                        onClick={() => setForm({ id: template.id, name: template.name, subject: template.subject ?? '', body: template.body })}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={dangerButtonClass}
                        disabled={(!platformScope && template.isSystem) || !can(deleteCode) || deleteMutation.isPending}
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
                  <td colSpan={isEmail || isPush ? 4 : 3} className="px-4 py-8 text-center text-slate-500">
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

function MultiSelectDropdown<T extends string>({
  label,
  options,
  selected,
  onChange,
  placeholder = 'Select',
  disabled = false,
  getOptionLabel,
  getOptionDescription,
}: {
  label: string;
  options: Array<{ id: T; label?: string } & Record<string, unknown>>;
  selected: T[];
  onChange: (selected: T[]) => void;
  placeholder?: string;
  disabled?: boolean;
  getOptionLabel?: (option: { id: T; label?: string } & Record<string, unknown>) => string;
  getOptionDescription?: (option: { id: T; label?: string } & Record<string, unknown>) => string | null | undefined;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabels = options
    .filter((option) => selected.includes(option.id))
    .map((option) => getOptionLabel?.(option) ?? option.label ?? option.id);

  return (
    <Field label={label}>
      <div className="relative">
        <button
          type="button"
          className={`${inputClass} flex min-h-[42px] items-center justify-between gap-3 text-left disabled:cursor-not-allowed`}
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
        >
          <span className="min-w-0 truncate">{selectedLabels.length ? selectedLabels.join(', ') : placeholder}</span>
          <span className="shrink-0 text-xs text-slate-400">v</span>
        </button>
        {open && !disabled ? (
          <div className="absolute z-30 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
            {options.map((option) => {
              const isChecked = selected.includes(option.id);
              return (
                <label key={option.id} className="flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2 text-sm hover:bg-slate-50">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={isChecked}
                    onChange={(event) => {
                      onChange(event.target.checked ? Array.from(new Set([...selected, option.id])) : selected.filter((id) => id !== option.id));
                    }}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-slate-800">{getOptionLabel?.(option) ?? option.label ?? option.id}</span>
                    {getOptionDescription?.(option) ? <span className="block truncate text-xs text-slate-500">{getOptionDescription(option)}</span> : null}
                  </span>
                </label>
              );
            })}
            {!options.length ? <div className="px-3 py-4 text-sm text-slate-500">No options found.</div> : null}
          </div>
        ) : null}
      </div>
    </Field>
  );
}

function AudienceGroupDropdown({
  groups,
  setGroups,
}: {
  groups: RecipientGroup[];
  setGroups: (groups: RecipientGroup[]) => void;
}) {
  return (
    <MultiSelectDropdown
      label="Message To"
      options={recipientOptions}
      selected={groups}
      onChange={setGroups}
      placeholder="Select recipients"
    />
  );
}

function RecipientOptionDropdown({
  options,
  selected,
  setSelected,
  loading,
}: {
  options: CommunicationRecipientOption[];
  selected: string[];
  setSelected: (selected: string[]) => void;
  loading: boolean;
}) {
  return (
    <MultiSelectDropdown
      label="Recipient Name / Contact"
      options={options.map((option) => ({ ...option, id: option.value }))}
      selected={selected}
      onChange={setSelected}
      placeholder={loading ? 'Loading recipients...' : 'Select recipients'}
      getOptionLabel={(option) => String(option.name ?? option.label ?? option.id)}
      getOptionDescription={(option) => `${String(option.type ?? '')} - ${String(option.contact ?? option.id)}`}
      disabled={loading}
    />
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
  const isPush = channel === 'PUSH';
  const [targetMode, setTargetMode] = useState<CommunicationTargetMode>('GROUP');
  const [recipientGroups, setRecipientGroups] = useState<RecipientGroup[]>(['STUDENTS', 'GUARDIANS']);
  const [templateId, setTemplateId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [sendMode, setSendMode] = useState<'now' | 'schedule'>('now');
  const [scheduledAt, setScheduledAt] = useState(nowLocalInput());
  const [route, setRoute] = useState('/dashboard');
  const [moduleName, setModuleName] = useState('notifications');
  const [category, setCategory] = useState('general');
  const [priority, setPriority] = useState<PushPriority>('normal');
  const birthdayAutoSelectRef = useRef('');
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
  const recipientsQuery = useQuery({
    queryKey: ['communication-recipient-options', effectiveSchoolId, channel, targetMode, recipientGroups, classId, sectionId],
    queryFn: () =>
      listCommunicationRecipients({
        schoolId: effectiveSchoolId,
        channel,
        targetMode,
        recipientGroups,
        classId: classId || null,
        sectionId: sectionId || null,
      }),
    enabled: Boolean(
      effectiveSchoolId &&
        templateId &&
        recipientGroups.length &&
        (targetMode === 'INDIVIDUAL' || targetMode === 'BIRTHDAY'),
    ),
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
    setSelectedRecipients([]);
    birthdayAutoSelectRef.current = '';
  }, [targetMode]);

  useEffect(() => {
    setSelectedRecipients([]);
    birthdayAutoSelectRef.current = '';
  }, [channel, recipientGroups, classId, sectionId, templateId]);

  useEffect(() => {
    if (targetMode !== 'BIRTHDAY') return;
    const recipients = recipientsQuery.data ?? [];
    const autoKey = recipients.map((recipient) => recipient.value).join('|');
    if (!autoKey || birthdayAutoSelectRef.current === autoKey) return;
    birthdayAutoSelectRef.current = autoKey;
    setSelectedRecipients(recipients.map((recipient) => recipient.value));
  }, [recipientsQuery.data, targetMode]);

  const sendMutation = useMutation({
    mutationFn: () => {
      const payload = {
        schoolId: effectiveSchoolId,
        templateId: templateId || null,
        subject: isEmail || isPush ? subject : null,
        body,
        recipientGroups,
        targetMode,
        classId: classId || null,
        sectionId: sectionId || null,
        individualRecipient: null,
        individualRecipients: selectedRecipients,
        scheduledAt: sendMode === 'schedule' ? scheduledAt : null,
        route: isPush ? route : null,
        module: isPush ? moduleName : null,
        category: isPush ? category : null,
        priority: isPush ? priority : null,
      };
      return isEmail ? sendCommunicationEmail(payload) : isPush ? sendCommunicationPush(payload) : sendCommunicationSms(payload);
    },
    onSuccess: (result) => {
      notify.success(result.scheduled ? 'Message scheduled' : 'Message processed', `${result.recipientCount} recipient${result.recipientCount === 1 ? '' : 's'}`);
      if (!templateId) setBody('');
    },
    onError: (error) => notify.error(`Unable to send ${channel}`, errorMessage(error)),
  });

  return (
    <div className="grid gap-5">
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
          {templateId ? <AudienceGroupDropdown groups={recipientGroups} setGroups={setRecipientGroups} /> : null}
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
          {templateId && (targetMode === 'INDIVIDUAL' || targetMode === 'BIRTHDAY') ? (
            <RecipientOptionDropdown
              options={recipientsQuery.data ?? []}
              selected={selectedRecipients}
              setSelected={setSelectedRecipients}
              loading={recipientsQuery.isFetching}
            />
          ) : null}
          {isEmail || isPush ? (
            <Field label={isPush ? 'Notification Title' : 'Title'}>
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
          {isPush ? (
            <div className="grid gap-4 sm:grid-cols-4">
              <Field label="Route">
                <input className={inputClass} value={route} onChange={(event) => setRoute(event.target.value)} />
              </Field>
              <Field label="Module">
                <input className={inputClass} value={moduleName} onChange={(event) => setModuleName(event.target.value)} />
              </Field>
              <Field label="Category">
                <input className={inputClass} value={category} onChange={(event) => setCategory(event.target.value)} />
              </Field>
              <Field label="Priority">
                <select className={inputClass} value={priority} onChange={(event) => setPriority(event.target.value as PushPriority)}>
                  {pushPriorityOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          ) : null}
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
            <button
              type="button"
              className={primaryButtonClass}
              disabled={
                sendMutation.isPending ||
                !templateId ||
                !recipientGroups.length ||
                ((targetMode === 'INDIVIDUAL' || targetMode === 'BIRTHDAY') && !selectedRecipients.length)
              }
              onClick={() => sendMutation.mutate()}
            >
              Submit
            </button>
          </div>
        </div>
      </section>
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

function PushLogsTable({ effectiveSchoolId }: { effectiveSchoolId: string }) {
  const logsQuery = useQuery({
    queryKey: ['push-notification-logs', effectiveSchoolId],
    queryFn: () => listPushNotificationLogs({ schoolId: effectiveSchoolId }),
    enabled: Boolean(effectiveSchoolId),
  });

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold text-slate-950">Push Logs</h2>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Recipient</th>
              <th className="px-4 py-3">Message</th>
              <th className="px-4 py-3">Route</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Sent / Created</th>
              <th className="px-4 py-3">Error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {(logsQuery.data ?? []).map((log: PushNotificationLog) => (
              <tr key={log.id}>
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-900">{log.recipientName || '-'}</p>
                  <p className="text-xs text-slate-500">{log.recipientType || log.recipientUserId}</p>
                </td>
                <td className="max-w-md px-4 py-3">
                  <p className="font-semibold text-slate-900">{log.subject || log.templateName || '-'}</p>
                  <p className="line-clamp-2 text-slate-600">{log.message}</p>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{log.route || log.module || '-'}</td>
                <td className="px-4 py-3"><StatusBadge status={log.status} /></td>
                <td className="px-4 py-3 text-slate-500">{formatDateTime(log.sentAt || log.createdAt)}</td>
                <td className="px-4 py-3 text-xs text-red-600">{log.error || '-'}</td>
              </tr>
            ))}
            {!logsQuery.data?.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No push logs found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LogsHub({
  effectiveSchoolId,
  initialTab = 'delivery',
}: {
  effectiveSchoolId: string;
  initialTab?: LogsTab;
}) {
  const [activeTab, setActiveTab] = useState<LogsTab>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        {logsTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
              activeTab === tab.id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === 'delivery' ? (
        <LogsTable scheduled={false} effectiveSchoolId={effectiveSchoolId} />
      ) : activeTab === 'scheduled' ? (
        <LogsTable scheduled effectiveSchoolId={effectiveSchoolId} />
      ) : (
        <PushLogsTable effectiveSchoolId={effectiveSchoolId} />
      )}
    </div>
  );
}

const viewConfig: Record<CommunicationView, { title: string; subtitle: string }> = {
  'notice-board': { title: 'Notice Board', subtitle: 'Create and manage school notices for students, guardians, and staff.' },
  'send-email': { title: 'Send Email', subtitle: 'Send email immediately or schedule it for selected school audiences.' },
  'send-sms': { title: 'Send SMS', subtitle: 'Send SMS immediately or schedule it for selected school audiences.' },
  'send-push': { title: 'Send Push', subtitle: 'Send Firebase push notifications to registered web and mobile devices.' },
  logs: { title: 'Logs', subtitle: 'Review Email, SMS, scheduled, and push notification delivery records.' },
  'push-logs': { title: 'Logs', subtitle: 'Review Email, SMS, scheduled, and push notification delivery records.' },
  'scheduled-logs': { title: 'Logs', subtitle: 'Review Email, SMS, scheduled, and push notification delivery records.' },
  'login-credentials': { title: 'Login Credentials Send', subtitle: 'Send secure login instructions without exposing passwords.' },
  'email-templates': { title: 'Email Template', subtitle: 'Create reusable email templates for school communication.' },
  'sms-templates': { title: 'SMS Template', subtitle: 'Create reusable SMS templates for school communication.' },
  'push-templates': { title: 'Push Template', subtitle: 'Create reusable Firebase push notification templates.' },
};

export default function CommunicationWorkspace({ view }: { view: CommunicationView }) {
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const { data: session } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSuperAdmin = session?.role === 'SUPER_ADMIN';
  const platformScope = isSuperAdmin && view === 'push-templates' && selectedSchoolId === '__platform__';
  const effectiveSchoolId = isSuperAdmin ? (platformScope ? '' : selectedSchoolId) : session?.schoolId ?? '';
  const config = viewConfig[view];
  const can = useMemo(() => {
    const allowed = new Set(session?.permissionCodes ?? []);
    return (code: string) => session?.role === 'SUPER_ADMIN' || allowed.has(code);
  }, [session?.permissionCodes, session?.role]);

  return (
    <div className="space-y-5">
      <PageHeader
        title={config.title}
        subtitle={config.subtitle}
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Communicate' }, { label: config.title }]}
        actions={<SchoolScopeSelect isSuperAdmin={Boolean(isSuperAdmin)} selectedSchoolId={selectedSchoolId} setSelectedSchoolId={setSelectedSchoolId} includePlatform={view === 'push-templates'} />}
      />

      {!effectiveSchoolId && !platformScope ? (
        <EmptyState message="Select a school to continue." />
      ) : view === 'notice-board' ? (
        <NoticeBoard effectiveSchoolId={effectiveSchoolId} can={can} />
      ) : view === 'send-email' ? (
        <SendMessage channel="EMAIL" effectiveSchoolId={effectiveSchoolId} />
      ) : view === 'send-sms' ? (
        <SendMessage channel="SMS" effectiveSchoolId={effectiveSchoolId} />
      ) : view === 'send-push' ? (
        <SendMessage channel="PUSH" effectiveSchoolId={effectiveSchoolId} />
      ) : view === 'logs' ? (
        <LogsHub effectiveSchoolId={effectiveSchoolId} />
      ) : view === 'push-logs' ? (
        <LogsHub effectiveSchoolId={effectiveSchoolId} initialTab="push" />
      ) : view === 'scheduled-logs' ? (
        <LogsHub effectiveSchoolId={effectiveSchoolId} initialTab="scheduled" />
      ) : view === 'login-credentials' ? (
        <LoginCredentials effectiveSchoolId={effectiveSchoolId} />
      ) : view === 'email-templates' ? (
        <TemplateManager channel="EMAIL" effectiveSchoolId={effectiveSchoolId} can={can} />
      ) : view === 'push-templates' ? (
        <TemplateManager channel="PUSH" effectiveSchoolId={effectiveSchoolId} platformScope={platformScope} can={can} />
      ) : (
        <TemplateManager channel="SMS" effectiveSchoolId={effectiveSchoolId} can={can} />
      )}
    </div>
  );
}
