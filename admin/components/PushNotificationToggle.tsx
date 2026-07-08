'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getWebPushToken, isFirebaseWebPushConfigured } from '../lib/firebasePush';
import {
  getPushPreference,
  registerPushDevice,
  unregisterPushDevice,
  updatePushPreference,
} from '../services/push-notifications.service';

const TOKEN_STORAGE_KEY = 'akademifyy.webPushToken';
const DEVICE_ID_STORAGE_KEY = 'akademifyy.webPushDeviceId';

const getDeviceId = () => {
  const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
  return id;
};

export default function PushNotificationToggle({ compact = false }: { compact?: boolean }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string>('');
  const configured = isFirebaseWebPushConfigured();
  const preferenceQuery = useQuery({
    queryKey: ['push-preference'],
    queryFn: getPushPreference,
    enabled: configured,
    staleTime: 60_000,
  });

  const enableMutation = useMutation({
    mutationFn: async () => {
      const token = await getWebPushToken();
      if (!token) throw new Error('Browser notification permission was not granted.');
      await registerPushDevice({ token, platform: 'WEB', app: 'admin-web', deviceId: getDeviceId() });
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
      return updatePushPreference(true);
    },
    onSuccess: async () => {
      setStatus('Enabled');
      await queryClient.invalidateQueries({ queryKey: ['push-preference'] });
    },
    onError: (error) => setStatus(error instanceof Error ? error.message : 'Unable to enable push'),
  });

  const disableMutation = useMutation({
    mutationFn: async () => {
      const token = window.localStorage.getItem(TOKEN_STORAGE_KEY);
      if (token) await unregisterPushDevice(token);
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      return updatePushPreference(false);
    },
    onSuccess: async () => {
      setStatus('Disabled');
      await queryClient.invalidateQueries({ queryKey: ['push-preference'] });
    },
    onError: (error) => setStatus(error instanceof Error ? error.message : 'Unable to disable push'),
  });

  useEffect(() => {
    if (!configured || typeof window === 'undefined' || !preferenceQuery.data?.pushEnabled) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (window.localStorage.getItem(TOKEN_STORAGE_KEY)) return;
    void enableMutation.mutateAsync().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, preferenceQuery.data?.pushEnabled]);

  if (!configured) return null;

  const enabled = preferenceQuery.data?.pushEnabled !== false;
  const pending = enableMutation.isPending || disableMutation.isPending || preferenceQuery.isLoading;
  const label = enabled ? 'Disable Push' : 'Enable Push';

  return (
    <div className={compact ? 'space-y-1' : 'space-y-2'}>
      <button
        type="button"
        disabled={pending}
        onClick={() => (enabled ? disableMutation.mutate() : enableMutation.mutate())}
        className="w-full rounded-xl px-3 py-2 text-left font-semibold text-[var(--shell-text,#0f172a)] hover:bg-[var(--shell-hover,#f1f5f9)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? 'Updating Push...' : label}
      </button>
      {status ? <p className="px-3 text-xs text-[var(--shell-muted,#64748b)]">{status}</p> : null}
    </div>
  );
}
