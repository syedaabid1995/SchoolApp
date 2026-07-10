/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAMfUglU-yKQ63f5ndzDKYVvsoFR4kPk0Q',
  authDomain: 'akademifyy-schoolapp.firebaseapp.com',
  projectId: 'akademifyy-schoolapp',
  storageBucket: 'akademifyy-schoolapp.firebasestorage.app',
  messagingSenderId: '589116200518',
  appId: '1:589116200518:web:137f4dfc310f00ed3e9c47',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const isSaaptHost = self.location.hostname === 'saapttech.com' || self.location.hostname.endsWith('.saapttech.com');
  const defaultTitle = isSaaptHost ? 'SAAPT' : 'Akademifyy';
  const defaultIcon = isSaaptHost ? '/branding/saapt-favicon.svg' : '/branding/demo-school-favicon.svg';
  const tagPrefix = isSaaptHost ? 'saapt' : 'akademifyy';
  const notification = payload.notification || {};
  const data = payload.data || {};
  const priority = data.priority || 'normal';
  const title = data.title || notification.title || defaultTitle;
  const options = {
    body: data.body || notification.body || '',
    icon: defaultIcon,
    badge: defaultIcon,
    tag: data.logId ? `${tagPrefix}-${data.logId}` : undefined,
    renotify: priority === 'high' || priority === 'urgent',
    requireInteraction: priority === 'urgent',
    silent: false,
    data: {
      route: data.route || data.link || '/',
    },
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const route = event.notification.data?.route || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.focus();
          client.navigate(route);
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(route);
      }
      return undefined;
    }),
  );
});
