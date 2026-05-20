'use client';

import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../../../components/PageHeader';
import Button from '../../../../components/Button';
import FullPageLoader from '../../../../components/FullPageLoader';
import { getSession } from '../../../../services/auth.service';
import { listSchools } from '../../../../services/school.service';
import {
  defaultLoginBranding,
  getLoginBrandingSettings,
  publishLoginBranding,
  resetLoginBranding,
  rollbackLoginBranding,
  updateLoginBranding,
  type LoginBranding,
} from '../../../../services/branding.service';

const hexPattern = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const logoSizeOptions = [
  { label: 'Small', value: '44px' },
  { label: 'Medium', value: '56px' },
  { label: 'Large', value: '72px' },
];

const colorFields: Array<{ key: keyof LoginBranding; label: string }> = [
  { key: 'primaryColor', label: 'Primary' },
  { key: 'secondaryColor', label: 'Secondary' },
  { key: 'accentColor', label: 'Accent' },
  { key: 'backgroundColor', label: 'Background' },
  { key: 'cardBackgroundColor', label: 'Card background' },
  { key: 'textColor', label: 'Text' },
  { key: 'mutedTextColor', label: 'Muted text' },
  { key: 'borderColor', label: 'Border' },
  { key: 'buttonBackgroundColor', label: 'Button background' },
  { key: 'buttonTextColor', label: 'Button text' },
  { key: 'linkColor', label: 'Link' },
  { key: 'focusRingColor', label: 'Focus ring' },
  { key: 'errorColor', label: 'Error' },
  { key: 'successColor', label: 'Success' },
];

const fieldClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

const normalizeBranding = (value: LoginBranding): LoginBranding => ({
  ...defaultLoginBranding,
  ...value,
  features: value.features?.filter((feature) => feature.trim()).slice(0, 8) ?? defaultLoginBranding.features,
  buttonBackgroundColor: value.buttonBackgroundColor || value.primaryColor,
  focusRingColor: value.focusRingColor || value.primaryColor,
  successColor: value.successColor || '#16a34a',
});

const initials = (branding: LoginBranding) => {
  const source = branding.schoolName || branding.appName || 'School';
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
};

const isSafeUrl = (value?: string) => {
  if (!value?.trim()) return true;
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
};

const previewBackground = (branding: LoginBranding): CSSProperties => {
  if (branding.backgroundType === 'gradient') {
    return { background: `linear-gradient(135deg, ${branding.gradientFrom || branding.backgroundColor}, ${branding.gradientTo || branding.cardBackgroundColor})` };
  }
  if ((branding.backgroundType === 'image' || branding.backgroundType === 'pattern') && branding.backgroundImageUrl) {
    return {
      backgroundColor: branding.backgroundColor,
      backgroundImage: `linear-gradient(rgba(248, 250, 252, 0.72), rgba(248, 250, 252, 0.9)), url(${branding.backgroundImageUrl})`,
      backgroundSize: branding.backgroundType === 'pattern' ? '280px' : 'cover',
      backgroundPosition: 'center',
    };
  }
  return { backgroundColor: branding.backgroundColor };
};

function TextField({
  label,
  value,
  onChange,
  multiline = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      {multiline ? (
        <textarea className={fieldClass} rows={3} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input className={fieldClass} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <div className="flex gap-2">
        <input
          type="color"
          value={hexPattern.test(value) && value.length === 7 ? value : '#000000'}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-12 rounded-xl border border-slate-300 bg-white p-1"
        />
        <input className={fieldClass} value={value} onChange={(event) => onChange(event.target.value)} />
      </div>
    </label>
  );
}

function PreviewLogo({ branding }: { branding: LoginBranding }) {
  const [failed, setFailed] = useState(false);
  if (branding.logoUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={branding.logoUrl}
        alt={`${branding.schoolName || branding.appName} logo`}
        onError={() => setFailed(true)}
        className="h-[var(--brand-logo-size)] w-[var(--brand-logo-size)] rounded-[var(--brand-radius-half)] object-cover"
      />
    );
  }

  return (
    <span className="flex h-[var(--brand-logo-size)] w-[var(--brand-logo-size)] items-center justify-center rounded-[var(--brand-radius-half)] bg-[var(--brand-primary)] text-sm font-bold text-[var(--brand-button-text)]">
      {initials(branding)}
    </span>
  );
}

function LoginPreview({ branding }: { branding: LoginBranding }) {
  const style = {
    '--brand-primary': branding.primaryColor,
    '--brand-secondary': branding.secondaryColor,
    '--brand-accent': branding.accentColor,
    '--brand-bg': branding.backgroundColor,
    '--brand-card': branding.cardBackgroundColor,
    '--brand-text': branding.textColor,
    '--brand-muted': branding.mutedTextColor,
    '--brand-border': branding.borderColor,
    '--brand-button': branding.buttonBackgroundColor || branding.primaryColor,
    '--brand-button-text': branding.buttonTextColor,
    '--brand-link': branding.linkColor,
    '--brand-error': branding.errorColor,
    '--brand-radius': branding.borderRadius || '24px',
    '--brand-radius-half': `calc(${branding.borderRadius || '24px'} / 2)`,
    '--brand-logo-size': branding.logoSize || '56px',
    '--brand-shadow': branding.cardShadow || '0 20px 45px rgba(15, 23, 42, 0.12)',
    ...previewBackground(branding),
  } as CSSProperties;

  return (
    <section className="sticky top-24 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Live Preview</h2>
          <p className="text-sm text-slate-500">Preview updates as fields change.</p>
        </div>
      </div>
      <div className="overflow-hidden rounded-[var(--brand-radius)] border border-[var(--brand-border)] text-[var(--brand-text)]" style={style}>
        <div className="grid min-h-[560px] gap-0 lg:grid-cols-[1fr_390px]">
          {branding.leftPanelEnabled !== false ? (
            <aside className="hidden flex-col justify-between bg-[var(--brand-secondary)] p-7 text-[var(--brand-button-text)] lg:flex">
              <div className="flex items-center gap-3">
                <PreviewLogo branding={branding} />
                <div className="min-w-0">
                  <p className="truncate font-bold">{branding.schoolName || branding.appName}</p>
                  <p className="text-xs opacity-75">{branding.appName}</p>
                </div>
              </div>
              <div>
                <h3 className="text-3xl font-bold leading-tight">{branding.leftPanelTitle}</h3>
                <p className="mt-4 text-sm leading-6 opacity-80">{branding.leftPanelDescription}</p>
                {branding.illustrationUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={branding.illustrationUrl} alt={`${branding.appName} preview`} className="mt-5 max-h-36 w-full rounded-[var(--brand-radius-half)] object-cover" />
                ) : null}
              </div>
              <div className="space-y-2">
                {branding.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-2 rounded-[var(--brand-radius-half)] border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold">
                    <span className="h-2 w-2 rounded-full bg-[var(--brand-accent)]" />
                    {feature}
                  </div>
                ))}
                <p className="pt-1 text-xs opacity-75">{branding.securityNote}</p>
              </div>
            </aside>
          ) : null}
          <main className="flex items-center justify-center p-5">
            <div className="w-full max-w-sm rounded-[var(--brand-radius)] border border-[var(--brand-border)] bg-[var(--brand-card)] p-5 shadow-[var(--brand-shadow)]">
              <div className="mb-5 flex items-center gap-3">
                <PreviewLogo branding={branding} />
                <div className="min-w-0">
                  <p className="truncate font-bold">{branding.schoolName || branding.appName}</p>
                  <p className="text-xs text-[var(--brand-muted)]">{branding.appName}</p>
                </div>
              </div>
              <h3 className="text-2xl font-bold">{branding.loginHeading}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--brand-muted)]">{branding.loginSubtitle}</p>
              <div className="mt-5 space-y-3">
                {['School Code / School ID', 'Email or Username', 'Password'].map((label) => (
                  <div key={label}>
                    <p className="mb-1 text-xs font-semibold">{label}</p>
                    <div className="h-10 rounded-[var(--brand-radius-half)] border border-[var(--brand-border)] bg-[var(--brand-bg)]" />
                  </div>
                ))}
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--brand-muted)]">Remember me</span>
                  <span className="font-semibold text-[var(--brand-link)]">{branding.forgotPasswordText}</span>
                </div>
                <button className="w-full rounded-[var(--brand-radius-half)] bg-[var(--brand-button)] px-4 py-3 text-sm font-bold text-[var(--brand-button-text)]">
                  {branding.loginButtonText}
                </button>
              </div>
              <div className="mt-5 border-t border-[var(--brand-border)] pt-4 text-center">
                <p className="text-xs text-[var(--brand-muted)]">{branding.supportText}</p>
                <p className="mt-1 text-[11px] text-[var(--brand-muted)]">{branding.footerText}</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    </section>
  );
}

export default function LoginBrandingSettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [form, setForm] = useState<LoginBranding>(defaultLoginBranding);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const sessionQuery = useQuery({
    queryKey: ['session'],
    queryFn: getSession,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const role = sessionQuery.data?.role;
  const isAllowed = role === 'SUPER_ADMIN' || role === 'SCHOOL_ADMIN';
  const params = role === 'SUPER_ADMIN' && selectedSchoolId ? { schoolId: selectedSchoolId } : undefined;

  useEffect(() => {
    if (!sessionQuery.isLoading && role && !isAllowed) {
      router.replace('/dashboard');
    }
  }, [isAllowed, role, router, sessionQuery.isLoading]);

  const schoolsQuery = useQuery({
    queryKey: ['branding-schools'],
    queryFn: () => listSchools({ limit: 100 }),
    enabled: role === 'SUPER_ADMIN',
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const brandingQuery = useQuery({
    queryKey: ['login-branding-settings', selectedSchoolId, role],
    queryFn: () => getLoginBrandingSettings(params),
    enabled: isAllowed,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (brandingQuery.data) setForm(normalizeBranding(brandingQuery.data));
  }, [brandingQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => updateLoginBranding(normalizeBranding(form), params),
    onSuccess: (next) => {
      setForm(normalizeBranding(next));
      setMessage('Login branding saved.');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['login-branding-settings'] });
    },
    onError: (err: any) => setError(err?.response?.data?.error?.message || err?.response?.data?.message || 'Unable to save branding.'),
  });

  const publishMutation = useMutation({
    mutationFn: () => publishLoginBranding(params),
    onSuccess: (next) => {
      setForm(normalizeBranding(next));
      setMessage('Login branding published.');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['login-branding-settings'] });
    },
    onError: (err: any) => setError(err?.response?.data?.error?.message || err?.response?.data?.message || 'Unable to publish branding.'),
  });

  const rollbackMutation = useMutation({
    mutationFn: () => rollbackLoginBranding(params),
    onSuccess: (next) => {
      setForm(normalizeBranding(next));
      setMessage('Login branding rolled back.');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['login-branding-settings'] });
    },
    onError: (err: any) => setError(err?.response?.data?.error?.message || err?.response?.data?.message || 'No branding history is available.'),
  });

  const resetMutation = useMutation({
    mutationFn: () => resetLoginBranding(params),
    onSuccess: (next) => {
      setForm(normalizeBranding(next));
      setMessage('Login branding reset to default values.');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['login-branding-settings'] });
    },
    onError: (err: any) => setError(err?.response?.data?.error?.message || err?.response?.data?.message || 'Unable to reset branding.'),
  });

  const isBusy = brandingQuery.isLoading || saveMutation.isPending || publishMutation.isPending || rollbackMutation.isPending || resetMutation.isPending;

  const updateField = <K extends keyof LoginBranding>(key: K, value: LoginBranding[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError('');
    setMessage('');
  };

  const validationError = useMemo(() => {
    if (!form.appName.trim()) return 'App name is required.';
    if (!form.loginHeading.trim()) return 'Login heading is required.';
    if (!form.loginSubtitle.trim()) return 'Login subtitle is required.';
    if (!form.features.filter((feature) => feature.trim()).length) return 'At least one feature is required.';
    const invalidColor = colorFields.find((field) => !hexPattern.test(String(form[field.key] ?? '')));
    if (invalidColor) return `${invalidColor.label}: Enter a valid hex color.`;
    const urlFields: Array<keyof LoginBranding> = ['logoUrl', 'darkLogoUrl', 'compactLogoUrl', 'faviconUrl', 'backgroundImageUrl', 'illustrationUrl'];
    if (urlFields.some((field) => !isSafeUrl(String(form[field] ?? '')))) return 'Image URLs must use http or https.';
    if ((form.footerText ?? '').length > 180) return 'Footer text is too long.';
    if ((form.supportText ?? '').length > 180) return 'Support text is too long.';
    return '';
  }, [form]);

  const save = () => {
    setError(validationError);
    if (validationError) return;
    saveMutation.mutate();
  };

  if (sessionQuery.isLoading) return <FullPageLoader label="Loading branding settings..." />;
  if (!isAllowed) return null;

  return (
    <div className="space-y-6">
      {isBusy ? <FullPageLoader label="Updating branding..." /> : null}
      <PageHeader title="Login Branding" subtitle="Customize the login experience for your school or platform." />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Branding Scope</h2>
            <p className="mt-1 text-sm text-slate-500">
              {role === 'SUPER_ADMIN' ? 'Edit platform default branding or a selected school.' : 'Edit branding for your school.'}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {role === 'SUPER_ADMIN' ? (
              <select className={fieldClass} value={selectedSchoolId} onChange={(event) => setSelectedSchoolId(event.target.value)}>
                <option value="">Platform default branding</option>
                {schoolsQuery.data?.items.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name} ({school.code})
                  </option>
                ))}
              </select>
            ) : null}
            <Button variant="outline" onClick={() => window.open('/login', '_blank', 'noopener,noreferrer')}>
              Preview Login
            </Button>
            <Button onClick={save} disabled={Boolean(validationError)} loading={saveMutation.isPending}>
              Save Draft
            </Button>
            <Button variant="secondary" onClick={() => window.confirm('Publish login branding now?') && publishMutation.mutate()} loading={publishMutation.isPending}>
              Publish
            </Button>
            <Button variant="outline" onClick={() => window.confirm('Rollback login branding to the latest saved history?') && rollbackMutation.mutate()} loading={rollbackMutation.isPending}>
              Rollback
            </Button>
            <Button variant="danger" onClick={() => window.confirm('Reset login branding to default values? This cannot be undone unless theme history is available.') && resetMutation.mutate()} loading={resetMutation.isPending}>
              Reset
            </Button>
          </div>
        </div>
        {message ? <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
        {(error || validationError) ? <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error || validationError}</p> : null}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_520px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Basic Identity</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <TextField label="App name" value={form.appName} onChange={(value) => updateField('appName', value)} />
              <TextField label="School name" value={form.schoolName ?? ''} onChange={(value) => updateField('schoolName', value)} />
              <TextField label="Logo URL" value={form.logoUrl ?? ''} onChange={(value) => updateField('logoUrl', value)} placeholder="https://..." />
              <TextField label="Compact logo URL" value={form.compactLogoUrl ?? ''} onChange={(value) => updateField('compactLogoUrl', value)} placeholder="https://..." />
              <TextField label="Dark logo URL" value={form.darkLogoUrl ?? ''} onChange={(value) => updateField('darkLogoUrl', value)} placeholder="https://..." />
              <TextField label="Favicon URL" value={form.faviconUrl ?? ''} onChange={(value) => updateField('faviconUrl', value)} placeholder="https://..." />
            </div>
            <p className="mt-3 text-xs text-slate-500">Upload support is not wired yet. Use hosted image URLs for now.</p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Login Text</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <TextField label="Login heading" value={form.loginHeading} onChange={(value) => updateField('loginHeading', value)} />
              <TextField label="Login subtitle" value={form.loginSubtitle} onChange={(value) => updateField('loginSubtitle', value)} />
              <TextField label="Left panel title" value={form.leftPanelTitle} onChange={(value) => updateField('leftPanelTitle', value)} />
              <TextField label="Left panel description" value={form.leftPanelDescription} onChange={(value) => updateField('leftPanelDescription', value)} multiline />
              <TextField label="Security note" value={form.securityNote} onChange={(value) => updateField('securityNote', value)} />
              <TextField label="Support text" value={form.supportText} onChange={(value) => updateField('supportText', value)} />
              <TextField label="Footer text" value={form.footerText} onChange={(value) => updateField('footerText', value)} />
              <TextField label="Forgot password text" value={form.forgotPasswordText} onChange={(value) => updateField('forgotPasswordText', value)} />
              <TextField label="Login button text" value={form.loginButtonText} onChange={(value) => updateField('loginButtonText', value)} />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-slate-950">Feature Highlights</h2>
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateField('features', [...form.features, 'New feature highlight'].slice(0, 8))}
                disabled={form.features.length >= 8}
              >
                Add Feature
              </Button>
            </div>
            <div className="mt-5 space-y-3">
              {form.features.map((feature, index) => (
                <div key={`${feature}-${index}`} className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
                  <input
                    className={fieldClass}
                    value={feature}
                    onChange={(event) => updateField('features', form.features.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))}
                  />
                  <Button size="sm" variant="outline" onClick={() => updateField('features', form.features.map((item, itemIndex) => itemIndex === index - 1 ? feature : itemIndex === index ? form.features[index - 1] : item))} disabled={index === 0}>
                    Up
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => updateField('features', form.features.map((item, itemIndex) => itemIndex === index + 1 ? feature : itemIndex === index ? form.features[index + 1] : item))} disabled={index === form.features.length - 1}>
                    Down
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => updateField('features', form.features.filter((_, itemIndex) => itemIndex !== index))} disabled={form.features.length <= 1}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Colors</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {colorFields.map((field) => (
                <ColorField
                  key={String(field.key)}
                  label={field.label}
                  value={String(form[field.key] ?? '')}
                  onChange={(value) => updateField(field.key, value as never)}
                />
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Background & Design</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Background type</span>
                <select className={fieldClass} value={form.backgroundType ?? 'gradient'} onChange={(event) => updateField('backgroundType', event.target.value as LoginBranding['backgroundType'])}>
                  <option value="solid">Solid</option>
                  <option value="gradient">Gradient</option>
                  <option value="image">Image</option>
                  <option value="pattern">Pattern</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Logo size</span>
                <select className={fieldClass} value={form.logoSize ?? '56px'} onChange={(event) => updateField('logoSize', event.target.value)}>
                  {logoSizeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <ColorField label="Gradient from" value={form.gradientFrom ?? '#eff6ff'} onChange={(value) => updateField('gradientFrom', value)} />
              <ColorField label="Gradient to" value={form.gradientTo ?? '#ffffff'} onChange={(value) => updateField('gradientTo', value)} />
              <TextField label="Background image URL" value={form.backgroundImageUrl ?? ''} onChange={(value) => updateField('backgroundImageUrl', value)} placeholder="https://..." />
              <TextField label="Illustration image URL" value={form.illustrationUrl ?? ''} onChange={(value) => updateField('illustrationUrl', value)} placeholder="https://..." />
              <TextField label="Border radius" value={form.borderRadius ?? '24px'} onChange={(value) => updateField('borderRadius', value)} />
              <TextField label="Card shadow" value={form.cardShadow ?? ''} onChange={(value) => updateField('cardShadow', value)} />
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
                <input type="checkbox" checked={form.leftPanelEnabled !== false} onChange={(event) => updateField('leftPanelEnabled', event.target.checked)} />
                Left panel enabled
              </label>
            </div>
          </section>
        </div>

        <LoginPreview branding={normalizeBranding(form)} />
      </div>
    </div>
  );
}
