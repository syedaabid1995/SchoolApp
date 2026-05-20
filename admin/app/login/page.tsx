'use client';

import type { CSSProperties, FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '../../services/auth.service';
import {
  defaultLoginBranding,
  getLoginBranding,
  type LoginBranding,
} from '../../services/branding.service';
import { resolveSchoolSubdomainFromHost } from '../../lib/school-domain';

type FieldErrors = Partial<Record<'schoolCode' | 'identifier' | 'password' | 'forgotEmail' | 'forgotSchoolCode' | 'form', string>>;
type RememberedLogin = {
  rememberMe?: boolean;
  email?: string;
  username?: string;
  schoolCode?: string;
  schoolId?: string;
};
type BrandStyle = CSSProperties & Record<`--brand-${string}`, string>;

const genericLoginError = 'Invalid login details. Please try again.';
const rememberStorageKey = 'login.remember';
const lastAccountStorageKey = 'login.lastAccount';
const demoPassword = process.env.NODE_ENV === 'development' ? 'Password@123' : '';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

const formCopy = {
  schoolLabel: 'School Code / School ID',
  schoolPlaceholder: 'Enter school code or ID',
  identifierLabel: 'Email or Username',
  identifierPlaceholder: 'name@school.com',
  passwordLabel: 'Password',
  passwordPlaceholder: 'Enter password',
  showPassword: 'Show password',
  hidePassword: 'Hide password',
  rememberMe: 'Remember me',
  forgotHeading: 'Reset password',
  forgotSubtitle: 'Enter your account details. If an account exists, reset instructions will be sent.',
  forgotEmailLabel: 'Account email',
  sendReset: 'Send reset instructions',
  backToLogin: 'Back to login',
  loading: 'Processing...',
  brandingLoading: 'Updating branding',
  invalidSchool: 'Enter a valid school code or school ID.',
  identifierRequired: 'Email or username is required.',
  passwordRequired: 'Password is required.',
  passwordLength: 'Password must be at least 8 characters.',
  resetEmailRequired: 'Email address is required.',
  resetEmailInvalid: 'Enter a valid email address.',
  resetGenericSuccess: 'If an account exists, password reset instructions have been sent.',
} as const;

const inputClassName =
  'w-full rounded-[var(--brand-radius-half)] border bg-[var(--brand-card)] px-4 py-3 text-sm text-[var(--brand-text)] outline-none transition placeholder:text-[var(--brand-muted)] focus:border-[var(--brand-focus)] focus:ring-4 focus:ring-[var(--brand-focus-soft)]';

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const isValidSchoolInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return uuidPattern.test(trimmed) || /^[a-zA-Z0-9_-]{2,64}$/.test(trimmed);
};

const hexToRgb = (hex: string) => {
  const normalized = hex.replace('#', '');
  const value = Number.parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
};

const rgba = (hex: string, alpha: number) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const initialsFromBranding = (branding: LoginBranding) => {
  const source = branding.schoolName || branding.appName || defaultLoginBranding.appName;
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
};

const buildBackgroundStyle = (branding: LoginBranding): CSSProperties => {
  if (branding.backgroundType === 'image' && branding.backgroundImageUrl) {
    return {
      backgroundColor: 'var(--brand-bg)',
      backgroundImage: `linear-gradient(${rgba(branding.backgroundColor, 0.72)}, ${rgba(branding.backgroundColor, 0.86)}), url(${branding.backgroundImageUrl})`,
      backgroundPosition: 'center',
      backgroundSize: 'cover',
    };
  }
  if (branding.backgroundType === 'pattern' && branding.backgroundImageUrl) {
    return {
      backgroundColor: 'var(--brand-bg)',
      backgroundImage: `url(${branding.backgroundImageUrl})`,
      backgroundRepeat: 'repeat',
    };
  }
  if (branding.backgroundType === 'gradient') {
    return {
      background: `linear-gradient(135deg, ${branding.gradientFrom ?? branding.backgroundColor}, ${branding.gradientTo ?? branding.cardBackgroundColor})`,
    };
  }
  return { backgroundColor: 'var(--brand-bg)' };
};

const clearRememberedLogin = () => {
  localStorage.removeItem(rememberStorageKey);
};

const clearLastAccount = () => {
  localStorage.removeItem(lastAccountStorageKey);
};

const safeRememberedLogin = (value: unknown): RememberedLogin | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  if (source.rememberMe !== true) return null;

  const safe: RememberedLogin = { rememberMe: true };
  if (typeof source.email === 'string') safe.email = source.email.trim();
  if (typeof source.username === 'string') safe.username = source.username.trim();
  if (typeof source.schoolCode === 'string') safe.schoolCode = source.schoolCode.trim();
  if (typeof source.schoolId === 'string') safe.schoolId = source.schoolId.trim();

  return safe;
};

const safeLastAccount = (value: unknown): RememberedLogin | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const safe: RememberedLogin = {};
  if (typeof source.email === 'string') safe.email = source.email.trim();
  if (typeof source.username === 'string') safe.username = source.username.trim();
  if (typeof source.schoolCode === 'string') safe.schoolCode = source.schoolCode.trim();
  if (typeof source.schoolId === 'string') safe.schoolId = source.schoolId.trim();
  return safe.email || safe.username ? safe : null;
};

const readRememberedLogin = () => {
  const raw = localStorage.getItem(rememberStorageKey);
  if (!raw) return null;

  try {
    const safe = safeRememberedLogin(JSON.parse(raw));
    if (!safe) {
      clearRememberedLogin();
      return null;
    }

    // Re-save only non-secret identifiers so any old password/token fields are purged.
    localStorage.setItem(rememberStorageKey, JSON.stringify(safe));
    return safe;
  } catch {
    clearRememberedLogin();
    return null;
  }
};

const readLastAccount = () => {
  const raw = localStorage.getItem(lastAccountStorageKey);
  if (!raw) return null;

  try {
    const safe = safeLastAccount(JSON.parse(raw));
    if (!safe) {
      clearLastAccount();
      return null;
    }
    localStorage.setItem(lastAccountStorageKey, JSON.stringify(safe));
    return safe;
  } catch {
    clearLastAccount();
    return null;
  }
};

function BrandLogo({ branding, className }: { branding: LoginBranding; className?: string }) {
  const [failed, setFailed] = useState(false);
  const logoUrl = branding.logoUrl || branding.compactLogoUrl;

  useEffect(() => {
    setFailed(false);
  }, [logoUrl]);

  if (logoUrl && !failed) {
    return (
      <img
        src={logoUrl}
        alt={`${branding.schoolName || branding.appName} logo`}
        className={`object-contain ${className ?? ''}`}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      className={`flex items-center justify-center rounded-[var(--brand-radius-half)] bg-[var(--brand-primary)] font-bold text-[var(--brand-button-text)] ${className ?? ''}`}
      aria-label={`${branding.schoolName || branding.appName} logo`}
      role="img"
    >
      {initialsFromBranding(branding)}
    </span>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [branding, setBranding] = useState<LoginBranding>(defaultLoginBranding);
  const [brandingLoading, setBrandingLoading] = useState(false);
  const [schoolCode, setSchoolCode] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState(demoPassword);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSchoolCode, setForgotSchoolCode] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hostSchoolCode, setHostSchoolCode] = useState<string | null>(null);
  const [domainNotFound, setDomainNotFound] = useState(false);
  const [passwordOnlyMode, setPasswordOnlyMode] = useState(false);

  const leftPanelEnabled = branding.leftPanelEnabled !== false;
  const pageShellClassName = leftPanelEnabled
    ? 'mx-auto grid min-h-screen w-full max-w-7xl items-center gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(390px,500px)] lg:px-8'
    : 'mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center px-4 py-6 sm:px-6';
  const brandStyle: BrandStyle = {
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
    '--brand-success': branding.successColor || '#16a34a',
    '--brand-focus': branding.focusRingColor || branding.primaryColor,
    '--brand-focus-soft': rgba(branding.focusRingColor || branding.primaryColor, 0.18),
    '--brand-radius': branding.borderRadius || '24px',
    '--brand-radius-half': `calc(${branding.borderRadius || '24px'} / 2)`,
    '--brand-radius-soft': `calc(${branding.borderRadius || '24px'} / 1.4)`,
    '--brand-radius-small': `calc(${branding.borderRadius || '24px'} / 3)`,
    '--brand-shadow': branding.cardShadow || '0 24px 70px rgba(15, 23, 42, 0.14)',
    '--brand-logo-size': branding.logoSize || '56px',
    ...buildBackgroundStyle(branding),
  };

  const loadBranding = async (nextSchoolCode?: string) => {
    setBrandingLoading(true);
    try {
      setBranding(await getLoginBranding(nextSchoolCode));
    } finally {
      setBrandingLoading(false);
    }
  };

  const validateHostSchoolDomain = async (nextSchoolCode: string) => {
    try {
      const res = await fetch(`/api/proxy/public/school-domain?subdomain=${encodeURIComponent(nextSchoolCode)}`, {
        cache: 'no-store',
      });
      setDomainNotFound(!res.ok);
    } catch {
      setDomainNotFound(true);
    }
  };

  useEffect(() => {
    const detectedSchoolCode = resolveSchoolSubdomainFromHost(window.location.host);
    const remembered = readRememberedLogin();
    const lastAccount = remembered ?? readLastAccount();
    if (detectedSchoolCode) {
      const rememberedIdentifier = lastAccount?.email || lastAccount?.username || '';
      setHostSchoolCode(detectedSchoolCode);
      setSchoolCode(detectedSchoolCode);
      setForgotSchoolCode(detectedSchoolCode);
      setIdentifier(rememberedIdentifier);
      setForgotEmail(rememberedIdentifier);
      setRememberMe(Boolean(remembered?.rememberMe));
      setPasswordOnlyMode(Boolean(rememberedIdentifier));
      void loadBranding(detectedSchoolCode);
      void validateHostSchoolDomain(detectedSchoolCode);
      return;
    }

    if (lastAccount) {
      const rememberedIdentifier = lastAccount.email || lastAccount.username || '';
      setIdentifier(rememberedIdentifier);
      setForgotEmail(rememberedIdentifier);
      setRememberMe(Boolean(remembered?.rememberMe));
      setPasswordOnlyMode(Boolean(rememberedIdentifier));
      void loadBranding();
      return;
    }
    void loadBranding();
  }, []);

  useEffect(() => {
    if (!branding.faviconUrl) return;
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = branding.faviconUrl;
  }, [branding.faviconUrl]);

  const persistRememberedLogin = () => {
    const trimmedIdentifier = identifier.trim();
    const trimmedSchool = schoolCode.trim();
    if (trimmedIdentifier) {
      localStorage.setItem(
        lastAccountStorageKey,
        JSON.stringify({
          ...(isEmail(trimmedIdentifier) ? { email: trimmedIdentifier } : { username: trimmedIdentifier }),
          ...(uuidPattern.test(trimmedSchool) ? { schoolId: trimmedSchool } : trimmedSchool ? { schoolCode: trimmedSchool } : {}),
        }),
      );
    }

    if (!rememberMe) {
      clearRememberedLogin();
      return;
    }
    // Never store passwords or tokens in browser storage. Remember-me keeps only non-secret identifiers.
    localStorage.setItem(
      rememberStorageKey,
      JSON.stringify({
        rememberMe: true,
        ...(isEmail(trimmedIdentifier) ? { email: trimmedIdentifier } : { username: trimmedIdentifier }),
        ...(uuidPattern.test(trimmedSchool) ? { schoolId: trimmedSchool } : trimmedSchool ? { schoolCode: trimmedSchool } : {}),
      }),
    );
  };

  const handleRememberMeChange = (checked: boolean) => {
    setRememberMe(checked);
    if (!checked) clearRememberedLogin();
  };

  const handleUseAnotherAccount = () => {
    clearRememberedLogin();
    clearLastAccount();
    setPasswordOnlyMode(false);
    setRememberMe(false);
    setIdentifier('');
    setForgotEmail('');
    setPassword(demoPassword);
    setErrors({});
    setMessage('');
  };

  const handleSchoolBlur = () => {
    if (hostSchoolCode) return;
    const trimmed = schoolCode.trim();
    if (!trimmed || !isValidSchoolInput(trimmed)) return;
    void loadBranding(trimmed);
  };

  const validateLogin = () => {
    const nextErrors: FieldErrors = {};
    if (hostSchoolCode && schoolCode.trim() && !isValidSchoolInput(schoolCode)) nextErrors.schoolCode = formCopy.invalidSchool;
    if (!identifier.trim()) nextErrors.identifier = formCopy.identifierRequired;
    if (!password) nextErrors.password = formCopy.passwordRequired;
    else if (password.length < 8) nextErrors.password = formCopy.passwordLength;
    return nextErrors;
  };

  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    const nextErrors = validateLogin();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      const trimmedIdentifier = identifier.trim();
      const trimmedSchool = schoolCode.trim();
      const result = await login({
        ...(trimmedIdentifier.includes('@') ? { email: trimmedIdentifier } : { username: trimmedIdentifier }),
        password,
        ...(uuidPattern.test(trimmedSchool) ? { schoolId: trimmedSchool } : trimmedSchool ? { schoolCode: trimmedSchool } : {}),
        rememberMe,
      });

      persistRememberedLogin();
      if (result.mfaRequired) {
        if (!result.challengeId) {
          throw new Error(genericLoginError);
        }
        sessionStorage.setItem('auth.mfaChallengeId', result.challengeId);
        sessionStorage.setItem('auth.mfaMethod', result.mfaMethod || 'email');
        sessionStorage.setItem('auth.mfaRememberMe', rememberMe ? '1' : '0');
        sessionStorage.setItem('auth.mfaStartedAt', String(Date.now()));
        router.replace('/verify-2fa');
        return;
      }
      if (result.user?.role === 'PARENT') router.replace('/parent/dashboard');
      else if (result.mustChangePassword) router.replace('/change-password');
      else if (result.subscriptionRestricted) router.replace('/dashboard/plans');
      else router.replace('/dashboard');
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : genericLoginError });
    } finally {
      setSubmitting(false);
    }
  };

  const submitForgotPassword = async () => {
    const trimmedEmail = forgotEmail.trim();
    const trimmedSchool = forgotSchoolCode.trim();
    const nextErrors: FieldErrors = {};
    if (!trimmedEmail) nextErrors.forgotEmail = formCopy.resetEmailRequired;
    else if (!isEmail(trimmedEmail)) nextErrors.forgotEmail = formCopy.resetEmailInvalid;
    if (trimmedSchool && !isValidSchoolInput(trimmedSchool)) nextErrors.forgotSchoolCode = formCopy.invalidSchool;
    setErrors(nextErrors);
    setMessage('');
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmedEmail,
          ...(uuidPattern.test(trimmedSchool) ? { schoolId: trimmedSchool } : trimmedSchool ? { schoolCode: trimmedSchool } : {}),
        }),
      });
      const data = await res.json().catch(() => null);
      setMessage((data as { message?: string } | null)?.message || formCopy.resetGenericSuccess);
    } finally {
      setSubmitting(false);
    }
  };

  const fieldError = (key: keyof FieldErrors) =>
    errors[key] ? (
      <p className="mt-1 text-xs font-semibold text-[var(--brand-error)]" id={`${key}-error`}>
        {errors[key]}
      </p>
    ) : null;

  if (domainNotFound) {
    const mainLoginHref = typeof window !== 'undefined' && window.location.hostname.endsWith('.localhost')
      ? 'http://localhost:3001/login'
      : 'https://akademify.techstageit.com/login';

    return (
      <main className="min-h-screen w-full overflow-x-hidden text-[var(--brand-text)]" style={brandStyle}>
        <div className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center px-4 py-6 sm:px-6">
          <section className="w-full rounded-[var(--brand-radius)] border border-[var(--brand-border)] bg-[var(--brand-card)] p-7 text-center shadow-[var(--brand-shadow)]">
            <BrandLogo branding={branding} className="mx-auto h-14 w-14" />
            <h1 className="mt-6 text-2xl font-bold">School domain not found</h1>
            <p className="mt-3 text-sm leading-6 text-[var(--brand-muted)]">
              This school login URL is not active. Check the subdomain or open the main platform login.
            </p>
            <a
              href={mainLoginHref}
              className="mt-6 inline-flex items-center justify-center rounded-[var(--brand-radius-half)] bg-[var(--brand-button)] px-5 py-3 text-sm font-bold text-[var(--brand-button-text)] shadow-lg transition hover:opacity-95 focus:outline-none focus:ring-4 focus:ring-[var(--brand-focus-soft)]"
            >
              Open main login
            </a>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full overflow-x-hidden text-[var(--brand-text)]" style={brandStyle}>
      <div className={pageShellClassName}>
        {leftPanelEnabled ? (
          <section className="hidden h-[calc(100vh-48px)] min-h-[640px] max-h-[760px] flex-col justify-between overflow-y-auto rounded-[var(--brand-radius)] bg-[var(--brand-secondary)] p-8 text-[var(--brand-button-text)] shadow-[var(--brand-shadow)] lg:flex xl:p-10">
            <div className="flex items-center gap-4">
              <BrandLogo branding={branding} className="h-[var(--brand-logo-size)] w-[var(--brand-logo-size)] bg-white/10" />
              <div className="min-w-0">
                <p className="truncate text-xl font-bold">{branding.schoolName || branding.appName}</p>
                <p className="text-sm opacity-75">{branding.appName}</p>
              </div>
            </div>

            <div className="max-w-xl">
              <h1 className="break-words text-4xl font-bold leading-tight xl:text-5xl">{branding.leftPanelTitle}</h1>
              <p className="mt-5 text-base leading-7 opacity-80">{branding.leftPanelDescription}</p>
              {branding.illustrationUrl ? (
                <img src={branding.illustrationUrl} alt={`${branding.appName} illustration`} className="mt-8 max-h-56 w-full rounded-[var(--brand-radius-soft)] object-cover xl:max-h-64" />
              ) : null}
            </div>

            <div className="grid gap-3">
              {branding.features.map((feature) => (
                <div key={feature} className="flex items-center gap-3 rounded-[var(--brand-radius-half)] border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--brand-accent)]" />
                  <span className="text-sm font-semibold">{feature}</span>
                </div>
              ))}
              <p className="pt-2 text-sm opacity-75">{branding.securityNote}</p>
            </div>
          </section>
        ) : null}

        <section className="mx-auto w-full min-w-0 max-w-xl">
          <div className="mb-5 flex items-center gap-3 lg:hidden">
            <BrandLogo branding={branding} className="h-12 w-12" />
            <div className="min-w-0">
              <p className="truncate font-bold">{branding.schoolName || branding.appName}</p>
              <p className="text-sm text-[var(--brand-muted)]">{branding.appName}</p>
            </div>
          </div>

          <div className="w-full max-w-full overflow-hidden rounded-[var(--brand-radius)] border border-[var(--brand-border)] bg-[var(--brand-card)] p-5 shadow-[var(--brand-shadow)] sm:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="hidden items-center gap-3 lg:flex">
                  <BrandLogo branding={branding} className="h-14 w-14" />
                  <div className="min-w-0">
                    <p className="truncate font-bold">{branding.schoolName || branding.appName}</p>
                    <p className="text-sm text-[var(--brand-muted)]">{branding.appName}</p>
                  </div>
                </div>
                <h2 className="mt-6 break-words text-2xl font-bold sm:text-3xl">
                  {forgotOpen ? formCopy.forgotHeading : branding.loginHeading}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--brand-muted)]">
                  {forgotOpen ? formCopy.forgotSubtitle : branding.loginSubtitle}
                </p>
              </div>
              {brandingLoading ? (
                <div className="min-w-24 sm:mt-1" aria-live="polite" aria-label={formCopy.brandingLoading}>
                  <div className="h-2 w-24 animate-pulse rounded-full bg-[var(--brand-border)]" />
                  <div className="mt-2 h-2 w-16 animate-pulse rounded-full bg-[var(--brand-border)]" />
                </div>
              ) : null}
            </div>

            <form
              className="mt-7 space-y-5"
              onSubmit={(event) => {
                if (forgotOpen) {
                  event.preventDefault();
                  void submitForgotPassword();
                  return;
                }
                void submitLogin(event);
              }}
            >
              {forgotOpen ? (
                <>
                  <div>
                    <label className="block text-sm font-semibold" htmlFor="forgotEmail">
                      {formCopy.forgotEmailLabel}
                    </label>
                    <input
                      id="forgotEmail"
                      name="forgotEmail"
                      type="email"
                      autoComplete="email"
                      value={forgotEmail}
                      onChange={(event) => setForgotEmail(event.target.value)}
                      className={`${inputClassName} mt-2`}
                      placeholder={formCopy.identifierPlaceholder}
                      aria-describedby={errors.forgotEmail ? 'forgotEmail-error' : undefined}
                      aria-invalid={Boolean(errors.forgotEmail)}
                    />
                    {fieldError('forgotEmail')}
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex flex-1 items-center justify-center rounded-[var(--brand-radius-half)] bg-[var(--brand-button)] px-4 py-3 text-sm font-bold text-[var(--brand-button-text)] shadow-lg transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-4 focus:ring-[var(--brand-focus-soft)]"
                    >
                      {submitting ? formCopy.loading : formCopy.sendReset}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotOpen(false);
                        setErrors({});
                        setMessage('');
                      }}
                      className="rounded-[var(--brand-radius-half)] border border-[var(--brand-border)] px-4 py-3 text-sm font-bold text-[var(--brand-text)] transition hover:bg-[var(--brand-bg)] focus:outline-none focus:ring-4 focus:ring-[var(--brand-focus-soft)]"
                    >
                      {formCopy.backToLogin}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {passwordOnlyMode ? (
                    <div className="rounded-[var(--brand-radius-half)] border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-muted)]">Signed in as</p>
                      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="min-w-0 truncate text-sm font-bold text-[var(--brand-text)]">{identifier}</p>
                        <button
                          type="button"
                          onClick={handleUseAnotherAccount}
                          className="w-fit rounded-[var(--brand-radius-small)] border border-[var(--brand-border)] px-3 py-2 text-xs font-bold text-[var(--brand-text)] transition hover:bg-[var(--brand-card)] focus:outline-none focus:ring-4 focus:ring-[var(--brand-focus-soft)]"
                        >
                          Use another account
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-semibold" htmlFor="identifier">
                        {formCopy.identifierLabel}
                      </label>
                      <input
                        id="identifier"
                        name="username"
                        type="text"
                        autoComplete="username"
                        value={identifier}
                        onChange={(event) => {
                          setIdentifier(event.target.value);
                          setForgotEmail(event.target.value);
                        }}
                        className={`${inputClassName} mt-2`}
                        placeholder={formCopy.identifierPlaceholder}
                        aria-describedby={errors.identifier ? 'identifier-error' : undefined}
                        aria-invalid={Boolean(errors.identifier)}
                      />
                      {fieldError('identifier')}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-semibold" htmlFor="password">
                      {formCopy.passwordLabel}
                    </label>
                    <div className="relative mt-2">
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className={`${inputClassName} pr-12`}
                        placeholder={formCopy.passwordPlaceholder}
                        aria-describedby={errors.password ? 'password-error' : undefined}
                        aria-invalid={Boolean(errors.password)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        className="absolute inset-y-0 right-2 my-auto flex h-9 w-9 items-center justify-center rounded-[var(--brand-radius-small)] text-[var(--brand-muted)] transition hover:bg-[var(--brand-bg)] focus:outline-none focus:ring-4 focus:ring-[var(--brand-focus-soft)]"
                        aria-label={showPassword ? formCopy.hidePassword : formCopy.showPassword}
                      >
                        {showPassword ? (
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 4.2A10.4 10.4 0 0112 4c5 0 8.5 4.2 9.5 8a10.8 10.8 0 01-2.2 4M6.2 6.2A10.8 10.8 0 002.5 12c1 3.8 4.5 8 9.5 8a10.8 10.8 0 005.1-1.3" />
                          </svg>
                        ) : (
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.5 12c1-3.8 4.5-8 9.5-8s8.5 4.2 9.5 8c-1 3.8-4.5 8-9.5 8S3.5 15.8 2.5 12z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    {fieldError('password')}
                  </div>

                  <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <label className="flex items-center gap-2 text-[var(--brand-muted)]">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(event) => handleRememberMeChange(event.target.checked)}
                        className="h-4 w-4 rounded border-[var(--brand-border)]"
                        style={{ accentColor: 'var(--brand-primary)' }}
                      />
                      {formCopy.rememberMe}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotOpen(true);
                        setForgotEmail(identifier.trim());
                        setForgotSchoolCode(schoolCode.trim());
                        setErrors({});
                        setMessage('');
                      }}
                      className="w-fit font-semibold text-[var(--brand-link)] transition hover:opacity-80 focus:outline-none focus:ring-4 focus:ring-[var(--brand-focus-soft)]"
                    >
                      {branding.forgotPasswordText}
                    </button>
                  </div>
                </>
              )}

              {message ? (
                <p className="rounded-[var(--brand-radius-half)] px-4 py-3 text-sm font-semibold text-[var(--brand-success)]" style={{ backgroundColor: rgba(branding.successColor || '#16a34a', 0.1) }} role="status">
                  {message}
                </p>
              ) : null}
              {errors.form ? (
                <p className="rounded-[var(--brand-radius-half)] px-4 py-3 text-sm font-semibold text-[var(--brand-error)]" style={{ backgroundColor: rgba(branding.errorColor, 0.08) }} role="alert">
                  {errors.form}
                </p>
              ) : null}

              {!forgotOpen ? (
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-center rounded-[var(--brand-radius-half)] bg-[var(--brand-button)] px-4 py-3 text-sm font-bold text-[var(--brand-button-text)] shadow-lg transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-4 focus:ring-[var(--brand-focus-soft)]"
                >
                  {submitting ? formCopy.loading : branding.loginButtonText}
                </button>
              ) : null}
            </form>

            <div className="mt-6 border-t border-[var(--brand-border)] pt-5 text-center">
              <p className="text-sm text-[var(--brand-muted)]">{branding.supportText}</p>
              <p className="mt-2 text-xs text-[var(--brand-muted)]">{branding.footerText}</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
