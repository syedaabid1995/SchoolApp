import type { Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { PermissionCodes as P } from '../permissions/permission-manifest';
import { AuthorizationService } from '../services/authorization.service';
import { sendNotification } from '../services/notification.service';
import { resolveSchoolId } from '../utils/tenant';

const channelSchema = z.enum(['EMAIL', 'SMS', 'PUSH']);
const pushPrioritySchema = z.enum(['normal', 'high', 'urgent']);
const audienceSchema = z.array(z.string().trim().min(1)).default(['Students', 'Guardians']);
const noticeStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('PUBLISHED');
const recipientGroupSchema = z.enum([
  'STUDENTS',
  'GUARDIANS',
  'ADMIN',
  'TEACHER',
  'ACCOUNTANT',
  'LIBRARIAN',
  'RECEPTIONIST',
  'STAFF',
]);

const noticePayloadSchema = z.object({
  schoolId: z.string().uuid().optional(),
  title: z.string().trim().min(1),
  message: z.string().trim().min(1),
  audience: audienceSchema,
  status: noticeStatusSchema,
  publishedAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional().nullable(),
});

const templatePayloadSchema = z.object({
  schoolId: z.string().uuid().optional(),
  platform: z.boolean().optional(),
  channel: channelSchema,
  name: z.string().trim().min(1),
  subject: z.string().trim().optional().nullable(),
  body: z.string().trim().min(1),
});

const sendPayloadBaseSchema = z.object({
  schoolId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional().nullable(),
  subject: z.string().trim().optional().nullable(),
  body: z.string().trim().optional().nullable(),
  recipientGroups: z.array(recipientGroupSchema).min(1),
  targetMode: z.enum(['GROUP', 'CLASS', 'INDIVIDUAL', 'BIRTHDAY']).default('GROUP'),
  classId: z.string().uuid().optional().nullable(),
  sectionId: z.string().uuid().optional().nullable(),
  individualRecipient: z.string().trim().optional().nullable(),
  individualRecipients: z.array(z.string().trim().min(1)).optional().default([]),
  scheduledAt: z.coerce.date().optional().nullable(),
  route: z.string().trim().optional().nullable(),
  module: z.string().trim().optional().nullable(),
  category: z.string().trim().optional().nullable(),
  priority: pushPrioritySchema.optional().nullable(),
});

const sendPayloadSchema = sendPayloadBaseSchema
  .refine((payload) => Boolean(payload.templateId || payload.body), {
    path: ['body'],
    message: 'Message body is required when no template is selected',
  });

type CommunicationChannel = z.infer<typeof channelSchema>;
type RecipientGroup = z.infer<typeof recipientGroupSchema>;

const normalizeRecipient = (value: string | null | undefined) => (value ?? '').trim();
const stripHtml = (value: string) =>
  value
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .trim();

const templatePermissions = (channel: CommunicationChannel, action: 'view' | 'create' | 'edit' | 'delete') => {
  if (channel === 'EMAIL') {
    return {
      view: P.communicationEmailTemplateView,
      create: P.communicationEmailTemplateCreate,
      edit: P.communicationEmailTemplateEdit,
      delete: P.communicationEmailTemplateDelete,
    }[action];
  }
  if (channel === 'PUSH') {
    return {
      view: P.communicationPushTemplateView,
      create: P.communicationPushTemplateCreate,
      edit: P.communicationPushTemplateEdit,
      delete: P.communicationPushTemplateDelete,
    }[action];
  }
  return {
    view: P.communicationSmsTemplateView,
    create: P.communicationSmsTemplateCreate,
    edit: P.communicationSmsTemplateEdit,
    delete: P.communicationSmsTemplateDelete,
  }[action];
};

const assertPermission = async (req: Request, permission: string | string[]) => {
  if (!req.auth) throw new HttpError(401, 'Unauthorized');
  await AuthorizationService.assertPermission(req.auth, permission);
};

const templateDto = (template: {
  id: string;
  schoolId: string | null;
  key: string;
  name: string | null;
  channel: string;
  subject: string | null;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: template.id,
  schoolId: template.schoolId,
  key: template.key,
  name: template.name ?? template.key,
  channel: template.channel,
  subject: template.subject,
  body: template.body,
  isSystem: template.schoolId === null,
  createdAt: template.createdAt,
  updatedAt: template.updatedAt,
});

const noticeDto = (notice: {
  id: string;
  title: string;
  message: string;
  audience: unknown;
  status: string;
  publishedAt: Date;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: { email: string } | null;
}) => ({
  id: notice.id,
  title: notice.title,
  message: notice.message,
  audience: Array.isArray(notice.audience) ? notice.audience : [],
  status: notice.status,
  publishedAt: notice.publishedAt,
  expiresAt: notice.expiresAt,
  createdAt: notice.createdAt,
  updatedAt: notice.updatedAt,
  createdByEmail: notice.createdBy?.email ?? null,
});

type ResolvedRecipient = {
  to: string;
  name: string;
  type: string;
};

const recipientKey = (channel: CommunicationChannel, value: string | null | undefined) => {
  const normalized = normalizeRecipient(value);
  if (!normalized) return '';
  if (channel === 'EMAIL') return normalized.toLowerCase();
  if (channel === 'SMS') return normalized.replace(/\D/g, '') || normalized;
  return normalized;
};

const addRecipient = (map: Map<string, ResolvedRecipient>, recipient: ResolvedRecipient, channel: CommunicationChannel) => {
  const to = normalizeRecipient(recipient.to);
  if (!to) return;
  const key = recipientKey(channel, to);
  if (!key) return;
  if (!map.has(key)) {
    map.set(key, { ...recipient, to });
  }
};

const isBirthdayToday = (value: Date | null | undefined) => {
  if (!value) return false;
  const today = new Date();
  return value.getMonth() === today.getMonth() && value.getDate() === today.getDate();
};

const recipientDto = (channel: CommunicationChannel, recipient: ResolvedRecipient) => ({
  value: recipient.to,
  name: recipient.name,
  type: recipient.type,
  contact: recipient.to,
  label: `${recipient.name} (${recipient.type}) - ${recipient.to}`,
  key: recipientKey(channel, recipient.to),
});

const getStudentsForTarget = async (params: {
  schoolId: string;
  classId?: string | null;
  sectionId?: string | null;
  birthdayOnly?: boolean;
}) => {
  const students = await prisma.student.findMany({
    where: {
      schoolId: params.schoolId,
      status: 'ENROLLED',
      ...(params.classId ? { classId: params.classId } : {}),
      ...(params.sectionId ? { sectionId: params.sectionId } : {}),
    },
    include: {
      guardians: { select: { name: true, email: true, phone: true } },
      parentLinks: {
        select: {
          parent: { select: { firstName: true, lastName: true, email: true, phone: true, userId: true } },
        },
      },
    },
    orderBy: { fullName: 'asc' },
  });

  if (!params.birthdayOnly) return students;
  return students.filter((student) => isBirthdayToday(student.dob));
};

const resolveRecipients = async (params: {
  schoolId: string;
  channel: CommunicationChannel;
  recipientGroups: RecipientGroup[];
  targetMode: 'GROUP' | 'CLASS' | 'INDIVIDUAL' | 'BIRTHDAY';
  classId?: string | null;
  sectionId?: string | null;
  individualRecipient?: string | null;
  individualRecipients?: string[];
}) => {
  const recipients = new Map<string, ResolvedRecipient>();
  const wantsStudents = params.recipientGroups.includes('STUDENTS');
  const wantsGuardians = params.recipientGroups.includes('GUARDIANS');
  const birthdayOnly = params.targetMode === 'BIRTHDAY';

  if (params.targetMode === 'INDIVIDUAL' && params.individualRecipient) {
    addRecipient(
      recipients,
      { to: params.individualRecipient, name: 'Individual Recipient', type: 'INDIVIDUAL' },
      params.channel,
    );
  }

  if (wantsStudents || wantsGuardians) {
    const students = await getStudentsForTarget({
      schoolId: params.schoolId,
      classId: params.targetMode === 'CLASS' ? params.classId : null,
      sectionId: params.targetMode === 'CLASS' ? params.sectionId : null,
      birthdayOnly,
    });

    for (const student of students) {
      if (wantsStudents && params.channel !== 'PUSH') {
        addRecipient(
          recipients,
          {
            to: params.channel === 'EMAIL' ? student.email : student.phone,
            name: student.fullName,
            type: 'STUDENT',
          },
          params.channel,
        );
      }

      if (wantsGuardians) {
        if (params.channel === 'PUSH') {
          student.parentLinks.forEach((link) => {
            if (!link.parent.userId) return;
            addRecipient(
              recipients,
              {
                to: link.parent.userId,
                name: `${link.parent.firstName ?? ''} ${link.parent.lastName ?? ''}`.trim() || link.parent.email || `${student.fullName} Guardian`,
                type: 'GUARDIAN',
              },
              params.channel,
            );
          });
        } else {
          addRecipient(
            recipients,
            {
              to: params.channel === 'EMAIL' ? student.parentEmail : student.parentPhone,
              name: student.guardianName || student.fatherName || student.motherName || `${student.fullName} Guardian`,
              type: 'GUARDIAN',
            },
            params.channel,
          );
          student.guardians.forEach((guardian) =>
            addRecipient(
              recipients,
              {
                to: params.channel === 'EMAIL' ? guardian.email : guardian.phone,
                name: guardian.name || `${student.fullName} Guardian`,
                type: 'GUARDIAN',
              },
              params.channel,
            ),
          );
        }
      }
    }
  }

  const roleGroups = params.recipientGroups.filter((group) => !['STUDENTS', 'GUARDIANS', 'RECEPTIONIST'].includes(group));
  if (roleGroups.length || params.recipientGroups.includes('RECEPTIONIST')) {
    const roleNames = Array.from(new Set(roleGroups.map((group) => (group === 'ADMIN' ? 'SCHOOL_ADMIN' : group))));
    if (params.recipientGroups.includes('RECEPTIONIST') && !roleNames.includes('STAFF')) {
      roleNames.push('STAFF');
    }

    const users = await prisma.user.findMany({
      where: {
        schoolId: params.schoolId,
        status: 'ACTIVE',
        roles: { some: { role: { name: { in: roleNames as any[] } } } },
        ...(birthdayOnly ? { teacherProfile: { is: { dateOfBirth: { not: null } } } } : {}),
      },
      include: {
        teacherProfile: {
          select: { firstName: true, lastName: true, phone: true, roleName: true, dateOfBirth: true },
        },
        roles: { select: { role: { select: { name: true } } } },
      },
      orderBy: { email: 'asc' },
    });

    for (const user of users) {
      if (birthdayOnly && !isBirthdayToday(user.teacherProfile?.dateOfBirth)) continue;
      const profileName = user.teacherProfile
        ? `${user.teacherProfile.firstName} ${user.teacherProfile.lastName}`.trim()
        : '';
      addRecipient(
        recipients,
        {
          to: params.channel === 'EMAIL' ? user.email : params.channel === 'SMS' ? user.teacherProfile?.phone : user.id,
          name: profileName || user.email,
          type: user.teacherProfile?.roleName ?? user.roles[0]?.role.name ?? 'STAFF',
        },
        params.channel,
      );
    }
  }

  const selectedKeys = new Set((params.individualRecipients ?? []).map((value) => recipientKey(params.channel, value)).filter(Boolean));
  if (params.targetMode === 'INDIVIDUAL') {
    if (selectedKeys.size) {
      return Array.from(recipients.entries()).filter(([key]) => selectedKeys.has(key)).map(([, recipient]) => recipient);
    }
    const freeformKey = recipientKey(params.channel, params.individualRecipient);
    return freeformKey && recipients.has(freeformKey) ? [recipients.get(freeformKey)!] : [];
  }
  if (selectedKeys.size && params.targetMode === 'BIRTHDAY') {
    return Array.from(recipients.entries()).filter(([key]) => selectedKeys.has(key)).map(([, recipient]) => recipient);
  }

  return Array.from(recipients.values());
};

const getTemplateForSend = async (schoolId: string, channel: CommunicationChannel, templateId?: string | null) => {
  if (!templateId) return null;
  const template = await prisma.notificationTemplate.findFirst({
    where: {
      id: templateId,
      channel,
      OR: [{ schoolId }, { schoolId: null }],
    },
  });
  if (!template) throw new HttpError(404, 'Template not found');
  return template;
};

const noticeAudienceToRecipientGroups = (audience: string[]): RecipientGroup[] => {
  const groups = new Set<RecipientGroup>();
  for (const item of audience) {
    const normalized = item.trim().toLowerCase();
    if (normalized.includes('student')) groups.add('STUDENTS');
    if (normalized.includes('guardian') || normalized.includes('parent')) groups.add('GUARDIANS');
    if (normalized.includes('admin')) groups.add('ADMIN');
    if (normalized.includes('teacher')) groups.add('TEACHER');
    if (normalized.includes('accountant')) groups.add('ACCOUNTANT');
    if (normalized.includes('librarian')) groups.add('LIBRARIAN');
    if (normalized.includes('staff')) groups.add('STAFF');
  }
  return Array.from(groups);
};

const sendNoticePushNotifications = async (params: {
  req: Request;
  schoolId: string;
  title: string;
  message: string;
  audience: string[];
}) => {
  const recipientGroups = noticeAudienceToRecipientGroups(params.audience);
  if (!recipientGroups.length) return;
  const recipients = await resolveRecipients({
    schoolId: params.schoolId,
    channel: 'PUSH',
    recipientGroups,
    targetMode: 'GROUP',
  });
  await Promise.all(
    recipients.map((recipient) =>
      sendNotification({
        schoolId: params.schoolId,
        userId: params.req.auth?.userId ?? null,
        channel: 'PUSH',
        data: {
          to: recipient.to,
          subject: params.title,
          body: params.message,
          recipientName: recipient.name,
          recipientType: recipient.type,
          targetMode: 'GROUP',
          recipientGroups,
          route: '/parent/notices',
          module: 'notices',
          category: 'notice',
        },
      }),
    ),
  );
};

const sendCommunication = async (req: Request, res: Response, channel: CommunicationChannel) => {
  await assertPermission(req, channel === 'EMAIL' ? P.communicationEmailSend : channel === 'SMS' ? P.communicationSmsSend : P.communicationPushSend);
  const payload = sendPayloadSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  const template = await getTemplateForSend(schoolId, channel, payload.templateId);
  const recipients = await resolveRecipients({
    schoolId,
    channel,
    recipientGroups: payload.recipientGroups,
    targetMode: payload.targetMode,
    classId: payload.classId,
    sectionId: payload.sectionId,
    individualRecipient: payload.individualRecipient,
    individualRecipients: payload.individualRecipients,
  });

  if (!recipients.length) {
    throw new HttpError(400, `No ${channel === 'EMAIL' ? 'email' : channel === 'SMS' ? 'SMS' : 'push'} recipients found for the selected audience`);
  }

  const subject = channel === 'EMAIL' || channel === 'PUSH' ? (payload.subject || template?.subject || 'School Communication') : undefined;
  const body = payload.body || template?.body;
  const textBody = channel === 'EMAIL' ? stripHtml(body ?? '') : body;
  const htmlBody = channel === 'EMAIL' ? body : undefined;
  const scheduledAt = payload.scheduledAt ?? null;

  const results = [];
  for (const recipient of recipients) {
    const result = await sendNotification({
      schoolId,
      userId: req.auth?.userId ?? null,
      channel,
      templateKey: template?.key,
      scheduledAt,
      data: {
        to: recipient.to,
        subject,
        body: textBody,
        html: htmlBody,
        ...(channel === 'EMAIL' ? { emailIntent: 'GENERAL_COMMUNICATION' } : {}),
        recipientName: recipient.name,
        recipientType: recipient.type,
        targetMode: payload.targetMode,
        recipientGroups: payload.recipientGroups,
        route: payload.route,
        module: payload.module,
        category: payload.category,
        priority: channel === 'PUSH' ? payload.priority ?? 'normal' : undefined,
      },
    });
    results.push(result);
  }

  res.status(scheduledAt && scheduledAt.getTime() > Date.now() ? 202 : 200).json({
    channel,
    scheduled: Boolean(scheduledAt && scheduledAt.getTime() > Date.now()),
    recipientCount: recipients.length,
    logIds: results.map((result) => result.logId),
    sentCount: results.filter((result) => result.delivery?.status === 'SENT' || result.delivery?.status === 'QUEUED').length,
    queuedCount: results.filter((result) => result.delivery?.status === 'QUEUED').length,
    failedCount: results.filter((result) => result.delivery?.status === 'FAILED').length,
  });
};

export const listCommunicationNoticesApi = async (req: Request, res: Response) => {
  await assertPermission(req, P.communicationNoticeBoardView);
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const notices = await prisma.communicationNotice.findMany({
    where: { schoolId },
    include: { createdBy: { select: { email: true } } },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
  });
  res.status(200).json({ items: notices.map(noticeDto) });
};

export const createCommunicationNoticeApi = async (req: Request, res: Response) => {
  await assertPermission(req, P.communicationNoticeBoardCreate);
  const payload = noticePayloadSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  const notice = await prisma.communicationNotice.create({
    data: {
      schoolId,
      title: payload.title,
      message: payload.message,
      audience: payload.audience,
      status: payload.status,
      publishedAt: payload.publishedAt ?? new Date(),
      expiresAt: payload.expiresAt ?? null,
      createdById: req.auth?.userId ?? null,
    },
    include: { createdBy: { select: { email: true } } },
  });
  if (notice.status === 'PUBLISHED') {
    await sendNoticePushNotifications({
      req,
      schoolId,
      title: notice.title,
      message: notice.message,
      audience: Array.isArray(notice.audience) ? notice.audience.map(String) : [],
    });
  }
  res.status(201).json(noticeDto(notice));
};

export const updateCommunicationNoticeApi = async (req: Request, res: Response) => {
  await assertPermission(req, P.communicationNoticeBoardEdit);
  const payload = noticePayloadSchema.partial().parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  const existing = await prisma.communicationNotice.findFirst({ where: { id: req.params.id, schoolId } });
  if (!existing) throw new HttpError(404, 'Notice not found');

  const notice = await prisma.communicationNotice.update({
    where: { id: existing.id },
    data: {
      title: payload.title,
      message: payload.message,
      audience: payload.audience,
      status: payload.status,
      publishedAt: payload.publishedAt,
      expiresAt: payload.expiresAt,
    },
    include: { createdBy: { select: { email: true } } },
  });
  if (existing.status !== 'PUBLISHED' && notice.status === 'PUBLISHED') {
    await sendNoticePushNotifications({
      req,
      schoolId,
      title: notice.title,
      message: notice.message,
      audience: Array.isArray(notice.audience) ? notice.audience.map(String) : [],
    });
  }
  res.status(200).json(noticeDto(notice));
};

export const deleteCommunicationNoticeApi = async (req: Request, res: Response) => {
  await assertPermission(req, P.communicationNoticeBoardDelete);
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const existing = await prisma.communicationNotice.findFirst({ where: { id: req.params.id, schoolId } });
  if (!existing) throw new HttpError(404, 'Notice not found');
  await prisma.communicationNotice.delete({ where: { id: existing.id } });
  res.status(200).json({ success: true });
};

export const listCommunicationTemplatesApi = async (req: Request, res: Response) => {
  const channel = channelSchema.parse((req.query.channel as string | undefined) ?? 'EMAIL');
  await assertPermission(req, [
    templatePermissions(channel, 'view'),
    channel === 'EMAIL' ? P.communicationEmailSend : channel === 'SMS' ? P.communicationSmsSend : P.communicationPushSend,
  ]);
  const platformScope = req.auth?.role === 'SUPER_ADMIN' && req.query.platform === 'true';
  const schoolId = platformScope ? null : resolveSchoolId(req, req.query.schoolId as string | undefined);
  const templates = await prisma.notificationTemplate.findMany({
    where: platformScope ? { channel, schoolId: null } : { channel, OR: [{ schoolId }, { schoolId: null }] },
    orderBy: [{ schoolId: 'desc' }, { updatedAt: 'desc' }],
  });
  res.status(200).json({ items: templates.map(templateDto) });
};

export const createCommunicationTemplateApi = async (req: Request, res: Response) => {
  const payload = templatePayloadSchema.parse(req.body);
  await assertPermission(req, templatePermissions(payload.channel, 'create'));
  const platformScope = req.auth?.role === 'SUPER_ADMIN' && payload.platform === true;
  const schoolId = platformScope ? null : resolveSchoolId(req, payload.schoolId);
  const template = await prisma.notificationTemplate.create({
    data: {
      schoolId,
      key: `${platformScope ? 'platform' : `school:${schoolId}`}:${payload.channel}:${crypto.randomUUID()}`,
      name: payload.name,
      channel: payload.channel,
      subject: payload.channel === 'EMAIL' || payload.channel === 'PUSH' ? payload.subject ?? null : null,
      body: payload.body,
    },
  });
  res.status(201).json(templateDto(template));
};

export const updateCommunicationTemplateApi = async (req: Request, res: Response) => {
  const payload = templatePayloadSchema.partial().extend({ channel: channelSchema }).parse(req.body);
  await assertPermission(req, templatePermissions(payload.channel, 'edit'));
  const platformScope = req.auth?.role === 'SUPER_ADMIN' && payload.platform === true;
  const schoolId = platformScope ? null : resolveSchoolId(req, payload.schoolId);
  const existing = await prisma.notificationTemplate.findFirst({
    where: { id: req.params.id, schoolId, channel: payload.channel },
  });
  if (!existing) throw new HttpError(404, 'Template not found');

  const template = await prisma.notificationTemplate.update({
    where: { id: existing.id },
    data: {
      name: payload.name,
      subject: payload.channel === 'EMAIL' || payload.channel === 'PUSH' ? payload.subject : null,
      body: payload.body,
    },
  });
  res.status(200).json(templateDto(template));
};

export const deleteCommunicationTemplateApi = async (req: Request, res: Response) => {
  const channel = channelSchema.parse((req.query.channel as string | undefined) ?? 'EMAIL');
  await assertPermission(req, templatePermissions(channel, 'delete'));
  const platformScope = req.auth?.role === 'SUPER_ADMIN' && req.query.platform === 'true';
  const schoolId = platformScope ? null : resolveSchoolId(req, req.query.schoolId as string | undefined);
  const existing = await prisma.notificationTemplate.findFirst({ where: { id: req.params.id, schoolId, channel } });
  if (!existing) throw new HttpError(404, 'Template not found');
  await prisma.notificationTemplate.delete({ where: { id: existing.id } });
  res.status(200).json({ success: true });
};

const parseRecipientGroupsQuery = (value: unknown) => {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : ['STUDENTS', 'GUARDIANS'];
  return z.array(recipientGroupSchema).min(1).parse(raw.map((item) => String(item).trim()).filter(Boolean));
};

export const listCommunicationRecipientsApi = async (req: Request, res: Response) => {
  await assertPermission(req, [P.communicationEmailSend, P.communicationSmsSend, P.communicationPushSend]);
  const channel = channelSchema.parse((req.query.channel as string | undefined) ?? 'EMAIL');
  const targetMode = z.enum(['GROUP', 'CLASS', 'INDIVIDUAL', 'BIRTHDAY']).parse((req.query.targetMode as string | undefined) ?? 'GROUP');
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const recipientGroups = parseRecipientGroupsQuery(req.query.recipientGroups);
  const recipients = await resolveRecipients({
    schoolId,
    channel,
    recipientGroups,
    targetMode,
    classId: typeof req.query.classId === 'string' ? req.query.classId : null,
    sectionId: typeof req.query.sectionId === 'string' ? req.query.sectionId : null,
  });

  res.status(200).json({ items: recipients.map((recipient) => recipientDto(channel, recipient)) });
};

export const listTodayBirthdaysApi = async (req: Request, res: Response) => {
  await assertPermission(req, [P.dashboardOverview, P.communicationEmailSend, P.communicationSmsSend, P.communicationPushSend]);
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const [students, employees] = await Promise.all([
    prisma.student.findMany({
      where: { schoolId, status: 'ENROLLED', dob: { not: null } },
      select: {
        id: true,
        fullName: true,
        dob: true,
        photoUrl: true,
        admissionNo: true,
        class: { select: { name: true } },
        section: { select: { name: true } },
      },
      orderBy: { fullName: 'asc' },
    }),
    prisma.teacherProfile.findMany({
      where: { schoolId, isActive: true, dateOfBirth: { not: null } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        roleName: true,
        dateOfBirth: true,
        photoUrl: true,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    }),
  ]);

  const studentItems = students
    .filter((student) => isBirthdayToday(student.dob))
    .map((student) => ({
      id: student.id,
      name: student.fullName,
      type: 'STUDENT',
      dateOfBirth: student.dob,
      photoUrl: student.photoUrl,
      subtitle: [student.class?.name, student.section?.name].filter(Boolean).join(' ') || `Admission ${student.admissionNo}`,
    }));
  const employeeItems = employees
    .filter((employee) => isBirthdayToday(employee.dateOfBirth))
    .map((employee) => ({
      id: employee.id,
      name: `${employee.firstName} ${employee.lastName}`.trim(),
      type: employee.roleName,
      dateOfBirth: employee.dateOfBirth,
      photoUrl: employee.photoUrl,
      subtitle: String(employee.roleName).replace(/_/g, ' '),
    }));

  res.status(200).json({ items: [...studentItems, ...employeeItems] });
};

const logDto = (log: {
  id: string;
  channel: string;
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
    channel: log.channel,
    status: log.status,
    to: typeof payload.to === 'string' ? payload.to : '',
    subject: typeof payload.subject === 'string' ? payload.subject : log.template?.subject ?? null,
    message: typeof payload.body === 'string' ? payload.body : '',
    html: typeof payload.html === 'string' ? payload.html : null,
    recipientName: typeof payload.recipientName === 'string' ? payload.recipientName : '',
    recipientType: typeof payload.recipientType === 'string' ? payload.recipientType : '',
    targetMode: typeof payload.targetMode === 'string' ? payload.targetMode : '',
    templateName: log.template?.name ?? log.template?.key ?? null,
    providerId: log.providerId,
    error: log.error,
    scheduledAt: log.scheduledAt,
    sentAt: log.sentAt,
    createdAt: log.createdAt,
  };
};

export const listCommunicationLogsApi = async (req: Request, res: Response) => {
  await assertPermission(req, P.communicationEmailLogView);
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const channel = req.query.channel ? channelSchema.parse(req.query.channel) : undefined;
  const logs = await prisma.notificationLog.findMany({
    where: {
      schoolId,
      channel: channel ? channel : { in: ['EMAIL', 'SMS'] },
      OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
    },
    include: { template: { select: { id: true, name: true, key: true, subject: true } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 200,
  });
  res.status(200).json({ items: logs.map(logDto) });
};

export const listCommunicationScheduledLogsApi = async (req: Request, res: Response) => {
  await assertPermission(req, P.communicationScheduledLogView);
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const channel = req.query.channel ? channelSchema.parse(req.query.channel) : undefined;
  const logs = await prisma.notificationLog.findMany({
    where: {
      schoolId,
      channel: channel ? channel : { in: ['EMAIL', 'SMS'] },
      scheduledAt: { not: null },
      status: 'QUEUED',
    },
    include: { template: { select: { id: true, name: true, key: true, subject: true } } },
    orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
    take: 200,
  });
  res.status(200).json({ items: logs.map(logDto) });
};

export const sendEmailCommunicationApi = async (req: Request, res: Response) => {
  await sendCommunication(req, res, 'EMAIL');
};

export const sendSmsCommunicationApi = async (req: Request, res: Response) => {
  await sendCommunication(req, res, 'SMS');
};

export const sendPushCommunicationApi = async (req: Request, res: Response) => {
  await sendCommunication(req, res, 'PUSH');
};

export const sendLoginCredentialInstructionsApi = async (req: Request, res: Response) => {
  await assertPermission(req, P.communicationLoginCredentialsSend);
  const payload = sendPayloadBaseSchema
    .omit({ templateId: true, subject: true, body: true })
    .extend({ channel: z.enum(['EMAIL', 'SMS']).default('EMAIL') })
    .parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { name: true, code: true, domainUrl: true } });
  const channel = payload.channel;
  const recipients = await resolveRecipients({
    schoolId,
    channel,
    recipientGroups: payload.recipientGroups,
    targetMode: payload.targetMode,
    classId: payload.classId,
    sectionId: payload.sectionId,
    individualRecipient: payload.individualRecipient,
    individualRecipients: payload.individualRecipients,
  });

  if (!recipients.length) {
    throw new HttpError(400, 'No recipients found for the selected account audience');
  }

  const loginHint = school?.domainUrl || `School code: ${school?.code ?? ''}`;
  const subject = `Login access for ${school?.name ?? 'your school'}`;
  const body =
    `Your school account is ready. Open the school login page and use your registered email or username. ${loginHint}. ` +
    'If you do not know your password, use Forgot Password to receive a secure reset link.';

  const results = [];
  for (const recipient of recipients) {
    results.push(
      await sendNotification({
        schoolId,
        userId: req.auth?.userId ?? null,
        channel,
        scheduledAt: payload.scheduledAt ?? null,
        data: {
          to: recipient.to,
          subject,
          body,
          ...(channel === 'EMAIL' ? { emailIntent: 'GENERAL_COMMUNICATION' } : {}),
          recipientName: recipient.name,
          recipientType: recipient.type,
          targetMode: payload.targetMode,
          recipientGroups: payload.recipientGroups,
          credentialNotice: true,
        },
      }),
    );
  }

  res.status(payload.scheduledAt && payload.scheduledAt.getTime() > Date.now() ? 202 : 200).json({
    channel,
    scheduled: Boolean(payload.scheduledAt && payload.scheduledAt.getTime() > Date.now()),
    recipientCount: recipients.length,
    logIds: results.map((result) => result.logId),
  });
};
