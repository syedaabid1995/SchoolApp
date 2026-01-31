'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listThemes, createTheme, updateTheme, publishTheme, rollbackTheme } from '../../../services/theme.service';

export default function ThemesPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [tokens, setTokens] = useState('{"primary":"#111827","secondary":"#64748b"}');
  const [rollbackTarget, setRollbackTarget] = useState({ themeId: '', targetId: '' });

  const { data: themes } = useQuery({ queryKey: ['themes'], queryFn: listThemes });

  const createMutation = useMutation({
    mutationFn: createTheme,
    onSuccess: () => {
      setName('');
      setTokens('{"primary":"#111827","secondary":"#64748b"}');
      queryClient.invalidateQueries({ queryKey: ['themes'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, tokens }: { id: string; tokens: Record<string, string> }) => updateTheme(id, tokens),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['themes'] }),
  });

  const publishMutation = useMutation({
    mutationFn: publishTheme,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['themes'] }),
  });

  const rollbackMutation = useMutation({
    mutationFn: () => rollbackTheme(rollbackTarget.themeId, rollbackTarget.targetId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['themes'] }),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Themes</h1>
        <p className="text-sm text-slate">Customize brand colors, logos, and runtime themes.</p>
      </header>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <h2 className="text-lg font-semibold">Create Theme</h2>
        <div className="mt-4 grid gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Theme name"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
          <textarea
            value={tokens}
            onChange={(e) => setTokens(e.target.value)}
            rows={4}
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
        </div>
        <button
          className="mt-4 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
          onClick={() => createMutation.mutate({ name, tokens: JSON.parse(tokens) })}
          disabled={createMutation.isPending}
        >
          Create Theme
        </button>
      </section>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <h2 className="text-lg font-semibold">Theme Library</h2>
        <div className="mt-4 space-y-3">
          {themes?.map((theme: { id: string; name: string; status: string; tokens: Record<string, string> }) => (
            <div key={theme.id} className="rounded-xl border border-slate/10 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{theme.name}</p>
                  <p className="text-xs text-slate">{theme.status}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="rounded-lg border border-slate/20 px-3 py-1 text-xs"
                    onClick={() => updateMutation.mutate({ id: theme.id, tokens: theme.tokens })}
                  >
                    Save Tokens
                  </button>
                  <button
                    className="rounded-lg border border-slate/20 px-3 py-1 text-xs"
                    onClick={() => publishMutation.mutate(theme.id)}
                  >
                    Publish
                  </button>
                </div>
              </div>
            </div>
          ))}
          {!themes?.length ? <p className="text-sm text-slate">No themes created.</p> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <h2 className="text-lg font-semibold">Rollback Theme</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            value={rollbackTarget.themeId}
            onChange={(e) => setRollbackTarget({ ...rollbackTarget, themeId: e.target.value })}
            placeholder="Theme ID"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
          <input
            value={rollbackTarget.targetId}
            onChange={(e) => setRollbackTarget({ ...rollbackTarget, targetId: e.target.value })}
            placeholder="Target Theme ID"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
        </div>
        <button
          className="mt-4 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
          onClick={() => rollbackMutation.mutate()}
          disabled={rollbackMutation.isPending}
        >
          Rollback Theme
        </button>
      </section>
    </div>
  );
}
