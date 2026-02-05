import type { LeaveRequestStatus, RoleName, StudentAttendanceStatus, TeacherSelfAttendanceStatus } from '@prisma/client';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { createAuditLog } from './auditLog.service';

const normalizeDate = (value?: Date | string | null) => {
  const date = value ? new Date(value) : new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (value: Date) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

export const isAdminRole = (role?: string | null) => role === 'SUPER_ADMIN' || role === 'SCHOOL_ADMIN';

const getTeacherProfile = async (schoolId: string, userId: string) => {
  const profile = await prisma.teacherProfile.findFirst({
    where: { schoolId, userId, isActive: true },
    select: { id: true, userId: true },
  });
  if (!profile) throw new HttpError(403, 'Teacher profile not found or inactive');
  return profile;
};

export const ensureTeacherAssignedToClassSection = async (params: {
  schoolId: string;
  userId: string;
  classId: string;
  sectionId?: string;
}) => {
  const teacher = await getTeacherProfile(params.schoolId, params.userId);

  const assigned = await prisma.teacherClassAssignment.findFirst({
    where: {
      teacherId: teacher.id,
      classId: params.classId,
      class: { schoolId: params.schoolId },
    },
    select: { id: true },
  });
  if (!assigned) throw new HttpError(403, 'Teacher is not assigned to this class');

  if (params.sectionId) {
    const section = await prisma.section.findFirst({
      where: {
        id: params.sectionId,
        classId: params.classId,
        class: { schoolId: params.schoolId },
      },
      select: { id: true },
    });
    if (!section) throw new HttpError(404, 'Section not found for class');
  }
};

export const createStudentAttendanceSession = async (params: {
  schoolId: string;
  actorId: string;
  actorRole: string;
  classId: string;
  sectionId?: string;
  date?: Date | string;
}) => {
  const date = normalizeDate(params.date);
  const existing = await prisma.studentAttendanceSession.findFirst({
    where: {
      schoolId: params.schoolId,
      classId: params.classId,
      sectionId: params.sectionId ?? null,
      date,
    },
    include: { records: true },
  });

  if (existing) return existing;

  const session = await prisma.studentAttendanceSession.create({
    data: {
      schoolId: params.schoolId,
      classId: params.classId,
      sectionId: params.sectionId ?? null,
      date,
      createdById: params.actorId,
      status: 'DRAFT',
    },
    include: { records: true },
  });

  await createAuditLog({
    schoolId: params.schoolId,
    actorId: params.actorId,
    actorRole: params.actorRole,
    entityType: 'StudentAttendanceSession',
    entityId: session.id,
    action: 'CREATE',
    afterState: {
      classId: session.classId,
      sectionId: session.sectionId,
      date: session.date.toISOString(),
      status: session.status,
    },
  });

  return session;
};

export const updateStudentAttendanceSession = async (params: {
  schoolId: string;
  actorId: string;
  actorRole: string;
  sessionId: string;
  records: Array<{ studentId: string; status: StudentAttendanceStatus; remarks?: string | null }>;
  submit: boolean;
  unlock: boolean;
  reason?: string | null;
}) => {
  const session = await prisma.studentAttendanceSession.findFirst({
    where: { id: params.sessionId, schoolId: params.schoolId },
  });
  if (!session) throw new HttpError(404, 'Attendance session not found');

  const admin = isAdminRole(params.actorRole);
  if (session.status === 'LOCKED' && !params.unlock) {
    throw new HttpError(409, 'Attendance session is locked');
  }

  if (params.unlock) {
    if (!admin) throw new HttpError(403, 'Only admin can unlock');
    if (!params.reason?.trim()) throw new HttpError(400, 'Unlock reason is required');

    const unlocked = await prisma.studentAttendanceSession.update({
      where: { id: session.id },
      data: { status: 'DRAFT', lockedAt: null, lockedById: null, lockReason: null },
      include: { records: true },
    });

    await createAuditLog({
      schoolId: params.schoolId,
      actorId: params.actorId,
      actorRole: params.actorRole,
      entityType: 'StudentAttendanceSession',
      entityId: unlocked.id,
      action: 'UNLOCK',
      beforeState: { status: session.status, lockReason: session.lockReason },
      afterState: { status: unlocked.status, reason: params.reason },
    });
    return unlocked;
  }

  const studentIds = params.records.map((r) => r.studentId);
  const students = await prisma.student.findMany({
    where: {
      schoolId: params.schoolId,
      id: { in: studentIds },
      classId: session.classId,
      ...(session.sectionId ? { sectionId: session.sectionId } : {}),
    },
    select: { id: true },
  });
  if (students.length !== studentIds.length) {
    throw new HttpError(400, 'All students must belong to selected class and section');
  }

  const beforeState = await prisma.studentAttendanceRecord.findMany({
    where: { sessionId: session.id },
    select: { studentId: true, status: true, remarks: true },
  });

  await prisma.$transaction(async (tx) => {
    for (const record of params.records) {
      await tx.studentAttendanceRecord.upsert({
        where: { sessionId_studentId: { sessionId: session.id, studentId: record.studentId } },
        create: {
          sessionId: session.id,
          studentId: record.studentId,
          status: record.status,
          remarks: record.remarks ?? null,
        },
        update: {
          status: record.status,
          remarks: record.remarks ?? null,
        },
      });
    }
  });

  const updated = await prisma.studentAttendanceSession.update({
    where: { id: session.id },
    data: params.submit
      ? {
          status: 'LOCKED',
          lockedAt: new Date(),
          lockedById: params.actorId,
          lockReason: 'Submitted by teacher',
        }
      : {},
    include: { records: true },
  });

  await createAuditLog({
    schoolId: params.schoolId,
    actorId: params.actorId,
    actorRole: params.actorRole,
    entityType: 'StudentAttendanceSession',
    entityId: updated.id,
    action: params.submit ? 'SUBMIT_AND_LOCK' : 'UPDATE',
    beforeState,
    afterState: updated.records.map((r) => ({ studentId: r.studentId, status: r.status, remarks: r.remarks })),
  });

  return updated;
};

export const lockStudentAttendanceSession = async (params: {
  schoolId: string;
  actorId: string;
  actorRole: string;
  sessionId: string;
  reason: string;
}) => {
  if (!isAdminRole(params.actorRole)) throw new HttpError(403, 'Only admin can lock sessions');
  if (!params.reason.trim()) throw new HttpError(400, 'Lock reason is required');

  const session = await prisma.studentAttendanceSession.findFirst({
    where: { id: params.sessionId, schoolId: params.schoolId },
  });
  if (!session) throw new HttpError(404, 'Attendance session not found');

  const locked = await prisma.studentAttendanceSession.update({
    where: { id: session.id },
    data: {
      status: 'LOCKED',
      lockedAt: new Date(),
      lockedById: params.actorId,
      lockReason: params.reason,
    },
    include: { records: true },
  });

  await createAuditLog({
    schoolId: params.schoolId,
    actorId: params.actorId,
    actorRole: params.actorRole,
    entityType: 'StudentAttendanceSession',
    entityId: locked.id,
    action: 'LOCK',
    beforeState: { status: session.status, lockReason: session.lockReason },
    afterState: { status: locked.status, lockReason: locked.lockReason },
  });

  return locked;
};

export const getAttendanceSummary = async (params: {
  schoolId: string;
  date?: Date | string;
}) => {
  const date = params.date ? normalizeDate(params.date) : undefined;
  const where = {
    schoolId: params.schoolId,
    ...(date ? { date } : {}),
  };

  const sessions = await prisma.studentAttendanceSession.findMany({
    where,
    include: { records: true, class: { select: { id: true, name: true } }, section: { select: { id: true, name: true } } },
    orderBy: { date: 'desc' },
  });

  const counts = sessions.flatMap((s) => s.records).reduce<Record<string, number>>((acc, rec) => {
    acc[rec.status] = (acc[rec.status] ?? 0) + 1;
    return acc;
  }, {});

  return {
    totals: {
      sessions: sessions.length,
      records: sessions.reduce((sum, s) => sum + s.records.length, 0),
      present: counts.PRESENT ?? 0,
      absent: counts.ABSENT ?? 0,
      late: counts.LATE ?? 0,
      halfDay: counts.HALF_DAY ?? 0,
    },
    sessions: sessions.map((s) => ({
      id: s.id,
      date: s.date,
      status: s.status,
      classId: s.classId,
      className: s.class.name,
      sectionId: s.sectionId,
      sectionName: s.section?.name ?? 'N/A',
      lockedAt: s.lockedAt,
      lockReason: s.lockReason,
      recordCount: s.records.length,
    })),
  };
};

export const markTeacherSelfAttendance = async (params: {
  schoolId: string;
  actorId: string;
  actorRole: string;
  status: TeacherSelfAttendanceStatus;
  date?: Date | string;
  teacherId?: string;
  overrideReason?: string;
  leaveRequestId?: string;
}) => {
  const date = normalizeDate(params.date);
  const isAdmin = isAdminRole(params.actorRole);
  const teacherProfile = params.teacherId
    ? await prisma.teacherProfile.findFirst({
        where: { id: params.teacherId, schoolId: params.schoolId, isActive: true },
        select: { id: true, userId: true },
      })
    : await getTeacherProfile(params.schoolId, params.actorId);

  if (!teacherProfile) throw new HttpError(404, 'Teacher not found');
  if (!isAdmin && teacherProfile.userId !== params.actorId) throw new HttpError(403, 'Teachers can only mark self attendance');
  if (isAdmin && teacherProfile.userId !== params.actorId && !params.overrideReason?.trim()) {
    throw new HttpError(400, 'Override reason is required');
  }

  const existing = await prisma.teacherSelfAttendance.findUnique({
    where: {
      schoolId_teacherId_date: {
        schoolId: params.schoolId,
        teacherId: teacherProfile.id,
        date,
      },
    },
  });

  const attendance = await prisma.teacherSelfAttendance.upsert({
    where: {
      schoolId_teacherId_date: {
        schoolId: params.schoolId,
        teacherId: teacherProfile.id,
        date,
      },
    },
    create: {
      schoolId: params.schoolId,
      teacherId: teacherProfile.id,
      date,
      status: params.status,
      leaveRequestId: params.leaveRequestId ?? null,
      createdById: params.actorId,
      overriddenById: isAdmin && teacherProfile.userId !== params.actorId ? params.actorId : null,
      overrideReason: params.overrideReason ?? null,
    },
    update: {
      status: params.status,
      leaveRequestId: params.leaveRequestId ?? null,
      overriddenById: isAdmin && teacherProfile.userId !== params.actorId ? params.actorId : null,
      overrideReason: params.overrideReason ?? null,
    },
  });

  await createAuditLog({
    schoolId: params.schoolId,
    actorId: params.actorId,
    actorRole: params.actorRole,
    entityType: 'TeacherSelfAttendance',
    entityId: attendance.id,
    action: existing ? 'UPDATE' : 'CREATE',
    beforeState: existing ? { status: existing.status, overrideReason: existing.overrideReason } : null,
    afterState: { status: attendance.status, date: attendance.date.toISOString(), overrideReason: attendance.overrideReason },
  });

  return attendance;
};

export const listTeacherSelfAttendance = async (params: {
  schoolId: string;
  actorId: string;
  actorRole: string;
  teacherId?: string;
  fromDate?: Date | string;
  toDate?: Date | string;
}) => {
  const teacherProfile = params.teacherId
    ? await prisma.teacherProfile.findFirst({
        where: { id: params.teacherId, schoolId: params.schoolId, isActive: true },
        select: { id: true, userId: true },
      })
    : await getTeacherProfile(params.schoolId, params.actorId);

  if (!teacherProfile) throw new HttpError(404, 'Teacher not found');
  if (!isAdminRole(params.actorRole) && teacherProfile.userId !== params.actorId) {
    throw new HttpError(403, 'Teachers can only view self attendance');
  }

  return prisma.teacherSelfAttendance.findMany({
    where: {
      schoolId: params.schoolId,
      teacherId: teacherProfile.id,
      ...(params.fromDate || params.toDate
        ? {
            date: {
              ...(params.fromDate ? { gte: normalizeDate(params.fromDate) } : {}),
              ...(params.toDate ? { lte: endOfDay(normalizeDate(params.toDate)) } : {}),
            },
          }
        : {}),
    },
    orderBy: { date: 'desc' },
  });
};

export const createLeaveRequest = async (params: {
  schoolId: string;
  actorId: string;
  actorRole: string;
  fromDate: Date | string;
  toDate: Date | string;
  reason: string;
}) => {
  const teacher = await getTeacherProfile(params.schoolId, params.actorId);
  const fromDate = normalizeDate(params.fromDate);
  const toDate = normalizeDate(params.toDate);
  if (toDate < fromDate) throw new HttpError(400, 'toDate must be on or after fromDate');

  const leave = await prisma.teacherLeaveRequest.create({
    data: {
      schoolId: params.schoolId,
      teacherId: teacher.id,
      fromDate,
      toDate,
      reason: params.reason.trim(),
      status: 'PENDING',
    },
  });

  await createAuditLog({
    schoolId: params.schoolId,
    actorId: params.actorId,
    actorRole: params.actorRole,
    entityType: 'TeacherLeaveRequest',
    entityId: leave.id,
    action: 'CREATE',
    afterState: {
      fromDate: leave.fromDate.toISOString(),
      toDate: leave.toDate.toISOString(),
      reason: leave.reason,
      status: leave.status,
    },
  });

  return leave;
};

export const listLeaveRequests = async (params: {
  schoolId: string;
  actorId: string;
  actorRole: string;
  status?: LeaveRequestStatus;
}) => {
  if (isAdminRole(params.actorRole)) {
    return prisma.teacherLeaveRequest.findMany({
      where: { schoolId: params.schoolId, ...(params.status ? { status: params.status } : {}) },
      include: { teacher: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  const teacher = await getTeacherProfile(params.schoolId, params.actorId);
  return prisma.teacherLeaveRequest.findMany({
    where: { schoolId: params.schoolId, teacherId: teacher.id, ...(params.status ? { status: params.status } : {}) },
    orderBy: { createdAt: 'desc' },
  });
};

const enumerateDays = (fromDate: Date, toDate: Date) => {
  const dates: Date[] = [];
  const current = new Date(fromDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(toDate);
  end.setHours(0, 0, 0, 0);
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

export const reviewLeaveRequest = async (params: {
  schoolId: string;
  actorId: string;
  actorRole: string;
  leaveId: string;
  status: Extract<LeaveRequestStatus, 'APPROVED' | 'REJECTED'>;
  reason?: string;
}) => {
  if (!isAdminRole(params.actorRole)) throw new HttpError(403, 'Only admin can review leave requests');

  const leave = await prisma.teacherLeaveRequest.findFirst({
    where: { id: params.leaveId, schoolId: params.schoolId },
  });
  if (!leave) throw new HttpError(404, 'Leave request not found');
  if (leave.status !== 'PENDING') throw new HttpError(409, 'Leave request already reviewed');

  const reviewed = await prisma.teacherLeaveRequest.update({
    where: { id: leave.id },
    data: {
      status: params.status,
      reviewedById: params.actorId,
      reviewedAt: new Date(),
      reviewReason: params.reason ?? null,
    },
  });

  if (params.status === 'APPROVED') {
    const dates = enumerateDays(leave.fromDate, leave.toDate);
    await prisma.$transaction(
      dates.map((date) =>
        prisma.teacherSelfAttendance.upsert({
          where: {
            schoolId_teacherId_date: {
              schoolId: leave.schoolId,
              teacherId: leave.teacherId,
              date,
            },
          },
          create: {
            schoolId: leave.schoolId,
            teacherId: leave.teacherId,
            date,
            status: 'LEAVE',
            leaveRequestId: leave.id,
            createdById: params.actorId,
            overriddenById: params.actorId,
            overrideReason: 'Approved leave',
          },
          update: {
            status: 'LEAVE',
            leaveRequestId: leave.id,
            overriddenById: params.actorId,
            overrideReason: 'Approved leave',
          },
        }),
      ),
    );
  }

  await createAuditLog({
    schoolId: params.schoolId,
    actorId: params.actorId,
    actorRole: params.actorRole as RoleName,
    entityType: 'TeacherLeaveRequest',
    entityId: reviewed.id,
    action: params.status,
    beforeState: { status: leave.status },
    afterState: { status: reviewed.status, reason: reviewed.reviewReason },
  });

  return reviewed;
};
