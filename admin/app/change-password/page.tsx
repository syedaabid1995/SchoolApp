'use client';

import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import FullPageLoader from '../../components/FullPageLoader';
import PageHeader from '../../components/PageHeader';
import { changePassword } from '../../services/auth.service';

type FieldErrors = Partial<Record<'currentPassword' | 'newPassword' | 'confirmPassword' | 'form', string>>;

const baseInputClassName =
  'w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] px-4 py-3 text-sm font-semibold text-[var(--shell-text)] outline-none transition-colors placeholder:text-[var(--shell-muted)] focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10';

const passwordChecks = [
  { id: 'length', label: 'Minimum 8 characters', test: (value: string) => value.length >= 8 },
  { id: 'uppercase', label: 'At least 1 uppercase letter', test: (value: string) => /[A-Z]/.test(value) },
  { id: 'lowercase', label: 'At least 1 lowercase letter', test: (value: string) => /[a-z]/.test(value) },
  { id: 'number', label: 'At least 1 number', test: (value: string) => /[0-9]/.test(value) },
  { id: 'special', label: 'At least 1 special character', test: (value: string) => /[^A-Za-z0-9]/.test(value) },
];

function PasswordToggleIcon({ hidden }: { hidden: boolean }) {
  if (hidden) {
    return (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13.875 18.825A10.05 10.05 0 0 1 12 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 0 1 1.563-3.029m5.858.908a3 3 0 1 1 4.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878 3 3m6.878 6.878L21 21"
        />
      </svg>
    );
  }

  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7Z"
      />
    </svg>
  );
}

function SecurityIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3.5 5.5 6v5.5c0 4.1 2.6 7.5 6.5 9 3.9-1.5 6.5-4.9 6.5-9V6L12 3.5Z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m9 12 2 2 4-5" />
    </svg>
  );
}

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const completedChecks = useMemo(
    () => passwordChecks.filter((item) => item.test(newPassword)).length,
    [newPassword],
  );
  const strengthPercent = (completedChecks / passwordChecks.length) * 100;
  const strengthLabel = completedChecks === passwordChecks.length ? 'Strong' : completedChecks >= 3 ? 'Medium' : 'Needs work';
  const strengthColor =
    completedChecks === passwordChecks.length ? 'bg-emerald-500' : completedChecks >= 3 ? 'bg-amber-500' : 'bg-rose-500';

  const validateForm = () => {
    const nextErrors: FieldErrors = {};
    if (!currentPassword) {
      nextErrors.currentPassword = 'Current password is required.';
    }
    if (!newPassword) {
      nextErrors.newPassword = 'New password is required.';
    } else if (completedChecks !== passwordChecks.length) {
      nextErrors.newPassword = 'Password does not meet all strength requirements.';
    } else if (newPassword === currentPassword) {
      nextErrors.newPassword = 'New password must be different from current password.';
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
    const nextErrors = validateForm();
    setErrors(nextErrors);
    setSuccessMessage('');
    if (Object.keys(nextErrors).length) return;

    setLoading(true);
    try {
      const result = await changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrors({});
      setSuccessMessage(result.message || 'Password changed successfully.');
    } catch (err) {
      setErrors({ form: (err as Error)?.message || 'Unable to change password.' });
    } finally {
      setLoading(false);
    }
  };

  const fieldError = (key: keyof FieldErrors) => {
    const value = errors[key];
    if (!value) return null;
    return <p className="mt-2 text-xs font-bold text-rose-600">{value}</p>;
  };

  const passwordField = (params: {
    id: 'currentPassword' | 'newPassword' | 'confirmPassword';
    label: string;
    value: string;
    show: boolean;
    setShow: (next: boolean) => void;
    onChange: (next: string) => void;
  }) => (
    <div>
      <label className="block text-sm font-bold text-[var(--shell-text)]" htmlFor={params.id}>
        {params.label}
      </label>
      <div className="relative mt-2">
        <input
          id={params.id}
          type={params.show ? 'text' : 'password'}
          autoComplete={params.id === 'currentPassword' ? 'current-password' : 'new-password'}
          value={params.value}
          onChange={(event) => params.onChange(event.target.value)}
          className={`${baseInputClassName} pr-14 ${errors[params.id] ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/10' : ''}`}
        />
        <button
          type="button"
          onClick={() => params.setShow(!params.show)}
          className="absolute inset-y-0 right-3 my-auto flex h-9 w-9 items-center justify-center rounded-lg text-[var(--shell-muted)] transition-colors hover:bg-[var(--shell-hover)] hover:text-[var(--shell-text)]"
          aria-label={params.show ? `Hide ${params.label.toLowerCase()}` : `Show ${params.label.toLowerCase()}`}
        >
          <PasswordToggleIcon hidden={params.show} />
        </button>
      </div>
      {fieldError(params.id)}
    </div>
  );

  return (
    <>
      {loading ? <FullPageLoader label="Saving password..." /> : null}

      <PageHeader
        title="Change Password"
        subtitle="Update your account password without leaving the dashboard workspace."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Change Password' },
        ]}
        actions={
          <Link
            href="/dashboard"
            className="rounded-lg border border-[var(--shell-border)] px-3 py-2 text-xs font-bold text-[var(--shell-text)] transition-colors hover:bg-[var(--shell-hover)]"
          >
            Back to Dashboard
          </Link>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-5 shadow-sm sm:p-6">
          <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-blue-500/15 bg-blue-500/5 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
                <SecurityIcon />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold uppercase tracking-[0.14em] text-blue-600">Account Security</p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-[var(--shell-text)]">Save a new password</h2>
                <p className="mt-1 text-sm leading-6 text-[var(--shell-muted)]">
                  Other active sessions are revoked after a successful password change.
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] px-4 py-3 text-sm font-bold text-[var(--shell-text)]">
              Status: Protected
            </div>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-5 xl:grid-cols-2">
            {passwordField({
              id: 'currentPassword',
              label: 'Current password',
              value: currentPassword,
              show: showCurrentPassword,
              setShow: setShowCurrentPassword,
              onChange: setCurrentPassword,
            })}

            {passwordField({
              id: 'newPassword',
              label: 'New password',
              value: newPassword,
              show: showNewPassword,
              setShow: setShowNewPassword,
              onChange: setNewPassword,
            })}

            <div className="xl:col-span-2">
              <div className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-[var(--shell-text)]">Password strength</p>
                  <p className="text-xs font-bold text-[var(--shell-muted)]">
                    {strengthLabel} {completedChecks}/{passwordChecks.length}
                  </p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--shell-border)]">
                  <div className={`h-full rounded-full ${strengthColor}`} style={{ width: `${strengthPercent}%` }} />
                </div>
                <div className="mt-4 grid gap-2 text-xs font-bold text-[var(--shell-muted)] sm:grid-cols-2 lg:grid-cols-3">
                  {passwordChecks.map((item) => {
                    const passed = item.test(newPassword);
                    return (
                      <p key={item.id} className={passed ? 'text-emerald-600' : undefined}>
                        <span aria-hidden="true">{passed ? 'OK' : '--'}</span> {item.label}
                      </p>
                    );
                  })}
                </div>
              </div>
            </div>

            {passwordField({
              id: 'confirmPassword',
              label: 'Confirm password',
              value: confirmPassword,
              show: showConfirmPassword,
              setShow: setShowConfirmPassword,
              onChange: setConfirmPassword,
            })}

            <div className="flex items-end">
              <button
                type="submit"
                disabled={loading}
                className="flex min-h-[46px] w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Saving...' : 'Save Password'}
              </button>
            </div>

            {successMessage ? (
              <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-700 xl:col-span-2">
                {successMessage}
              </p>
            ) : null}

            {errors.form ? (
              <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-700 xl:col-span-2">
                {errors.form}
              </p>
            ) : null}
          </form>
        </section>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-5 shadow-sm">
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--shell-muted)]">Password Rules</p>
            <div className="mt-4 space-y-3">
              {passwordChecks.map((item) => {
                const passed = item.test(newPassword);
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] px-3 py-2"
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${passed ? 'bg-emerald-500 text-white' : 'bg-[var(--shell-card)] text-[var(--shell-muted)]'}`}>
                      {passed ? 'OK' : '--'}
                    </span>
                    <span className="text-sm font-semibold text-[var(--shell-text)]">{item.label}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-5 shadow-sm">
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--shell-muted)]">Security Notes</p>
            <div className="mt-4 space-y-3 text-sm font-semibold text-[var(--shell-muted)]">
              <p className="rounded-xl bg-[var(--shell-subtle)] px-4 py-3">Current password confirmation protects account changes.</p>
              <p className="rounded-xl bg-[var(--shell-subtle)] px-4 py-3">New passwords must pass every strength rule before saving.</p>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
