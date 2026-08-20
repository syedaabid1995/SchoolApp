import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { createAuditLog } from './auditLog.service';
import { buildRuntimeObjectKey, getSignedDownloadUrlForStoredRef, putRuntimeObject } from './runtimeStorage.service';
import { DEFAULT_EXPORT_ROW_LIMIT } from '../utils/pagination';
import { decryptStudentSensitiveFieldList } from '../modules/students/utils/student-sensitive-fields';
import { decryptParentProfileSensitiveFieldList } from '../modules/students/utils/parent-profile-sensitive-fields';

export const exportTenantData = async (params: {
  schoolId: string;
  requestedById: string;
  actorRole: string;
}) => {
  const job = await prisma.dataExportJob.create({
    data: { schoolId: params.schoolId, requestedById: params.requestedById, status: 'RUNNING', startedAt: new Date() },
  });

  const [studentCount, parentCount, teacherCount, attendanceSessionCount, attendanceRecordCount] = await Promise.all([
    prisma.student.count({ where: { schoolId: params.schoolId } }),
    prisma.parentProfile.count({ where: { links: { some: { student: { schoolId: params.schoolId } } } } }),
    prisma.teacherProfile.count({ where: { schoolId: params.schoolId } }),
    prisma.attendanceSession.count({ where: { schoolId: params.schoolId } }),
    prisma.attendanceRecord.count({ where: { session: { schoolId: params.schoolId } } }),
  ]);
  const overLimit = [
    studentCount,
    parentCount,
    teacherCount,
    attendanceSessionCount,
    attendanceRecordCount,
  ].find((count) => count > DEFAULT_EXPORT_ROW_LIMIT);
  if (overLimit) {
    await prisma.dataExportJob.update({
      where: { id: job.id },
      data: { status: 'FAILED', finishedAt: new Date() },
    });
    throw new HttpError(413, `Tenant data export exceeds ${DEFAULT_EXPORT_ROW_LIMIT} rows in at least one dataset. Use a background export worker before exporting this school.`);
  }

  const students = await prisma.student.findMany({ where: { schoolId: params.schoolId } });
  const parents = await prisma.parentProfile.findMany({
    where: { links: { some: { student: { schoolId: params.schoolId } } } },
  });
  const exportData = {
    schools: await prisma.school.findMany({ where: { id: params.schoolId } }),
    students: decryptStudentSensitiveFieldList(students),
    parents: decryptParentProfileSensitiveFieldList(parents),
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
