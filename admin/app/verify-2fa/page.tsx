'use client';

import type { CSSProperties, FormEvent } from 'react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { resendTwoFactor, verifyTotpLogin, verifyTwoFactor } from '../../services/auth.service';
import {
  defaultLoginBranding,
  getLoginBranding,
  type LoginBranding,
} from '../../services/branding.service';

type BrandStyle = CSSProperties & Record<`--brand-${string}`, string>;
type RememberedLogin = {
  rememberMe?: boolean;
  schoolCode?: string;
  schoolId?: string;
};
type MfaMethod = 'email' | 'totp';

const OTP_TTL_SECONDS = 5 * 60;
const invalidCodeMessage = 'Invalid or expired verification code.';
const resendSuccessMessage = 'Verification code sent to your email.';
const rateLimitMessage = 'Too many attempts. Please try again later.';

const inputClassName =
  'w-full rounded-[var(--brand-radius-half)] border border-[var(--brand-border)] bg-[var(--brand-card)] px-4 py-4 text-center text-2xl font-bold tracking-[0.32em] text-[var(--brand-text)] outline-none transition placeholder:text-[var(--brand-muted)] focus:border-[var(--brand-focus)] focus:ring-4 focus:ring-[var(--brand-focus-soft)]';

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

const secondsLeft = (startedAt: number) => {
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  return Math.max(0, OTP_TTL_SECONDS - elapsed);
};

const formatRemaining = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const nextSeconds = String(seconds % 60).padStart(2, '0');
  return `${minutes}:${nextSeconds}`;
};

const redirectForRole = (role: string | null | undefined) => {
  if (role === 'PARENT') return '/parent/dashboard';
  return '/dashboard';
};

const clearMfaSession = () => {
  sessionStorage.removeItem('auth.mfaChallengeId');
  sessionStorage.removeItem('auth.mfaMethod');
  sessionStorage.removeItem('auth.mfaRememberMe');
  sessionStorage.removeItem('auth.mfaStartedAt');
};

const readRememberedSchool = () => {
  try {
    const raw = localStorage.getItem('login.remember');
    const remembered = raw ? (JSON.parse(raw) as RememberedLogin) : null;
    if (!remembered?.rememberMe) return undefined;
    return remembered.schoolCode || remembered.schoolId || undefined;
  } catch {
    return undefined;
  }
};

function BrandLogo({ branding }: { branding: LoginBranding }) {
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
        className="h-14 w-14 rounded-[var(--brand-radius-half)] object-contain"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      className="flex h-14 w-14 items-center justify-center rounded-[var(--brand-radius-half)] bg-[var(--brand-primary)] text-lg font-bold text-[var(--brand-button-text)]"
      aria-label={`${branding.schoolName || branding.appName} logo`}
      role="img"
    >
      {initialsFromBranding(branding)}
    </span>
  );
}

export default function VerifyTwoFactorPage() {
  const router = useRouter();
  const [branding, setBranding] = useState<LoginBranding>(defaultLoginBranding);
  const [challengeId, setChallengeId] = useState('');
  const [mfaMethod, setMfaMethod] = useState<MfaMethod>('email');
  const [rememberMe, setRememberMe] = useState(false);
  const [ready, setReady] = useState(false);
  const [otp, setOtp] = useState('');
  const [remaining, setRemaining] = useState(OTP_TTL_SECONDS);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const brandStyle: BrandStyle = useMemo(
    () => ({
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
      '--brand-shadow': branding.cardShadow || '0 24px 70px rgba(15, 23, 42, 0.14)',
      background:
        branding.backgroundType === 'gradient'
          ? `linear-gradient(135deg, ${branding.gradientFrom ?? branding.backgroundColor}, ${branding.gradientTo ?? branding.cardBackgroundColor})`
          : branding.backgroundColor,
    }),
    [branding],
  );

  useEffect(() => {
    const storedChallengeId = sessionStorage.getItem('auth.mfaChallengeId')?.trim() ?? '';
    const storedMethod = sessionStorage.getItem('auth.mfaMethod') === 'totp' ? 'totp' : 'email';
    const storedStartedAt = Number(sessionStorage.getItem('auth.mfaStartedAt'));
    const startedAt = Number.isFinite(storedStartedAt) && storedStartedAt > 0 ? storedStartedAt : Date.now();

    setChallengeId(storedChallengeId);
    setMfaMethod(storedMethod);
    setRememberMe(sessionStorage.getItem('auth.mfaRememberMe') === '1');
    setRemaining(secondsLeft(startedAt));
    setReady(true);

    void getLoginBranding(readRememberedSchool()).then(setBranding);
  }, []);

  useEffect(() => {
    if (!challengeId) return undefined;
    const timer = window.setInterval(() => {
      const storedStartedAt = Number(sessionStorage.getItem('auth.mfaStartedAt'));
      const startedAt = Number.isFinite(storedStartedAt) && storedStartedAt > 0 ? storedStartedAt : Date.now();
      setRemaining(secondsLeft(startedAt));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [challengeId]);

  const resetCountdown = () => {
    const now = Date.now();
    sessionStorage.setItem('auth.mfaStartedAt', String(now));
    setRemaining(OTP_TTL_SECONDS);
  };

  const handleOtpChange = (value: string) => {
    setOtp(value.replace(/\D/g, '').slice(0, 6));
    setError('');
    setStatus('');
  };

  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!challengeId || submitting) return;
    if (otp.length !== 6) {
      setError(invalidCodeMessage);
      return;
    }

    setSubmitting(true);
    setError('');
    setStatus('');
    try {
      const result = mfaMethod === 'totp'
        ? await verifyTotpLogin({
            challengeId,
            code: otp,
            rememberMe,
          })
        : await verifyTwoFactor({
            challengeId,
            otp,
            rememberMe,
          });
      setOtp('');
      clearMfaSession();
      router.replace(redirectForRole(result.user?.role));
    } catch {
      setOtp('');
      setError(invalidCodeMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!challengeId || resending || mfaMethod === 'totp') return;

    setResending(true);
    setError('');
    setStatus('');
    try {
      const result = await resendTwoFactor({ challengeId });
      setChallengeId(result.challengeId);
      sessionStorage.setItem('auth.mfaChallengeId', result.challengeId);
      setOtp('');
      resetCountdown();
      setStatus(result.message || resendSuccessMessage);
    } catch (err) {
      const message = err instanceof Error && err.message === rateLimitMessage ? rateLimitMessage : invalidCodeMessage;
      setError(message);
    } finally {
      setResending(false);
    }
  };

  return (
    <main className="min-h-screen text-[var(--brand-text)]" style={brandStyle}>
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <section className="grid w-full overflow-hidden rounded-[var(--brand-radius)] border border-[var(--brand-border)] bg-[var(--brand-card)] shadow-[var(--brand-shadow)] lg:grid-cols-[0.9fr_1.1fr]">
          <div className="hidden flex-col justify-between bg-[var(--brand-secondary)] p-10 text-[var(--brand-button-text)] lg:flex">
            <div className="flex items-center gap-4">
              <BrandLogo branding={branding} />
              <div>
                <p className="text-lg font-bold">{branding.schoolName || branding.appName}</p>
                <p className="text-sm opacity-75">{branding.appName}</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] opacity-75">Two-step verification</p>
              <h1 className="mt-4 text-4xl font-bold leading-tight">
                {mfaMethod === 'totp' ? 'Enter your app code' : 'Enter your email code'}
              </h1>
              <p className="mt-5 max-w-md text-sm leading-6 opacity-80">
                The code expires in 5 minutes. Complete this step before opening the dashboard.
              </p>
            </div>

            <div className="rounded-[var(--brand-radius-half)] border border-white/15 bg-white/10 p-4 text-sm backdrop-blur">
              <p className="font-semibold">Secure sign in</p>
              <p className="mt-1 opacity-75">{branding.securityNote}</p>
            </div>
          </div>

          <div className="flex items-center justify-center p-5 sm:p-8 lg:p-12">
            <div className="w-full max-w-md">
              <div className="mb-8 flex items-center gap-4 lg:hidden">
                <BrandLogo branding={branding} />
                <div>
                  <p className="font-bold">{branding.schoolName || branding.appName}</p>
                  <p className="text-sm text-[var(--brand-muted)]">{branding.appName}</p>
                </div>
              </div>

              {!ready ? (
                <div className="space-y-3" aria-label="Loading verification">
                  <div className="h-4 w-36 animate-pulse rounded-full bg-[var(--brand-border)]" />
                  <div className="h-10 w-full animate-pulse rounded-full bg-[var(--brand-border)]" />
                  <div className="h-14 w-full animate-pulse rounded-[var(--brand-radius-half)] bg-[var(--brand-border)]" />
                </div>
              ) : !challengeId ? (
                <div className="rounded-[var(--brand-radius-half)] border border-[var(--brand-border)] bg-[var(--brand-bg)] p-5">
                  <h2 className="text-2xl font-bold">Invalid verification session</h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--brand-muted)]">
                    Start again from the login page to request a new verification code.
                  </p>
                  <Link
                    href="/login"
                    className="mt-5 inline-flex rounded-[var(--brand-radius-half)] bg-[var(--brand-button)] px-4 py-3 text-sm font-bold text-[var(--brand-button-text)]"
                  >
                    Back to login
                  </Link>
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-link)]">
                      Two-step verification
                    </p>
                      <h2 className="mt-2 text-3xl font-bold tracking-tight">
                        {mfaMethod === 'totp' ? 'Open your authenticator app' : 'Check your email'}
                      </h2>
                      <p className="mt-3 text-sm leading-6 text-[var(--brand-muted)]">
                        {mfaMethod === 'totp'
                          ? 'Enter the 6-digit code from your authenticator app.'
                          : 'Enter the 6-digit code sent to your account email.'}
                      </p>
                  </div>

                  <div className="mt-6 rounded-[var(--brand-radius-half)] border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3">
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="font-semibold text-[var(--brand-muted)]">Code expires in</span>
                      <span className="font-bold text-[var(--brand-text)]" aria-live="polite">
                        {formatRemaining(remaining)}
                      </span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--brand-border)]">
                      <div
                        className="h-full rounded-full bg-[var(--brand-primary)] transition-all"
                        style={{ width: `${Math.max(0, (remaining / OTP_TTL_SECONDS) * 100)}%` }}
                      />
                    </div>
                    {remaining === 0 ? (
                      <p className="mt-3 text-xs font-semibold text-[var(--brand-error)]">
                        This code has expired. Return to login to request a new code.
                      </p>
                    ) : null}
                  </div>

                  <form onSubmit={handleVerify} className="mt-7 space-y-5">
                    <div>
                      <label className="block text-sm font-semibold" htmlFor="otp">
                        Verification code
                      </label>
                      <input
                        id="otp"
                        name="otp"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        value={otp}
                        onChange={(event) => handleOtpChange(event.target.value)}
                        className={`${inputClassName} mt-2`}
                        placeholder="000000"
                        aria-describedby={error ? 'verification-error' : undefined}
                        aria-invalid={Boolean(error)}
                      />
                    </div>

                    {status ? (
                      <p className="rounded-[var(--brand-radius-half)] px-4 py-3 text-sm font-semibold text-[var(--brand-success)]" style={{ backgroundColor: rgba(branding.successColor || '#16a34a', 0.1) }} role="status">
                        {status}
                      </p>
                    ) : null}
                    {error ? (
                      <p id="verification-error" className="rounded-[var(--brand-radius-half)] px-4 py-3 text-sm font-semibold text-[var(--brand-error)]" style={{ backgroundColor: rgba(branding.errorColor, 0.08) }} role="alert">
                        {error}
                      </p>
                    ) : null}

                    <button
                      type="submit"
                      disabled={submitting || otp.length !== 6}
                      className="flex w-full items-center justify-center rounded-[var(--brand-radius-half)] bg-[var(--brand-button)] px-4 py-3 text-sm font-bold text-[var(--brand-button-text)] shadow-lg transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-4 focus:ring-[var(--brand-focus-soft)]"
                    >
                      {submitting ? 'Verifying...' : 'Verify code'}
                    </button>
                  </form>

                  <div className="mt-5 flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                    {mfaMethod === 'email' ? (
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={resending}
                        className="w-fit font-semibold text-[var(--brand-link)] transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-4 focus:ring-[var(--brand-focus-soft)]"
                      >
                        {resending ? 'Sending code...' : 'Resend code'}
                      </button>
                    ) : (
                      <span className="text-sm font-semibold text-[var(--brand-muted)]">Authenticator app required</span>
                    )}
                    <Link
                      href="/login"
                      onClick={clearMfaSession}
                      className="w-fit font-semibold text-[var(--brand-muted)] transition hover:text-[var(--brand-link)] focus:outline-none focus:ring-4 focus:ring-[var(--brand-focus-soft)]"
                    >
                      Back to login
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
