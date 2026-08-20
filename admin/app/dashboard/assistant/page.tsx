'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import PageHeader from '../../../components/PageHeader';
import Button from '../../../components/Button';
import AccessDeniedPanel from '../../../components/AccessDeniedPanel';
import FullPageLoader from '../../../components/FullPageLoader';
import { ModuleFeatureKeys, isModuleEnabled } from '../../../config/module-flags';
import { getSession } from '../../../services/auth.service';
import {
  sendAiAssistantMessage,
  type AiAssistantAction,
  type AiAssistantResponse,
} from '../../../services/ai-assistant.service';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  action?: AiAssistantAction;
  data?: unknown;
};

const promptTemplates = [
  {
    label: 'Create academic year',
    prompt: 'Create academic year 2027-2028 starting 2027-01-01 to 2028-12-31',
  },
  {
    label: 'Create classes',
    prompt: 'Create classes 1 to 12',
  },
  {
    label: 'Create sections',
    prompt: 'Create sections A and B',
  },
  {
    label: 'Map sections',
    prompt: 'Map sections A and B to classes 1 to 5. Map only section A to classes 6 to 12',
  },
  {
    label: 'Full setup',
    prompt: 'Create academic year 2027-2028 starting 2027-01-01 to 2028-12-31. Create classes 1 to 12. Create sections A and B. Map sections A and B to classes 1 to 5. Map only section A to classes 6 to 12.',
  },
  {
    label: 'Check setup',
    prompt: 'What setup is missing?',
  },
  {
    label: 'Show classes',
    prompt: 'Show all classes',
  },
  {
    label: 'Show unmapped classes',
    prompt: 'Show classes without sections',
  },
];

const actionTone: Record<string, string> = {
  LOW: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  MEDIUM: 'border-amber-200 bg-amber-50 text-amber-800',
  HIGH: 'border-red-200 bg-red-50 text-red-800',
};

const formatDataPreview = (data: unknown) => {
  if (!data) return null;
  if (Array.isArray(data)) {
    return data.slice(0, 6).map((item: any) => item.name || item.fullName || item.title || item.id).filter(Boolean).join(', ');
  }
  if (typeof data === 'object') {
    return JSON.stringify(data, null, 2).slice(0, 700);
  }
  return String(data);
};

export default function AssistantPage() {
  const [conversationId, setConversationId] = useState<string>();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Ask me to explain setup, list academic records, or prepare safe setup actions. Create and update actions require confirmation.',
    },
  ]);
  const [pendingAction, setPendingAction] = useState<AiAssistantAction | null>(null);
  const [error, setError] = useState('');
  const sessionQuery = useQuery({ queryKey: ['session'], queryFn: getSession });
  const assistantEnabled = isModuleEnabled(sessionQuery.data?.moduleFlags, ModuleFeatureKeys.aiAssistant);

  const mutation = useMutation({
    mutationFn: sendAiAssistantMessage,
    onSuccess: (response: AiAssistantResponse) => {
      setConversationId(response.conversationId);
      setPendingAction(response.action ?? null);
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-assistant`,
          role: 'assistant',
          content: response.message,
          action: response.action,
          data: response.data,
        },
      ]);
      setError('');
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error?.message || err?.message || 'Assistant request failed');
    },
  });

  const canSend = useMemo(() => input.trim().length > 0 && !mutation.isPending, [input, mutation.isPending]);

  if (sessionQuery.isLoading) {
    return <FullPageLoader label="Checking module access..." />;
  }

  if (!assistantEnabled) {
    return (
      <AccessDeniedPanel
        title="AI Assistant disabled"
        message="AI Assistant is disabled by the platform administrator."
      />
    );
  }

  const submitMessage = (message: string, confirmActionId?: string) => {
    const trimmed = message.trim();
    if (!trimmed && !confirmActionId) return;
    if (trimmed) {
      setMessages((current) => [...current, { id: `${Date.now()}-user`, role: 'user', content: trimmed }]);
    }
    mutation.mutate({ message: trimmed || 'Confirm', conversationId, confirmActionId });
    setInput('');
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSend) return;
    submitMessage(input);
  };

  const confirmAction = () => {
    if (!pendingAction) return;
    submitMessage('Confirm', pendingAction.id);
    setPendingAction(null);
  };

  const cancelAction = () => {
    setPendingAction(null);
    submitMessage('Cancel');
  };

  return (
    <div className="mx-auto flex h-[calc(100dvh-12rem)] min-h-0 w-full max-w-7xl flex-col overflow-hidden px-2 pb-2 sm:px-0">
      <div className="shrink-0">
        <PageHeader
          title="AI Assistant"
          subtitle="Controlled school ERP assistant for help, lookup, and confirmed setup actions."
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'AI Assistant' }]}
        />
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {messages.map((message) => {
              const preview = formatDataPreview(message.data);
              return (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[92%] rounded-lg px-4 py-3 text-sm leading-6 sm:max-w-[78%] ${message.role === 'user' ? 'bg-blue-900 text-white' : 'border border-slate-200 bg-slate-50 text-slate-800'}`}>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    {message.action ? (
                      <div className={`mt-3 rounded-md border px-3 py-2 text-xs ${actionTone[message.action.risk]}`}>
                        <div className="font-semibold">{message.action.summary}</div>
                        <div className="mt-1">Risk: {message.action.risk}</div>
                      </div>
                    ) : null}
                    {preview ? <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-white/70 p-3 text-xs text-slate-700">{preview}</pre> : null}
                  </div>
                </div>
              );
            })}
            {mutation.isPending ? <div className="text-sm text-slate-500">Assistant is working...</div> : null}
          </div>

          {pendingAction ? (
            <div className="border-t border-amber-200 bg-amber-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-amber-900">Confirmation required</p>
                  <p className="text-sm text-amber-800">{pendingAction.summary}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={cancelAction} disabled={mutation.isPending}>Cancel</Button>
                  <Button onClick={confirmAction} disabled={mutation.isPending}>Confirm</Button>
                </div>
              </div>
            </div>
          ) : null}

          {error ? <div className="border-t border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

          <form onSubmit={handleSubmit} className="sticky bottom-0 z-10 shrink-0 border-t border-slate-200 bg-white p-3 sm:p-4">
            <div className="flex gap-3">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    if (canSend) submitMessage(input);
                  }
                }}
                rows={1}
                className="max-h-28 min-h-11 flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Ask or request a safe setup action..."
              />
              <Button type="submit" disabled={!canSend}>{mutation.isPending ? 'Sending...' : 'Send'}</Button>
            </div>
          </form>
        </section>

        <aside className="hidden min-h-0 space-y-4 overflow-y-auto lg:block">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Phase 3A templates</h2>
            <div className="mt-3 space-y-2">
              {promptTemplates.map((template) => (
                <button
                  key={template.label}
                  type="button"
                  onClick={() => setInput(template.prompt)}
                  disabled={mutation.isPending}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="block font-medium text-slate-900">{template.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">{template.prompt}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600 shadow-sm">
            <p className="font-semibold text-slate-900">Safety scope</p>
            <p className="mt-2">AI execution is currently limited to academic year, class, section, and class-section setup. Subjects, students, teachers, exams, attendance, fees, payroll, updates, and deletes remain blocked or preview-only.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
