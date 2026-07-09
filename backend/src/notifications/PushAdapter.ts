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
    const title = payload.subject || 'Akademifyy';
    const body = payload.body;
    const priority = data.priority === 'urgent' || data.priority === 'high' ? data.priority : 'normal';

    try {
      if (payload.platform === 'WEB') {
        const providerId = await getFirebaseMessaging().send({
          token,
          data: {
            ...data,
            title,
            body,
            priority,
          },
          webpush: {
            headers: {
              Urgency: priority === 'urgent' ? 'high' : priority,
            },
            fcmOptions: data.route ? { link: data.route } : undefined,
          },
        });
        return { status: 'SENT', providerId };
      }

      const providerId = await getFirebaseMessaging().send({
        token,
        notification: {
          title,
          body,
        },
        data,
        android: {
          priority: priority === 'normal' ? 'normal' : 'high',
          notification: {
            channelId: 'akademifyy_updates',
            title,
            body,
          },
        },
        apns: {
          headers: {
            'apns-priority': priority === 'normal' ? '5' : '10',
          },
          payload: {
            aps: {
              alert: {
                title,
                body,
              },
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
