'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listThemes, createTheme, updateTheme, publishTheme } from '../../../services/theme.service';
import { listSchools } from '../../../services/school.service';
import { getSession } from '../../../services/auth.service';

export default function ThemesPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [palette, setPalette] = useState({
    navbarBg: '#0f172a',
    headerBg: '#111827',
    footerBg: '#0f172a',
    buttonBg: '#2563eb',
    buttonText: '#ffffff',
    logoUrl: '',
  });
  const [editingThemeId, setEditingThemeId] = useState<string | null>(null);

  const { data: session } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSuperAdmin = session?.role === 'SUPER_ADMIN';
  const effectiveSchoolId = isSuperAdmin ? schoolId : session?.schoolId ?? undefined;

  const { data: schools } = useQuery({
    queryKey: ['schools', 'all'],
    queryFn: () => listSchools({ limit: 100 }),
    enabled: isSuperAdmin,
  });

  const { data: themes } = useQuery({
    queryKey: ['themes', effectiveSchoolId],
    queryFn: () => listThemes({ schoolId: effectiveSchoolId }),
    enabled: Boolean(effectiveSchoolId),
  });

  const tokens = useMemo(
    () => ({
      navbarBg: palette.navbarBg,
      headerBg: palette.headerBg,
      footerBg: palette.footerBg,
      buttonBg: palette.buttonBg,
      buttonText: palette.buttonText,
      logoUrl: palette.logoUrl,
    }),
    [palette],
  );

  const createMutation = useMutation({
    mutationFn: createTheme,
    onSuccess: () => {
      setName('');
      setPalette({
        navbarBg: '#0f172a',
        headerBg: '#111827',
        footerBg: '#0f172a',
        buttonBg: '#2563eb',
        buttonText: '#ffffff',
        logoUrl: '',
      });
      setEditingThemeId(null);
      queryClient.invalidateQueries({ queryKey: ['themes'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, tokens }: { id: string; tokens: Record<string, string> }) =>
      updateTheme(id, tokens, effectiveSchoolId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['themes'] });
      setEditingThemeId(null);
    },
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => publishTheme(id, effectiveSchoolId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['themes'] }),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Themes</h1>
        <p className="text-sm text-slate">Customize brand colors, logos, and runtime themes.</p>
      </header>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        {isSuperAdmin ? (
          <div className="mb-4">
            <select
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
            >
              <option value="">Select school</option>
              {schools?.items.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name} ({school.code})
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <h2 className="text-lg font-semibold">Create Theme</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Theme name"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
          <div className="rounded-lg border border-slate/20 px-3 py-2 text-sm text-slate">
            Applied to: {effectiveSchoolId ? 'Selected school' : 'Select a school'}
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {([
            { key: 'navbarBg', label: 'Navbar' },
            { key: 'headerBg', label: 'Header' },
            { key: 'footerBg', label: 'Footer' },
            { key: 'buttonBg', label: 'Buttons' },
            { key: 'buttonText', label: 'Button Text' },
          ] as const).map((item) => (
            <label key={item.key} className="flex items-center justify-between rounded-xl border border-slate/10 px-4 py-3">
              <span className="text-sm font-medium text-ink">{item.label} Color</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate">{palette[item.key]}</span>
                <input
                  type="color"
                  value={palette[item.key]}
                  onChange={(e) => setPalette({ ...palette, [item.key]: e.target.value })}
                  className="h-8 w-12 rounded-md border border-slate/20 bg-transparent"
                />
              </div>
            </label>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-slate/10 px-4 py-3">
          <p className="text-xs font-semibold text-slate">Logo</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  setPalette((prev) => ({ ...prev, logoUrl: String(reader.result) }));
                };
                reader.readAsDataURL(file);
              }}
              className="text-xs"
            />
            {palette.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={palette.logoUrl} alt="Logo preview" className="h-10 w-10 rounded-md object-cover" />
            ) : (
              <span className="text-xs text-slate">No logo selected</span>
            )}
          </div>
        </div>
          <div className="mt-4 rounded-xl border border-slate/10 p-4">
            <p className="text-xs uppercase text-slate">Preview</p>
            <div className="mt-3 overflow-hidden rounded-lg border border-slate/10">
              <div className="px-4 py-2 text-sm text-white" style={{ backgroundColor: tokens.navbarBg }}>
              <div className="flex items-center gap-3">
                {tokens.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={tokens.logoUrl} alt="Logo" className="h-6 w-6 rounded object-cover" />
                ) : null}
                <span>Navbar</span>
              </div>
              </div>
            <div className="px-4 py-3 text-sm text-white" style={{ backgroundColor: tokens.headerBg }}>
              Header
            </div>
            <div className="px-4 py-3 text-sm">
              <button
                className="rounded-md px-4 py-2 text-sm font-semibold"
                style={{ backgroundColor: tokens.buttonBg, color: tokens.buttonText }}
              >
                Primary Button
              </button>
            </div>
            <div className="px-4 py-2 text-sm text-white" style={{ backgroundColor: tokens.footerBg }}>
              Footer
            </div>
          </div>
        </div>
        <button
          className="mt-4 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
          onClick={() => {
            if (editingThemeId) {
              updateMutation.mutate({ id: editingThemeId, tokens });
            } else {
              createMutation.mutate({ name, tokens, schoolId: effectiveSchoolId });
            }
          }}
          disabled={(createMutation.isPending || updateMutation.isPending) || !name || !effectiveSchoolId}
        >
          {editingThemeId ? 'Update Theme' : 'Create Theme'}
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
                    onClick={() => {
                      setName(theme.name);
                      setEditingThemeId(theme.id);
                      setPalette({
                        navbarBg: theme.tokens?.navbarBg ?? '#0f172a',
                        headerBg: theme.tokens?.headerBg ?? '#111827',
                        footerBg: theme.tokens?.footerBg ?? '#0f172a',
                        buttonBg: theme.tokens?.buttonBg ?? '#2563eb',
                        buttonText: theme.tokens?.buttonText ?? '#ffffff',
                        logoUrl: theme.tokens?.logoUrl ?? '',
                      });
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="rounded-lg border border-slate/20 px-3 py-1 text-xs"
                    onClick={() => publishMutation.mutate(theme.id)}
                  >
                    Publish
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(['navbarBg', 'headerBg', 'footerBg', 'buttonBg', 'buttonText'] as const).map((key) => (
                  <span key={key} className="flex items-center gap-2 rounded-full border border-slate/10 px-3 py-1 text-xs text-slate">
                    <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: theme.tokens?.[key] ?? '#e2e8f0' }} />
                    {key.replace('Bg', '').replace('buttonText', 'buttonText')}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {!themes?.length ? <p className="text-sm text-slate">No themes created.</p> : null}
        </div>
      </section>
    </div>
  );
}
