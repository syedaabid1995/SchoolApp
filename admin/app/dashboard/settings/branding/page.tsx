'use client';

import type { ChangeEvent } from 'react';
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
  uploadBrandingAsset,
  type BrandingAssetType,
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

const acceptedImageTypes = ['image/png', 'image/jpeg', 'image/webp'];
const acceptedExtensions = ['png', 'jpg', 'jpeg', 'webp'];
const assetLimits: Record<
  BrandingAssetType,
  { maxBytes: number; minWidth: number; minHeight: number; maxWidth: number; maxHeight: number }
> = {
  logo: { maxBytes: 1 * 1024 * 1024, minWidth: 32, minHeight: 32, maxWidth: 1600, maxHeight: 1600 },
  compactLogo: { maxBytes: 1 * 1024 * 1024, minWidth: 32, minHeight: 32, maxWidth: 1200, maxHeight: 1200 },
  darkLogo: { maxBytes: 1 * 1024 * 1024, minWidth: 32, minHeight: 32, maxWidth: 1600, maxHeight: 1600 },
  favicon: { maxBytes: 512 * 1024, minWidth: 16, minHeight: 16, maxWidth: 512, maxHeight: 512 },
  background: { maxBytes: 3 * 1024 * 1024, minWidth: 320, minHeight: 160, maxWidth: 3840, maxHeight: 2160 },
  illustration: { maxBytes: 2 * 1024 * 1024, minWidth: 120, minHeight: 120, maxWidth: 2400, maxHeight: 2400 },
};

const formatBytes = (value: number) => {
  if (value >= 1024 * 1024) return `${value / 1024 / 1024} MB`;
  return `${Math.round(value / 1024)} KB`;
};

const normalizeBranding = (value: LoginBranding): LoginBranding => ({
  ...defaultLoginBranding,
  ...value,
  features: value.features?.filter((feature) => feature.trim()).slice(0, 8) ?? defaultLoginBranding.features,
  buttonBackgroundColor: value.buttonBackgroundColor || value.primaryColor,
  focusRingColor: value.focusRingColor || value.primaryColor,
  successColor: value.successColor || '#16a34a',
});

const isSafeUrl = (value?: string) => {
  if (!value?.trim()) return true;
  if (value.startsWith('/api/proxy/public/assets/branding?') || value.startsWith('/api/v1/public/assets/branding?')) {
    return true;
  }
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
};

const isUploadedBrandingAssetUrl = (value?: string) => {
  if (!value?.trim()) return true;
  return value.startsWith('/api/proxy/public/assets/branding?') || value.startsWith('/api/v1/public/assets/branding?');
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

const loadImageDimensions = (file: File) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Unable to read image dimensions.'));
    };
    image.src = url;
  });

function AssetUploadField({
  label,
  value,
  assetType,
  onUpload,
  onClear,
}: {
  label: string;
  value?: string;
  assetType: BrandingAssetType;
  onUpload: (file: File) => Promise<void>;
  onClear: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState('');
  const limit = assetLimits[assetType];

  const validateAndUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    setLocalError('');
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!acceptedImageTypes.includes(file.type) || !extension || !acceptedExtensions.includes(extension)) {
      setLocalError('Upload PNG, JPG, or WebP only. SVG and external links are not allowed.');
      return;
    }

    if (file.size > limit.maxBytes) {
      setLocalError(`${label} must be ${formatBytes(limit.maxBytes)} or smaller.`);
      return;
    }

    try {
      const dimensions = await loadImageDimensions(file);
      if (
        dimensions.width < limit.minWidth ||
        dimensions.height < limit.minHeight ||
        dimensions.width > limit.maxWidth ||
        dimensions.height > limit.maxHeight
      ) {
        setLocalError(`${label} must be between ${limit.minWidth}x${limit.minHeight} and ${limit.maxWidth}x${limit.maxHeight}px.`);
        return;
      }

      setUploading(true);
      await onUpload(file);
    } catch (err: any) {
      setLocalError(err?.response?.data?.error?.message || err?.message || 'Unable to upload image.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-400">
            {value ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={value} alt={`${label} preview`} className="h-full w-full object-contain" />
            ) : (
              'No image'
            )}
          </div>
          <div className="min-w-0 flex-1">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={validateAndUpload}
              disabled={uploading}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700"
            />
            <p className="mt-2 text-xs text-slate-500">
              PNG, JPG, or WebP. Max {formatBytes(limit.maxBytes)}. {limit.minWidth}x{limit.minHeight} to {limit.maxWidth}x{limit.maxHeight}px.
            </p>
          </div>
          {value ? (
            <button
              type="button"
              onClick={onClear}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Remove
            </button>
          ) : null}
        </div>
        {uploading ? <p className="mt-2 text-xs font-semibold text-blue-700">Uploading...</p> : null}
        {localError ? <p className="mt-2 text-xs font-semibold text-rose-700">{localError}</p> : null}
      </div>
    </div>
  );
}

export default function LoginBrandingSettingsPage({ embedded = false }: { embedded?: boolean }) {
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

  const uploadAsset = async (field: keyof LoginBranding, assetType: BrandingAssetType, file: File) => {
    setError('');
    setMessage('');
    const result = await uploadBrandingAsset(file, assetType, params);
    setForm((current) => ({ ...current, [field]: result.url }));
    setMessage(`${file.name} uploaded successfully.`);
  };

  const validationError = useMemo(() => {
    if (!form.appName.trim()) return 'App name is required.';
    if (!form.loginHeading.trim()) return 'Login heading is required.';
    if (!form.loginSubtitle.trim()) return 'Login subtitle is required.';
    if (!form.features.filter((feature) => feature.trim()).length) return 'At least one feature is required.';
    const invalidColor = colorFields.find((field) => !hexPattern.test(String(form[field.key] ?? '')));
    if (invalidColor) return `${invalidColor.label}: Enter a valid hex color.`;
    const logoFields: Array<keyof LoginBranding> = ['logoUrl', 'darkLogoUrl', 'compactLogoUrl', 'faviconUrl'];
    if (logoFields.some((field) => !isUploadedBrandingAssetUrl(String(form[field] ?? '')))) return 'Logo and favicon images must be uploaded. External links are not allowed.';
    const urlFields: Array<keyof LoginBranding> = ['backgroundImageUrl', 'illustrationUrl'];
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
      {!embedded ? <PageHeader title="Branding & Theme" subtitle="Customize platform identity, login branding, colors, and published theme values." /> : null}

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

      <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Basic Identity</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <TextField label="App name" value={form.appName} onChange={(value) => updateField('appName', value)} />
              <TextField label="School name" value={form.schoolName ?? ''} onChange={(value) => updateField('schoolName', value)} />
              <AssetUploadField
                label="Primary logo"
                value={form.logoUrl}
                assetType="logo"
                onUpload={(file) => uploadAsset('logoUrl', 'logo', file)}
                onClear={() => updateField('logoUrl', '')}
              />
              <AssetUploadField
                label="Compact logo"
                value={form.compactLogoUrl}
                assetType="compactLogo"
                onUpload={(file) => uploadAsset('compactLogoUrl', 'compactLogo', file)}
                onClear={() => updateField('compactLogoUrl', '')}
              />
              <AssetUploadField
                label="Dark logo"
                value={form.darkLogoUrl}
                assetType="darkLogo"
                onUpload={(file) => uploadAsset('darkLogoUrl', 'darkLogo', file)}
                onClear={() => updateField('darkLogoUrl', '')}
              />
              <AssetUploadField
                label="Favicon"
                value={form.faviconUrl}
                assetType="favicon"
                onUpload={(file) => uploadAsset('faviconUrl', 'favicon', file)}
                onClear={() => updateField('faviconUrl', '')}
              />
            </div>
            <p className="mt-3 text-xs text-slate-500">
              External logo links and SVG uploads are blocked. Uploaded files are renamed before storage.
            </p>
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
              <AssetUploadField
                label="Background image"
                value={form.backgroundImageUrl}
                assetType="background"
                onUpload={(file) => uploadAsset('backgroundImageUrl', 'background', file)}
                onClear={() => updateField('backgroundImageUrl', '')}
              />
              <AssetUploadField
                label="Illustration image"
                value={form.illustrationUrl}
                assetType="illustration"
                onUpload={(file) => uploadAsset('illustrationUrl', 'illustration', file)}
                onClear={() => updateField('illustrationUrl', '')}
              />
              <TextField label="Border radius" value={form.borderRadius ?? '24px'} onChange={(value) => updateField('borderRadius', value)} />
              <TextField label="Card shadow" value={form.cardShadow ?? ''} onChange={(value) => updateField('cardShadow', value)} />
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
                <input type="checkbox" checked={form.leftPanelEnabled !== false} onChange={(event) => updateField('leftPanelEnabled', event.target.checked)} />
                Left panel enabled
              </label>
            </div>
          </section>
      </div>
    </div>
  );
}
