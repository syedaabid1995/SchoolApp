import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../config/db';
import { logger } from '../config/logger';
import { HttpError } from '../middlewares/error.middleware';
import { logAudit } from '../utils/audit';
import { sendNotification } from '../services/notification.service';
import { uploadBuffer } from '../services/s3.service';

const uuidSchema = z.string().uuid();

const normalizeText = (value: string) => value.trim().replace(/\s+/g, ' ');
const nullableText = (value?: string | null) => {
  const normalized = value?.trim().replace(/\s+/g, ' ');
  return normalized || null;
};

const getRequestedSchoolId = (req: Request, bodySchoolId?: string | null) =>
  bodySchoolId ?? (typeof req.query.schoolId === 'string' ? req.query.schoolId : undefined);

const requireHomeworkManager = (req: Request, requestedSchoolId?: string | null) => {
  if (!req.auth?.userId) throw new HttpError(401, 'Unauthorized');

  if (req.auth.schoolId) {
    if (requestedSchoolId && requestedSchoolId !== req.auth.schoolId) {
      throw new HttpError(403, 'Tenant scope violation');
    }
    return { schoolId: req.auth.schoolId, userId: req.auth.userId, role: req.auth.role };
  }

  if (req.auth.role === 'SUPER_ADMIN') {
    if (!requestedSchoolId) throw new HttpError(400, 'schoolId is required');
    return { schoolId: requestedSchoolId, userId: req.auth.userId, role: req.auth.role };
  }

  throw new HttpError(403, 'School scope is required to manage homework');
};

const dateSchema = z.coerce.date();

const homeworkSchema = z.object({
  classId: uuidSchema,
  sectionId: uuidSchema,
  subjectId: uuidSchema,
  homeworkDate: dateSchema,
  submissionDate: dateSchema,
  marks: z.coerce.number().min(0).max(1000000),
  description: z.string().min(1).max(5000),
  attachmentUrl: z.string().max(1000).optional().nullable(),
  attachmentName: z.string().max(255).optional().nullable(),
  schoolId: uuidSchema.optional(),
});

const evaluationRowSchema = z.object({
  studentId: uuidSchema,
  marks: z.coerce.number().min(0).max(1000000).optional().nullable(),
  comments: z.string().max(1000).optional().nullable(),
  qualityStatus: z.enum(['GOOD', 'NOT_GOOD']).default('GOOD'),
  completionStatus: z.enum(['COMPLETED', 'NOT_COMPLETED']).default('COMPLETED'),
});

const evaluationSchema = z.object({
  evaluationDate: dateSchema,
  evaluations: z.array(evaluationRowSchema).min(1),
  schoolId: uuidSchema.optional(),
});

const includeHomework = {
  class: { select: { id: true, name: true } },
  section: { select: { id: true, name: true } },
  subject: { select: { id: true, name: true, code: true } },
  createdBy: { select: { id: true, email: true } },
  evaluatedBy: { select: { id: true, email: true } },
  _count: { select: { evaluations: true } },
} satisfies Prisma.HomeworkInclude;

const isTeacherRole = (role?: string | null) => role === 'TEACHER';

const assertAcademicScope = async (schoolId: string, classId: string, sectionId: string, subjectId: string) => {
  const [schoolClass, section, subject] = await Promise.all([
    prisma.class.findFirst({ where: { id: classId, schoolId }, select: { id: true } }),
    prisma.section.findFirst({
      where: { id: sectionId, schoolId },
      select: { id: true, classId: true, classSections: { where: { classId }, select: { classId: true } } },
    }),
    prisma.subject.findFirst({ where: { id: subjectId, schoolId }, select: { id: true, classId: true } }),
  ]);

  if (!schoolClass) throw new HttpError(404, 'Class not found');
  if (!section) throw new HttpError(404, 'Section not found');
  if (section.classId !== classId && section.classSections.length === 0) {
    throw new HttpError(400, 'Section does not belong to selected class');
  }
  if (!subject) throw new HttpError(404, 'Subject not found');
  if (subject.classId && subject.classId !== classId) throw new HttpError(400, 'Subject does not belong to selected class');

  const assignedSubject = await prisma.assignSubject.findFirst({
    where: { schoolId, classId, sectionId, subjectId },
    select: { id: true },
  });
  if (!assignedSubject) throw new HttpError(400, 'Subject is not assigned to selected class and section');
};

const getTeacherProfileId = async (schoolId: string, userId: string) => {
  const teacher = await prisma.teacherProfile.findFirst({
    where: { schoolId, userId, isActive: true },
    select: { id: true },
  });
  if (!teacher) throw new HttpError(403, 'Teacher profile not found');
  return teacher.id;
};

const assertTeacherHomeworkScope = async (params: {
  schoolId: string;
  userId: string;
  classId: string;
  sectionId: string;
  subjectId: string;
}) => {
  const teacherId = await getTeacherProfileId(params.schoolId, params.userId);
  const assigned = await prisma.assignSubject.findFirst({
    where: {
      schoolId: params.schoolId,
      teacherId,
      classId: params.classId,
      sectionId: params.sectionId,
      subjectId: params.subjectId,
    },
    select: { id: true },
  });
  if (!assigned) throw new HttpError(403, 'Teacher is not assigned to this homework subject');
};

const teacherHomeworkWhere = async (schoolId: string, userId: string): Promise<Prisma.HomeworkWhereInput> => {
  const teacherId = await getTeacherProfileId(schoolId, userId);
  const assignments = await prisma.assignSubject.findMany({
    where: { schoolId, teacherId },
    select: { classId: true, sectionId: true, subjectId: true },
  });
  if (assignments.length === 0) return { id: { in: [] } };
  return {
    OR: assignments.map((assignment) => ({
      classId: assignment.classId,
      sectionId: assignment.sectionId,
      subjectId: assignment.subjectId,
    })),
  };
};

const getHomeworkOrThrow = async (schoolId: string, id: string) => {
  const homework = await prisma.homework.findFirst({
    where: { id, schoolId },
    include: includeHomework,
  });
  if (!homework) throw new HttpError(404, 'Homework not found');
  return homework;
};

type HomeworkWithMeta = Prisma.HomeworkGetPayload<{ include: typeof includeHomework }>;
type HomeworkParentNotificationEvent = 'CREATED' | 'UPDATED' | 'EVALUATED';

const parentName = (parent: { firstName: string; lastName: string; email?: string | null; phone?: string | null }) => {
  const name = [parent.firstName, parent.lastName].filter(Boolean).join(' ').trim();
  return name || parent.email || parent.phone || 'Parent';
};

const homeworkNotificationContent = (params: {
  event: HomeworkParentNotificationEvent;
  homework: HomeworkWithMeta;
  studentName: string;
  evaluation?: Pick<z.infer<typeof evaluationRowSchema>, 'completionStatus' | 'marks'>;
}) => {
  const dueDate = params.homework.submissionDate.toISOString().slice(0, 10);
  switch (params.event) {
    case 'UPDATED':
      return {
        subject: `Homework updated: ${params.homework.subject.name}`,
        body: `${params.studentName}'s ${params.homework.subject.name} homework was updated. Due on ${dueDate}.`,
      };
    case 'EVALUATED': {
      const completed = params.evaluation?.completionStatus === 'COMPLETED';
      const status = completed ? 'completed' : 'not completed';
      const marks = params.evaluation?.marks === undefined || params.evaluation?.marks === null ? '' : ` Marks: ${params.evaluation.marks}.`;
      return {
        subject: `Homework evaluated: ${params.homework.subject.name}`,
        body: `${params.studentName}'s ${params.homework.subject.name} homework was marked ${status}.${marks}`,
      };
    }
    case 'CREATED':
    default:
      return {
        subject: `New homework: ${params.homework.subject.name}`,
        body: `${params.studentName} has new ${params.homework.subject.name} homework due on ${dueDate}.`,
      };
  }
};

const sendHomeworkParentNotifications = async (params: {
  schoolId: string;
  actorId: string;
  homework: HomeworkWithMeta;
  event: HomeworkParentNotificationEvent;
  studentIds?: string[];
  evaluationsByStudentId?: Map<string, Pick<z.infer<typeof evaluationRowSchema>, 'completionStatus' | 'marks'>>;
}) => {
  const studentIds = params.studentIds ? Array.from(new Set(params.studentIds)) : undefined;
  if (studentIds && studentIds.length === 0) return;

  const students = await prisma.student.findMany({
    where: {
      schoolId: params.schoolId,
      classId: params.homework.classId,
      sectionId: params.homework.sectionId,
      status: { not: 'DISABLED' },
      ...(studentIds ? { id: { in: studentIds } } : {}),
    },
    select: {
      id: true,
      fullName: true,
      admissionNo: true,
      parentLinks: {
        select: {
          parentId: true,
          parent: {
            select: {
              id: true,
              userId: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
        },
      },
    },
    orderBy: [{ admissionNo: 'asc' }, { fullName: 'asc' }],
  });

  for (const student of students) {
    for (const link of student.parentLinks) {
      const receipt = await prisma.homeworkNotificationReceipt.upsert({
        where: {
          homeworkId_studentId_parentProfileId: {
            homeworkId: params.homework.id,
            studentId: student.id,
            parentProfileId: link.parentId,
          },
        },
        update: {
          schoolId: params.schoolId,
          parentUserId: link.parent.userId ?? null,
        },
        create: {
          schoolId: params.schoolId,
          homeworkId: params.homework.id,
          studentId: student.id,
          parentProfileId: link.parentId,
          parentUserId: link.parent.userId ?? null,
        },
      });

      if (!link.parent.userId) continue;

      try {
        const content = homeworkNotificationContent({
          event: params.event,
          homework: params.homework,
          studentName: student.fullName,
          evaluation: params.evaluationsByStudentId?.get(student.id),
        });
        const result = await sendNotification({
          schoolId: params.schoolId,
          userId: params.actorId,
          channel: 'PUSH',
          data: {
            to: link.parent.userId,
            subject: content.subject,
            body: content.body,
            recipientName: parentName(link.parent),
            recipientType: 'PARENT',
            targetMode: 'STUDENT',
            recipientGroups: ['GUARDIANS'],
            route: '/homework',
            module: 'homework',
            category: 'homework',
            priority: 'high',
            homeworkEvent: params.event,
            homeworkId: params.homework.id,
            childId: student.id,
            childName: student.fullName,
            classId: params.homework.classId,
            className: params.homework.class.name,
            sectionId: params.homework.sectionId,
            sectionName: params.homework.section.name,
            subjectId: params.homework.subjectId,
            subjectName: params.homework.subject.name,
            homeworkDate: params.homework.homeworkDate.toISOString(),
            submissionDate: params.homework.submissionDate.toISOString(),
          },
        });

        await prisma.homeworkNotificationReceipt.update({
          where: { id: receipt.id },
          data: { notificationLogId: result.logId },
        });
      } catch (error) {
        logger.warn(
          {
            err: error,
            homeworkId: params.homework.id,
            studentId: student.id,
            parentId: link.parentId,
          },
          'homework parent push failed',
        );
      }
    }
  }
};

export const listHomeworks = async (req: Request, res: Response) => {
  const { schoolId, userId, role } = requireHomeworkManager(req, getRequestedSchoolId(req));
  const classId = typeof req.query.classId === 'string' ? req.query.classId : undefined;
  const sectionId = typeof req.query.sectionId === 'string' ? req.query.sectionId : undefined;
  const subjectId = typeof req.query.subjectId === 'string' ? req.query.subjectId : undefined;
  const homeworkDateQuery = typeof req.query.homeworkDate === 'string' ? req.query.homeworkDate : undefined;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const scopedWhere = isTeacherRole(role) ? await teacherHomeworkWhere(schoolId, userId) : {};
  const homeworkDate = homeworkDateQuery ? z.coerce.date().parse(homeworkDateQuery) : undefined;
  const homeworkDateEnd = homeworkDate ? new Date(homeworkDate) : undefined;
  if (homeworkDateEnd) homeworkDateEnd.setDate(homeworkDateEnd.getDate() + 1);

  const items = await prisma.homework.findMany({
    where: {
      schoolId,
      ...scopedWhere,
      ...(classId ? { classId } : {}),
      ...(sectionId ? { sectionId } : {}),
      ...(subjectId ? { subjectId } : {}),
      ...(homeworkDate && homeworkDateEnd ? { homeworkDate: { gte: homeworkDate, lt: homeworkDateEnd } } : {}),
      ...(search
        ? {
            OR: [
              { description: { contains: search, mode: 'insensitive' } },
              { class: { name: { contains: search, mode: 'insensitive' } } },
              { section: { name: { contains: search, mode: 'insensitive' } } },
              { subject: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    include: includeHomework,
    orderBy: [{ homeworkDate: 'desc' }, { createdAt: 'desc' }],
  });

  res.status(200).json(items);
};

export const createHomework = async (req: Request, res: Response) => {
  const payload = homeworkSchema.parse(req.body);
  const { schoolId, userId, role } = requireHomeworkManager(req, payload.schoolId);

  await assertAcademicScope(schoolId, payload.classId, payload.sectionId, payload.subjectId);
  if (isTeacherRole(role)) {
    await assertTeacherHomeworkScope({
      schoolId,
      userId,
      classId: payload.classId,
      sectionId: payload.sectionId,
      subjectId: payload.subjectId,
    });
  }

  const item = await prisma.homework.create({
    data: {
      schoolId,
      classId: payload.classId,
      sectionId: payload.sectionId,
      subjectId: payload.subjectId,
      homeworkDate: payload.homeworkDate,
      submissionDate: payload.submissionDate,
      marks: new Prisma.Decimal(payload.marks),
      description: normalizeText(payload.description),
      attachmentUrl: nullableText(payload.attachmentUrl),
      attachmentName: nullableText(payload.attachmentName),
      createdById: userId,
    },
    include: includeHomework,
  });

  await logAudit(req, {
    schoolId,
    entityType: 'HOMEWORK',
    entityId: item.id,
    action: 'CREATE',
    afterState: item,
  });

  await sendHomeworkParentNotifications({
    schoolId,
    actorId: userId,
    homework: item,
    event: 'CREATED',
  });

  res.status(201).json(item);
};

export const updateHomework = async (req: Request, res: Response) => {
  const payload = homeworkSchema.partial().parse(req.body);
  const { schoolId, userId, role } = requireHomeworkManager(req, getRequestedSchoolId(req, payload.schoolId));
  const id = req.params.id;
  const existing = await getHomeworkOrThrow(schoolId, id);

  const classId = payload.classId ?? existing.classId;
  const sectionId = payload.sectionId ?? existing.sectionId;
  const subjectId = payload.subjectId ?? existing.subjectId;
  await assertAcademicScope(schoolId, classId, sectionId, subjectId);
  if (isTeacherRole(role)) {
    await assertTeacherHomeworkScope({ schoolId, userId, classId, sectionId, subjectId });
  }

  const item = await prisma.homework.update({
    where: { id },
    data: {
      classId: payload.classId ?? undefined,
      sectionId: payload.sectionId ?? undefined,
      subjectId: payload.subjectId ?? undefined,
      homeworkDate: payload.homeworkDate ?? undefined,
      submissionDate: payload.submissionDate ?? undefined,
      marks: payload.marks === undefined ? undefined : new Prisma.Decimal(payload.marks),
      description: payload.description === undefined ? undefined : normalizeText(payload.description),
      attachmentUrl: payload.attachmentUrl === undefined ? undefined : nullableText(payload.attachmentUrl),
      attachmentName: payload.attachmentName === undefined ? undefined : nullableText(payload.attachmentName),
    },
    include: includeHomework,
  });

  await logAudit(req, {
    schoolId,
    entityType: 'HOMEWORK',
    entityId: id,
    action: 'UPDATE',
    beforeState: existing,
    afterState: item,
  });

  await sendHomeworkParentNotifications({
    schoolId,
    actorId: userId,
    homework: item,
    event: 'UPDATED',
  });

  res.status(200).json(item);
};

export const deleteHomework = async (req: Request, res: Response) => {
  const { schoolId, userId, role } = requireHomeworkManager(req, getRequestedSchoolId(req));
  const id = req.params.id;
  const existing = await getHomeworkOrThrow(schoolId, id);
  if (isTeacherRole(role)) {
    await assertTeacherHomeworkScope({
      schoolId,
      userId,
      classId: existing.classId,
      sectionId: existing.sectionId,
      subjectId: existing.subjectId,
    });
  }

  await prisma.homework.delete({ where: { id } });
  await logAudit(req, { schoolId, entityType: 'HOMEWORK', entityId: id, action: 'DELETE', beforeState: existing });
  res.status(204).send();
};

export const getHomeworkEvaluation = async (req: Request, res: Response) => {
  const { schoolId, userId, role } = requireHomeworkManager(req, getRequestedSchoolId(req));
  const id = req.params.id;
  const homework = await getHomeworkOrThrow(schoolId, id);
  if (isTeacherRole(role)) {
    await assertTeacherHomeworkScope({
      schoolId,
      userId,
      classId: homework.classId,
      sectionId: homework.sectionId,
      subjectId: homework.subjectId,
    });
  }

  const [students, evaluations] = await Promise.all([
    prisma.student.findMany({
      where: {
        schoolId,
        classId: homework.classId,
        sectionId: homework.sectionId,
        status: { not: 'DISABLED' },
      },
      select: { id: true, admissionNo: true, rollNo: true, fullName: true },
      orderBy: [{ admissionNo: 'asc' }, { fullName: 'asc' }],
    }),
    prisma.homeworkEvaluation.findMany({ where: { schoolId, homeworkId: id } }),
  ]);

  const evaluationByStudent = new Map(evaluations.map((item) => [item.studentId, item]));
  res.status(200).json({
    homework,
    rows: students.map((student) => ({
      student,
      evaluation: evaluationByStudent.get(student.id) ?? null,
    })),
  });
};

export const getHomeworkNotificationHistory = async (req: Request, res: Response) => {
  const { schoolId, userId, role } = requireHomeworkManager(req, getRequestedSchoolId(req));
  const id = req.params.id;
  const homework = await getHomeworkOrThrow(schoolId, id);
  if (isTeacherRole(role)) {
    await assertTeacherHomeworkScope({
      schoolId,
      userId,
      classId: homework.classId,
      sectionId: homework.sectionId,
      subjectId: homework.subjectId,
    });
  }

  const [students, receipts] = await Promise.all([
    prisma.student.findMany({
      where: {
        schoolId,
        classId: homework.classId,
        sectionId: homework.sectionId,
        status: { not: 'DISABLED' },
      },
      select: {
        id: true,
        admissionNo: true,
        rollNo: true,
        fullName: true,
        parentLinks: {
          select: {
            parentId: true,
            parent: {
              select: {
                id: true,
                userId: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
      orderBy: [{ admissionNo: 'asc' }, { fullName: 'asc' }],
    }),
    prisma.homeworkNotificationReceipt.findMany({
      where: { schoolId, homeworkId: id },
      include: {
        notificationLog: {
          select: {
            id: true,
            status: true,
            error: true,
            sentAt: true,
            createdAt: true,
          },
        },
      },
    }),
  ]);

  const receiptByParent = new Map(
    receipts.map((receipt) => [`${receipt.studentId}:${receipt.parentProfileId}`, receipt]),
  );

  const rows = students.flatMap((student) =>
    student.parentLinks.map((link) => {
      const receipt = receiptByParent.get(`${student.id}:${link.parentId}`);
      const log = receipt?.notificationLog ?? null;
      return {
        student: {
          id: student.id,
          admissionNo: student.admissionNo,
          rollNo: student.rollNo,
          fullName: student.fullName,
        },
        parent: {
          id: link.parent.id,
          userId: link.parent.userId,
          name: parentName(link.parent),
          email: link.parent.email,
          phone: link.parent.phone,
        },
        notificationLogId: log?.id ?? null,
        notificationStatus: log?.status ?? 'NOT_SENT',
        notificationError:
          log?.error ?? (link.parent.userId ? null : 'Parent app account is not linked'),
        sentAt: log?.sentAt?.toISOString() ?? null,
        notificationCreatedAt: log?.createdAt?.toISOString() ?? null,
        viewedAt: receipt?.viewedAt?.toISOString() ?? null,
      };
    }),
  );

  res.status(200).json({ homework, rows });
};

export const saveHomeworkEvaluation = async (req: Request, res: Response) => {
  const payload = evaluationSchema.parse(req.body);
  const { schoolId, userId, role } = requireHomeworkManager(req, getRequestedSchoolId(req, payload.schoolId));
  const homeworkId = req.params.id;
  const homework = await getHomeworkOrThrow(schoolId, homeworkId);
  if (isTeacherRole(role)) {
    await assertTeacherHomeworkScope({
      schoolId,
      userId,
      classId: homework.classId,
      sectionId: homework.sectionId,
      subjectId: homework.subjectId,
    });
  }
  const studentIds = Array.from(new Set(payload.evaluations.map((item) => item.studentId)));

  const students = await prisma.student.findMany({
    where: {
      id: { in: studentIds },
      schoolId,
      classId: homework.classId,
      sectionId: homework.sectionId,
      status: { not: 'DISABLED' },
    },
    select: { id: true },
  });
  if (students.length !== studentIds.length) throw new HttpError(404, 'One or more students were not found for this homework class and section');

  await prisma.$transaction(async (tx) => {
    for (const item of payload.evaluations) {
      await tx.homeworkEvaluation.upsert({
        where: { homeworkId_studentId: { homeworkId, studentId: item.studentId } },
        update: {
          marks: item.marks === undefined || item.marks === null ? null : new Prisma.Decimal(item.marks),
          comments: nullableText(item.comments),
          qualityStatus: item.qualityStatus,
          completionStatus: item.completionStatus,
          evaluationDate: payload.evaluationDate,
          evaluatedById: userId,
        },
        create: {
          schoolId,
          homeworkId,
          studentId: item.studentId,
          marks: item.marks === undefined || item.marks === null ? null : new Prisma.Decimal(item.marks),
          comments: nullableText(item.comments),
          qualityStatus: item.qualityStatus,
          completionStatus: item.completionStatus,
          evaluationDate: payload.evaluationDate,
          evaluatedById: userId,
        },
      });
    }

    await tx.homework.update({
      where: { id: homeworkId },
      data: { evaluationDate: payload.evaluationDate, evaluatedById: userId },
    });
  });

  await logAudit(req, {
    schoolId,
    entityType: 'HOMEWORK_EVALUATION',
    entityId: homeworkId,
    action: 'UPSERT',
    afterState: { evaluationDate: payload.evaluationDate, studentCount: payload.evaluations.length },
  });

  const evaluationsByStudentId = new Map(payload.evaluations.map((item) => [item.studentId, { completionStatus: item.completionStatus, marks: item.marks }]));
  const [updatedHomework, studentsAfter, evaluationsAfter] = await Promise.all([
    getHomeworkOrThrow(schoolId, homeworkId),
    prisma.student.findMany({
      where: {
        schoolId,
        classId: homework.classId,
        sectionId: homework.sectionId,
        status: { not: 'DISABLED' },
      },
      select: { id: true, admissionNo: true, rollNo: true, fullName: true },
      orderBy: [{ admissionNo: 'asc' }, { fullName: 'asc' }],
    }),
    prisma.homeworkEvaluation.findMany({ where: { schoolId, homeworkId } }),
  ]);

  await sendHomeworkParentNotifications({
    schoolId,
    actorId: userId,
    homework: updatedHomework,
    event: 'EVALUATED',
    studentIds,
    evaluationsByStudentId,
  });

  const evaluationByStudent = new Map(evaluationsAfter.map((item) => [item.studentId, item]));
  res.status(200).json({
    homework: updatedHomework,
    rows: studentsAfter.map((student) => ({
      student,
      evaluation: evaluationByStudent.get(student.id) ?? null,
    })),
  });
};

export const getHomeworkEvaluationReport = async (req: Request, res: Response) => {
  const { schoolId, userId, role } = requireHomeworkManager(req, getRequestedSchoolId(req));
  const classId = typeof req.query.classId === 'string' ? req.query.classId : undefined;
  const sectionId = typeof req.query.sectionId === 'string' ? req.query.sectionId : undefined;
  const subjectId = typeof req.query.subjectId === 'string' ? req.query.subjectId : undefined;
  const scopedWhere = isTeacherRole(role) ? await teacherHomeworkWhere(schoolId, userId) : {};

  const homeworks = await prisma.homework.findMany({
    where: {
      schoolId,
      ...scopedWhere,
      ...(classId ? { classId } : {}),
      ...(sectionId ? { sectionId } : {}),
      ...(subjectId ? { subjectId } : {}),
    },
    include: includeHomework,
    orderBy: [{ homeworkDate: 'desc' }, { createdAt: 'desc' }],
  });

  const rows = await Promise.all(
    homeworks.map(async (homework) => {
      const [totalStudents, completedCount] = await Promise.all([
        prisma.student.count({
          where: {
            schoolId,
            classId: homework.classId,
            sectionId: homework.sectionId,
            status: { not: 'DISABLED' },
          },
        }),
        prisma.homeworkEvaluation.count({
          where: { schoolId, homeworkId: homework.id, completionStatus: 'COMPLETED' },
        }),
      ]);
      const percent = totalStudents > 0 ? Math.round((completedCount / totalStudents) * 10000) / 100 : 0;
      return { homework, totalStudents, completedCount, percent };
    }),
  );

  res.status(200).json(rows);
};

const documentFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const allowed = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp',
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported document type'));
  }
};

export const homeworkAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: documentFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
});

export const uploadHomeworkAttachment = async (req: Request, res: Response) => {
  const { schoolId } = requireHomeworkManager(req, getRequestedSchoolId(req));
  if (!req.file) throw new HttpError(400, 'No file uploaded');

  const ext = path.extname(req.file.originalname).toLowerCase();
  const filename = `${crypto.randomUUID()}${ext || ''}`;
  const key = `schools/${schoolId}/homework/${filename}`;
  const uploaded = await uploadBuffer({ key, body: req.file.buffer, contentType: req.file.mimetype });

  res.status(201).json({
    url: uploaded.url,
    filename: req.file.originalname,
    storedFilename: filename,
    contentType: req.file.mimetype,
    size: req.file.size,
  });
};
