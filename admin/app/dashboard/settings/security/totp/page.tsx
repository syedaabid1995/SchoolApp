'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import FullPageLoader from '../../../../../components/FullPageLoader';
import PageHeader from '../../../../../components/PageHeader';
import {
  getAuthSecuritySettings,
  type AuthSecuritySettings,
} from '../../../../../services/auth-security.service';
import {
  disableTotp,
  startTotpSetup,
  verifyTotpSetup,
} from '../../../../../services/auth.service';

type SetupState = {
  secret: string;
  issuer: string;
  label: string;
  qrCodeDataUrl: string;
  otpauthUrl: string;
};

const normalizeCode = (value: string) => value.replace(/\D/g, '').slice(0, 6);

export default function TotpSettingsPage() {
  const [settings, setSettings] = useState<AuthSecuritySettings | null>(null);
  const [setup, setSetup] = useState<SetupState | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      setBusy(true);
      try {
        setSettings(await getAuthSecuritySettings());
      } catch (err) {
        setError((err as Error)?.message || 'Unable to load authenticator settings.');
      } finally {
        setBusy(false);
      }
    };

    void loadSettings();
  }, []);

  if (!settings) {
    return (
      <div className="space-y-6">
        {busy ? <FullPageLoader label="Loading authenticator settings..." /> : null}
        <div className="mx-auto max-w-5xl space-y-6 pb-12">
          <PageHeader title="Authenticator App" subtitle="Checking two-step verification settings." />
          <div className="mb-5">
            <Link href="/dashboard/settings?tab=security" className="text-sm font-semibold text-blue-700 hover:text-blue-800">
              Back to security sessions
            </Link>
          </div>
          {error ? (
            <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  if (settings && (!settings.twoStepEnabled || !settings.authenticatorAppEnabled)) {
    return (
      <div className="space-y-6">
        <div className="mx-auto max-w-5xl space-y-6 pb-12">
          <PageHeader title="Authenticator App" subtitle="Two-step verification is currently disabled." />
          <div className="mb-5">
            <Link href="/dashboard/settings?tab=security" className="text-sm font-semibold text-blue-700 hover:text-blue-800">
              Back to security sessions
            </Link>
          </div>
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-950">Two-step verification disabled</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Login will continue with email or username and password only. Enable two-step verification and authenticator app from security settings to use this page.
            </p>
          </section>
        </div>
      </div>
    );
  }

  const beginSetup = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    setBackupCodes([]);
    try {
      setSetup(await startTotpSetup());
      setVerifyCode('');
    } catch (err) {
      setError((err as Error)?.message || 'Unable to start authenticator setup.');
    } finally {
      setBusy(false);
    }
  };

  const confirmSetup = async () => {
    if (verifyCode.length !== 6) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await verifyTotpSetup({ code: verifyCode });
      setBackupCodes(result.backupCodes ?? []);
      setMessage(result.message || 'Authenticator app enabled successfully.');
      setSetup(null);
      setVerifyCode('');
    } catch (err) {
      setError((err as Error)?.message || 'Invalid authenticator code.');
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    if (!disableCode.trim()) {
      setError('Enter a current authenticator code or backup code.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await disableTotp({ code: disableCode.trim() });
      setMessage(result.message || 'Authenticator app disabled successfully.');
      setDisableCode('');
      setSetup(null);
      setBackupCodes([]);
    } catch (err) {
      setError((err as Error)?.message || 'Unable to disable authenticator app.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {busy ? <FullPageLoader label="Updating authenticator settings..." /> : null}
      <div className="mx-auto max-w-5xl space-y-6 pb-12">
        <PageHeader title="Authenticator App" subtitle="Add app-based verification and one-time backup codes." />

        <div className="mb-5">
          <Link href="/dashboard/settings?tab=security" className="text-sm font-semibold text-blue-700 hover:text-blue-800">
            Back to security sessions
          </Link>
        </div>

        {message ? (
          <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700" role="alert">
            {error}
          </p>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-950">Set up authenticator app</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Scan the QR code in Google Authenticator, Microsoft Authenticator, 1Password, or another TOTP app.
                </p>
              </div>
              <button
                type="button"
                onClick={beginSetup}
                disabled={busy}
                className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Start setup
              </button>
            </div>

            {setup ? (
              <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <img
                    src={setup.qrCodeDataUrl}
                    alt={`Authenticator QR code for ${setup.label}`}
                    className="mx-auto h-56 w-56 rounded-xl bg-white p-2"
                  />
                </div>
                <div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Manual secret</p>
                    <p className="mt-2 break-all font-mono text-sm font-semibold text-slate-950">{setup.secret}</p>
                    <p className="mt-3 text-sm text-slate-600">
                      Issuer: {setup.issuer} | Account: {setup.label}
                    </p>
                  </div>

                  <div className="mt-5">
                    <label className="block text-sm font-semibold text-slate-800" htmlFor="verifyTotpCode">
                      Verify first code
                    </label>
                    <input
                      id="verifyTotpCode"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={verifyCode}
                      onChange={(event) => setVerifyCode(normalizeCode(event.target.value))}
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-xl font-bold tracking-[0.28em] outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      placeholder="000000"
                    />
                    <button
                      type="button"
                      onClick={confirmSetup}
                      disabled={busy || verifyCode.length !== 6}
                      className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Enable authenticator app
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-950">Disable authenticator app</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Use a current app code or one unused backup code to disable app-based verification.
            </p>
            <label className="mt-5 block text-sm font-semibold text-slate-800" htmlFor="disableTotpCode">
              Code
            </label>
            <input
              id="disableTotpCode"
              type="text"
              value={disableCode}
              onChange={(event) => setDisableCode(event.target.value.toUpperCase().slice(0, 16))}
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
              placeholder="123456 or ABCD-EFGH"
            />
            <button
              type="button"
              onClick={handleDisable}
              disabled={busy || !disableCode.trim()}
              className="mt-4 w-full rounded-xl border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Disable authenticator app
            </button>
          </section>
        </div>

        {backupCodes.length ? (
          <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
            <h2 className="text-xl font-bold">Backup codes</h2>
            <p className="mt-2 text-sm leading-6">
              These backup codes are shown once. Each code can be used one time if the authenticator app is unavailable.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {backupCodes.map((code) => (
                <div key={code} className="rounded-xl border border-amber-200 bg-white px-4 py-3 text-center font-mono text-sm font-bold">
                  {code}
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
