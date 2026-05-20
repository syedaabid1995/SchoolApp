import type { Prisma } from '@prisma/client';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { createAuditLog } from './auditLog.service';

type ListParams = {
  page: number;
  limit: number;
  status?: string;
  schoolId?: string;
  query?: string;
};

type Actor = {
  id: string;
  email: string;
  roles?: Array<{ role: { name: string } }>;
  teacherProfile?: { firstName: string; lastName: string } | null;
  parentProfiles?: Array<{ firstName: string; lastName: string }>;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const actorSelect = {
  id: true,
  email: true,
  roles: { select: { role: { select: { name: true } } } },
  teacherProfile: { select: { firstName: true, lastName: true } },
  parentProfiles: { select: { firstName: true, lastName: true }, take: 1 },
} satisfies Prisma.UserSelect;

const actorName = (actor?: Actor | null) => {
  if (!actor) return 'Unknown user';
  const teacherName = actor.teacherProfile
    ? `${actor.teacherProfile.firstName} ${actor.teacherProfile.lastName}`.trim()
    : '';
  const parent = actor.parentProfiles?.[0];
  const parentName = parent ? `${parent.firstName} ${parent.lastName}`.trim() : '';
  return teacherName || parentName || actor.email;
};

const mapActor = (actor?: Actor | null) =>
  actor
    ? {
        id: actor.id,
        name: actorName(actor),
        email: actor.email,
        role: actor.roles?.[0]?.role.name,
      }
    : null;

const paging = (params: ListParams) => ({
  skip: (params.page - 1) * params.limit,
  take: params.limit,
});

const exportWhere = (params: ListParams): Prisma.DataExportJobWhereInput => {
  const query = params.query?.trim();
  return {
    ...(params.status ? { status: params.status as never } : {}),
    ...(params.schoolId ? { schoolId: params.schoolId } : {}),
    ...(query
      ? {
          OR: [
            ...(uuidPattern.test(query) ? [{ id: query }] : []),
            { school: { name: { contains: query, mode: 'insensitive' } } },
            { school: { code: { contains: query, mode: 'insensitive' } } },
            { requestedBy: { email: { contains: query, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };
};

const deletionWhere = (params: ListParams): Prisma.DataDeletionJobWhereInput => {
  const query = params.query?.trim();
  return {
    ...(params.status ? { status: params.status as never } : {}),
    ...(params.schoolId ? { schoolId: params.schoolId } : {}),
    ...(query
      ? {
          OR: [
            ...(uuidPattern.test(query) ? [{ id: query }] : []),
            { school: { name: { contains: query, mode: 'insensitive' } } },
            { school: { code: { contains: query, mode: 'insensitive' } } },
            { requestedBy: { email: { contains: query, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };
};

const consentWhere = (params: ListParams): Prisma.ConsentRecordWhereInput => {
  const query = params.query?.trim();
  return {
    ...(params.status ? { status: params.status } : {}),
    ...(params.schoolId ? { schoolId: params.schoolId } : {}),
    ...(query
      ? {
          OR: [
            ...(uuidPattern.test(query) ? [{ id: query }, { parentId: query }] : []),
            { school: { name: { contains: query, mode: 'insensitive' } } },
            { school: { code: { contains: query, mode: 'insensitive' } } },
            { document: { type: { equals: query as never } } },
          ],
        }
      : {}),
  };
};

const mapExportJob = (job: Prisma.DataExportJobGetPayload<{
  include: { school: { select: { id: true; name: true; code: true } }; requestedBy: { select: typeof actorSelect } };
}>) => ({
  id: job.id,
  requestNumber: `EXP-${job.id.slice(0, 8).toUpperCase()}`,
  schoolId: job.schoolId,
  schoolName: job.school.name,
  schoolCode: job.school.code,
  requestedBy: mapActor(job.requestedBy),
  subjectType: 'SCHOOL',
  subjectId: job.schoolId,
  status: job.status,
  reason: null,
  requestedAt: job.createdAt,
  approvedBy: null,
  approvedAt: null,
  rejectedAt: null,
  rejectionReason: null,
  completedAt: job.finishedAt,
  expiresAt: null,
  downloadAvailable: false,
});

const mapDeletionJob = (job: Prisma.DataDeletionJobGetPayload<{
  include: {
    school: { select: { id: true; name: true; code: true } };
    requestedBy: { select: typeof actorSelect };
    approvedBy: { select: typeof actorSelect };
  };
}>) => ({
  id: job.id,
  requestNumber: `DEL-${job.id.slice(0, 8).toUpperCase()}`,
  schoolId: job.schoolId,
  schoolName: job.school.name,
  schoolCode: job.school.code,
  requestedBy: mapActor(job.requestedBy),
  subjectType: 'SCHOOL',
  subjectId: job.schoolId,
  status: job.status,
  reason: job.reason,
  requestedAt: job.createdAt,
  approvedBy: mapActor(job.approvedBy),
  approvedAt: job.status === 'APPROVED' || job.approvedById ? job.updatedAt : null,
  rejectedAt: null,
  rejectionReason: null,
  completedAt: job.finishedAt,
});

export const getAdminComplianceSummary = async () => {
  const [
    exportTotal,
    exportPending,
    exportCompleted,
    exportFailed,
    deletionTotal,
    deletionPending,
    deletionApproved,
    deletionCompleted,
    deletionFailed,
    consentTotal,
    consentActive,
    consentRevoked,
    exportRunning,
    deletionRunning,
  ] = await Promise.all([
    prisma.dataExportJob.count(),
    prisma.dataExportJob.count({ where: { status: 'REQUESTED' } }),
    prisma.dataExportJob.count({ where: { status: 'COMPLETED' } }),
    prisma.dataExportJob.count({ where: { status: 'FAILED' } }),
    prisma.dataDeletionJob.count(),
    prisma.dataDeletionJob.count({ where: { status: 'REQUESTED' } }),
    prisma.dataDeletionJob.count({ where: { status: 'APPROVED' } }),
    prisma.dataDeletionJob.count({ where: { status: 'COMPLETED' } }),
    prisma.dataDeletionJob.count({ where: { status: 'FAILED' } }),
    prisma.consentRecord.count(),
    prisma.consentRecord.count({ where: { status: { in: ['GRANTED', 'ACTIVE'] } } }),
    prisma.consentRecord.count({
      where: { OR: [{ withdrawnAt: { not: null } }, { status: { in: ['WITHDRAWN', 'REVOKED'] } }] },
    }),
    prisma.dataExportJob.count({ where: { status: 'RUNNING' } }),
    prisma.dataDeletionJob.count({ where: { status: 'RUNNING' } }),
  ]);

  return {
    exportRequests: {
      total: exportTotal,
      pending: exportPending,
      approved: 0,
      rejected: 0,
      completed: exportCompleted,
      failed: exportFailed,
    },
    deletionRequests: {
      total: deletionTotal,
      pending: deletionPending,
      approved: deletionApproved,
      rejected: 0,
      completed: deletionCompleted,
      failed: deletionFailed,
    },
    consents: {
      total: consentTotal,
      active: consentActive,
      revoked: consentRevoked,
      // Consent expiry is not modeled yet.
      expired: 0,
    },
    jobs: {
      running: exportRunning + deletionRunning,
      completed: exportCompleted + deletionCompleted,
      failed: exportFailed + deletionFailed,
    },
  };
};

export const listAdminExportRequests = async (params: ListParams) => {
  const where = exportWhere(params);
  const [items, total] = await Promise.all([
    prisma.dataExportJob.findMany({
      where,
      ...paging(params),
      orderBy: { createdAt: 'desc' },
      include: {
        school: { select: { id: true, name: true, code: true } },
        requestedBy: { select: actorSelect },
      },
    }),
    prisma.dataExportJob.count({ where }),
  ]);

  return { items: items.map(mapExportJob), total };
};

export const getAdminExportRequestById = async (id: string) => {
  const job = await prisma.dataExportJob.findUnique({
    where: { id },
    include: {
      school: { select: { id: true, name: true, code: true } },
      requestedBy: { select: actorSelect },
    },
  });
  if (!job) throw new HttpError(404, 'Export request not found');
  return mapExportJob(job);
};

export const approveAdminExportRequest = async () => {
  throw new HttpError(501, 'Export approval workflow is not implemented by the current export job model');
};

export const rejectAdminExportRequest = async () => {
  throw new HttpError(501, 'Export rejection workflow is not implemented by the current export job model');
};

export const listAdminDeletionRequests = async (params: ListParams) => {
  const where = deletionWhere(params);
  const [items, total] = await Promise.all([
    prisma.dataDeletionJob.findMany({
      where,
      ...paging(params),
      orderBy: { createdAt: 'desc' },
      include: {
        school: { select: { id: true, name: true, code: true } },
        requestedBy: { select: actorSelect },
        approvedBy: { select: actorSelect },
      },
    }),
    prisma.dataDeletionJob.count({ where }),
  ]);

  return { items: items.map(mapDeletionJob), total };
};

export const getAdminDeletionRequestById = async (id: string) => {
  const job = await prisma.dataDeletionJob.findUnique({
    where: { id },
    include: {
      school: { select: { id: true, name: true, code: true } },
      requestedBy: { select: actorSelect },
      approvedBy: { select: actorSelect },
    },
  });
  if (!job) throw new HttpError(404, 'Deletion request not found');
  return mapDeletionJob(job);
};

export const approveAdminDeletionRequest = async (params: {
  id: string;
  actorId: string;
  actorRole: string;
  note?: string | null;
}) => {
  const job = await prisma.dataDeletionJob.findUnique({ where: { id: params.id } });
  if (!job) throw new HttpError(404, 'Deletion request not found');
  if (job.status !== 'REQUESTED') throw new HttpError(409, 'Only requested deletion jobs can be approved');

  const updated = await prisma.dataDeletionJob.update({
    where: { id: job.id },
    data: { status: 'APPROVED', approvedById: params.actorId },
    include: {
      school: { select: { id: true, name: true, code: true } },
      requestedBy: { select: actorSelect },
      approvedBy: { select: actorSelect },
    },
  });

  await createAuditLog({
    schoolId: job.schoolId,
    actorId: params.actorId,
    actorRole: params.actorRole,
    entityType: 'DataDeletionJob',
    entityId: job.id,
    action: 'DATA_DELETION_REQUEST_APPROVED',
    beforeState: { status: job.status } as Prisma.InputJsonValue,
    afterState: { status: updated.status, note: params.note ?? null } as Prisma.InputJsonValue,
  });

  return mapDeletionJob(updated);
};

export const rejectAdminDeletionRequest = async () => {
  throw new HttpError(501, 'Deletion rejection workflow is not implemented by the current deletion job model');
};

export const listAdminConsentRecords = async (params: ListParams) => {
  const where = consentWhere(params);
  const [items, total] = await Promise.all([
    prisma.consentRecord.findMany({
      where,
      ...paging(params),
      orderBy: { grantedAt: 'desc' },
      include: {
        school: { select: { id: true, name: true, code: true } },
        document: { select: { type: true, version: true } },
      },
    }),
    prisma.consentRecord.count({ where }),
  ]);

  return {
    items: items.map((record) => ({
      id: record.id,
      schoolId: record.schoolId,
      schoolName: record.school.name,
      schoolCode: record.school.code,
      subjectType: 'PARENT',
      subjectId: record.parentId,
      consentType: record.document.type,
      documentVersion: record.document.version,
      status: record.status,
      givenAt: record.grantedAt,
      revokedAt: record.withdrawnAt,
      expiresAt: null,
    })),
    total,
  };
};

export const listAdminComplianceJobs = async (params: ListParams) => {
  const [exports, deletions] = await Promise.all([
    prisma.dataExportJob.findMany({
      where: exportWhere(params),
      take: params.limit,
      orderBy: { createdAt: 'desc' },
      include: { school: { select: { id: true, name: true, code: true } } },
    }),
    prisma.dataDeletionJob.findMany({
      where: deletionWhere(params),
      take: params.limit,
      orderBy: { createdAt: 'desc' },
      include: { school: { select: { id: true, name: true, code: true } } },
    }),
  ]);

  const items = [
    ...exports.map((job) => ({
      id: job.id,
      type: 'DATA_EXPORT',
      status: job.status,
      schoolId: job.schoolId,
      schoolName: job.school.name,
      schoolCode: job.school.code,
      startedAt: job.startedAt ?? job.createdAt,
      completedAt: job.finishedAt,
      errorMessage: job.status === 'FAILED' ? 'Export job failed.' : null,
    })),
    ...deletions.map((job) => ({
      id: job.id,
      type: 'DATA_DELETION',
      status: job.status,
      schoolId: job.schoolId,
      schoolName: job.school.name,
      schoolCode: job.school.code,
      startedAt: job.startedAt ?? job.createdAt,
      completedAt: job.finishedAt,
      errorMessage: job.status === 'FAILED' ? 'Deletion job failed.' : null,
    })),
  ]
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, params.limit);

  return { items, total: items.length };
};
