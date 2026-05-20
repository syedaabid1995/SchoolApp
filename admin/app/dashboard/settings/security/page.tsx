'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import FullPageLoader from '../../../../components/FullPageLoader';
import PageHeader from '../../../../components/PageHeader';
import { getSession } from '../../../../services/auth.service';
import {
  getAuthSecuritySettings,
  updateAuthSecuritySettings,
  type AuthSecuritySettings,
} from '../../../../services/auth-security.service';
import {
  listUserSessions,
  logoutAllSessions,
  revokeUserSession,
  type UserSession,
} from '../../../../services/session.service';

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Not used yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const describeDevice = (session: UserSession) => {
  if (session.deviceName) return session.deviceName;
  const userAgent = session.userAgent?.toLowerCase() ?? '';
  if (userAgent.includes('mobile') || userAgent.includes('android') || userAgent.includes('iphone')) return 'Mobile browser';
  if (userAgent.includes('windows')) return 'Windows browser';
  if (userAgent.includes('mac')) return 'Mac browser';
  return 'Browser session';
};

function SessionRow({
  session,
  onRevoke,
  busy,
}: {
  session: UserSession;
  onRevoke: (session: UserSession) => void;
  busy: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-950">{describeDevice(session)}</p>
            {session.currentSession ? (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                Current device
              </span>
            ) : null}
          </div>
          <p className="mt-1 break-words text-xs text-slate-500">{session.userAgent || 'User agent not available'}</p>
          <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
            <p>
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">IP</span>
              {session.ipAddress || 'Not available'}
            </p>
            <p>
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">Created</span>
              {formatDateTime(session.createdAt)}
            </p>
            <p>
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">Last used</span>
              {formatDateTime(session.lastUsedAt)}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onRevoke(session)}
          disabled={busy}
          className="w-full rounded-lg border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto"
        >
          {session.currentSession ? 'Logout this device' : 'Revoke'}
        </button>
      </div>
    </div>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold text-slate-950">{title}</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        disabled={disabled}
        className={`relative h-8 w-14 shrink-0 rounded-full transition-colors focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60 ${
          checked ? 'bg-blue-600' : 'bg-slate-300'
        }`}
        aria-pressed={checked}
      >
        <span
          className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-7' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

export default function SecuritySessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [authSettings, setAuthSettings] = useState<AuthSecuritySettings | null>(null);
  const [sessionRole, setSessionRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [busySessionId, setBusySessionId] = useState<string | null>(null);
  const [logoutAllBusy, setLogoutAllBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');

  const currentSession = useMemo(
    () => sessions.find((session) => session.currentSession) ?? null,
    [sessions],
  );
  const otherSessions = useMemo(
    () => sessions.filter((session) => !session.currentSession),
    [sessions],
  );

  const loadSessions = async () => {
    setError('');
    try {
      const data = await listUserSessions();
      setSessions(data.sessions ?? []);
    } catch (err) {
      setError((err as Error)?.message || 'Unable to load sessions.');
    } finally {
      setLoading(false);
    }
  };

  const loadAuthSettings = async () => {
    setSettingsError('');
    try {
      const [settings, currentSession] = await Promise.all([
        getAuthSecuritySettings(),
        getSession(),
      ]);
      setAuthSettings(settings);
      setSessionRole(currentSession.role);
    } catch (err) {
      setSettingsError((err as Error)?.message || 'Unable to load authentication security settings.');
    } finally {
      setSettingsLoading(false);
    }
  };

  useEffect(() => {
    void loadSessions();
    void loadAuthSettings();
  }, []);

  const canManageAuthSettings = sessionRole === 'SUPER_ADMIN';

  const handleAuthSettingChange = async (patch: Partial<AuthSecuritySettings>) => {
    if (!authSettings || !canManageAuthSettings) return;

    const nextSettings = { ...authSettings, ...patch };
    if (nextSettings.twoStepEnabled && !nextSettings.emailOtpEnabled && !nextSettings.authenticatorAppEnabled) {
      setSettingsError('Enable email verification or authenticator app before enabling two-step verification.');
      return;
    }

    setSettingsSaving(true);
    setSettingsError('');
    setSettingsMessage('');
    try {
      const updated = await updateAuthSecuritySettings(nextSettings);
      setAuthSettings(updated);
      setSettingsMessage('Authentication security settings updated.');
    } catch (err) {
      setSettingsError((err as Error)?.message || 'Unable to update authentication security settings.');
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleRevoke = async (session: UserSession) => {
    setBusySessionId(session.id);
    setError('');
    setMessage('');
    try {
      const result = await revokeUserSession(session.id);
      if (session.currentSession) {
        router.replace('/login');
        return;
      }
      setMessage(result.message || 'Session revoked successfully.');
      await loadSessions();
    } catch (err) {
      setError((err as Error)?.message || 'Unable to revoke session.');
    } finally {
      setBusySessionId(null);
    }
  };

  const handleLogoutAll = async () => {
    setLogoutAllBusy(true);
    setError('');
    setMessage('');
    try {
      await logoutAllSessions();
      router.replace('/login');
    } catch (err) {
      setError((err as Error)?.message || 'Unable to logout from all devices.');
    } finally {
      setLogoutAllBusy(false);
    }
  };

  const isBusy = loading || settingsLoading || settingsSaving || Boolean(busySessionId) || logoutAllBusy;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/40">
      {isBusy ? <FullPageLoader label="Updating sessions..." /> : null}
      <div className="mx-auto max-w-6xl pr-6 pb-12">
        <PageHeader title="Security Sessions" subtitle="Review active devices and revoke refresh sessions." />

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-950">Login Verification Settings</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Enable or disable two-step login and the verification methods used during sign in.
              </p>
            </div>
            <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
              authSettings?.twoStepEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
            }`}>
              {authSettings?.twoStepEnabled ? 'Two-step on' : 'Two-step off'}
            </span>
          </div>

          {!canManageAuthSettings ? (
            <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              Only super admin can change login verification settings.
            </p>
          ) : null}
          {settingsMessage ? <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{settingsMessage}</p> : null}
          {settingsError ? <p className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{settingsError}</p> : null}

          {authSettings ? (
            <div className="grid gap-3">
              <ToggleRow
                title="Two-step verification"
                description="Require privileged users to complete a second verification step after password login."
                checked={authSettings.twoStepEnabled}
                disabled={!canManageAuthSettings || settingsSaving}
                onChange={(checked) => handleAuthSettingChange({ twoStepEnabled: checked })}
              />
              <ToggleRow
                title="Email verification code"
                description="Send a one-time login code to the user's email address when two-step verification is required."
                checked={authSettings.emailOtpEnabled}
                disabled={!canManageAuthSettings || settingsSaving}
                onChange={(checked) => handleAuthSettingChange({ emailOtpEnabled: checked })}
              />
              <ToggleRow
                title="Authenticator app"
                description="Allow users to set up and verify login using an authenticator app and backup codes."
                checked={authSettings.authenticatorAppEnabled}
                disabled={!canManageAuthSettings || settingsSaving}
                onChange={(checked) => handleAuthSettingChange({ authenticatorAppEnabled: checked })}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
              Authentication security settings are loading.
            </div>
          )}
        </section>

        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-medium">Use logout from all devices if you do not recognize an active session.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <span className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-center text-sm font-semibold text-amber-900">
              {authSettings?.twoStepEnabled ? 'Two-step verification enabled' : 'Two-step verification disabled'}
            </span>
            <button
              type="button"
              onClick={handleLogoutAll}
              disabled={logoutAllBusy}
              className="rounded-lg bg-amber-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Logout from all devices
            </button>
          </div>
        </div>

        {message ? <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
        {error ? <p className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}

        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-950">Current Device</h2>
            <span className="text-sm text-slate-500">{currentSession ? 'Active now' : 'Not detected'}</span>
          </div>
          {currentSession ? (
            <SessionRow session={currentSession} onRevoke={handleRevoke} busy={busySessionId === currentSession.id} />
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
              Current session could not be matched to a refresh token.
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-950">Other Active Devices</h2>
            <span className="text-sm text-slate-500">{otherSessions.length} active</span>
          </div>
          <div className="space-y-3">
            {otherSessions.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                onRevoke={handleRevoke}
                busy={busySessionId === session.id}
              />
            ))}
            {!otherSessions.length ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
                No other active devices found.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
