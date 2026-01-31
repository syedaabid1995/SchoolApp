import { Prisma } from '@prisma/client';

export const consentDocumentSelect = {
  id: true,
  version: true,
  type: true,
  text: true,
  createdAt: true,
} satisfies Prisma.ConsentDocumentSelect;

export const consentRecordSelect = {
  id: true,
  schoolId: true,
  parentId: true,
  documentId: true,
  status: true,
  grantedAt: true,
  withdrawnAt: true,
} satisfies Prisma.ConsentRecordSelect;

export type ConsentDocumentRecord = Prisma.ConsentDocumentGetPayload<{ select: typeof consentDocumentSelect }>;
export type ConsentRecord = Prisma.ConsentRecordGetPayload<{ select: typeof consentRecordSelect }>;
