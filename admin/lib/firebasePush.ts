'use client';

import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage, type MessagePayload } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseWebPushConfigured = () =>
  Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.messagingSenderId &&
      firebaseConfig.appId &&
      process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
  );

export const getWebPushToken = async (options: { requestPermission?: boolean } = {}) => {
  if (typeof window === 'undefined' || !isFirebaseWebPushConfigured()) return null;
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return null;
  if (!(await isSupported())) return null;

  let permission = Notification.permission;
  if (permission === 'default' && options.requestPermission !== false) {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') return null;

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  const messaging = getMessaging(app);
  return getToken(messaging, {
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
};

let foregroundListenerStarted = false;

export const startForegroundPushListener = async () => {
  if (typeof window === 'undefined' || foregroundListenerStarted || !isFirebaseWebPushConfigured()) return;
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (!(await isSupported())) return;

  foregroundListenerStarted = true;
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  const messaging = getMessaging(app);
  onMessage(messaging, (payload: MessagePayload) => {
    const data = payload.data ?? {};
    const notification = payload.notification ?? {};
    const title = data.title || notification.title || 'Akademifyy';
    const body = data.body || notification.body || '';
    const priority = data.priority || 'normal';
    if (!title && !body) return;

    const notificationOptions = {
      body,
      icon: '/branding/demo-school-favicon.svg',
      tag: data.logId ? `akademifyy-${data.logId}` : undefined,
      renotify: priority === 'high' || priority === 'urgent',
      requireInteraction: priority === 'urgent',
      silent: false,
      data: {
        route: data.route || data.link || '/',
      },
    } as NotificationOptions & { renotify?: boolean };

    const browserNotification = new Notification(title, notificationOptions);

    browserNotification.onclick = () => {
      window.focus();
      const route = browserNotification.data?.route;
      if (typeof route === 'string' && route.startsWith('/')) {
        window.location.assign(route);
      }
      browserNotification.close();
    };
  });
};
