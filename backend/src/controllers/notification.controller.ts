import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { resolveSchoolId } from '../utils/tenant';
import { sendNotification } from '../services/notification.service';
import { HttpError } from '../middlewares/error.middleware';
import { buildQueryFingerprint, cacheKeys } from '../services/cache/cache.keys';
import { rememberCache, setCacheHeader } from '../services/cache/cache.service';
import { cacheTTL } from '../services/cache/cache.ttl';
import { invalidateNotificationCache } from '../services/cache/cache.invalidation';
import {
  cursorPrismaArgs,
  parseCursorPagination,
  setCursorPaginationHeaders,
  toCursorPage,
} from '../utils/pagination';

const templateSchema = z.object({
  key: z.string().min(1),
  channel: z.enum(['PUSH', 'WHATSAPP', 'SMS', 'EMAIL']),
  subject: z.string().min(1).optional(),
  body: z.string().min(1),
});

const sendSchema = z.object({
  channel: z.enum(['PUSH', 'WHATSAPP', 'SMS', 'EMAIL']),
  templateKey: z.string().optional(),
  schoolId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  data: z.record(z.unknown()),
});

const pushDeviceSchema = z.object({
  token: z.string().trim().min(20),
  platform: z.enum(['WEB', 'ANDROID', 'IOS']),
  app: z.string().trim().max(80).optional().nullable(),
  deviceId: z.string().trim().max(160).optional().nullable(),
});

const pushPreferenceSchema = z.object({
  pushEnabled: z.boolean(),
});

const pushLogDto = (log: {
  id: string;
  schoolId: string | null;
  payload: unknown;
  status: string;
  providerId: string | null;
  error: string | null;
  scheduledAt: Date | null;
  sentAt: Date | null;
  createdAt: Date;
  template?: { id: string; name: string | null; key: string; subject: string | null } | null;
}) => {
  const payload = log.payload && typeof log.payload === 'object' ? (log.payload as Record<string, unknown>) : {};
  return {
    id: log.id,
    schoolId: log.schoolId,
    status: log.status,
    recipientUserId: typeof payload.to === 'string' ? payload.to : '',
    subject: typeof payload.subject === 'string' ? payload.subject : log.template?.subject ?? null,
    message: typeof payload.body === 'string' ? payload.body : '',
    recipientName: typeof payload.recipientName === 'string' ? payload.recipientName : '',
    recipientType: typeof payload.recipientType === 'string' ? payload.recipientType : '',
    route: typeof payload.route === 'string' ? payload.route : '',
    module: typeof payload.module === 'string' ? payload.module : '',
    templateName: log.template?.name ?? log.template?.key ?? null,
    providerId: log.providerId,
    error: log.error,
    scheduledAt: log.scheduledAt,
    sentAt: log.sentAt,
    createdAt: log.createdAt,
  };
};

export const createTemplate = async (req: Request, res: Response) => {
  const payload = templateSchema.parse(req.body);

  const template = await prisma.notificationTemplate.create({
    data: {
      key: payload.key,
      channel: payload.channel,
      subject: payload.subject ?? null,
      body: payload.body,
    },
  });

  await invalidateNotificationCache();

  res.status(201).json(template);
};

export const listTemplates = async (_req: Request, res: Response) => {
  const { value: templates, status } = await rememberCache(
    cacheKeys.notificationTemplates(),
    cacheTTL.NOTIFICATIONS,
    () => prisma.notificationTemplate.findMany({ orderBy: { key: 'asc' } }),
  );
  setCacheHeader(res, status);
  res.status(200).json(templates);
};

export const sendNotificationApi = async (req: Request, res: Response) => {
  const payload = sendSchema.parse(req.body);
  const schoolId = payload.schoolId ? resolveSchoolId(req, payload.schoolId) : req.auth?.schoolId ?? null;

  if (!req.auth) throw new HttpError(401, 'Unauthorized');

  const result = await sendNotification({
    schoolId,
    userId: payload.userId ?? null,
    channel: payload.channel,
    templateKey: payload.templateKey,
    data: payload.data,
  });

  await invalidateNotificationCache(schoolId);

  res.status(202).json(result);
};

export const registerPushDevice = async (req: Request, res: Response) => {
  if (!req.auth) throw new HttpError(401, 'Unauthorized');
  const payload = pushDeviceSchema.parse(req.body);
  const device = await prisma.pushDeviceToken.upsert({
    where: { token: payload.token },
    create: {
      userId: req.auth.userId,
      schoolId: req.auth.schoolId ?? null,
      token: payload.token,
      platform: payload.platform,
      app: payload.app ?? null,
      deviceId: payload.deviceId ?? null,
      userAgent: req.headers['user-agent'] ?? null,
      isEnabled: true,
      lastSeenAt: new Date(),
    },
    update: {
      userId: req.auth.userId,
      schoolId: req.auth.schoolId ?? null,
      platform: payload.platform,
      app: payload.app ?? null,
      deviceId: payload.deviceId ?? null,
      userAgent: req.headers['user-agent'] ?? null,
      isEnabled: true,
      disabledAt: null,
      lastSeenAt: new Date(),
    },
  });
  await prisma.userNotificationPreference.upsert({
    where: { userId: req.auth.userId },
    create: { userId: req.auth.userId, schoolId: req.auth.schoolId ?? null, pushEnabled: true },
    update: {},
  });
  res.status(200).json({ id: device.id, platform: device.platform, app: device.app, isEnabled: device.isEnabled });
};

export const unregisterPushDevice = async (req: Request, res: Response) => {
  if (!req.auth) throw new HttpError(401, 'Unauthorized');
  const payload = z.object({ token: z.string().trim().min(1) }).parse(req.body);
  await prisma.pushDeviceToken.updateMany({
    where: { token: payload.token, userId: req.auth.userId },
    data: { isEnabled: false, disabledAt: new Date() },
  });
  res.status(200).json({ success: true });
};

export const getPushPreference = async (req: Request, res: Response) => {
  if (!req.auth) throw new HttpError(401, 'Unauthorized');
  const preference = await prisma.userNotificationPreference.upsert({
    where: { userId: req.auth.userId },
    create: { userId: req.auth.userId, schoolId: req.auth.schoolId ?? null, pushEnabled: true },
    update: {},
  });
  res.status(200).json({ pushEnabled: preference.pushEnabled });
};

export const updatePushPreference = async (req: Request, res: Response) => {
  if (!req.auth) throw new HttpError(401, 'Unauthorized');
  const payload = pushPreferenceSchema.parse(req.body);
  const preference = await prisma.userNotificationPreference.upsert({
    where: { userId: req.auth.userId },
    create: { userId: req.auth.userId, schoolId: req.auth.schoolId ?? null, pushEnabled: payload.pushEnabled },
    update: { pushEnabled: payload.pushEnabled },
  });
  if (!payload.pushEnabled) {
    await prisma.pushDeviceToken.updateMany({
      where: { userId: req.auth.userId },
      data: { isEnabled: false, disabledAt: new Date() },
    });
  }
  res.status(200).json({ pushEnabled: preference.pushEnabled });
};

export const listPushNotificationLogs = async (req: Request, res: Response) => {
  if (!req.auth) throw new HttpError(401, 'Unauthorized');
  const pagination = parseCursorPagination(req.query, { defaultLimit: 50, maxLimit: 100 });
  const requestedSchoolId = req.query.schoolId as string | undefined;
  const schoolId = req.auth.role === 'SUPER_ADMIN'
    ? requestedSchoolId || undefined
    : resolveSchoolId(req, requestedSchoolId);
  const rows = await prisma.notificationLog.findMany({
    where: {
      channel: 'PUSH',
      ...(schoolId ? { schoolId } : {}),
    },
    include: { template: { select: { id: true, name: true, key: true, subject: true } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    ...cursorPrismaArgs(pagination),
  });
  const { data: logs, pageInfo } = toCursorPage(rows, pagination.limit);
  setCursorPaginationHeaders(res, pageInfo);
  res.status(200).json({ items: logs.map(pushLogDto), pageInfo });
};

export const listNotificationLogs = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const pagination = parseCursorPagination(req.query, { defaultLimit: 50, maxLimit: 100 });
  const queryFingerprint = buildQueryFingerprint({
    schoolId,
    limit: pagination.limit,
    cursor: pagination.cursor ?? null,
  });
  const { value: rows, status } = await rememberCache(
    cacheKeys.notificationLogs(queryFingerprint),
    cacheTTL.NOTIFICATIONS,
    () =>
      prisma.notificationLog.findMany({
        where: { schoolId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...cursorPrismaArgs(pagination),
      }),
  );
  const { data: logs, pageInfo } = toCursorPage(rows, pagination.limit);
  setCacheHeader(res, status);
  setCursorPaginationHeaders(res, pageInfo);

  res.status(200).json(logs);
};

export const listNotificationSummary = async (req: Request, res: Response) => {
  if (!req.auth) throw new HttpError(401, 'Unauthorized');

  const role = req.auth.role;
  const userId = req.auth.userId;
  const schoolId = req.auth.schoolId ?? null;
  const now = new Date();
  const cacheKey = cacheKeys.notificationSummary(schoolId, role, userId);

  const { value, status } = await rememberCache(
    cacheKey,
    cacheTTL.NOTIFICATIONS,
    async () => {
      const items: Array<{ id: string; title: string; message?: string; type: 'info' | 'warning' | 'danger' | 'success'; href?: string }> = [];

      const addItem = (payload: { id: string; title: string; message?: string; type: 'info' | 'warning' | 'danger' | 'success'; href?: string }) => {
        items.push(payload);
      };

      if (role === 'SUPER_ADMIN') {
        const [openTickets, expiringPlans, gracePlans] = await Promise.all([
          prisma.supportTicket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
          prisma.subscription.count({
            where: {
              nextDueAt: { lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), gte: now },
            },
          }),
          prisma.subscription.count({ where: { status: 'GRACE_PERIOD' } }),
        ]);

    if (openTickets > 0) {
      addItem({
        id: 'tickets-open',
        title: 'Open support tickets',
        message: `${openTickets} tickets awaiting response.`,
        type: 'warning',
        href: '/dashboard/support',
      });
    }

    if (expiringPlans > 0) {
      addItem({
        id: 'plans-expiring',
        title: 'Plans expiring soon',
        message: `${expiringPlans} schools have plans expiring in 7 days.`,
        type: 'info',
        href: '/dashboard/subscriptions',
      });
    }

    if (gracePlans > 0) {
      addItem({
        id: 'plans-grace',
        title: 'Schools in grace period',
        message: `${gracePlans} schools are in grace period.`,
        type: 'danger',
        href: '/dashboard/subscriptions',
      });
    }
      } else {
        const resolvedSchoolId = resolveSchoolId(req, schoolId ?? undefined);
        const [pendingAttendance, transferRequests, openTickets] = await Promise.all([
          prisma.attendanceSession.count({
            where: role === 'TEACHER'
              ? { schoolId: resolvedSchoolId, startedById: userId, approvalStatus: 'PENDING' }
              : { schoolId: resolvedSchoolId, approvalStatus: 'PENDING' },
          }),
          role === 'SCHOOL_ADMIN'
            ? prisma.studentTransferRequest.count({ where: { toSchoolId: resolvedSchoolId, status: 'PENDING' } })
            : Promise.resolve(0),
          prisma.supportTicket.count({
            where: role === 'TEACHER'
              ? { createdById: userId, status: { in: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'] } }
              : { schoolId: resolvedSchoolId, status: { in: ['OPEN', 'IN_PROGRESS'] } },
          }),
        ]);

    const subscription = await prisma.subscription.findFirst({ where: { schoolId: resolvedSchoolId } });
    const dueDate = subscription?.nextDueAt ?? subscription?.endsAt ?? null;
    if (dueDate) {
      const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      if (subscription?.status === 'GRACE_PERIOD') {
        addItem({
          id: 'plan-grace',
          title: 'Subscription overdue',
          message: `Grace period active. Please renew to avoid suspension.`,
          type: 'danger',
          href: '/dashboard/plans',
        });
      } else if (diffDays <= 7 && diffDays >= 0) {
        addItem({
          id: 'plan-due',
          title: 'Subscription due soon',
          message: `Your plan expires in ${diffDays} day${diffDays === 1 ? '' : 's'}.`,
          type: 'warning',
          href: '/dashboard/plans',
        });
      }
    }

    if (pendingAttendance > 0) {
      addItem({
        id: 'attendance-pending',
        title: 'Attendance pending approval',
        message: `${pendingAttendance} sessions awaiting review.`,
        type: 'info',
        href: '/dashboard/attendance',
      });
    }

    if (transferRequests > 0) {
      addItem({
        id: 'transfer-requests',
        title: 'New transfer request',
        message: `${transferRequests} student transfer${transferRequests === 1 ? '' : 's'} need action.`,
        type: 'warning',
        href: '/dashboard/students/transfers',
      });
    }

    if (openTickets > 0) {
      addItem({
        id: 'tickets',
        title: role === 'TEACHER' ? 'Ticket status updated' : 'Open support tickets',
        message: role === 'TEACHER'
          ? `${openTickets} ticket${openTickets === 1 ? '' : 's'} updated by admin.`
          : `${openTickets} tickets awaiting response.`,
        type: 'info',
        href: '/dashboard/support',
      });
    }
      }

      return { items };
    },
  );
  setCacheHeader(res, status);

  res.status(200).json(value);
};
