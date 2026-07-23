import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  createSchool,
  createSchoolAdmin,
  resetSchoolAdminCredentials,
  listSchoolAdmins,
  setSchoolAdminStatus,
  listSchools,
  updateSchool,
  setSchoolStatus,
  softDeleteSchool,
  restoreSchool,
  createSchoolImpersonationSession,
} from '../services/schoolAdmin.service';
import { logAudit } from '../utils/audit';
import { buildQueryFingerprint, cacheKeys } from '../services/cache/cache.keys';
import { rememberCache, setCacheHeader } from '../services/cache/cache.service';
import { cacheTTL } from '../services/cache/cache.ttl';
import { invalidateSchoolCache, invalidateSubscriptionCache } from '../services/cache/cache.invalidation';
import { sendAccountCreatedWhatsapp } from '../services/accountOnboardingWhatsapp.service';
import { EmailService } from '../services/email.service';
import { buildSchoolLoginUrlFromRequest } from '../utils/requestLoginUrl';

const bankDetailsSchema = z
  .object({
    accountHolderName: z.string().min(1).optional().nullable(),
    accountNumber: z.string().min(1).optional().nullable(),
    ifscCode: z.string().min(1).optional().nullable(),
    accountType: z.string().min(1).optional().nullable(),
    bankName: z.string().min(1).optional().nullable(),
    branchName: z.string().min(1).optional().nullable(),
    panNumber: z.string().min(1).optional().nullable(),
  })
  .optional();

const createSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  subscriptionPlan: z.string().trim().min(1).max(120),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  adminEmail: z.string().email().optional(),
  adminBankDetails: bankDetailsSchema,
});

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  query: z.string().min(1).optional(),
  includeDeleted: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((value) => (typeof value === 'string' ? value === 'true' : Boolean(value))),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  subscriptionPlan: z.string().trim().min(1).max(120).optional(),
  statusReason: z.string().min(1).nullable().optional(),
  lastLoginAt: z.coerce.date().nullable().optional(),
  activeUsersCount: z.number().int().min(0).optional(),
});

const statusSchema = z.object({
  reason: z.string().min(1).nullable().optional(),
});

const createSchoolAdminSchema = z.object({
  adminEmail: z.string().email(),
  bankDetails: bankDetailsSchema,
});

const schoolAdminStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']),
});

export const createSchoolApi = async (req: Request, res: Response) => {
  const payload = createSchema.parse(req.body);
  const result = await createSchool({
    name: payload.name,
    code: payload.code,
    subscriptionPlan: payload.subscriptionPlan,
    status: payload.status,
    adminEmail: payload.adminEmail,
    adminBankDetails: payload.adminBankDetails,
  });
  await invalidateSchoolCache(result.school.id);
  await invalidateSubscriptionCache(result.school.id);
  let whatsappSentTo: string | null = null;
  let manualShareRequired = false;
  let manualShareText: string | null = null;
  let manualShareUrl: string | null = null;
  let notificationDeliveries: unknown = null;
  let platformEmailDeliveryStatus: string | null = null;
  let loginUrl: string | null = null;
  if (result.adminUser) {
    loginUrl = buildSchoolLoginUrlFromRequest(req, result.school);
    await logAudit(req, {
      schoolId: result.school.id,
      entityType: 'USER',
      entityId: result.adminUser.id,
      action: 'SCHOOL_ADMIN_CREATED',
      afterState: { email: result.adminUser.email, status: result.adminUser.status },
    });
    const whatsapp = await sendAccountCreatedWhatsapp({
      role: 'SCHOOL_ADMIN',
      schoolId: result.school.id,
      schoolCode: result.school.code,
      loginUrl,
      email: result.adminUser.email,
      mobile: null,
      tempPassword: result.tempPassword,
      fullName: result.adminUser.email,
    });
    whatsappSentTo = whatsapp.sentTo;
    manualShareRequired = whatsapp.manualShareRequired;
    manualShareText = whatsapp.manualShareText;
    manualShareUrl = whatsapp.manualShareUrl;
    notificationDeliveries = whatsapp.deliveries;
    const platformEmail = await EmailService.sendSchoolAdminCredentials({
      to: result.adminUser.email,
      schoolName: result.school.name,
      schoolCode: result.school.code,
      loginUrl,
      tempPassword: result.tempPassword,
      userId: result.adminUser.id,
    });
    platformEmailDeliveryStatus = platformEmail.status;
  }
  res.status(201).json({
    ...result,
    mappedSchoolId: result.school.id,
    whatsappSentTo,
    manualShareRequired,
    manualShareText,
    manualShareUrl,
    notificationDeliveries,
    platformEmailDeliveryStatus,
    loginUrl,
    schoolCode: result.school.code,
  });
};

export const listSchoolsApi = async (req: Request, res: Response) => {
  const payload = listSchema.parse(req.query);
  const params = {
    page: payload.page,
    limit: payload.limit,
    status: payload.status,
    query: payload.query,
    includeDeleted: payload.includeDeleted ?? false,
  };
  const queryFingerprint = buildQueryFingerprint(payload);
  const { value: result, status } = await rememberCache(
    cacheKeys.schoolsList(queryFingerprint),
    cacheTTL.SCHOOLS,
    () => listSchools(params),
  );
  setCacheHeader(res, status);
  res.status(200).json(result);
};

export const listSchoolAdminsApi = async (req: Request, res: Response) => {
  const { value: result, status } = await rememberCache(
    cacheKeys.schoolAdmins(req.params.id),
    cacheTTL.SCHOOLS,
    () => listSchoolAdmins(req.params.id),
  );
  setCacheHeader(res, status);
  res.status(200).json(result);
};

export const updateSchoolApi = async (req: Request, res: Response) => {
  const payload = updateSchema.parse(req.body);
  const school = await updateSchool(req.params.id, payload);
  await invalidateSchoolCache(school.id);
  await invalidateSubscriptionCache(school.id);
  res.status(200).json(school);
};

export const activateSchoolApi = async (req: Request, res: Response) => {
  const payload = statusSchema.parse(req.body);
  const school = await setSchoolStatus(req.params.id, 'ACTIVE', payload.reason ?? null);
  await invalidateSchoolCache(school.id);
  await invalidateSubscriptionCache(school.id);
  res.status(200).json(school);
};

export const suspendSchoolApi = async (req: Request, res: Response) => {
  const payload = statusSchema.parse(req.body);
  const school = await setSchoolStatus(req.params.id, 'SUSPENDED', payload.reason ?? null);
  await invalidateSchoolCache(school.id);
  await invalidateSubscriptionCache(school.id);
  res.status(200).json(school);
};

export const deleteSchoolApi = async (req: Request, res: Response) => {
  const school = await softDeleteSchool(req.params.id);
  await invalidateSchoolCache(school.id);
  await invalidateSubscriptionCache(school.id);
  res.status(200).json(school);
};

export const restoreSchoolApi = async (req: Request, res: Response) => {
  const school = await restoreSchool(req.params.id);
  await invalidateSchoolCache(school.id);
  await invalidateSubscriptionCache(school.id);
  res.status(200).json(school);
};

export const createSchoolAdminApi = async (req: Request, res: Response) => {
  const payload = createSchoolAdminSchema.parse(req.body);
  const result = await createSchoolAdmin(req.params.id, payload.adminEmail, payload.bankDetails);
  await invalidateSchoolCache(req.params.id);
  await logAudit(req, {
    schoolId: req.params.id,
    entityType: 'USER',
    entityId: result.adminUser.id,
    action: 'SCHOOL_ADMIN_CREATED',
    afterState: { email: result.adminUser.email, status: result.adminUser.status },
  });
  const loginUrl = buildSchoolLoginUrlFromRequest(req, result.school);
  const whatsapp = await sendAccountCreatedWhatsapp({
    role: 'SCHOOL_ADMIN',
    schoolId: req.params.id,
    schoolCode: result.school?.code ?? null,
    loginUrl,
    email: result.adminUser.email,
    mobile: null,
    tempPassword: result.tempPassword,
    fullName: result.adminUser.email,
  });
  const platformEmail = await EmailService.sendSchoolAdminCredentials({
    to: result.adminUser.email,
    schoolName: result.school?.name ?? null,
    schoolCode: result.school?.code ?? null,
    loginUrl,
    tempPassword: result.tempPassword,
    userId: result.adminUser.id,
  });
  res.status(201).json({
    ...result,
    mappedSchoolId: req.params.id,
    whatsappSentTo: whatsapp.sentTo,
    manualShareRequired: whatsapp.manualShareRequired,
    manualShareText: whatsapp.manualShareText,
    manualShareUrl: whatsapp.manualShareUrl,
    notificationDeliveries: whatsapp.deliveries,
    platformEmailDeliveryStatus: platformEmail.status,
    loginUrl,
    schoolCode: result.school?.code ?? null,
  });
};

export const resetSchoolAdminCredentialsApi = async (req: Request, res: Response) => {
  const result = await resetSchoolAdminCredentials(req.params.id, req.params.adminId);
  await invalidateSchoolCache(req.params.id);
  const loginUrl = buildSchoolLoginUrlFromRequest(req, result.school);
  await logAudit(req, {
    schoolId: req.params.id,
    entityType: 'USER',
    entityId: result.adminUser.id,
    action: 'SCHOOL_ADMIN_CREDENTIALS_REGENERATED',
    afterState: {
      email: result.adminUser.email,
      status: result.adminUser.status,
      revokedSessions: result.revokedSessions,
    },
  });

  const whatsapp = await sendAccountCreatedWhatsapp({
    role: 'SCHOOL_ADMIN',
    schoolId: req.params.id,
    schoolCode: result.school.code,
    loginUrl,
    email: result.adminUser.email,
    mobile: null,
    tempPassword: result.tempPassword,
    fullName: result.adminUser.email,
    event: 'REGENERATED',
  });
  const platformEmail = await EmailService.sendTemporaryPasswordCredentials({
    to: result.adminUser.email,
    recipientName: result.adminUser.email,
    schoolName: result.school.name,
    schoolCode: result.school.code,
    loginUrl,
    tempPassword: result.tempPassword,
    userId: result.adminUser.id,
    roleLabel: 'School Admin',
  });

  res.status(200).json({
    ...result,
    mappedSchoolId: req.params.id,
    whatsappSentTo: whatsapp.sentTo,
    manualShareRequired: whatsapp.manualShareRequired,
    manualShareText: whatsapp.manualShareText,
    manualShareUrl: whatsapp.manualShareUrl,
    notificationDeliveries: whatsapp.deliveries,
    platformEmailDeliveryStatus: platformEmail.status,
    platformEmailLogId: platformEmail.logId ?? null,
    loginUrl,
    schoolCode: result.school.code,
  });
};

export const setSchoolAdminStatusApi = async (req: Request, res: Response) => {
  const payload = schoolAdminStatusSchema.parse(req.body);
  const updated = await setSchoolAdminStatus(req.params.id, req.params.adminId, payload.status);
  await invalidateSchoolCache(req.params.id);
  await logAudit(req, {
    schoolId: req.params.id,
    entityType: 'USER',
    entityId: updated.id,
    action: 'SCHOOL_ADMIN_STATUS_UPDATED',
    afterState: { status: updated.status },
  });
  res.status(200).json(updated);
};

export const impersonateSchoolApi = async (req: Request, res: Response) => {
  const result = await createSchoolImpersonationSession(req, req.params.id);
  await logAudit(req, {
    schoolId: result.school.id,
    entityType: 'USER',
    entityId: result.user.id,
    action: 'SCHOOL_ADMIN_IMPERSONATED',
    afterState: {
      schoolId: result.school.id,
      schoolName: result.school.name,
      schoolCode: result.school.code,
      impersonatedUserId: result.user.id,
      impersonatedUserEmail: result.user.email,
      visibleToSuperAdminOnly: true,
    },
  });
  res.status(200).json(result);
};
