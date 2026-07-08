import { NotificationAdapter, NotificationDispatch, DeliveryResult } from './NotificationAdapter';
import { getFirebaseMessaging, isFirebasePushConfigured } from '../services/firebaseAdmin.service';

export class PushAdapter implements NotificationAdapter {
  async send(payload: NotificationDispatch): Promise<DeliveryResult> {
    if (!isFirebasePushConfigured()) {
      return { status: 'FAILED', error: 'Firebase push adapter not configured' };
    }

    const token = payload.to.trim();
    if (!token) {
      return { status: 'FAILED', error: 'Missing FCM device token' };
    }

    const data = Object.entries(payload.data ?? {}).reduce<Record<string, string>>((acc, [key, value]) => {
      if (value !== undefined && value !== null) {
        acc[key] = String(value);
      }
      return acc;
    }, {});

    try {
      const providerId = await getFirebaseMessaging().send({
        token,
        notification: {
          title: payload.subject || 'Akademifyy',
          body: payload.body,
        },
        data,
        webpush: {
          notification: {
            title: payload.subject || 'Akademifyy',
            body: payload.body,
            icon: '/branding/demo-school-favicon.svg',
          },
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'akademifyy_updates',
            title: payload.subject || 'Akademifyy',
            body: payload.body,
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
            },
          },
        },
      });
      return { status: 'SENT', providerId };
    } catch (error) {
      return {
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Firebase push delivery failed',
      };
    }
  }
}
