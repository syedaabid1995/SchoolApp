'use client';

import type { CSSProperties, FormEvent } from 'react';
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import FullPageLoader from '../../components/FullPageLoader';
import { resetPassword } from '../../services/auth.service';
import {
  defaultLoginExperience,
  getLoginExperience,
  type LoginExperience,
} from '../../services/login-experience.service';

type FieldErrors = Partial<Record<'newPassword' | 'confirmPassword' | 'form', string>>;

const invalidTokenMessage = 'Invalid or expired reset token.';
const invalidLinkMessage = 'Invalid reset link.';

const baseInputClassName =
  'w-full rounded-xl border bg-white px-4 py-3 text-sm shadow-sm outline-none transition-colors placeholder:text-slate-400';

const hexToRgb = (hex: string) => {
  const normalized = hex.replace('#', '');
  const value = Number.parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
};

const readableTextColor = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 150 ? '#0f172a' : '#ffffff';
};

const rgba = (hex: string, alpha: number) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const passwordChecks = [
  {
    id: 'length',
    label: 'Minimum 8 characters',
    test: (value: string) => value.length >= 8,
  },
  {
    id: 'uppercase',
    label: 'At least 1 uppercase letter',
    test: (value: string) => /[A-Z]/.test(value),
  },
  {
    id: 'lowercase',
    label: 'At least 1 lowercase letter',
    test: (value: string) => /[a-z]/.test(value),
  },
  {
    id: 'number',
    label: 'At least 1 number',
    test: (value: string) => /[0-9]/.test(value),
  },
  {
    id: 'special',
    label: 'At least 1 special character',
    test: (value: string) => /[^A-Za-z0-9]/.test(value),
  },
];

function PasswordToggleIcon({ hidden }: { hidden: boolean }) {
  if (hidden) {
    return (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
        />
      </svg>
    );
  }

  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  );
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';
  const [experience, setExperience] = useState<LoginExperience>(defaultLoginExperience);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const theme = experience.theme;
  const primaryTextColor = readableTextColor(theme.primaryColor);
  const completedChecks = useMemo(
    () => passwordChecks.filter((item) => item.test(newPassword)).length,
    [newPassword],
  );
  const isValidToken = Boolean(token);

  const pageStyle: CSSProperties = {
    background: `linear-gradient(135deg, ${theme.backgroundColor}, ${rgba(theme.accentColor, 0.12)})`,
    color: theme.textColor,
  };

  const panelStyle: CSSProperties = {
    backgroundColor: theme.panelColor,
    borderColor: rgba(theme.primaryColor, 0.12),
  };

  const buttonStyle: CSSProperties = {
    backgroundColor: theme.primaryColor,
    color: primaryTextColor,
  };

  const inputStyle = (hasError?: boolean): CSSProperties => ({
    borderColor: hasError ? theme.errorColor : '#dbe3eb',
    color: theme.textColor,
  });

  useEffect(() => {
    let mounted = true;
    getLoginExperience().then((next) => {
      if (mounted) setExperience(next);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const validateForm = () => {
    const nextErrors: FieldErrors = {};
    if (!newPassword) {
      nextErrors.newPassword = 'New password is required.';
    } else if (completedChecks !== passwordChecks.length) {
      nextErrors.newPassword = 'Password does not meet all strength requirements.';
    }
    if (!confirmPassword) {
      nextErrors.confirmPassword = 'Confirm password is required.';
    } else if (newPassword !== confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.';
    }
    return nextErrors;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValidToken || successMessage) return;

    const nextErrors = validateForm();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setLoading(true);
    setSuccessMessage('');
    try {
      const result = await resetPassword({
        token,
        newPassword,
        confirmPassword,
      });
      setNewPassword('');
      setConfirmPassword('');
      setErrors({});
      setSuccessMessage(result.message || 'Password has been reset successfully. Please login again.');
    } catch {
      setErrors({ form: invalidTokenMessage });
    } finally {
      setLoading(false);
    }
  };

  const fieldError = (key: keyof FieldErrors) => {
    const value = errors[key];
    if (!value) return null;
    return (
      <p className="mt-2 text-xs font-semibold" style={{ color: theme.errorColor }}>
        {value}
      </p>
    );
  };

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8" style={pageStyle}>
      {loading ? <FullPageLoader label="Resetting password..." /> : null}

      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-2xl border bg-white shadow-2xl shadow-slate-200/80 lg:grid-cols-[0.85fr_1.15fr]" style={panelStyle}>
          <section
            className="flex min-h-[240px] flex-col justify-between p-6 text-white sm:p-8 lg:p-10"
            style={{
              background: `linear-gradient(135deg, ${theme.primaryColor}, ${rgba(theme.accentColor, 0.9)})`,
              color: primaryTextColor,
            }}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/95 text-slate-950 shadow-lg shadow-black/15">
                {experience.logoUrl ? (
                  <img
                    src={experience.logoUrl}
                    alt={`${experience.brandName} logo`}
                    className="h-9 w-9 rounded-lg object-cover"
                  />
                ) : (
                  <span className="text-lg font-bold">{experience.brandName.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div>
                <p className="text-lg font-semibold tracking-tight">{experience.brandName}</p>
                <p className="text-xs font-medium uppercase tracking-[0.24em] opacity-75">{experience.consoleName}</p>
              </div>
            </div>

            <div className="mt-12 max-w-md">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] opacity-80">Account Security</p>
              <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Create a new password</h1>
              <p className="mt-5 text-sm leading-6 opacity-85 sm:text-base">
                Use a strong password and sign in again after the reset is complete.
              </p>
            </div>

            <div className="mt-8 rounded-xl border border-white/15 bg-white/10 p-4 text-sm backdrop-blur">
              <p className="font-semibold">No automatic login</p>
              <p className="mt-1 opacity-80">All existing sessions are closed after a successful password reset.</p>
            </div>
          </section>

          <section className="flex items-center justify-center p-5 sm:p-8 lg:p-10">
            <div className="w-full max-w-md">
              {!isValidToken ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-800">
                  <h2 className="text-xl font-bold">{invalidLinkMessage}</h2>
                  <p className="mt-2 text-sm">Request a new password reset link from the login page.</p>
                  <Link
                    href="/login"
                    className="mt-5 inline-flex rounded-xl px-4 py-3 text-sm font-semibold"
                    style={buttonStyle}
                  >
                    Back to login
                  </Link>
                </div>
              ) : successMessage ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
                  <h2 className="text-xl font-bold">Password reset complete</h2>
                  <p className="mt-2 text-sm font-medium">{successMessage}</p>
                  <Link
                    href="/login"
                    className="mt-5 inline-flex rounded-xl px-4 py-3 text-sm font-semibold"
                    style={buttonStyle}
                  >
                    Continue to login
                  </Link>
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: theme.accentColor }}>
                      Password reset
                    </p>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: theme.textColor }}>
                      Set your new password
                    </h2>
                  </div>

                  <form onSubmit={handleSubmit} className="mt-7 space-y-5">
                    <div>
                      <label className="block text-sm font-semibold" htmlFor="newPassword" style={{ color: theme.textColor }}>
                        New password
                      </label>
                      <div className="relative mt-2">
                        <input
                          id="newPassword"
                          type={showNewPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          value={newPassword}
                          onChange={(event) => setNewPassword(event.target.value)}
                          className={`${baseInputClassName} pr-14`}
                          style={inputStyle(Boolean(errors.newPassword))}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword((current) => !current)}
                          className="absolute inset-y-0 right-3 my-auto flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                          aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                        >
                          <PasswordToggleIcon hidden={showNewPassword} />
                        </button>
                      </div>
                      {fieldError('newPassword')}
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold" style={{ color: theme.textColor }}>
                          Password strength
                        </p>
                        <p className="text-xs font-semibold text-slate-500">
                          {completedChecks}/{passwordChecks.length}
                        </p>
                      </div>
                      <div className="grid gap-2 text-xs font-medium text-slate-600 sm:grid-cols-2">
                        {passwordChecks.map((item) => {
                          const passed = item.test(newPassword);
                          return (
                            <p key={item.id} className={passed ? 'text-emerald-700' : 'text-slate-500'}>
                              <span aria-hidden="true">{passed ? 'OK' : '-'}</span> {item.label}
                            </p>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold" htmlFor="confirmPassword" style={{ color: theme.textColor }}>
                        Confirm password
                      </label>
                      <div className="relative mt-2">
                        <input
                          id="confirmPassword"
                          type={showConfirmPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          value={confirmPassword}
                          onChange={(event) => setConfirmPassword(event.target.value)}
                          className={`${baseInputClassName} pr-14`}
                          style={inputStyle(Boolean(errors.confirmPassword))}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((current) => !current)}
                          className="absolute inset-y-0 right-3 my-auto flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                          aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                        >
                          <PasswordToggleIcon hidden={showConfirmPassword} />
                        </button>
                      </div>
                      {fieldError('confirmPassword')}
                    </div>

                    {errors.form ? (
                      <p className="rounded-xl px-4 py-3 text-sm font-semibold" style={{ backgroundColor: rgba(theme.errorColor, 0.08), color: theme.errorColor }}>
                        {errors.form}
                      </p>
                    ) : null}

                    <button
                      type="submit"
                      disabled={loading}
                      className="flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold shadow-lg transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                      style={buttonStyle}
                    >
                      {loading ? 'Resetting...' : 'Reset password'}
                    </button>
                  </form>

                  <div className="mt-6 text-center">
                    <Link href="/login" className="text-sm font-semibold" style={{ color: theme.primaryColor }}>
                      Back to login
                    </Link>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<FullPageLoader label="Loading reset link..." />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
