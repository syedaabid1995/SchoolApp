import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { createAuditLog } from './auditLog.service';
import { buildRuntimeObjectKey, getSignedDownloadUrlForStoredRef, putRuntimeObject } from './runtimeStorage.service';

export const exportTenantData = async (params: {
  schoolId: string;
  requestedById: string;
  actorRole: string;
}) => {
  const job = await prisma.dataExportJob.create({
    data: { schoolId: params.schoolId, requestedById: params.requestedById, status: 'RUNNING', startedAt: new Date() },
  });

  const exportData = {
    schools: await prisma.school.findMany({ where: { id: params.schoolId } }),
    students: await prisma.student.findMany({ where: { schoolId: params.schoolId } }),
    parents: await prisma.parentProfile.findMany({
      where: { links: { some: { student: { schoolId: params.schoolId } } } },
    }),
    teachers: await prisma.teacherProfile.findMany({ where: { schoolId: params.schoolId } }),
    attendance: await prisma.attendanceSession.findMany({ where: { schoolId: params.schoolId }, include: { records: true } }),
  };

  const key = buildRuntimeObjectKey({
    schoolId: params.schoolId,
    category: 'exports',
    filename: `export-${job.id}.json`,
    id: job.id,
  });
  const uploaded = await putRuntimeObject({
    key,
    body: JSON.stringify(exportData),
    contentType: 'application/json',
    metadata: {
      schoolId: params.schoolId,
      exportJobId: job.id,
    },
  });

  await prisma.dataExportJob.update({
    where: { id: job.id },
    data: { status: 'COMPLETED', filePath: uploaded.storageRef, finishedAt: new Date() },
  });

  await createAuditLog({
    schoolId: params.schoolId,
    actorId: params.requestedById,
    actorRole: params.actorRole,
    entityType: 'DataExportJob',
    entityId: job.id,
    action: 'EXPORT',
    afterState: { status: 'COMPLETED' },
  });

  return { jobId: job.id, status: 'COMPLETED' };
};

export const getExportJob = async (id: string, schoolId: string) => {
  const job = await prisma.dataExportJob.findFirst({ where: { id, schoolId } });
  if (!job) throw new HttpError(404, 'Export job not found');
  const { filePath: _filePath, ...safeJob } = job;
  return {
    ...safeJob,
    downloadAvailable: job.status === 'COMPLETED' && Boolean(job.filePath),
    downloadUrl:
      job.status === 'COMPLETED' && job.filePath
        ? await getSignedDownloadUrlForStoredRef({ storageRef: job.filePath })
        : null,
  };
};
