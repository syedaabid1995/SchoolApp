import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { createAuditLog } from './auditLog.service';

export const createConsentDocument = async (params: {
  version: string;
  type: 'BIOMETRIC' | 'DATA_PROCESSING';
  text: string;
}) => {
  return prisma.consentDocument.create({
    data: {
      version: params.version,
      type: params.type,
      text: params.text,
    },
  });
};

export const grantConsent = async (params: {
  schoolId: string;
  parentId: string;
  documentId: string;
  actorId: string;
  actorRole: string;
}) => {
  const document = await prisma.consentDocument.findUnique({
    where: { id: params.documentId },
  });

  if (!document) throw new HttpError(404, 'Consent document not found');

  const record = await prisma.consentRecord.create({
    data: {
      schoolId: params.schoolId,
      parentId: params.parentId,
      documentId: params.documentId,
      status: 'GRANTED',
    },
  });

  await createAuditLog({
    schoolId: params.schoolId,
    actorId: params.actorId,
    actorRole: params.actorRole,
    entityType: 'ConsentRecord',
    entityId: record.id,
    action: 'GRANT',
    afterState: { documentId: params.documentId, status: 'GRANTED' },
  });

  return record;
};

export const withdrawConsent = async (params: {
  schoolId: string;
  consentId: string;
  actorId: string;
  actorRole: string;
}) => {
  const record = await prisma.consentRecord.findFirst({
    where: { id: params.consentId, schoolId: params.schoolId },
  });

  if (!record) throw new HttpError(404, 'Consent record not found');

  const updated = await prisma.consentRecord.update({
    where: { id: record.id },
    data: { status: 'WITHDRAWN', withdrawnAt: new Date() },
  });

  await createAuditLog({
    schoolId: params.schoolId,
    actorId: params.actorId,
    actorRole: params.actorRole,
    entityType: 'ConsentRecord',
    entityId: record.id,
    action: 'WITHDRAW',
    beforeState: { status: record.status },
    afterState: { status: updated.status },
  });

  return updated;
};

export const listConsents = async (params: { schoolId: string; parentId?: string }) => {
  return prisma.consentRecord.findMany({
    where: {
      schoolId: params.schoolId,
      ...(params.parentId ? { parentId: params.parentId } : {}),
    },
    orderBy: { grantedAt: 'desc' },
  });
};
