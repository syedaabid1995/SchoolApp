import type {
  AttendanceConfiguration,
  AttendanceMode,
  AttendanceSlot,
  AttendanceSlotType,
  AttendanceStatus,
  AttendanceUnitType,
  Prisma,
} from '@prisma/client';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { ensureTeacherAssignedToClassSection, isAdminRole } from './attendanceP1.service';
import { createAuditLog } from './auditLog.service';

type AttendanceScopeParams = {
  schoolId: string;
  academicYearId: string;
  classId: string;
  sectionId?: string | null;
  date: Date | string;
};

type AttendanceUnitInput = {
  unitType: AttendanceUnitType;
  slotId?: string | null;
  slotType?: AttendanceSlotType | null;
  periodId?: string | null;
  timetableEntryId?: string | null;
};

type AttendanceRecordInput = {
  studentId: string;
  status: AttendanceStatus;
  confidence?: number;
  manualOverrideReason?: string;
};

type AttendanceActor = {
  actorId: string;
  actorRole: string;
};

type ResolvedConfiguration = {
  id: string | null;
  mode: AttendanceMode;
  source: 'SECTION' | 'CLASS' | 'ACADEMIC_YEAR' | 'SCHOOL' | 'DEFAULT';
  configuration: AttendanceConfiguration | null;
};

type ResolvedUnit = {
  unitType: AttendanceUnitType;
  label: string;
  slotId?: string | null;
  slotType?: AttendanceSlotType | null;
  periodId?: string | null;
  timetableEntryId?: string | null;
  subjectId?: string | null;
  teacherId?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  source: 'DAY' | 'SLOT' | 'TIMETABLE_ENTRY' | 'PERIOD_FALLBACK';
};

const DEFAULT_CLASS_PERIODS = [
  { name: '1ST PERIOD', startTime: '09:00', endTime: '09:45' },
  { name: '2ND PERIOD', startTime: '09:45', endTime: '10:30' },
  { name: '3RD PERIOD', startTime: '10:45', endTime: '11:30' },
  { name: '4TH PERIOD', startTime: '11:30', endTime: '12:15' },
  { name: '5TH PERIOD', startTime: '13:00', endTime: '13:45' },
  { name: '6TH PERIOD', startTime: '13:45', endTime: '14:30' },
  { name: '7TH PERIOD', startTime: '14:30', endTime: '15:15' },
];

const toDateOnly = (value: Date | string) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, 'Invalid date');
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const toDateKey = (value: Date | string) => toDateOnly(value).toISOString().slice(0, 10);

const schoolTimeZone = process.env.SCHOOL_TIME_ZONE || 'Asia/Kolkata';

const currentSchoolDateKey = () => {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: schoolTimeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;
    if (year && month && day) return `${year}-${month}-${day}`;
  } catch {
    // Fall back to UTC if an invalid timezone is configured.
  }
  return toDateKey(new Date());
};

const toDayOfWeek = (date: Date) => {
  const day = date.getUTCDay();
  return day === 6 ? 1 : day + 2;
};

const requirePastOrToday = (date: Date) => {
  if (toDateKey(date) > currentSchoolDateKey()) {
    throw new HttpError(400, 'Cannot record attendance for a future date');
  }
};

const ensureClassSection = async (params: AttendanceScopeParams) => {
  const sectionId = params.sectionId ?? null;
  const klass = await prisma.class.findFirst({
    where: {
      id: params.classId,
      schoolId: params.schoolId,
    },
    select: { id: true, name: true, academicYearId: true, sections: { select: { id: true }, take: 1 } },
  });
  if (!klass) throw new HttpError(404, 'Class not found');

  if (sectionId) {
    const section = await prisma.section.findFirst({
      where: { id: sectionId, schoolId: params.schoolId },
      select: { id: true, name: true },
    });
    if (!section) throw new HttpError(404, 'Section not found');
    return { class: klass, section };
  }

  if (klass.sections.length > 0) {
    throw new HttpError(400, 'sectionId is required for classes with sections');
  }

  return { class: klass, section: null };
};

const scopeRank: Record<ResolvedConfiguration['source'], number> = {
  SECTION: 4,
  CLASS: 3,
  ACADEMIC_YEAR: 2,
  SCHOOL: 1,
  DEFAULT: 0,
};

const mapConfigurationSource = (config: AttendanceConfiguration): ResolvedConfiguration['source'] => {
  if (config.scope === 'SECTION') return 'SECTION';
  if (config.scope === 'CLASS') return 'CLASS';
  if (config.scope === 'ACADEMIC_YEAR') return 'ACADEMIC_YEAR';
  return 'SCHOOL';
};

export const resolveAttendanceConfiguration = async (params: AttendanceScopeParams): Promise<ResolvedConfiguration> => {
  const date = toDateOnly(params.date);
  await ensureClassSection({ ...params, date });

  const rows = await prisma.attendanceConfiguration.findMany({
    where: {
      schoolId: params.schoolId,
      isActive: true,
      effectiveFrom: { lte: date },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
      AND: [
        {
          OR: [
            {
              scope: 'SECTION',
              academicYearId: params.academicYearId,
              classId: params.classId,
              sectionId: params.sectionId ?? null,
            },
            {
              scope: 'CLASS',
              academicYearId: params.academicYearId,
              classId: params.classId,
              sectionId: null,
            },
            {
              scope: 'ACADEMIC_YEAR',
              academicYearId: params.academicYearId,
              classId: null,
              sectionId: null,
            },
            {
              scope: 'SCHOOL',
              academicYearId: null,
              classId: null,
              sectionId: null,
            },
          ],
        },
      ],
    },
    orderBy: [{ effectiveFrom: 'desc' }, { updatedAt: 'desc' }],
  });

  const selected = rows
    .map((row) => ({ row, source: mapConfigurationSource(row) }))
    .sort((a, b) => {
      const rankCompare = scopeRank[b.source] - scopeRank[a.source];
      if (rankCompare) return rankCompare;
      const effectiveCompare = b.row.effectiveFrom.getTime() - a.row.effectiveFrom.getTime();
      if (effectiveCompare) return effectiveCompare;
      return b.row.updatedAt.getTime() - a.row.updatedAt.getTime();
    })[0];

  if (!selected) {
    const configuration = await prisma.attendanceConfiguration.create({
      data: {
        schoolId: params.schoolId,
        scope: 'SCHOOL',
        mode: 'TWICE_DAILY',
        effectiveFrom: new Date('2000-01-01T00:00:00.000Z'),
        isActive: true,
      },
    });
    return {
      id: configuration.id,
      mode: configuration.mode,
      source: 'DEFAULT',
      configuration,
    };
  }

  return {
    id: selected.row.id,
    mode: selected.row.mode,
    source: selected.source,
    configuration: selected.row,
  };
};

const ensureFixedSlots = async (configuration: AttendanceConfiguration): Promise<AttendanceSlot[]> => {
  const morning = await prisma.attendanceSlot.upsert({
    where: { configurationId_type: { configurationId: configuration.id, type: 'MORNING' } },
    update: { isActive: true, name: 'Morning' },
    create: {
      schoolId: configuration.schoolId,
      configurationId: configuration.id,
      type: 'MORNING',
      name: 'Morning',
      sequence: 1,
    },
  });
  const afternoon = await prisma.attendanceSlot.upsert({
    where: { configurationId_type: { configurationId: configuration.id, type: 'AFTERNOON' } },
    update: { isActive: true, name: 'Afternoon' },
    create: {
      schoolId: configuration.schoolId,
      configurationId: configuration.id,
      type: 'AFTERNOON',
      name: 'Afternoon',
      sequence: 2,
    },
  });
  return [morning, afternoon];
};

const ensureDefaultClassPeriods = async (schoolId: string) => {
  for (const period of DEFAULT_CLASS_PERIODS) {
    await prisma.attendancePeriod.upsert({
      where: { schoolId_type_name: { schoolId, type: 'CLASS_TIME', name: period.name } },
      update: {
        startTime: period.startTime,
        endTime: period.endTime,
      },
      create: {
        schoolId,
        type: 'CLASS_TIME',
        name: period.name,
        startTime: period.startTime,
        endTime: period.endTime,
      },
    });
  }
  return prisma.attendancePeriod.findMany({
    where: { schoolId, type: 'CLASS_TIME' },
    orderBy: [{ startTime: 'asc' }],
  });
};

export const resolveAttendanceUnits = async (params: AttendanceScopeParams) => {
  const date = toDateOnly(params.date);
  const resolvedConfiguration = await resolveAttendanceConfiguration({ ...params, date });

  if (resolvedConfiguration.mode === 'DAILY') {
    return {
      configuration: resolvedConfiguration,
      units: [{ unitType: 'DAY', label: 'Day', source: 'DAY' } satisfies ResolvedUnit],
    };
  }

  if (resolvedConfiguration.mode === 'TWICE_DAILY') {
    if (!resolvedConfiguration.configuration) {
      throw new HttpError(400, 'Twice daily attendance requires an attendance configuration');
    }
    const existingSlots = await prisma.attendanceSlot.findMany({
      where: { configurationId: resolvedConfiguration.configuration.id, isActive: true },
      orderBy: [{ sequence: 'asc' }],
    });
    const slots = existingSlots.length >= 2 ? existingSlots : await ensureFixedSlots(resolvedConfiguration.configuration);
    return {
      configuration: resolvedConfiguration,
      units: slots.map((slot) => ({
        unitType: 'SLOT',
        label: slot.name,
        slotId: slot.id,
        slotType: slot.type,
        startTime: slot.startTime,
        endTime: slot.endTime,
        source: 'SLOT',
      })) satisfies ResolvedUnit[],
    };
  }

  const dayOfWeek = toDayOfWeek(date);
  const version = await prisma.timetableVersion.findFirst({
    where: {
      schoolId: params.schoolId,
      academicYearId: params.academicYearId,
      status: 'PUBLISHED',
      effectiveFrom: { lte: date },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
    },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    select: { id: true },
  });

  if (version) {
    const entries = await prisma.timetableEntry.findMany({
      where: {
        schoolId: params.schoolId,
        academicYearId: params.academicYearId,
        classId: params.classId,
        sectionId: params.sectionId ?? null,
        timetableVersionId: version.id,
        dayOfWeek,
        isActive: true,
      },
      include: {
        period: { select: { id: true, name: true, startTime: true, endTime: true } },
        subject: { select: { id: true, name: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ period: { startTime: 'asc' } }],
    });

    if (entries.length > 0) {
      return {
        configuration: resolvedConfiguration,
        units: entries.map((entry) => ({
          unitType: 'TIMETABLE_ENTRY',
          label: `${entry.period.name} - ${entry.subject.name}`,
          timetableEntryId: entry.id,
          periodId: entry.attendancePeriodId,
          subjectId: entry.subjectId,
          teacherId: entry.teacherId,
          startTime: entry.period.startTime,
          endTime: entry.period.endTime,
          source: 'TIMETABLE_ENTRY',
        })) satisfies ResolvedUnit[],
      };
    }
  }

  let periods = await prisma.attendancePeriod.findMany({
    where: { schoolId: params.schoolId, type: 'CLASS_TIME' },
    orderBy: [{ startTime: 'asc' }],
  });
  if (!periods.length) {
    periods = await ensureDefaultClassPeriods(params.schoolId);
  }

  return {
    configuration: resolvedConfiguration,
    units: periods.map((period) => ({
      unitType: 'PERIOD',
      label: period.name,
      periodId: period.id,
      startTime: period.startTime,
      endTime: period.endTime,
      source: 'PERIOD_FALLBACK',
    })) satisfies ResolvedUnit[],
  };
};

const matchesUnit = (candidate: ResolvedUnit, input: AttendanceUnitInput) => {
  if (candidate.unitType !== input.unitType) return false;
  if (input.unitType === 'DAY') return true;
  if (input.unitType === 'SLOT') {
    return Boolean((input.slotId && candidate.slotId === input.slotId) || (input.slotType && candidate.slotType === input.slotType));
  }
  if (input.unitType === 'PERIOD') return candidate.periodId === input.periodId;
  return candidate.timetableEntryId === input.timetableEntryId;
};

const resolveRequestedUnit = async (params: AttendanceScopeParams & AttendanceUnitInput) => {
  const resolved = await resolveAttendanceUnits(params);
  const unit = resolved.units.find((candidate) => matchesUnit(candidate, params));
  if (!unit) throw new HttpError(400, 'Requested attendance unit is not valid for this class, section and date');
  return { ...resolved, unit };
};

const sessionWhere = (params: AttendanceScopeParams & AttendanceUnitInput) => ({
  schoolId: params.schoolId,
  academicYearId: params.academicYearId,
  classId: params.classId,
  sectionId: params.sectionId ?? null,
  date: toDateOnly(params.date),
  unitType: params.unitType,
  slotId: params.unitType === 'SLOT' ? params.slotId ?? null : null,
  periodId: params.unitType === 'PERIOD' ? params.periodId ?? null : params.unitType === 'TIMETABLE_ENTRY' ? params.periodId ?? null : null,
  timetableEntryId: params.unitType === 'TIMETABLE_ENTRY' ? params.timetableEntryId ?? null : null,
});

const loadStudents = async (params: AttendanceScopeParams) => {
  return prisma.student.findMany({
    where: {
      schoolId: params.schoolId,
      classId: params.classId,
      sectionId: params.sectionId ?? null,
      status: 'ENROLLED',
    },
    select: {
      id: true,
      admissionNo: true,
      rollNo: true,
      firstName: true,
      lastName: true,
      fullName: true,
    },
    orderBy: [{ rollNo: 'asc' }, { fullName: 'asc' }],
  });
};

const formatSheet = async (params: AttendanceScopeParams & AttendanceUnitInput) => {
  const resolved = await resolveRequestedUnit(params);
  const session = await prisma.attendanceSession.findFirst({
    where: sessionWhere({ ...params, ...resolved.unit }),
    include: {
      records: {
        include: {
          student: { select: { id: true, admissionNo: true, rollNo: true, firstName: true, lastName: true, fullName: true } },
        },
      },
    },
  });
  const students = await loadStudents(params);
  const recordsByStudent = new Map((session?.records ?? []).map((record) => [record.studentId, record]));

  return {
    configuration: resolved.configuration,
    unit: resolved.unit,
    session: session
      ? {
          id: session.id,
          status: session.status,
          approvalStatus: session.approvalStatus,
          lockedAt: session.lockedAt,
          lockedById: session.lockedById,
          lockReason: session.lockReason,
          date: toDateKey(session.date),
          mode: session.mode,
          unitType: session.unitType,
          slotId: session.slotId,
          periodId: session.periodId,
          timetableEntryId: session.timetableEntryId,
        }
      : null,
    rows: students.map((student) => {
      const record = recordsByStudent.get(student.id);
      return {
        student,
        recordId: record?.id ?? null,
        status: record?.status ?? null,
        confidence: record?.confidence ?? null,
        capturedAt: record?.capturedAt ?? null,
        deviceId: record?.deviceId ?? null,
        manualOverrideReason: record?.manualOverrideReason ?? null,
      };
    }),
  };
};

export const getAttendanceSheet = async (params: AttendanceScopeParams & AttendanceUnitInput) => {
  return formatSheet(params);
};

const ensureRecordStudents = async (params: AttendanceScopeParams & { records: AttendanceRecordInput[] }) => {
  const ids = params.records.map((record) => record.studentId);
  if (new Set(ids).size !== ids.length) throw new HttpError(400, 'Duplicate student records are not allowed');

  const students = await prisma.student.findMany({
    where: {
      id: { in: ids },
      schoolId: params.schoolId,
      classId: params.classId,
      sectionId: params.sectionId ?? null,
      status: 'ENROLLED',
    },
    select: { id: true },
  });
  if (students.length !== ids.length) {
    throw new HttpError(400, 'One or more students do not belong to this class and section');
  }
};

export const saveAttendanceSheet = async (
  params: AttendanceScopeParams &
    AttendanceUnitInput &
    AttendanceActor & {
      records: AttendanceRecordInput[];
      deviceId?: string | null;
      gpsLat?: number | null;
      gpsLng?: number | null;
    },
) => {
  const date = toDateOnly(params.date);
  requirePastOrToday(date);
  await ensureClassSection({ ...params, date });
  if (!isAdminRole(params.actorRole)) {
    await ensureTeacherAssignedToClassSection({
      schoolId: params.schoolId,
      userId: params.actorId,
      classId: params.classId,
      sectionId: params.sectionId ?? undefined,
      date,
    });
  }
  await ensureRecordStudents({ ...params, date });

  const resolved = await resolveRequestedUnit({ ...params, date });
  const normalizedUnit = {
    unitType: resolved.unit.unitType,
    slotId: resolved.unit.unitType === 'SLOT' ? resolved.unit.slotId ?? null : null,
    periodId:
      resolved.unit.unitType === 'PERIOD' || resolved.unit.unitType === 'TIMETABLE_ENTRY'
        ? resolved.unit.periodId ?? null
        : null,
    timetableEntryId: resolved.unit.unitType === 'TIMETABLE_ENTRY' ? resolved.unit.timetableEntryId ?? null : null,
  };

  const deviceId = params.deviceId?.trim() || 'manual';
  const session = await prisma.$transaction(async (tx) => {
    let row = await tx.attendanceSession.findFirst({
      where: sessionWhere({ ...params, date, ...normalizedUnit }),
    });
    if (row?.status === 'CLOSED' || row?.lockedAt) {
      throw new HttpError(409, 'Attendance sheet is locked');
    }

    if (!row) {
      try {
        row = await tx.attendanceSession.create({
          data: {
            schoolId: params.schoolId,
            academicYearId: params.academicYearId,
            classId: params.classId,
            sectionId: params.sectionId ?? null,
            configurationId: resolved.configuration.id,
            mode: resolved.configuration.mode,
            unitType: normalizedUnit.unitType,
            slotId: normalizedUnit.slotId,
            periodId: normalizedUnit.periodId,
            timetableEntryId: normalizedUnit.timetableEntryId,
            date,
            startedById: params.actorId,
            deviceId,
            gpsLat: params.gpsLat ?? null,
            gpsLng: params.gpsLng ?? null,
          },
        });
      } catch (error) {
        if ((error as Prisma.PrismaClientKnownRequestError).code === 'P2002') {
          throw new HttpError(409, 'Attendance sheet already exists for this unit');
        }
        throw error;
      }
    }

    for (const record of params.records) {
      await tx.attendanceRecord.upsert({
        where: { sessionId_studentId: { sessionId: row.id, studentId: record.studentId } },
        create: {
          sessionId: row.id,
          studentId: record.studentId,
          status: record.status,
          confidence: record.confidence ?? null,
          deviceId,
          gpsLat: params.gpsLat ?? null,
          gpsLng: params.gpsLng ?? null,
          manualOverrideReason: record.manualOverrideReason?.trim() || null,
        },
        update: {
          status: record.status,
          confidence: record.confidence ?? null,
          capturedAt: new Date(),
          deviceId,
          gpsLat: params.gpsLat ?? null,
          gpsLng: params.gpsLng ?? null,
          manualOverrideReason: record.manualOverrideReason?.trim() || null,
        },
      });
    }

    return row;
  });

  await createAuditLog({
    schoolId: params.schoolId,
    actorId: params.actorId,
    actorRole: params.actorRole,
    entityType: 'AttendanceSession',
    entityId: session.id,
    action: 'UPDATE',
    afterState: {
      date: toDateKey(date),
      mode: resolved.configuration.mode,
      unitType: normalizedUnit.unitType,
      slotId: normalizedUnit.slotId,
      periodId: normalizedUnit.periodId,
      timetableEntryId: normalizedUnit.timetableEntryId,
      recordCount: params.records.length,
    },
  });

  return formatSheet({ ...params, date, ...normalizedUnit });
};

export const lockAttendanceSheet = async (params: { schoolId: string; sessionId: string; reason?: string | null } & AttendanceActor) => {
  const session = await prisma.attendanceSession.findFirst({
    where: { id: params.sessionId, schoolId: params.schoolId },
  });
  if (!session) throw new HttpError(404, 'Attendance sheet not found');
  if (session.status === 'CLOSED' || session.lockedAt) return session;

  const locked = await prisma.attendanceSession.update({
    where: { id: session.id },
    data: {
      status: 'CLOSED',
      lockedAt: new Date(),
      lockedById: params.actorId,
      lockReason: params.reason?.trim() || null,
    },
  });

  await createAuditLog({
    schoolId: params.schoolId,
    actorId: params.actorId,
    actorRole: params.actorRole,
    entityType: 'AttendanceSession',
    entityId: locked.id,
    action: 'LOCK',
    afterState: { status: locked.status, lockReason: locked.lockReason },
  });

  return locked;
};

export const reopenAttendanceSheet = async (params: { schoolId: string; sessionId: string; reason?: string | null } & AttendanceActor) => {
  if (!isAdminRole(params.actorRole)) {
    throw new HttpError(403, 'Only school administrators can reopen attendance sheets');
  }

  const session = await prisma.attendanceSession.findFirst({
    where: { id: params.sessionId, schoolId: params.schoolId },
  });
  if (!session) throw new HttpError(404, 'Attendance sheet not found');
  if (session.status === 'OPEN' && !session.lockedAt) return session;

  const reopened = await prisma.attendanceSession.update({
    where: { id: session.id },
    data: {
      status: 'OPEN',
      lockedAt: null,
      lockedById: null,
      lockReason: null,
    },
  });

  await createAuditLog({
    schoolId: params.schoolId,
    actorId: params.actorId,
    actorRole: params.actorRole,
    entityType: 'AttendanceSession',
    entityId: reopened.id,
    action: 'REOPEN',
    afterState: { status: reopened.status, reason: params.reason?.trim() || null },
  });

  return reopened;
};
