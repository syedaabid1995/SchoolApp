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

type ReviewParams = {
  id: string;
  actorId: string;
  actorRole: string;
  actorSchoolId?: string | null;
  note?: string | null;
  reason?: string | null;
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
  include: {
    school: { select: { id: true; name: true; code: true } };
    requestedBy: { select: typeof actorSelect };
    reviewedBy?: { select: typeof actorSelect };
  };
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
  approvedBy: job.status === 'APPROVED' ? mapActor(job.reviewedBy) : null,
  approvedAt: job.status === 'APPROVED' ? job.reviewedAt : null,
  rejectedAt: job.status === 'REJECTED' ? job.reviewedAt : null,
  rejectionReason: job.rejectionReason,
  reviewNote: job.reviewNote,
  completedAt: job.finishedAt,
  expiresAt: null,
  downloadAvailable: job.status === 'COMPLETED' && Boolean(job.filePath),
});

const mapDeletionJob = (job: Prisma.DataDeletionJobGetPayload<{
  include: {
    school: { select: { id: true; name: true; code: true } };
    requestedBy: { select: typeof actorSelect };
    approvedBy: { select: typeof actorSelect };
    reviewedBy?: { select: typeof actorSelect };
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
  approvedBy: mapActor(job.reviewedBy ?? job.approvedBy),
  approvedAt: job.status === 'APPROVED' ? job.reviewedAt ?? job.updatedAt : null,
  rejectedAt: job.status === 'REJECTED' ? job.reviewedAt : null,
  rejectionReason: job.rejectionReason,
  reviewNote: job.reviewNote,
  completedAt: job.finishedAt,
});

const canReviewStatus = (status: string) => ['REQUESTED', 'PENDING'].includes(status);

const enforceTenant = (jobSchoolId: string, actorSchoolId?: string | null) => {
  if (actorSchoolId && actorSchoolId !== jobSchoolId) {
    throw new HttpError(403, 'Tenant scope violation');
  }
};

export const getAdminComplianceSummary = async (params?: { schoolId?: string }) => {
  const scoped = params?.schoolId ? { schoolId: params.schoolId } : {};
  const [
    exportTotal,
    exportPending,
    exportApproved,
    exportRejected,
    exportCompleted,
    exportFailed,
    deletionTotal,
    deletionPending,
    deletionApproved,
    deletionRejected,
    deletionCompleted,
    deletionFailed,
    consentTotal,
    consentActive,
    consentRevoked,
    exportRunning,
    deletionRunning,
  ] = await Promise.all([
    prisma.dataExportJob.count({ where: scoped }),
    prisma.dataExportJob.count({ where: { ...scoped, status: 'REQUESTED' } }),
    prisma.dataExportJob.count({ where: { ...scoped, status: 'APPROVED' } }),
    prisma.dataExportJob.count({ where: { ...scoped, status: 'REJECTED' } }),
    prisma.dataExportJob.count({ where: { ...scoped, status: 'COMPLETED' } }),
    prisma.dataExportJob.count({ where: { ...scoped, status: 'FAILED' } }),
    prisma.dataDeletionJob.count({ where: scoped }),
    prisma.dataDeletionJob.count({ where: { ...scoped, status: 'REQUESTED' } }),
    prisma.dataDeletionJob.count({ where: { ...scoped, status: 'APPROVED' } }),
    prisma.dataDeletionJob.count({ where: { ...scoped, status: 'REJECTED' } }),
    prisma.dataDeletionJob.count({ where: { ...scoped, status: 'COMPLETED' } }),
    prisma.dataDeletionJob.count({ where: { ...scoped, status: 'FAILED' } }),
    prisma.consentRecord.count({ where: scoped }),
    prisma.consentRecord.count({ where: { ...scoped, status: { in: ['GRANTED', 'ACTIVE'] } } }),
    prisma.consentRecord.count({
      where: { ...scoped, OR: [{ withdrawnAt: { not: null } }, { status: { in: ['WITHDRAWN', 'REVOKED'] } }] },
    }),
    prisma.dataExportJob.count({ where: { ...scoped, status: 'RUNNING' } }),
    prisma.dataDeletionJob.count({ where: { ...scoped, status: 'RUNNING' } }),
  ]);

  return {
    exportRequests: {
      total: exportTotal,
      pending: exportPending,
      approved: exportApproved,
      rejected: exportRejected,
      completed: exportCompleted,
      failed: exportFailed,
    },
    deletionRequests: {
      total: deletionTotal,
      pending: deletionPending,
      approved: deletionApproved,
      rejected: deletionRejected,
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
        reviewedBy: { select: actorSelect },
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
      reviewedBy: { select: actorSelect },
    },
  });
  if (!job) throw new HttpError(404, 'Export request not found');
  return mapExportJob(job);
};

export const approveAdminExportRequest = async (params: ReviewParams) => {
  const job = await prisma.dataExportJob.findUnique({ where: { id: params.id } });
  if (!job) throw new HttpError(404, 'Export request not found');
  enforceTenant(job.schoolId, params.actorSchoolId);
  if (!canReviewStatus(job.status)) throw new HttpError(409, 'Only requested export jobs can be approved');

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.dataExportJob.update({
      where: { id: job.id },
      data: {
        status: 'APPROVED',
        reviewedById: params.actorId,
        reviewedAt: new Date(),
        reviewNote: params.note ?? null,
        rejectionReason: null,
      },
      include: {
        school: { select: { id: true, name: true, code: true } },
        requestedBy: { select: actorSelect },
        reviewedBy: { select: actorSelect },
      },
    });
    await tx.complianceJobStatusHistory.create({
      data: {
        schoolId: job.schoolId,
        jobType: 'DATA_EXPORT',
        jobId: job.id,
        oldStatus: job.status,
        newStatus: row.status,
        actorId: params.actorId,
        reason: params.note ?? null,
      },
    });
    return row;
  });

  await createAuditLog({
    schoolId: job.schoolId,
    actorId: params.actorId,
    actorRole: params.actorRole,
    entityType: 'DataExportJob',
    entityId: job.id,
    action: 'DATA_EXPORT_REQUEST_APPROVED',
    beforeState: job as unknown as Prisma.InputJsonValue,
    afterState: updated as unknown as Prisma.InputJsonValue,
  });

  return mapExportJob(updated);
};

export const rejectAdminExportRequest = async (params: ReviewParams) => {
  const reason = params.reason?.trim();
  if (!reason) throw new HttpError(400, 'Rejection reason is required');
  const job = await prisma.dataExportJob.findUnique({ where: { id: params.id } });
  if (!job) throw new HttpError(404, 'Export request not found');
  enforceTenant(job.schoolId, params.actorSchoolId);
  if (!canReviewStatus(job.status)) throw new HttpError(409, 'Only requested export jobs can be rejected');

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.dataExportJob.update({
      where: { id: job.id },
      data: {
        status: 'REJECTED',
        reviewedById: params.actorId,
        reviewedAt: new Date(),
        rejectionReason: reason,
        reviewNote: params.note ?? null,
      },
      include: {
        school: { select: { id: true, name: true, code: true } },
        requestedBy: { select: actorSelect },
        reviewedBy: { select: actorSelect },
      },
    });
    await tx.complianceJobStatusHistory.create({
      data: {
        schoolId: job.schoolId,
        jobType: 'DATA_EXPORT',
        jobId: job.id,
        oldStatus: job.status,
        newStatus: row.status,
        actorId: params.actorId,
        reason,
      },
    });
    return row;
  });

  await createAuditLog({
    schoolId: job.schoolId,
    actorId: params.actorId,
    actorRole: params.actorRole,
    entityType: 'DataExportJob',
    entityId: job.id,
    action: 'DATA_EXPORT_REQUEST_REJECTED',
    beforeState: job as unknown as Prisma.InputJsonValue,
    afterState: updated as unknown as Prisma.InputJsonValue,
  });

  return mapExportJob(updated);
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
        reviewedBy: { select: actorSelect },
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
      reviewedBy: { select: actorSelect },
    },
  });
  if (!job) throw new HttpError(404, 'Deletion request not found');
  return mapDeletionJob(job);
};

export const approveAdminDeletionRequest = async (params: {
  id: string;
  actorId: string;
  actorRole: string;
  actorSchoolId?: string | null;
  note?: string | null;
}) => {
  const job = await prisma.dataDeletionJob.findUnique({ where: { id: params.id } });
  if (!job) throw new HttpError(404, 'Deletion request not found');
  enforceTenant(job.schoolId, params.actorSchoolId);
  if (!canReviewStatus(job.status)) throw new HttpError(409, 'Only requested deletion jobs can be approved');

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.dataDeletionJob.update({
      where: { id: job.id },
      data: {
        status: 'APPROVED',
        approvedById: params.actorId,
        reviewedById: params.actorId,
        reviewedAt: new Date(),
        reviewNote: params.note ?? null,
        rejectionReason: null,
      },
      include: {
        school: { select: { id: true, name: true, code: true } },
        requestedBy: { select: actorSelect },
        approvedBy: { select: actorSelect },
        reviewedBy: { select: actorSelect },
      },
    });
    await tx.complianceJobStatusHistory.create({
      data: {
        schoolId: job.schoolId,
        jobType: 'DATA_DELETION',
        jobId: job.id,
        oldStatus: job.status,
        newStatus: row.status,
        actorId: params.actorId,
        reason: params.note ?? null,
      },
    });
    return row;
  });

  await createAuditLog({
    schoolId: job.schoolId,
    actorId: params.actorId,
    actorRole: params.actorRole,
    entityType: 'DataDeletionJob',
    entityId: job.id,
    action: 'DATA_DELETION_REQUEST_APPROVED',
    beforeState: job as unknown as Prisma.InputJsonValue,
    afterState: updated as unknown as Prisma.InputJsonValue,
  });

  return mapDeletionJob(updated);
};

export const rejectAdminDeletionRequest = async (params: ReviewParams) => {
  const reason = params.reason?.trim();
  if (!reason) throw new HttpError(400, 'Rejection reason is required');
  const job = await prisma.dataDeletionJob.findUnique({ where: { id: params.id } });
  if (!job) throw new HttpError(404, 'Deletion request not found');
  enforceTenant(job.schoolId, params.actorSchoolId);
  if (!canReviewStatus(job.status)) throw new HttpError(409, 'Only requested deletion jobs can be rejected');

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.dataDeletionJob.update({
      where: { id: job.id },
      data: {
        status: 'REJECTED',
        reviewedById: params.actorId,
        reviewedAt: new Date(),
        rejectionReason: reason,
        reviewNote: params.note ?? null,
      },
      include: {
        school: { select: { id: true, name: true, code: true } },
        requestedBy: { select: actorSelect },
        approvedBy: { select: actorSelect },
        reviewedBy: { select: actorSelect },
      },
    });
    await tx.complianceJobStatusHistory.create({
      data: {
        schoolId: job.schoolId,
        jobType: 'DATA_DELETION',
        jobId: job.id,
        oldStatus: job.status,
        newStatus: row.status,
        actorId: params.actorId,
        reason,
      },
    });
    return row;
  });

  await createAuditLog({
    schoolId: job.schoolId,
    actorId: params.actorId,
    actorRole: params.actorRole,
    entityType: 'DataDeletionJob',
    entityId: job.id,
    action: 'DATA_DELETION_REQUEST_REJECTED',
    beforeState: job as unknown as Prisma.InputJsonValue,
    afterState: updated as unknown as Prisma.InputJsonValue,
  });

  return mapDeletionJob(updated);
};

export const getComplianceJobHistory = async (params: {
  jobId: string;
  actorSchoolId?: string | null;
}) => {
  const rows = await prisma.complianceJobStatusHistory.findMany({
    where: { jobId: params.jobId },
    orderBy: { createdAt: 'asc' },
    include: {
      school: { select: { id: true, name: true, code: true } },
      actor: { select: actorSelect },
    },
  });
  if (!rows.length) return [];
  enforceTenant(rows[0].schoolId, params.actorSchoolId);
  return rows.map((row) => ({
    id: row.id,
    schoolId: row.schoolId,
    schoolName: row.school.name,
    schoolCode: row.school.code,
    jobType: row.jobType,
    jobId: row.jobId,
    oldStatus: row.oldStatus,
    newStatus: row.newStatus,
    actor: mapActor(row.actor),
    reason: row.reason,
    createdAt: row.createdAt,
  }));
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
