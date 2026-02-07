'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listThemes, createTheme, updateTheme, publishTheme } from '../../../services/theme.service';
import { listSchools } from '../../../services/school.service';
import { getSession } from '../../../services/auth.service';
import FullPageLoader from '../../../components/FullPageLoader';

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
  const [formError, setFormError] = useState('');

  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: getSession,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 5 * 60_000,
  });
  const isSuperAdmin = session?.role === 'SUPER_ADMIN';
  const effectiveSchoolId = isSuperAdmin ? schoolId : session?.schoolId ?? undefined;

  const { data: schools } = useQuery({
    queryKey: ['schools', 'all'],
    queryFn: () => listSchools({ limit: 100 }),
    enabled: isSuperAdmin,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 60_000,
  });

  const { data: themes } = useQuery({
    queryKey: ['themes', effectiveSchoolId],
    queryFn: () => listThemes({ schoolId: effectiveSchoolId }),
    enabled: Boolean(effectiveSchoolId),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 60_000,
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

  const isBusy = createMutation.isPending || updateMutation.isPending || publishMutation.isPending;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/40 p-6">
      {isBusy ? <FullPageLoader label="Processing..." /> : null}
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 p-8 text-white shadow-2xl">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative">
            <div className="mb-4 inline-flex items-center rounded-full bg-white/20 px-4 py-2 text-sm font-medium backdrop-blur-sm">
              <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
              Themes
            </div>
            <h1 className="text-4xl font-bold tracking-tight">Brand Themes</h1>
            <p className="mt-2 text-violet-100">Customize brand colors, logos, and runtime themes.</p>
          </div>
          <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10 animate-pulse"></div>
          <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/10 animate-bounce"></div>
        </div>

        {/* School Selector for Super Admin */}
        {isSuperAdmin && (
          <section className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-full bg-violet-100 p-2">
                <svg className="h-5 w-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">School Context</h2>
            </div>
            <select
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">Select school</option>
              {schools?.items.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name} ({school.code})
                </option>
              ))}
            </select>
          </section>
        )}

        {/* Create/Edit Theme Section */}
        <section className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-full bg-gradient-to-br from-violet-100 to-purple-100 p-3">
              <svg className="h-6 w-6 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{editingThemeId ? 'Edit Theme' : 'Create Theme'}</h2>
              <p className="text-sm text-gray-500">Configure brand colors and logo</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 mb-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Theme name"
              className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
            />
            <div className="rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-500 bg-gray-50">
              Applied to: {effectiveSchoolId ? 'Selected school' : 'Select a school'}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 mb-4">
            {([
              { key: 'navbarBg', label: 'Navbar' },
              { key: 'headerBg', label: 'Header' },
              { key: 'footerBg', label: 'Footer' },
              { key: 'buttonBg', label: 'Buttons' },
              { key: 'buttonText', label: 'Button Text' },
            ] as const).map((item) => (
              <label key={item.key} className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 hover:border-violet-300 transition-colors">
                <span className="text-sm font-medium text-gray-900">{item.label} Color</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 font-mono">{palette[item.key]}</span>
                  <input
                    type="color"
                    value={palette[item.key]}
                    onChange={(e) => setPalette({ ...palette, [item.key]: e.target.value })}
                    className="h-10 w-14 rounded-lg border border-gray-300 cursor-pointer"
                  />
                </div>
              </label>
            ))}
          </div>
          <div className="rounded-xl border border-gray-200 px-4 py-4 mb-4">
            <p className="text-sm font-semibold text-gray-900 mb-3">Logo Upload</p>
            <div className="flex flex-wrap items-center gap-4">
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
                className="text-sm text-gray-600"
              />
              {palette.logoUrl ? (
                <div className="flex items-center gap-2">
                  <img src={palette.logoUrl} alt="Logo preview" className="h-12 w-12 rounded-lg object-cover border border-gray-200" />
                  <span className="text-xs text-gray-500">Preview</span>
                </div>
              ) : (
                <span className="text-xs text-gray-400">No logo selected</span>
              )}
            </div>
          </div>
          <div className="rounded-xl border-2 border-gray-200 p-4 mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-3">Live Preview</p>
            <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
              <div className="px-4 py-3 text-sm text-white flex items-center gap-3" style={{ backgroundColor: tokens.navbarBg }}>
                {tokens.logoUrl && <img src={tokens.logoUrl} alt="Logo" className="h-6 w-6 rounded object-cover" />}
                <span className="font-medium">Navbar</span>
              </div>
              <div className="px-4 py-3 text-sm text-white font-medium" style={{ backgroundColor: tokens.headerBg }}>
                Header Section
              </div>
              <div className="px-4 py-4 bg-white">
                <button
                  className="rounded-lg px-5 py-2.5 text-sm font-semibold shadow-md"
                  style={{ backgroundColor: tokens.buttonBg, color: tokens.buttonText }}
                >
                  Primary Button
                </button>
              </div>
              <div className="px-4 py-3 text-sm text-white font-medium" style={{ backgroundColor: tokens.footerBg }}>
                Footer Section
              </div>
            </div>
          </div>
          <button
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:from-violet-700 hover:to-purple-700 hover:shadow-xl disabled:opacity-50"
            onClick={() => {
              let error = '';
              if (!name.trim()) error = 'Theme name is required.';
              else if (!effectiveSchoolId) error = 'Select a school to apply the theme.';
              setFormError(error);
              if (error) return;
              if (editingThemeId) {
                updateMutation.mutate({ id: editingThemeId, tokens });
              } else {
                createMutation.mutate({ name, tokens, schoolId: effectiveSchoolId });
              }
            }}
            disabled={isBusy || !name || !effectiveSchoolId}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {editingThemeId ? 'Update Theme' : 'Create Theme'}
          </button>
          {formError && <p className="mt-3 text-sm font-semibold text-rose-600">{formError}</p>}
        </section>

        {/* Theme Library */}
        <section className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-full bg-gradient-to-br from-blue-100 to-purple-100 p-3">
              <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Theme Library</h2>
              <p className="text-sm text-gray-500">{themes?.length ?? 0} themes available</p>
            </div>
          </div>
          <div className="space-y-4">
            {themes?.map((theme: { id: string; name: string; status: string; tokens: Record<string, string> }) => (
              <div key={theme.id} className="rounded-xl border border-gray-200 p-5 hover:border-violet-300 hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-500 text-white font-bold">
                      {theme.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{theme.name}</p>
                      <p className="text-xs text-gray-500">{theme.status}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
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
                      className="rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:from-violet-700 hover:to-purple-700"
                      onClick={() => publishMutation.mutate(theme.id)}
                    >
                      Publish
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['navbarBg', 'headerBg', 'footerBg', 'buttonBg', 'buttonText'] as const).map((key) => (
                    <span key={key} className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600">
                      <span className="inline-block h-3 w-3 rounded-full border border-gray-300" style={{ backgroundColor: theme.tokens?.[key] ?? '#e2e8f0' }} />
                      {key.replace('Bg', '').replace('buttonText', 'text')}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {!themes?.length && (
              <div className="flex flex-col items-center py-12 text-gray-400">
                <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
                <p className="mt-2 text-sm font-medium text-gray-600">No themes created</p>
                <p className="text-xs text-gray-500">Create your first theme above</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
