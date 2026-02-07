import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { createAuditLog } from './auditLog.service';

export const setTeacherActive = async (params: {
  schoolId: string;
  teacherId: string;
  actorId: string;
  actorRole: string;
  isActive: boolean;
}) => {
  const teacher = await prisma.teacherProfile.findFirst({
    where: { id: params.teacherId, schoolId: params.schoolId },
  });

  if (!teacher) throw new HttpError(404, 'Teacher not found');

  const updated = await prisma.teacherProfile.update({
    where: { id: teacher.id },
    data: { isActive: params.isActive },
  });

  await createAuditLog({
    schoolId: params.schoolId,
    actorId: params.actorId,
    actorRole: params.actorRole,
    entityType: 'TeacherProfile',
    entityId: teacher.id,
    action: params.isActive ? 'ACTIVATE' : 'DEACTIVATE',
    beforeState: { isActive: teacher.isActive },
    afterState: { isActive: updated.isActive },
  });

  return updated;
};

export const assignTeacherToClass = async (params: {
  schoolId: string;
  teacherId: string;
  classId: string;
  sectionId?: string;
  actorId: string;
  actorRole: string;
}) => {
  const teacher = await prisma.teacherProfile.findFirst({
    where: { id: params.teacherId, schoolId: params.schoolId },
  });
  if (!teacher) throw new HttpError(404, 'Teacher not found');

  const cls = await prisma.class.findFirst({
    where: { id: params.classId, schoolId: params.schoolId },
  });
  if (!cls) throw new HttpError(404, 'Class not found');

  if (params.sectionId) {
    const section = await prisma.section.findFirst({
      where: { id: params.sectionId, classId: params.classId, class: { schoolId: params.schoolId } },
      select: { id: true },
    });
    if (!section) throw new HttpError(404, 'Section not found for class');
  }

  const assignment = await prisma.teacherClassAssignment.create({
    data: { teacherId: teacher.id, classId: cls.id, sectionId: params.sectionId ?? null },
  });

  await createAuditLog({
    schoolId: params.schoolId,
    actorId: params.actorId,
    actorRole: params.actorRole,
    entityType: 'TeacherClassAssignment',
    entityId: assignment.id,
    action: 'CREATE',
    afterState: { teacherId: teacher.id, classId: cls.id, sectionId: params.sectionId ?? null },
  });

  return assignment;
};

export const unassignTeacherFromClass = async (params: {
  schoolId: string;
  teacherId: string;
  classId: string;
  sectionId?: string;
  actorId: string;
  actorRole: string;
}) => {
  const assignment = await prisma.teacherClassAssignment.findFirst({
    where: {
      teacherId: params.teacherId,
      class: { schoolId: params.schoolId },
      classId: params.classId,
      sectionId: params.sectionId ?? null,
    },
  });

  if (!assignment) throw new HttpError(404, 'Assignment not found');

  await prisma.teacherClassAssignment.delete({ where: { id: assignment.id } });

  await createAuditLog({
    schoolId: params.schoolId,
    actorId: params.actorId,
    actorRole: params.actorRole,
    entityType: 'TeacherClassAssignment',
    entityId: assignment.id,
    action: 'DELETE',
    beforeState: { teacherId: assignment.teacherId, classId: assignment.classId, sectionId: assignment.sectionId },
  });

  return { deleted: true };
};

export const assignTeacherToSubject = async (params: {
  schoolId: string;
  teacherId: string;
  subjectId: string;
  actorId: string;
  actorRole: string;
}) => {
  const teacher = await prisma.teacherProfile.findFirst({
    where: { id: params.teacherId, schoolId: params.schoolId },
  });
  if (!teacher) throw new HttpError(404, 'Teacher not found');

  const subject = await prisma.subject.findFirst({
    where: { id: params.subjectId, schoolId: params.schoolId },
  });
  if (!subject) throw new HttpError(404, 'Subject not found');

  const assignment = await prisma.teacherSubjectAssignment.create({
    data: { teacherId: teacher.id, subjectId: subject.id },
  });

  await createAuditLog({
    schoolId: params.schoolId,
    actorId: params.actorId,
    actorRole: params.actorRole,
    entityType: 'TeacherSubjectAssignment',
    entityId: assignment.id,
    action: 'CREATE',
    afterState: { teacherId: teacher.id, subjectId: subject.id },
  });

  return assignment;
};

export const unassignTeacherFromSubject = async (params: {
  schoolId: string;
  teacherId: string;
  subjectId: string;
  actorId: string;
  actorRole: string;
}) => {
  const assignment = await prisma.teacherSubjectAssignment.findFirst({
    where: {
      teacherId: params.teacherId,
      subject: { schoolId: params.schoolId },
      subjectId: params.subjectId,
    },
  });

  if (!assignment) throw new HttpError(404, 'Assignment not found');

  await prisma.teacherSubjectAssignment.delete({ where: { id: assignment.id } });

  await createAuditLog({
    schoolId: params.schoolId,
    actorId: params.actorId,
    actorRole: params.actorRole,
    entityType: 'TeacherSubjectAssignment',
    entityId: assignment.id,
    action: 'DELETE',
    beforeState: { teacherId: assignment.teacherId, subjectId: assignment.subjectId },
  });

  return { deleted: true };
};
