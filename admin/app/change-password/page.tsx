'use client';

import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import FullPageLoader from '../../components/FullPageLoader';
import { changePassword } from '../../services/auth.service';

type FieldErrors = Partial<Record<'currentPassword' | 'newPassword' | 'confirmPassword' | 'form', string>>;

const baseInputClassName =
  'w-full rounded-lg border border-[var(--shell-border)] bg-[var(--shell-card)] px-3 py-2.5 text-sm font-semibold text-[var(--shell-text)] outline-none transition-colors placeholder:text-[var(--shell-muted)] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10';

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

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  const completedChecks = useMemo(
    () => passwordChecks.filter((item) => item.test(newPassword)).length,
    [newPassword],
  );

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
    if (Object.keys(nextErrors).length) return;

    setLoading(true);
    try {
      await changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      router.replace('/dashboard');
    } catch (err) {
      setErrors({ form: (err as Error)?.message || 'Unable to change password.' });
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

      <div className="mx-auto max-w-2xl space-y-4 pb-10">
        <section className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] px-5 py-4 shadow-sm">
          <div>
            <h1 className="text-2xl font-black text-[var(--shell-text)]">Change Password</h1>
            <p className="mt-1 text-sm text-[var(--shell-muted)]">Update your password and return to the dashboard.</p>
          </div>
        </section>

        <section className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-5 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
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

            <div className="rounded-lg border border-[var(--shell-border)] bg-[var(--shell-subtle)] p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-[var(--shell-text)]">Password requirements</p>
                <p className="text-xs font-bold text-[var(--shell-muted)]">{completedChecks}/{passwordChecks.length}</p>
              </div>
              <div className="grid gap-2 text-xs font-semibold text-[var(--shell-muted)] sm:grid-cols-2">
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

            {passwordField({
              id: 'confirmPassword',
              label: 'Confirm password',
              value: confirmPassword,
              show: showConfirmPassword,
              setShow: setShowConfirmPassword,
              onChange: setConfirmPassword,
            })}

            {errors.form ? (
              <p className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm font-bold text-rose-700">
                {errors.form}
              </p>
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="rounded-lg border border-[var(--shell-border)] px-4 py-2.5 text-sm font-bold text-[var(--shell-text)] hover:bg-[var(--shell-hover)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-blue-600/20 transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Saving...' : 'Change Password'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
