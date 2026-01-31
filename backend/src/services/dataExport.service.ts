import fs from 'fs';
import path from 'path';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { createAuditLog } from './auditLog.service';

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
    parents: await prisma.parentProfile.findMany({ where: { schoolId: params.schoolId } }),
    teachers: await prisma.teacherProfile.findMany({ where: { schoolId: params.schoolId } }),
    attendance: await prisma.attendanceSession.findMany({ where: { schoolId: params.schoolId }, include: { records: true } }),
  };

  const dir = path.join(process.cwd(), 'exports');
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `export-${params.schoolId}-${job.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(exportData));

  await prisma.dataExportJob.update({
    where: { id: job.id },
    data: { status: 'COMPLETED', filePath, finishedAt: new Date() },
  });

  await createAuditLog({
    schoolId: params.schoolId,
    actorId: params.requestedById,
    actorRole: params.actorRole,
    entityType: 'DataExportJob',
    entityId: job.id,
    action: 'EXPORT',
    afterState: { filePath },
  });

  return { jobId: job.id, filePath };
};

export const getExportJob = async (id: string, schoolId: string) => {
  const job = await prisma.dataExportJob.findFirst({ where: { id, schoolId } });
  if (!job) throw new HttpError(404, 'Export job not found');
  return job;
};
