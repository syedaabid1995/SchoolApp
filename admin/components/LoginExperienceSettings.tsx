'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  defaultLoginExperience,
  getLoginExperienceSettings,
  updateLoginExperienceSettings,
  type LoginExperience,
  type LoginTypeConfig,
} from '../services/login-experience.service';
import FullPageLoader from './FullPageLoader';

const hexPattern = /^#[0-9a-fA-F]{6}$/;

const colorFields: Array<{ key: keyof LoginExperience['theme']; label: string }> = [
  { key: 'primaryColor', label: 'Primary Color' },
  { key: 'secondaryColor', label: 'Secondary Color' },
  { key: 'accentColor', label: 'Accent Color' },
  { key: 'backgroundColor', label: 'Page Background' },
  { key: 'panelColor', label: 'Form Panel' },
  { key: 'textColor', label: 'Text Color' },
  { key: 'mutedTextColor', label: 'Muted Text' },
  { key: 'borderColor', label: 'Border Color' },
  { key: 'buttonBackgroundColor', label: 'Button Color' },
  { key: 'buttonTextColor', label: 'Button Text' },
  { key: 'linkColor', label: 'Link Color' },
  { key: 'errorColor', label: 'Error Color' },
  { key: 'successColor', label: 'Success Color' },
];

const fieldClassName =
  'w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100';

export default function LoginExperienceSettings() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<LoginExperience>(defaultLoginExperience);
  const [formError, setFormError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

  const { data, isPending } = useQuery({
    queryKey: ['login-experience-settings'],
    queryFn: getLoginExperienceSettings,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: updateLoginExperienceSettings,
    onSuccess: (next) => {
      setForm(next);
      setSavedMessage('Login page settings saved.');
      queryClient.invalidateQueries({ queryKey: ['login-experience-settings'] });
    },
    onError: (error) => {
      setFormError((error as Error)?.message || 'Failed to save login settings.');
    },
  });

  const updateField = (key: keyof LoginExperience, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFormError('');
    setSavedMessage('');
  };

  const updateThemeField = (key: keyof LoginExperience['theme'], value: string) => {
    setForm((prev) => ({ ...prev, theme: { ...prev.theme, [key]: value } }));
    setFormError('');
    setSavedMessage('');
  };

  const updateFeatures = (value: string) => {
    setForm((prev) => ({
      ...prev,
      features: value
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean),
    }));
    setFormError('');
    setSavedMessage('');
  };

  const updateLoginType = (id: LoginTypeConfig['id'], patch: Partial<LoginTypeConfig>) => {
    setForm((prev) => ({
      ...prev,
      loginTypes: prev.loginTypes.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
    setFormError('');
    setSavedMessage('');
  };

  const validate = () => {
    if (!form.brandName.trim()) return 'Brand name is required.';
    if (!form.appName.trim()) return 'App name is required.';
    if (!form.consoleName.trim()) return 'Console name is required.';
    if (!form.headline.trim()) return 'Headline is required.';
    if (!form.subtitle.trim()) return 'Subtitle is required.';
    if (!form.loginHeading.trim()) return 'Login heading is required.';
    if (!form.loginSubtitle.trim()) return 'Login subtitle is required.';
    if (!form.leftPanelTitle.trim()) return 'Left panel title is required.';
    if (!form.leftPanelDescription.trim()) return 'Left panel description is required.';
    if (!form.features.length) return 'At least one feature highlight is required.';
    if (!form.footerText.trim()) return 'Footer text is required.';
    if (!form.supportText.trim()) return 'Support text is required.';
    try {
      new URL(form.supportUrl);
    } catch {
      return 'Support URL must be a valid URL.';
    }
    const invalidColor = colorFields.find((field) => !hexPattern.test(form.theme[field.key]));
    if (invalidColor) return `${invalidColor.label} must be a valid hex color.`;
    const missingRole = form.loginTypes.find((role) => !role.label.trim() || !role.description.trim());
    if (missingRole) return `${missingRole.label || missingRole.id} needs a label and description.`;
    if (!form.loginTypes.some((role) => role.enabled)) return 'At least one login type must be enabled.';
    return '';
  };

  const save = () => {
    const error = validate();
    setFormError(error);
    setSavedMessage('');
    if (error) return;
    updateMutation.mutate(form);
  };

  return (
    <section className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
      {(isPending || updateMutation.isPending) && <FullPageLoader label="Processing..." />}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Login Page Experience</h2>
          <p className="mt-1 text-sm text-gray-500">Control login colors, logo, text, and role options from settings.</p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={updateMutation.isPending}
          className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Save Login Settings
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-semibold text-gray-700">Brand Name</span>
          <input className={fieldClassName} value={form.brandName} onChange={(event) => updateField('brandName', event.target.value)} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-gray-700">App Name</span>
          <input className={fieldClassName} value={form.appName} onChange={(event) => updateField('appName', event.target.value)} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-gray-700">Console Name</span>
          <input className={fieldClassName} value={form.consoleName} onChange={(event) => updateField('consoleName', event.target.value)} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-gray-700">Login Button Text</span>
          <input className={fieldClassName} value={form.loginButtonText} onChange={(event) => updateField('loginButtonText', event.target.value)} />
        </label>
        <label className="space-y-2 lg:col-span-2">
          <span className="text-sm font-semibold text-gray-700">Headline</span>
          <input className={fieldClassName} value={form.headline} onChange={(event) => updateField('headline', event.target.value)} />
        </label>
        <label className="space-y-2 lg:col-span-2">
          <span className="text-sm font-semibold text-gray-700">Subtitle</span>
          <textarea className={fieldClassName} rows={2} value={form.subtitle} onChange={(event) => updateField('subtitle', event.target.value)} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-gray-700">Login Heading</span>
          <input className={fieldClassName} value={form.loginHeading} onChange={(event) => updateField('loginHeading', event.target.value)} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-gray-700">Forgot Password Text</span>
          <input className={fieldClassName} value={form.forgotPasswordText} onChange={(event) => updateField('forgotPasswordText', event.target.value)} />
        </label>
        <label className="space-y-2 lg:col-span-2">
          <span className="text-sm font-semibold text-gray-700">Login Subtitle</span>
          <textarea className={fieldClassName} rows={2} value={form.loginSubtitle} onChange={(event) => updateField('loginSubtitle', event.target.value)} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-gray-700">Left Panel Title</span>
          <input className={fieldClassName} value={form.leftPanelTitle} onChange={(event) => updateField('leftPanelTitle', event.target.value)} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-gray-700">Background Type</span>
          <select
            className={fieldClassName}
            value={form.backgroundType}
            onChange={(event) => setForm((prev) => ({ ...prev, backgroundType: event.target.value as LoginExperience['backgroundType'] }))}
          >
            <option value="solid">Solid</option>
            <option value="gradient">Gradient</option>
            <option value="image">Image</option>
            <option value="pattern">Pattern</option>
          </select>
        </label>
        <label className="space-y-2 lg:col-span-2">
          <span className="text-sm font-semibold text-gray-700">Left Panel Description</span>
          <textarea className={fieldClassName} rows={2} value={form.leftPanelDescription} onChange={(event) => updateField('leftPanelDescription', event.target.value)} />
        </label>
        <label className="space-y-2 lg:col-span-2">
          <span className="text-sm font-semibold text-gray-700">Feature Highlights</span>
          <textarea className={fieldClassName} rows={4} value={form.features.join('\n')} onChange={(event) => updateFeatures(event.target.value)} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-gray-700">Footer Text</span>
          <input className={fieldClassName} value={form.footerText} onChange={(event) => updateField('footerText', event.target.value)} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-gray-700">Support Text</span>
          <input className={fieldClassName} value={form.supportText} onChange={(event) => updateField('supportText', event.target.value)} />
        </label>
        <label className="space-y-2 lg:col-span-2">
          <span className="text-sm font-semibold text-gray-700">Security Note</span>
          <input className={fieldClassName} value={form.securityNote} onChange={(event) => updateField('securityNote', event.target.value)} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-gray-700">Logo URL</span>
          <input className={fieldClassName} value={form.logoUrl} onChange={(event) => updateField('logoUrl', event.target.value)} placeholder="https://... or data:image/..." />
          <input
            type="file"
            accept="image/*"
            className="block w-full text-sm text-gray-600"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => updateField('logoUrl', String(reader.result));
              reader.readAsDataURL(file);
            }}
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-gray-700">Support URL</span>
          <input className={fieldClassName} value={form.supportUrl} onChange={(event) => updateField('supportUrl', event.target.value)} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-gray-700">Login Background Image</span>
          <input className={fieldClassName} value={form.backgroundImageUrl} onChange={(event) => updateField('backgroundImageUrl', event.target.value)} placeholder="https://..." />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-gray-700">Illustration Image</span>
          <input className={fieldClassName} value={form.illustrationUrl} onChange={(event) => updateField('illustrationUrl', event.target.value)} placeholder="https://..." />
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700">
          <input
            type="checkbox"
            checked={form.leftPanelEnabled}
            onChange={(event) => setForm((prev) => ({ ...prev, leftPanelEnabled: event.target.checked }))}
          />
          Left panel enabled
        </label>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {colorFields.map((field) => (
          <label key={field.key} className="rounded-xl border border-gray-200 p-4">
            <span className="text-sm font-semibold text-gray-700">{field.label}</span>
            <div className="mt-3 flex items-center gap-3">
              <input
                type="color"
                value={hexPattern.test(form.theme[field.key]) ? form.theme[field.key] : '#000000'}
                onChange={(event) => updateThemeField(field.key, event.target.value)}
                className="h-10 w-14 cursor-pointer rounded-lg border border-gray-300"
              />
              <input className={fieldClassName} value={form.theme[field.key]} onChange={(event) => updateThemeField(field.key, event.target.value)} />
            </div>
          </label>
        ))}
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-bold uppercase tracking-wide text-gray-600">Login Options</h3>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          {form.loginTypes.map((role) => (
            <div key={role.id} className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold uppercase tracking-wide text-gray-500">{role.id}</p>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <input type="checkbox" checked={role.enabled} onChange={(event) => updateLoginType(role.id, { enabled: event.target.checked })} />
                  Enabled
                </label>
              </div>
              <div className="mt-4 grid gap-3">
                <input className={fieldClassName} value={role.label} onChange={(event) => updateLoginType(role.id, { label: event.target.value })} placeholder="Label" />
                <input className={fieldClassName} value={role.description} onChange={(event) => updateLoginType(role.id, { description: event.target.value })} placeholder="Description" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    className={fieldClassName}
                    value={role.authMode}
                    onChange={(event) => updateLoginType(role.id, { authMode: event.target.value as LoginTypeConfig['authMode'] })}
                    disabled={role.id !== 'parent'}
                  >
                    <option value="password">Email Password</option>
                    <option value="otp">Mobile OTP</option>
                  </select>
                  <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700">
                    <input
                      type="checkbox"
                      checked={role.requiresSchoolId}
                      onChange={(event) => updateLoginType(role.id, { requiresSchoolId: event.target.checked })}
                      disabled={role.id === 'parent'}
                    />
                    Require School ID
                  </label>
                </div>
                <input
                  className={fieldClassName}
                  value={role.unavailableMessage ?? ''}
                  onChange={(event) => updateLoginType(role.id, { unavailableMessage: event.target.value })}
                  placeholder="Disabled message"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-gray-200 p-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">Preview</p>
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <div className="px-4 py-5" style={{ background: form.theme.primaryColor, color: '#ffffff' }}>
            <div className="flex items-center gap-3">
              {form.logoUrl ? <img src={form.logoUrl} alt="Login logo preview" className="h-10 w-10 rounded-lg object-cover" /> : <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-900">{form.brandName.charAt(0).toUpperCase()}</div>}
              <div>
                <p className="font-semibold">{form.brandName}</p>
                <p className="text-xs opacity-80">{form.consoleName}</p>
              </div>
            </div>
            <p className="mt-4 text-lg font-bold">{form.headline}</p>
          </div>
          <div className="px-4 py-4" style={{ background: form.theme.panelColor, color: form.theme.textColor }}>
            <button className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: form.theme.primaryColor, color: '#ffffff' }}>
              Continue
            </button>
            <p className="mt-3 text-sm font-semibold" style={{ color: form.theme.errorColor }}>
              Error messages use this configured color.
            </p>
          </div>
        </div>
      </div>

      {formError ? <p className="mt-4 text-sm font-semibold text-rose-600">{formError}</p> : null}
      {savedMessage ? <p className="mt-4 text-sm font-semibold text-emerald-600">{savedMessage}</p> : null}
    </section>
  );
}
