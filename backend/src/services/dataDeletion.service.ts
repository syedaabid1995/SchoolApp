import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { createAuditLog } from './auditLog.service';

export const requestDeletion = async (params: {
  schoolId: string;
  requestedById: string;
  reason?: string | null;
}) => {
  return prisma.dataDeletionJob.create({
    data: {
      schoolId: params.schoolId,
      requestedById: params.requestedById,
      reason: params.reason ?? null,
    },
  });
};

export const approveDeletion = async (params: {
  jobId: string;
  schoolId: string;
  approvedById: string;
}) => {
  const job = await prisma.dataDeletionJob.findFirst({
    where: { id: params.jobId, schoolId: params.schoolId },
  });
  if (!job) throw new HttpError(404, 'Deletion job not found');

  return prisma.dataDeletionJob.update({
    where: { id: job.id },
    data: { status: 'APPROVED', approvedById: params.approvedById },
  });
};

export const executeDeletion = async (params: {
  jobId: string;
  schoolId: string;
  actorId: string;
  actorRole: string;
}) => {
  const job = await prisma.dataDeletionJob.findFirst({
    where: { id: params.jobId, schoolId: params.schoolId },
  });
  if (!job) throw new HttpError(404, 'Deletion job not found');
  if (job.status !== 'APPROVED') throw new HttpError(409, 'Deletion not approved');

  await prisma.dataDeletionJob.update({
    where: { id: job.id },
    data: { status: 'RUNNING', startedAt: new Date() },
  });

  await prisma.student.deleteMany({ where: { schoolId: params.schoolId } });
  await prisma.teacherProfile.deleteMany({ where: { schoolId: params.schoolId } });

  await prisma.dataDeletionJob.update({
    where: { id: job.id },
    data: { status: 'COMPLETED', finishedAt: new Date() },
  });

  await createAuditLog({
    schoolId: params.schoolId,
    actorId: params.actorId,
    actorRole: params.actorRole,
    entityType: 'DataDeletionJob',
    entityId: job.id,
    action: 'DELETE',
    afterState: { status: 'COMPLETED' },
  });

  return { deleted: true };
};

export const listDeletionJobs = async (schoolId: string) => {
  return prisma.dataDeletionJob.findMany({
    where: { schoolId },
    orderBy: { createdAt: 'desc' },
  });
};
