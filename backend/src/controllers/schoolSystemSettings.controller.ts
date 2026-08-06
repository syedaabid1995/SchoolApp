import type { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { resolveSchoolId } from '../utils/tenant';
import { logAudit } from '../utils/audit';
import { normalizeSchoolContacts } from '../services/schoolProfile.service';
import { uploadBuffer } from '../services/s3.service';
import { isAllowedDocumentMimeType, validateUploadedDocumentFile } from '../utils/documentUploadValidation';

const jsonRecord = z.record(z.unknown());
const jsonArray = z.array(z.unknown());

const normalizeText = (value?: string | null) => {
  const trimmed = value?.trim().replace(/\s+/g, ' ');
  return trimmed || undefined;
};

const normalizeNullable = (value?: string | null) => normalizeText(value) ?? null;

const updateSchema = z.object({
  schoolId: z.string().uuid().optional(),
  general: jsonRecord.optional(),
  paymentGateways: jsonArray.optional(),
  baseSetups: jsonRecord.optional(),
  sessions: jsonArray.optional(),
  holidays: jsonArray.optional(),
  weekends: jsonArray.optional(),
  smsSettings: jsonRecord.optional(),
  feeChallanBanks: jsonArray.optional(),
});

const defaultGeneral = {
  schoolName: '',
  siteTitle: 'School ERP',
  address: 'India',
  phone: '',
  email: '',
  schoolCode: '',
  currentSession: '2026',
  language: 'English',
  dateFormat: 'DD MMMM, YYYY',
  currency: 'USD',
  currencySymbol: '$',
  timezone: 'Asia/Kolkata',
  contacts: [],
};

const defaultPaymentGateways = [
  {
    id: 'paypal',
    name: 'PayPal',
    enabled: true,
    mode: 'sandbox',
    username: 'demo-paypal-user',
    clientId: '',
    secretId: '',
    signature: '',
  },
  {
    id: 'stripe',
    name: 'Stripe',
    enabled: false,
    mode: 'test',
    publishableKey: '',
    secretKey: '',
    webhookSecret: '',
  },
  {
    id: 'payumoney',
    name: 'PayUMoney',
    enabled: false,
    mode: 'test',
    merchantKey: '',
    merchantSalt: '',
  },
  {
    id: 'skrill',
    name: 'Skrill',
    enabled: false,
    mode: 'test',
    merchantEmail: '',
  },
];

const defaultBaseSetups = {
  gender: ['Male', 'Female', 'Others'],
  religion: ['Islam', 'Hinduism', 'Christianity', 'Buddhism', 'Others'],
  bloodGroup: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
  caste: ['General', 'OBC', 'SC', 'ST', 'Others'],
};

const defaultSessions = [
  { id: 'session-2024', title: '2024', isActive: false },
  { id: 'session-2025', title: '2025', isActive: false },
  { id: 'session-2026', title: '2026', isActive: true },
];

const defaultHolidays = [
  {
    id: 'holiday-public',
    title: 'Public Holiday',
    fromDate: '2026-01-01',
    toDate: '2026-01-01',
    details: 'New year holiday',
  },
  {
    id: 'holiday-summer',
    title: 'Summer Vacation',
    fromDate: '2026-05-10',
    toDate: '2026-05-20',
    details: 'Academic calendar vacation',
  },
];

const defaultWeekends = [
  { id: 'saturday', name: 'Saturday', isWeekend: false },
  { id: 'sunday', name: 'Sunday', isWeekend: false },
  { id: 'monday', name: 'Monday', isWeekend: false },
  { id: 'tuesday', name: 'Tuesday', isWeekend: false },
  { id: 'wednesday', name: 'Wednesday', isWeekend: false },
  { id: 'thursday', name: 'Thursday', isWeekend: false },
  { id: 'friday', name: 'Friday', isWeekend: true },
];

const defaultSmsSettings = {
  activeProvider: 'TWILIO',
  clickatell: {
    username: 'demo1',
    password: '',
    apiId: '',
  },
  twilio: {
    accountSid: '',
    authToken: '',
    registeredPhoneNumber: '',
  },
};

const defaultFeeChallanBanks = [
  {
    id: 'challan-bank-demo',
    bankName: 'Demo National Bank',
    branchAddress: 'Main Branch, School Road',
    accountNumber: '100200300400',
    instructions: 'Please include student admission number on the payment challan.',
    logoDataUrl: '',
    logoFileName: '',
    logoMimeType: '',
    logoSize: 0,
    isActive: true,
  },
];

const toJson = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

const mergeRecord = (base: Record<string, unknown>, value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value) ? { ...base, ...(value as Record<string, unknown>) } : base;

const normalizeGeneral = (value: unknown) => {
  const merged = mergeRecord(defaultGeneral, value);
  return {
    ...merged,
    contacts: normalizeSchoolContacts(merged.contacts),
  };
};

const normalizeSetting = (setting: {
  id: string;
  schoolId: string;
  general: Prisma.JsonValue;
  paymentGateways: Prisma.JsonValue;
  baseSetups: Prisma.JsonValue;
  sessions: Prisma.JsonValue;
  holidays: Prisma.JsonValue;
  weekends: Prisma.JsonValue;
  smsSettings: Prisma.JsonValue;
  feeChallanBanks: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  ...setting,
  general: normalizeGeneral(setting.general),
  paymentGateways: Array.isArray(setting.paymentGateways) && setting.paymentGateways.length ? setting.paymentGateways : defaultPaymentGateways,
  baseSetups: mergeRecord(defaultBaseSetups, setting.baseSetups),
  sessions: Array.isArray(setting.sessions) && setting.sessions.length ? setting.sessions : defaultSessions,
  holidays: Array.isArray(setting.holidays) && setting.holidays.length ? setting.holidays : defaultHolidays,
  weekends: Array.isArray(setting.weekends) && setting.weekends.length ? setting.weekends : defaultWeekends,
  smsSettings: mergeRecord(defaultSmsSettings, setting.smsSettings),
  feeChallanBanks: Array.isArray(setting.feeChallanBanks) ? setting.feeChallanBanks : defaultFeeChallanBanks,
});

const ensureSettings = async (schoolId: string) => {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { name: true, code: true },
  });
  const createGeneral = {
    ...defaultGeneral,
    schoolName: school?.name?.trim() || '',
    schoolCode: school?.code?.trim() || '',
    address: 'India',
  };

  const setting = await prisma.schoolSystemSetting.upsert({
    where: { schoolId },
    update: {},
    create: {
      schoolId,
      general: toJson(createGeneral),
      paymentGateways: toJson(defaultPaymentGateways),
      baseSetups: toJson(defaultBaseSetups),
      sessions: toJson(defaultSessions),
      holidays: toJson(defaultHolidays),
      weekends: toJson(defaultWeekends),
      smsSettings: toJson(defaultSmsSettings),
      feeChallanBanks: toJson(defaultFeeChallanBanks),
    },
  });

  return normalizeSetting(setting);
};

export const getSchoolSystemSettings = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const setting = await ensureSettings(schoolId);
  res.status(200).json(setting);
};

export const updateSchoolSystemSettings = async (req: Request, res: Response) => {
  const payload = updateSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));

  const existing = await prisma.schoolSystemSetting.findUnique({ where: { schoolId } });
  if (!existing) {
    await ensureSettings(schoolId);
  }

  const data: Prisma.SchoolSystemSettingUpdateInput = {};
  if (payload.general) data.general = toJson(normalizeGeneral(payload.general));
  if (payload.paymentGateways) data.paymentGateways = toJson(payload.paymentGateways);
  if (payload.baseSetups) data.baseSetups = toJson(mergeRecord(defaultBaseSetups, payload.baseSetups));
  if (payload.sessions) data.sessions = toJson(payload.sessions);
  if (payload.holidays) data.holidays = toJson(payload.holidays);
  if (payload.weekends) data.weekends = toJson(payload.weekends);
  if (payload.smsSettings) data.smsSettings = toJson(mergeRecord(defaultSmsSettings, payload.smsSettings));
  if (payload.feeChallanBanks) data.feeChallanBanks = toJson(payload.feeChallanBanks);

  if (!Object.keys(data).length) {
    throw new HttpError(400, 'No settings payload supplied.');
  }

  const updated = await prisma.schoolSystemSetting.update({
    where: { schoolId },
    data,
  });

  await logAudit(req, {
    schoolId,
    entityType: 'SCHOOL_SYSTEM_SETTINGS',
    entityId: updated.id,
    action: 'UPDATE',
    beforeState: existing,
    afterState: updated,
  });

  res.status(200).json(normalizeSetting(updated));
};

const schoolDocumentUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (!isAllowedDocumentMimeType(file.mimetype)) {
      cb(new Error('Unsupported document type'));
      return;
    }
    cb(null, true);
  },
  limits: { fileSize: 20 * 1024 * 1024 },
});

export const uploadSchoolDocumentMiddleware = schoolDocumentUpload.single('file');

export const listSchoolDocuments = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const documents = await prisma.schoolDocument.findMany({
    where: { schoolId },
    orderBy: { createdAt: 'desc' },
  });
  res.status(200).json(documents);
};

export const addSchoolDocument = async (req: Request, res: Response) => {
  if (!req.auth?.userId) throw new HttpError(401, 'Unauthorized');
  const schoolId = resolveSchoolId(req, (req.body.schoolId ?? req.query.schoolId) as string | undefined);
  const title = z.string().trim().min(1).max(160).parse(req.body.title ?? req.query.title);
  const documentNumber = z.string().trim().max(120).optional().nullable().parse(req.body.documentNumber ?? req.query.documentNumber);
  if (!req.file) throw new HttpError(400, 'No file uploaded');
  validateUploadedDocumentFile(req.file);

  const extension = path.extname(req.file.originalname).toLowerCase();
  const name = `${crypto.randomUUID()}${extension || ''}`;
  const key = `schools/${schoolId}/school-documents/${name}`;
  const uploaded = await uploadBuffer({ key, body: req.file.buffer, contentType: req.file.mimetype });
  const document = await prisma.schoolDocument.create({
    data: {
      schoolId,
      title,
      documentNumber: normalizeNullable(documentNumber),
      fileUrl: uploaded.url,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      sizeBytes: req.file.size,
      uploadedById: req.auth.userId,
    },
  });

  await logAudit(req, {
    schoolId,
    entityType: 'SCHOOL_DOCUMENT',
    entityId: document.id,
    action: 'CREATE',
    afterState: { title: document.title, documentNumber: document.documentNumber },
  });

  res.status(201).json(document);
};

export const deleteSchoolDocument = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const document = await prisma.schoolDocument.findFirst({ where: { id: req.params.documentId, schoolId } });
  if (!document) throw new HttpError(404, 'Document not found');
  await prisma.schoolDocument.delete({ where: { id: document.id } });
  await logAudit(req, {
    schoolId,
    entityType: 'SCHOOL_DOCUMENT',
    entityId: document.id,
    action: 'DELETE',
    beforeState: { title: document.title, documentNumber: document.documentNumber },
  });
  res.status(204).send();
};
