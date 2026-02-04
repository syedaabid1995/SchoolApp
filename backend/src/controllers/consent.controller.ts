import type { Request, Response } from 'express';
import { z } from 'zod';
import { resolveSchoolId } from '../utils/tenant';
import { HttpError } from '../middlewares/error.middleware';
import {
  createConsentDocument,
  grantConsent,
  withdrawConsent,
  listConsents,
} from '../services/consent.service';

const docSchema = z.object({
  version: z.string().min(1),
  type: z.enum(['BIOMETRIC', 'DATA_PROCESSING']),
  text: z.string().min(1),
});

const grantSchema = z.object({
  parentId: z.string().uuid(),
  documentId: z.string().uuid(),
  schoolId: z.string().uuid().optional(),
});

const withdrawSchema = z.object({
  schoolId: z.string().uuid().optional(),
});

export const createDocumentApi = async (req: Request, res: Response) => {
  const payload = docSchema.parse(req.body);
  const doc = await createConsentDocument({
    version: payload.version,
    type: payload.type,
    text: payload.text,
  });
  res.status(201).json(doc);
};

export const grantConsentApi = async (req: Request, res: Response) => {
  const payload = grantSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));
  const auth = req.auth;
  if (!auth) throw new HttpError(401, 'Unauthorized');

  const record = await grantConsent({
    schoolId,
    parentId: payload.parentId,
    documentId: payload.documentId,
    actorId: auth.userId,
    actorRole: 'PARENT',
  });

  res.status(201).json(record);
};

export const withdrawConsentApi = async (req: Request, res: Response) => {
  const payload = withdrawSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));
  const auth = req.auth;
  if (!auth) throw new HttpError(401, 'Unauthorized');

  const result = await withdrawConsent({
    schoolId,
    consentId: req.params.id,
    actorId: auth.userId,
    actorRole: 'PARENT',
  });

  res.status(200).json(result);
};

export const listConsentApi = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const parentId = req.query.parentId as string | undefined;

  const records = await listConsents({ schoolId, parentId });
  res.status(200).json(records);
};
