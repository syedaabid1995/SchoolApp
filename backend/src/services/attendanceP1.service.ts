import type { AttendanceMode, AttendanceUnitType, LeaveRequestStatus, RoleName, StudentAttendanceStatus, TeacherSelfAttendanceStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { attendanceReadService } from '../modules/attendance/services/attendance-read.service';
import { createAuditLog } from './auditLog.service';
import { sendAttendanceAbsenceParentAlerts } from './parentAlert.service';

const normalizeDate = (value?: Date | string | null) => {
  const date = value ? new Date(value) : new Date();
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const endOfDay = (value: Date) => {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 23, 59, 59, 999));
};

const nextDay = (value: Date) => {
  const date = normalizeDate(value);
  date.setUTCDate(date.getUTCDate() + 1);
  return date;
};

const toDateKey = (value: Date) => normalizeDate(value).toISOString().slice(0, 10);

const dayValueByKey = new Map([
  ['saturday', 1],
  ['sat', 1],
  ['sunday', 2],
  ['sun', 2],
  ['monday', 3],
  ['mon', 3],
  ['tuesday', 4],
  ['tue', 4],
  ['wednesday', 5],
  ['wed', 5],
  ['thursday', 6],
  ['thu', 6],
  ['friday', 7],
  ['fri', 7],
]);

const routineDayValue = (date: Date) => {
  const day = normalizeDate(date).getUTCDay();
  return day === 6 ? 1 : day + 2;
};

const staffAttendanceUnitKey = (unitType: AttendanceUnitType, slotType?: 'MORNING' | 'AFTERNOON' | null, periodId?: string | null) => {
  if (unitType === 'SLOT') return `SLOT:${slotType ?? 'MORNING'}`;
  if (unitType === 'PERIOD') return `PERIOD:${periodId ?? 'UNKNOWN'}`;
  return 'DAY';
};

const parseSystemHolidays = (settings: { holidays: Prisma.JsonValue } | null, fromDate: Date, toDate: Date) => {
  const raw = Array.isArray(settings?.holidays) ? settings.holidays : [];
  const holidays: Array<{ date: Date; title: string; details?: string | null; type?: string | null }> = [];
  const start = normalizeDate(fromDate);
  const end = normalizeDate(toDate);
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const from = typeof row.fromDate === 'string' ? normalizeDate(row.fromDate) : null;
    const to = typeof row.toDate === 'string' ? normalizeDate(row.toDate) : from;
    if (!from || !to) continue;
    for (let cursor = new Date(from); cursor <= to; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const day = normalizeDate(cursor);
      if (day < start || day > end) continue;
      holidays.push({
        date: day,
        title: String(row.title ?? 'Holiday'),
        details: typeof row.details === 'string' ? row.details : null,
        type: typeof row.type === 'string' ? row.type : null,
      });
    }
  }
  return holidays;
};

const parseSystemWeekends = (settings: { weekends: Prisma.JsonValue } | null, fromDate: Date, toDate: Date) => {
  const weekendValues = new Set<number>();
  const raw = Array.isArray(settings?.weekends) ? settings.weekends : [];
  if (!raw.length) weekendValues.add(7);
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    if (row.isWeekend !== true) continue;
    const key = String(row.id ?? row.name ?? '').trim().toLowerCase();
    const value = dayValueByKey.get(key);
    if (value) weekendValues.add(value);
  }

  const weekends: Array<{ date: Date; title: string; details?: string | null; type?: string | null }> = [];
  const start = normalizeDate(fromDate);
  const end = normalizeDate(toDate);
  for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const day = normalizeDate(cursor);
    if (!weekendValues.has(routineDayValue(day))) continue;
    weekends.push({
      date: day,
      title: 'Weekend',
      details: 'Configured school weekend',
      type: 'Weekend',
    });
  }
  return weekends;
};

const defaultSelfAttendancePeriods = [
  { name: '1ST PERIOD', startTime: '09:00', endTime: '09:45' },
  { name: '2ND PERIOD', startTime: '09:45', endTime: '10:30' },
  { name: '3RD PERIOD', startTime: '10:45', endTime: '11:30' },
  { name: '4TH PERIOD', startTime: '11:30', endTime: '12:15' },
  { name: '5TH PERIOD', startTime: '13:00', endTime: '13:45' },
  { name: '6TH PERIOD', startTime: '13:45', endTime: '14:30' },
  { name: '7TH PERIOD', startTime: '14:30', endTime: '15:15' },
];

const ensureSelfAttendancePeriods = async (schoolId: string) => {
  for (const period of defaultSelfAttendancePeriods) {
    await prisma.attendancePeriod.upsert({
      where: { schoolId_type_name: { schoolId, type: 'CLASS_TIME', name: period.name } },
      update: { startTime: period.startTime, endTime: period.endTime },
      create: { schoolId, type: 'CLASS_TIME', name: period.name, startTime: period.startTime, endTime: period.endTime },
    });
  }
  return prisma.attendancePeriod.findMany({
    where: { schoolId, type: 'CLASS_TIME' },
    orderBy: [{ startTime: 'asc' }],
  });
};

const resolveStaffAttendanceConfiguration = async (schoolId: string, roleName: RoleName | null, date: Date) => {
  const rows = await prisma.staffAttendanceConfiguration.findMany({
    where: {
      schoolId,
      isActive: true,
      effectiveFrom: { lte: date },
      AND: [
        { OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }] },
        {
          OR: roleName
            ? [{ roleName }, { roleName: null }]
            : [{ roleName: null }],
        },
      ],
    },
    orderBy: [{ roleName: 'desc' }, { effectiveFrom: 'desc' }, { updatedAt: 'desc' }],
  });
  const selected = rows.find((row) => row.roleName === roleName) ?? rows.find((row) => row.roleName === null);
  return {
    id: selected?.id ?? null,
    mode: selected?.mode ?? 'TWICE_DAILY',
    source: selected ? (selected.roleName ? 'ROLE' : 'SCHOOL') : 'DEFAULT',
    configuration: selected ?? null,
  };
};

const resolveStaffAttendanceUnits = async (schoolId: string, mode: AttendanceMode) => {
  if (mode === 'TWICE_DAILY') {
    return [
      { unitType: 'SLOT', slotType: 'MORNING', label: 'Morning', unitKey: 'SLOT:MORNING' },
      { unitType: 'SLOT', slotType: 'AFTERNOON', label: 'Afternoon', unitKey: 'SLOT:AFTERNOON' },
    ];
  }
  if (mode === 'PERIOD_WISE') {
    const periods = await ensureSelfAttendancePeriods(schoolId);
    return periods.map((period) => ({
      unitType: 'PERIOD',
      periodId: period.id,
      label: period.name,
      startTime: period.startTime,
      endTime: period.endTime,
      unitKey: `PERIOD:${period.id}`,
    }));
  }
  return [{ unitType: 'DAY', label: 'Day', unitKey: 'DAY' }];
};

export const isAdminRole = (role?: string | null) => role === 'SUPER_ADMIN' || role === 'SCHOOL_ADMIN';

const mapRecordsForCompare = (rows: Array<{ studentId: string; status: StudentAttendanceStatus; remarks?: string | null }>) =>
  rows
    .map((row) => ({
      studentId: row.studentId,
      status: row.status,
      remarks: (row.remarks ?? '').trim() || null,
    }))
    .sort((a, b) => a.studentId.localeCompare(b.studentId));

const isSameRecordSet = (
  left: Array<{ studentId: string; status: StudentAttendanceStatus; remarks?: string | null }>,
  right: Array<{ studentId: string; status: StudentAttendanceStatus; remarks?: string | null }>,
) => JSON.stringify(mapRecordsForCompare(left)) === JSON.stringify(mapRecordsForCompare(right));

const getTeacherProfile = async (schoolId: string, userId: string) => {
  const profile = await prisma.teacherProfile.findFirst({
    where: { schoolId, userId, isActive: true },
    select: { id: true, userId: true, roleName: true },
  });
  if (!profile) throw new HttpError(403, 'Teacher profile not found or inactive');
  return profile;
};

export const ensureTeacherAssignedToClassSection = async (params: {
  schoolId: string;
  userId: string;
  classId: string;
  sectionId?: string;
  date?: Date | string;
}) => {
  const teacher = await getTeacherProfile(params.schoolId, params.userId);

  if (params.sectionId) {
    const section = await prisma.section.findFirst({
      where: {
        id: params.sectionId,
        schoolId: params.schoolId,
      },
      select: { id: true },
    });
    if (!section) throw new HttpError(404, 'Section not found');
  }

  if (params.date) {
    const substitution = await prisma.teacherAttendanceSubstitution.findFirst({
      where: {
        schoolId: params.schoolId,
        classId: params.classId,
        sectionId: params.sectionId ?? null,
        date: normalizeDate(params.date),
        substituteTeacherId: teacher.id,
        canceledAt: null,
      },
      select: { id: true },
    });
    if (substitution) return;
  }

  let assigned = await prisma.teacherClassAssignment.findFirst({
    where: {
      teacherId: teacher.id,
      classId: params.classId,
      sectionId: params.sectionId ?? null,
      class: { schoolId: params.schoolId },
    },
    select: { id: true },
  });

  if (!assigned && params.sectionId) {
    const legacy = await prisma.teacherClassAssignment.findFirst({
      where: {
        teacherId: teacher.id,
        classId: params.classId,
        sectionId: null,
        class: { schoolId: params.schoolId },
      },
      select: { id: true },
    });
    if (legacy) assigned = legacy;
  }

  if (!assigned) {
    const subjectAssignment = await prisma.assignSubject.findFirst({
      where: {
        schoolId: params.schoolId,
        teacherId: teacher.id,
        classId: params.classId,
        ...(params.sectionId ? { sectionId: params.sectionId } : {}),
      },
      select: { id: true },
    });
    if (subjectAssignment) assigned = subjectAssignment;
  }

  if (!assigned) {
    const classTeacher = await prisma.classTeacher.findFirst({
      where: {
        schoolId: params.schoolId,
        teacherId: teacher.id,
        classId: params.classId,
        ...(params.sectionId ? { sectionId: params.sectionId } : {}),
      },
      select: { id: true },
    });
    if (classTeacher) assigned = classTeacher;
  }

  if (!assigned) throw new HttpError(403, 'Teacher is not assigned to this class');
};

export const createTeacherAttendanceSubstitution = async (params: {
  schoolId: string;
  actorId: string;
  actorRole: string;
  classId: string;
  sectionId?: string;
  date: Date | string;
  substituteTeacherId: string;
  originalTeacherId?: string;
  reason?: string | null;
}) => {
  const classInfo = await prisma.class.findFirst({
    where: { id: params.classId, schoolId: params.schoolId },
    select: { id: true, academicYearId: true },
  });
  if (!classInfo) throw new HttpError(404, 'Class not found');
  if (!classInfo.academicYearId) throw new HttpError(400, 'Academic year is required for class');

  if (params.sectionId) {
    const section = await prisma.section.findFirst({
      where: {
        id: params.sectionId,
        schoolId: params.schoolId,
      },
      select: { id: true },
    });
    if (!section) throw new HttpError(404, 'Section not found');
  }

  const substitute = await prisma.teacherProfile.findFirst({
    where: { id: params.substituteTeacherId, schoolId: params.schoolId, isActive: true },
    select: { id: true },
  });
  if (!substitute) throw new HttpError(404, 'Substitute teacher not found or inactive');

  if (params.originalTeacherId) {
    const original = await prisma.teacherProfile.findFirst({
      where: { id: params.originalTeacherId, schoolId: params.schoolId },
      select: { id: true },
    });
    if (!original) throw new HttpError(404, 'Original teacher not found');
  }

  const date = normalizeDate(params.date);
  const existing = await prisma.teacherAttendanceSubstitution.findFirst({
    where: {
      schoolId: params.schoolId,
      academicYearId: classInfo.academicYearId,
      classId: params.classId,
      sectionId: params.sectionId ?? null,
      date,
      canceledAt: null,
    },
    select: { id: true },
  });
  if (existing) {
    throw new HttpError(409, 'Temporary reassignment already exists for this class and date');
  }

  const created = await prisma.teacherAttendanceSubstitution.create({
    data: {
      schoolId: params.schoolId,
      academicYearId: classInfo.academicYearId,
      classId: params.classId,
      sectionId: params.sectionId ?? null,
      date,
      originalTeacherId: params.originalTeacherId ?? null,
      substituteTeacherId: params.substituteTeacherId,
      reason: params.reason?.trim() || null,
      createdById: params.actorId,
    },
  });

  await createAuditLog({
    schoolId: params.schoolId,
    actorId: params.actorId,
    actorRole: params.actorRole,
    entityType: 'TeacherAttendanceSubstitution',
    entityId: created.id,
    action: 'CREATE',
    afterState: {
      classId: created.classId,
      sectionId: created.sectionId,
      academicYearId: created.academicYearId,
      date: created.date.toISOString(),
      substituteTeacherId: created.substituteTeacherId,
      originalTeacherId: created.originalTeacherId,
      reason: created.reason,
    },
  });

  return created;
};

export const listTeacherAttendanceSubstitutions = async (params: {
  schoolId: string;
  classId?: string;
  sectionId?: string;
  substituteTeacherId?: string;
  originalTeacherId?: string;
  date?: Date | string;
  fromDate?: Date | string;
  toDate?: Date | string;
}) => {
  const dateFilter =
    params.date || params.fromDate || params.toDate
      ? {
          date: {
            ...(params.date ? { equals: normalizeDate(params.date) } : {}),
            ...(params.fromDate ? { gte: normalizeDate(params.fromDate) } : {}),
            ...(params.toDate ? { lte: endOfDay(normalizeDate(params.toDate)) } : {}),
          },
        }
      : {};

  return prisma.teacherAttendanceSubstitution.findMany({
    where: {
      schoolId: params.schoolId,
      ...(params.classId ? { classId: params.classId } : {}),
      ...(params.sectionId ? { sectionId: params.sectionId } : {}),
      ...(params.substituteTeacherId ? { substituteTeacherId: params.substituteTeacherId } : {}),
      ...(params.originalTeacherId ? { originalTeacherId: params.originalTeacherId } : {}),
      ...dateFilter,
    },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    include: {
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      originalTeacher: { select: { id: true, firstName: true, lastName: true } },
      substituteTeacher: { select: { id: true, firstName: true, lastName: true } },
      createdBy: { select: { id: true, email: true } },
      canceledBy: { select: { id: true, email: true } },
    },
  });
};

export const cancelTeacherAttendanceSubstitution = async (params: {
  schoolId: string;
  actorId: string;
  actorRole: string;
  substitutionId: string;
  reason?: string | null;
}) => {
  const substitution = await prisma.teacherAttendanceSubstitution.findFirst({
    where: { id: params.substitutionId, schoolId: params.schoolId },
  });
  if (!substitution) throw new HttpError(404, 'Substitution not found');

  if (substitution.canceledAt) {
    return substitution;
  }

  const canceled = await prisma.teacherAttendanceSubstitution.update({
    where: { id: substitution.id },
    data: {
      canceledAt: new Date(),
      canceledById: params.actorId,
    },
  });

  await createAuditLog({
    schoolId: params.schoolId,
    actorId: params.actorId,
    actorRole: params.actorRole,
    entityType: 'TeacherAttendanceSubstitution',
    entityId: canceled.id,
    action: 'CANCEL',
    beforeState: { canceledAt: substitution.canceledAt, reason: substitution.reason },
    afterState: {
      canceledAt: canceled.canceledAt?.toISOString(),
      reason: params.reason ?? null,
    },
  });

  return canceled;
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
  const today = normalizeDate(new Date());
  if (date > today) {
    throw new HttpError(400, 'Future date attendance is not allowed');
  }
  const lockKey = `${params.schoolId}:${params.classId}:${params.sectionId ?? 'na'}:${date.toISOString()}`;
  const { session, didCreate } = await prisma.$transaction(async (tx) => {
    // Prevent duplicate sessions under concurrent requests, including NULL sectionId cases.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

    const existing = await tx.studentAttendanceSession.findFirst({
      where: {
        schoolId: params.schoolId,
        classId: params.classId,
        sectionId: params.sectionId ?? null,
        date,
      },
      include: { records: true },
    });
    if (existing) return { session: existing, didCreate: false };

    const created = await tx.studentAttendanceSession.create({
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
    return { session: created, didCreate: true };
  });

  if (didCreate) {
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
  }

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
  if (!admin) {
    await ensureTeacherAssignedToClassSection({
      schoolId: params.schoolId,
      userId: params.actorId,
      classId: session.classId,
      sectionId: session.sectionId ?? undefined,
      date: session.date,
    });
  }

  if (!params.unlock && params.records.length === 0) {
    throw new HttpError(400, 'Attendance records are required');
  }

  if (session.status === 'LOCKED' && !params.unlock) {
    if (params.submit) {
      const current = await prisma.studentAttendanceRecord.findMany({
        where: { sessionId: session.id },
        select: { studentId: true, status: true, remarks: true },
      });
      if (isSameRecordSet(current, params.records)) {
        return prisma.studentAttendanceSession.findFirstOrThrow({
          where: { id: session.id, schoolId: params.schoolId },
          include: { records: true },
        });
      }
    }
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
  const uniqueStudentIds = new Set(studentIds);
  if (uniqueStudentIds.size !== studentIds.length) {
    throw new HttpError(400, 'Duplicate student entries are not allowed');
  }
  const students = await prisma.student.findMany({
    where: {
      schoolId: params.schoolId,
      id: { in: [...uniqueStudentIds] },
      classId: session.classId,
      ...(session.sectionId ? { sectionId: session.sectionId } : {}),
    },
    select: { id: true },
  });
  if (students.length !== uniqueStudentIds.size) {
    throw new HttpError(400, 'All students must belong to selected class and section');
  }

  const beforeState = await prisma.studentAttendanceRecord.findMany({
    where: { sessionId: session.id },
    select: { studentId: true, status: true, remarks: true },
  });
  const previousStatusByStudent = new Map(
    beforeState.map((record) => [record.studentId, record.status]),
  );

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

  await sendAttendanceAbsenceParentAlerts({
    schoolId: params.schoolId,
    actorId: params.actorId,
    date: session.date,
    unitLabel: 'Daily Session',
    sessionId: session.id,
    source: 'legacy-attendance',
    absentRecords: params.records.map((record) => ({
      studentId: record.studentId,
      status: record.status,
      previousStatus: previousStatusByStudent.get(record.studentId) ?? null,
      remarks: record.remarks,
    })),
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
  actorId?: string;
  actorRole?: string;
}) => {
  const date = params.date ? normalizeDate(params.date) : undefined;
  let classId: string | string[] | undefined;
  let classSectionPairs: Array<{ classId: string; sectionId: string | null }> | undefined;

  if (params.actorRole && !isAdminRole(params.actorRole) && params.actorId) {
    const teacher = await getTeacherProfile(params.schoolId, params.actorId);
    const assignments = await prisma.assignSubject.findMany({
      where: { schoolId: params.schoolId, teacherId: teacher.id },
      select: { classId: true, sectionId: true },
    });

    if (assignments.length === 0) {
      return {
        totals: { sessions: 0, records: 0, present: 0, absent: 0, late: 0, halfDay: 0 },
        sessions: [],
      };
    }

    const pairs = assignments.map((row) => ({
      classId: row.classId,
      sectionId: row.sectionId ?? null,
    }));

    const hasSectionScoped = pairs.some((pair) => pair.sectionId);
    if (!hasSectionScoped) {
      classId = pairs.map((pair) => pair.classId);
    } else {
      classSectionPairs = pairs;
    }
  }

  const sessions = await attendanceReadService.getSessionAttendanceOverview({
    schoolId: params.schoolId,
    date,
    classId,
    classSectionPairs,
  });

  const counts = sessions.flatMap((s) => s.records).reduce<Record<string, number>>((acc, rec) => {
    acc[rec.status] = (acc[rec.status] ?? 0) + 1;
    return acc;
  }, {});

  return {
    totals: {
      sessions: sessions.length,
      records: sessions.reduce((sum, s) => sum + s.recordCount, 0),
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
      className: s.className,
      sectionId: s.sectionId,
      sectionName: s.sectionName,
      lockedAt: s.lockedAt,
      lockReason: s.lockReason,
      recordCount: s.recordCount,
    })),
  };
};

export const markTeacherSelfAttendance = async (params: {
  schoolId: string;
  actorId: string;
  actorRole: string;
  status: TeacherSelfAttendanceStatus;
  date?: Date | string;
  unitType?: AttendanceUnitType;
  slotType?: 'MORNING' | 'AFTERNOON' | null;
  periodId?: string | null;
  teacherId?: string;
  overrideReason?: string;
  leaveRequestId?: string;
}) => {
  const date = normalizeDate(params.date);
  const isAdmin = isAdminRole(params.actorRole);
  const teacherProfile = params.teacherId
      ? await prisma.teacherProfile.findFirst({
        where: { id: params.teacherId, schoolId: params.schoolId, isActive: true },
        select: { id: true, userId: true, roleName: true },
      })
    : await getTeacherProfile(params.schoolId, params.actorId);

  if (!teacherProfile) throw new HttpError(404, 'Teacher not found');
  if (!isAdmin && teacherProfile.userId !== params.actorId) throw new HttpError(403, 'Teachers can only mark self attendance');
  if (isAdmin && teacherProfile.userId !== params.actorId && !params.overrideReason?.trim()) {
    throw new HttpError(400, 'Override reason is required');
  }

  const configuration = await resolveStaffAttendanceConfiguration(params.schoolId, teacherProfile.roleName, date);
  const units = await resolveStaffAttendanceUnits(params.schoolId, configuration.mode);
  const unitType = params.unitType ?? 'DAY';
  const unitKey = staffAttendanceUnitKey(unitType, params.slotType, params.periodId);
  const selectedUnit = units.find((unit) => unit.unitKey === unitKey);
  if (!selectedUnit) throw new HttpError(400, 'Requested self attendance unit is not valid for your role and date');

  const existing = await prisma.staffAttendance.findUnique({
    where: { schoolId_staffId_attendanceDate_unitKey: { schoolId: params.schoolId, staffId: teacherProfile.id, attendanceDate: date, unitKey } },
  });

  const attendance = await prisma.staffAttendance.upsert({
    where: { schoolId_staffId_attendanceDate_unitKey: { schoolId: params.schoolId, staffId: teacherProfile.id, attendanceDate: date, unitKey } },
    create: {
      schoolId: params.schoolId,
      staffId: teacherProfile.id,
      attendanceDate: date,
      mode: configuration.mode,
      unitType,
      slotType: unitType === 'SLOT' ? params.slotType ?? null : null,
      periodId: unitType === 'PERIOD' ? params.periodId ?? null : null,
      unitKey,
      status: params.status,
      note: params.overrideReason ?? null,
      markedById: params.actorId,
    },
    update: {
      mode: configuration.mode,
      unitType,
      slotType: unitType === 'SLOT' ? params.slotType ?? null : null,
      periodId: unitType === 'PERIOD' ? params.periodId ?? null : null,
      status: params.status,
      note: params.overrideReason ?? null,
      markedById: params.actorId,
    },
  });

  await createAuditLog({
    schoolId: params.schoolId,
    actorId: params.actorId,
    actorRole: params.actorRole,
    entityType: 'TeacherSelfAttendance',
    entityId: attendance.id,
    action: existing ? 'UPDATE' : 'CREATE',
    beforeState: existing ? { status: existing.status, note: existing.note, unitKey: existing.unitKey } : null,
    afterState: { status: attendance.status, date: attendance.attendanceDate.toISOString(), note: attendance.note, unitKey: attendance.unitKey },
  });

  return {
    id: attendance.id,
    teacherId: attendance.staffId,
    date: attendance.attendanceDate,
    status: attendance.status,
    overrideReason: attendance.note,
    unitType: attendance.unitType,
    slotType: attendance.slotType,
    periodId: attendance.periodId,
    unitKey: attendance.unitKey,
    mode: attendance.mode,
  };
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
        select: { id: true, userId: true, roleName: true },
      })
    : await getTeacherProfile(params.schoolId, params.actorId);

  if (!teacherProfile) throw new HttpError(404, 'Teacher not found');
  if (!isAdminRole(params.actorRole) && teacherProfile.userId !== params.actorId) {
    throw new HttpError(403, 'Teachers can only view self attendance');
  }

  const fromDate = params.fromDate ? normalizeDate(params.fromDate) : undefined;
  const toDate = params.toDate ? normalizeDate(params.toDate) : undefined;
  const [rows, settings, staffHolidays] = await Promise.all([
    prisma.staffAttendance.findMany({
      where: {
        schoolId: params.schoolId,
        staffId: teacherProfile.id,
        ...(fromDate || toDate
          ? {
              attendanceDate: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: endOfDay(toDate) } : {}),
              },
            }
          : {}),
      },
      include: { period: { select: { id: true, name: true, startTime: true, endTime: true } } },
      orderBy: [{ attendanceDate: 'desc' }, { unitKey: 'asc' }],
    }),
    fromDate && toDate ? prisma.schoolSystemSetting.findUnique({ where: { schoolId: params.schoolId }, select: { holidays: true, weekends: true } }) : Promise.resolve(null),
    fromDate && toDate
      ? prisma.staffAttendanceHoliday.findMany({
          where: {
            schoolId: params.schoolId,
            holidayDate: { gte: fromDate, lt: nextDay(toDate) },
            OR: [{ roleName: null }, { roleName: teacherProfile.roleName }],
          },
        })
      : Promise.resolve([]),
  ]);

  const attendanceRecords = rows.map((row) => ({
    id: row.id,
    teacherId: row.staffId,
    date: row.attendanceDate,
    status: row.status,
    overrideReason: row.note,
    unitType: row.unitType,
    slotType: row.slotType,
    periodId: row.periodId,
    periodName: row.period?.name ?? null,
    unitKey: row.unitKey,
    mode: row.mode,
  }));

  if (!fromDate || !toDate) return attendanceRecords;

  const holidaysByDate = new Map<string, { date: Date; title: string; details?: string | null; type?: string | null }>();
  for (const weekend of parseSystemWeekends(settings, fromDate, toDate)) {
    holidaysByDate.set(toDateKey(weekend.date), weekend);
  }
  for (const holiday of parseSystemHolidays(settings, fromDate, toDate)) {
    holidaysByDate.set(toDateKey(holiday.date), holiday);
  }
  for (const holiday of staffHolidays) {
    const title = holiday.reason ?? 'Staff Holiday';
    holidaysByDate.set(toDateKey(holiday.holidayDate), {
      date: holiday.holidayDate,
      title,
      details: holiday.reason,
      type: 'Staff holiday',
    });
  }
  const holidayDateKeys = new Set(holidaysByDate.keys());
  const visibleAttendanceRecords = attendanceRecords.filter((record) => !holidayDateKeys.has(toDateKey(record.date)));

  const holidayRecords = [...holidaysByDate.entries()]
    .map(([dateKey, holiday]) => ({
      id: `holiday-${dateKey}`,
      teacherId: teacherProfile.id,
      date: holiday.date,
      status: 'HOLIDAY' as const,
      overrideReason: [holiday.title, holiday.details].filter(Boolean).join(' - ') || null,
      unitType: 'DAY' as const,
      slotType: null,
      periodId: null,
      periodName: holiday.type ?? 'Holiday',
      unitKey: 'HOLIDAY',
      mode: 'DAILY' as const,
    }));

  return [...visibleAttendanceRecords, ...holidayRecords].sort((a, b) => {
    const dateCompare = b.date.getTime() - a.date.getTime();
    if (dateCompare !== 0) return dateCompare;
    return a.unitKey.localeCompare(b.unitKey);
  });
};

export const resolveTeacherSelfAttendanceOptions = async (params: {
  schoolId: string;
  actorId: string;
  actorRole: string;
  date?: Date | string;
  teacherId?: string;
}) => {
  const date = normalizeDate(params.date);
  const isAdmin = isAdminRole(params.actorRole);
  const teacherProfile = params.teacherId
    ? await prisma.teacherProfile.findFirst({
        where: { id: params.teacherId, schoolId: params.schoolId, isActive: true },
        select: { id: true, userId: true, roleName: true },
      })
    : await getTeacherProfile(params.schoolId, params.actorId);

  if (!teacherProfile) throw new HttpError(404, 'Teacher not found');
  if (!isAdmin && teacherProfile.userId !== params.actorId) throw new HttpError(403, 'Teachers can only view self attendance options');

  const configuration = await resolveStaffAttendanceConfiguration(params.schoolId, teacherProfile.roleName, date);
  const units = await resolveStaffAttendanceUnits(params.schoolId, configuration.mode);
  return { configuration, units };
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
    const existingByDay = await prisma.teacherSelfAttendance.findMany({
      where: {
        schoolId: leave.schoolId,
        teacherId: leave.teacherId,
        date: { in: dates },
      },
      select: { id: true, date: true, status: true, overrideReason: true },
    });
    const existingMap = new Map(existingByDay.map((item) => [normalizeDate(item.date).toISOString(), item]));
    const upserted = await prisma.$transaction(
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

    await Promise.all(
      upserted.map((attendance) => {
        const previous = existingMap.get(normalizeDate(attendance.date).toISOString());
        return createAuditLog({
          schoolId: leave.schoolId,
          actorId: params.actorId,
          actorRole: params.actorRole,
          entityType: 'TeacherSelfAttendance',
          entityId: attendance.id,
          action: previous ? 'UPDATE' : 'CREATE',
          beforeState: previous
            ? {
                status: previous.status,
                overrideReason: previous.overrideReason,
              }
            : null,
          afterState: {
            status: attendance.status,
            leaveRequestId: attendance.leaveRequestId,
            overrideReason: attendance.overrideReason,
          },
        });
      }),
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

export const __attendanceP1Internals = {
  normalizeDate,
  endOfDay,
  isSameRecordSet,
};
