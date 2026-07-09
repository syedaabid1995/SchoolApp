'use client';

import { getWebPushToken, isFirebaseWebPushConfigured, requestWebPushPermission, startForegroundPushListener } from './firebasePush';
import {
  getPushPreference,
  registerPushDevice,
  updatePushPreference,
} from '../services/push-notifications.service';

export const WEB_PUSH_TOKEN_STORAGE_KEY = 'akademifyy.webPushToken';
const WEB_PUSH_DEVICE_ID_STORAGE_KEY = 'akademifyy.webPushDeviceId';
const WEB_PUSH_MANUAL_DISABLED_STORAGE_KEY = 'akademifyy.webPushManuallyDisabled';

const getDeviceId = () => {
  const existing = window.localStorage.getItem(WEB_PUSH_DEVICE_ID_STORAGE_KEY);
  if (existing) return existing;
  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(WEB_PUSH_DEVICE_ID_STORAGE_KEY, id);
  return id;
};

export const markWebPushManuallyDisabled = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(WEB_PUSH_MANUAL_DISABLED_STORAGE_KEY, '1');
};

export const clearWebPushManualDisable = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(WEB_PUSH_MANUAL_DISABLED_STORAGE_KEY);
};

export const isWebPushManuallyDisabled = () => {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(WEB_PUSH_MANUAL_DISABLED_STORAGE_KEY) === '1';
};

export const canAutoRequestWebPushPermission = () =>
  typeof window !== 'undefined' &&
  isFirebaseWebPushConfigured() &&
  'Notification' in window &&
  Notification.permission === 'default' &&
  !isWebPushManuallyDisabled();

export const requestAutomaticWebPushPermission = async () => {
  if (!canAutoRequestWebPushPermission()) {
    return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : null;
  }
  return requestWebPushPermission();
};

export const registerCurrentWebPushDevice = async ({
  app = 'admin-web',
  requestPermission = true,
  respectServerPreference = true,
  respectManualDisable = true,
}: {
  app?: string;
  requestPermission?: boolean;
  respectServerPreference?: boolean;
  respectManualDisable?: boolean;
} = {}) => {
  if (typeof window === 'undefined' || !isFirebaseWebPushConfigured()) {
    return { registered: false, reason: 'not_configured' as const, token: null };
  }
  if (respectManualDisable && isWebPushManuallyDisabled()) {
    return { registered: false, reason: 'manually_disabled' as const, token: null };
  }
  if (respectServerPreference) {
    const preference = await getPushPreference();
    if (preference.pushEnabled === false) {
      return { registered: false, reason: 'server_disabled' as const, token: null };
    }
  }

  const token = await getWebPushToken({ requestPermission });
  if (!token) {
    return { registered: false, reason: 'permission_not_granted' as const, token: null };
  }

  await registerPushDevice({ token, platform: 'WEB', app, deviceId: getDeviceId() });
  await startForegroundPushListener();
  window.localStorage.setItem(WEB_PUSH_TOKEN_STORAGE_KEY, token);
  clearWebPushManualDisable();
  return { registered: true, reason: 'registered' as const, token };
};

export const registerWebPushAfterLogin = async ({
  app = 'admin-web',
  permission,
}: {
  app?: string;
  permission?: NotificationPermission | null;
} = {}) => {
  const resolvedPermission =
    permission ?? (typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : null);
  if (resolvedPermission !== 'granted') {
    return { registered: false, reason: 'permission_not_granted' as const, token: null };
  }
  return registerCurrentWebPushDevice({
    app,
    requestPermission: false,
    respectServerPreference: true,
    respectManualDisable: true,
  });
};

export const enableCurrentWebPushDevice = async (app = 'admin-web') => {
  const result = await registerCurrentWebPushDevice({
    app,
    requestPermission: true,
    respectServerPreference: false,
    respectManualDisable: false,
  });
  if (!result.registered) {
    throw new Error('Browser notification permission was not granted.');
  }
  await updatePushPreference(true);
  return result.token;
};
