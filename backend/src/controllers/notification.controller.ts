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

export const listNotificationLogs = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const queryFingerprint = buildQueryFingerprint({
    schoolId,
    page: req.query.page ?? null,
    limit: req.query.limit ?? null,
  });
  const { value: logs, status } = await rememberCache(
    cacheKeys.notificationLogs(queryFingerprint),
    cacheTTL.NOTIFICATIONS,
    () =>
      prisma.notificationLog.findMany({
        where: { schoolId },
        orderBy: { createdAt: 'desc' },
      }),
  );
  setCacheHeader(res, status);

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
