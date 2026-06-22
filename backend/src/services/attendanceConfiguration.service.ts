import type { AttendanceConfigurationScope, AttendanceMode, Prisma } from '@prisma/client';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { createAuditLog } from './auditLog.service';

type Actor = {
  actorId: string;
  actorRole: string;
};

type ConfigurationInput = {
  schoolId: string;
  scope: AttendanceConfigurationScope;
  mode: AttendanceMode;
  academicYearId?: string | null;
  classId?: string | null;
  sectionId?: string | null;
  effectiveFrom: Date | string;
  effectiveTo?: Date | string | null;
  isActive?: boolean;
};

type ConfigurationPatch = Partial<Omit<ConfigurationInput, 'schoolId'>> & { schoolId: string };
type BulkApplyInput = {
  schoolId: string;
  scope: 'SCHOOL' | 'ACADEMIC_YEAR';
  mode: AttendanceMode;
  academicYearId: string;
  effectiveFrom: Date | string;
  effectiveTo?: Date | string | null;
  replaceExisting?: boolean;
};
type BulkTarget = {
  scope: 'CLASS' | 'SECTION';
  classId: string;
  sectionId: string | null;
};

const toDateOnly = (value: Date | string) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, 'Invalid date');
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const normalizeTarget = (input: ConfigurationInput | ConfigurationPatch) => {
  const scope = input.scope;
  if (!scope) return input;
  return {
    ...input,
    academicYearId: scope === 'SCHOOL' ? null : input.academicYearId ?? null,
    classId: scope === 'CLASS' || scope === 'SECTION' ? input.classId ?? null : null,
    sectionId: scope === 'SECTION' ? input.sectionId ?? null : null,
  };
};

const assertDateRange = (effectiveFrom: Date, effectiveTo?: Date | null) => {
  if (effectiveTo && effectiveTo < effectiveFrom) {
    throw new HttpError(400, 'effectiveTo cannot be earlier than effectiveFrom');
  }
};

const assertScopeTarget = async (input: ConfigurationInput) => {
  if (input.scope !== 'SCHOOL' && !input.academicYearId) {
    throw new HttpError(400, 'academicYearId is required for this scope');
  }
  if ((input.scope === 'CLASS' || input.scope === 'SECTION') && !input.classId) {
    throw new HttpError(400, 'classId is required for this scope');
  }
  if (input.scope === 'SECTION' && !input.sectionId) {
    throw new HttpError(400, 'sectionId is required for SECTION scope');
  }

  if (input.academicYearId) {
    const year = await prisma.academicYear.findFirst({
      where: { id: input.academicYearId, schoolId: input.schoolId },
      select: { id: true },
    });
    if (!year) throw new HttpError(404, 'Academic year not found');
  }

  if (input.classId) {
    const klass = await prisma.class.findFirst({
      where: {
        id: input.classId,
        schoolId: input.schoolId,
      },
      select: { id: true },
    });
    if (!klass) throw new HttpError(404, 'Class not found');
  }

  if (input.sectionId) {
    const section = await prisma.section.findFirst({
      where: {
        id: input.sectionId,
        schoolId: input.schoolId,
      },
      select: { id: true },
    });
    if (!section) throw new HttpError(404, 'Section not found');
  }
};

const overlapWhere = (input: ConfigurationInput, excludeId?: string): Prisma.AttendanceConfigurationWhereInput => ({
  schoolId: input.schoolId,
  isActive: true,
  ...(excludeId ? { id: { not: excludeId } } : {}),
  scope: input.scope,
  academicYearId: input.academicYearId ?? null,
  classId: input.classId ?? null,
  sectionId: input.sectionId ?? null,
  effectiveFrom: { lte: input.effectiveTo ?? new Date('9999-12-31T00:00:00.000Z') },
  OR: [{ effectiveTo: null }, { effectiveTo: { gte: input.effectiveFrom as Date } }],
});

const assertNoOverlap = async (input: ConfigurationInput, excludeId?: string) => {
  if (input.isActive === false) return;
  const duplicate = await prisma.attendanceConfiguration.findFirst({
    where: overlapWhere(input, excludeId),
    select: { id: true, effectiveFrom: true, effectiveTo: true },
  });
  if (duplicate) {
    throw new HttpError(409, 'Attendance configuration overlaps with an existing active configuration');
  }
};

const hasRecordedSessions = async (id: string) =>
  prisma.attendanceSession.count({
    where: { configurationId: id },
  });

export const listAttendanceConfigurations = async (params: {
  schoolId: string;
  academicYearId?: string;
  classId?: string;
  sectionId?: string;
  active?: boolean;
}) => {
  return prisma.attendanceConfiguration.findMany({
    where: {
      schoolId: params.schoolId,
      ...(params.academicYearId ? { academicYearId: params.academicYearId } : {}),
      ...(params.classId ? { classId: params.classId } : {}),
      ...(params.sectionId ? { sectionId: params.sectionId } : {}),
      ...(typeof params.active === 'boolean' ? { isActive: params.active } : {}),
    },
    include: {
      academicYear: { select: { id: true, name: true } },
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      slots: { orderBy: { sequence: 'asc' } },
    },
    orderBy: [{ scope: 'desc' }, { effectiveFrom: 'desc' }, { updatedAt: 'desc' }],
  });
};

export const createAttendanceConfiguration = async (input: ConfigurationInput & Actor) => {
  const normalized = normalizeTarget({
    ...input,
    effectiveFrom: toDateOnly(input.effectiveFrom),
    effectiveTo: input.effectiveTo ? toDateOnly(input.effectiveTo) : null,
    isActive: input.isActive ?? true,
  }) as ConfigurationInput;
  assertDateRange(normalized.effectiveFrom as Date, normalized.effectiveTo as Date | null);
  await assertScopeTarget(normalized);
  await assertNoOverlap(normalized);

  const created = await prisma.attendanceConfiguration.create({
    data: {
      schoolId: normalized.schoolId,
      scope: normalized.scope,
      mode: normalized.mode,
      academicYearId: normalized.academicYearId ?? null,
      classId: normalized.classId ?? null,
      sectionId: normalized.sectionId ?? null,
      effectiveFrom: normalized.effectiveFrom as Date,
      effectiveTo: (normalized.effectiveTo as Date | null) ?? null,
      isActive: normalized.isActive ?? true,
      createdById: input.actorId,
      updatedById: input.actorId,
    },
  });

  await createAuditLog({
    schoolId: input.schoolId,
    actorId: input.actorId,
    actorRole: input.actorRole,
    entityType: 'AttendanceConfiguration',
    entityId: created.id,
    action: 'CREATE',
    afterState: created as unknown as Prisma.InputJsonValue,
  });

  return created;
};

const resolveBulkTargets = async (schoolId: string): Promise<BulkTarget[]> => {
  const [classes, sections] = await Promise.all([
    prisma.class.findMany({
      where: { schoolId },
      select: { id: true },
      orderBy: { name: 'asc' },
    }),
    prisma.section.findMany({
      where: { schoolId },
      select: {
        id: true,
        classId: true,
        classSections: { select: { classId: true } },
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  const targets: BulkTarget[] = [];
  for (const klass of classes) {
    const classSections = sections.filter((section) =>
      section.classId === klass.id || section.classSections.some((link) => link.classId === klass.id),
    );
    if (!classSections.length) {
      targets.push({ scope: 'CLASS', classId: klass.id, sectionId: null });
      continue;
    }
    for (const section of classSections) {
      targets.push({ scope: 'SECTION', classId: klass.id, sectionId: section.id });
    }
  }
  return targets;
};

const overlappingDateWhere = (effectiveFrom: Date, effectiveTo?: Date | null) => ({
  effectiveFrom: { lte: effectiveTo ?? new Date('9999-12-31T00:00:00.000Z') },
  OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }],
});

export const bulkApplyAttendanceConfiguration = async (input: BulkApplyInput & Actor) => {
  const effectiveFrom = toDateOnly(input.effectiveFrom);
  const effectiveTo = input.effectiveTo ? toDateOnly(input.effectiveTo) : null;
  assertDateRange(effectiveFrom, effectiveTo);

  const year = await prisma.academicYear.findFirst({
    where: { id: input.academicYearId, schoolId: input.schoolId },
    select: { id: true },
  });
  if (!year) throw new HttpError(404, 'Academic year not found');

  const targets = await resolveBulkTargets(input.schoolId);
  if (!targets.length) throw new HttpError(400, 'No classes found for this school');

  const created = await prisma.$transaction(async (tx) => {
    if (input.replaceExisting) {
      await tx.attendanceConfiguration.updateMany({
        where: {
          schoolId: input.schoolId,
          academicYearId: input.academicYearId,
          isActive: true,
          AND: [
            overlappingDateWhere(effectiveFrom, effectiveTo),
            {
              OR: [
                { scope: 'ACADEMIC_YEAR', classId: null, sectionId: null },
                ...targets.map((target) => ({
                  scope: target.scope,
                  classId: target.classId,
                  sectionId: target.sectionId,
                })),
              ],
            },
          ],
        },
        data: { isActive: false, updatedById: input.actorId },
      });
    } else {
      const duplicate = await tx.attendanceConfiguration.findFirst({
        where: {
          schoolId: input.schoolId,
          academicYearId: input.academicYearId,
          isActive: true,
          AND: [
            overlappingDateWhere(effectiveFrom, effectiveTo),
            {
              OR: targets.map((target) => ({
                scope: target.scope,
                classId: target.classId,
                sectionId: target.sectionId,
              })),
            },
          ],
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new HttpError(409, 'Attendance configuration overlaps with an existing active configuration. Enable replace to deactivate old active configs.');
      }
    }

    await tx.attendanceConfiguration.createMany({
      data: targets.map((target) => ({
        schoolId: input.schoolId,
        scope: target.scope,
        mode: input.mode,
        academicYearId: input.academicYearId,
        classId: target.classId,
        sectionId: target.sectionId,
        effectiveFrom,
        effectiveTo,
        isActive: true,
        createdById: input.actorId,
        updatedById: input.actorId,
      })),
    });

    return tx.attendanceConfiguration.findMany({
      where: {
        schoolId: input.schoolId,
        academicYearId: input.academicYearId,
        effectiveFrom,
        mode: input.mode,
        isActive: true,
        OR: targets.map((target) => ({
          scope: target.scope,
          classId: target.classId,
          sectionId: target.sectionId,
        })),
      },
      include: {
        academicYear: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        slots: { orderBy: { sequence: 'asc' } },
      },
      orderBy: [{ class: { name: 'asc' } }, { section: { name: 'asc' } }],
    });
  });

  await createAuditLog({
    schoolId: input.schoolId,
    actorId: input.actorId,
    actorRole: input.actorRole,
    entityType: 'AttendanceConfiguration',
    entityId: `bulk:${input.academicYearId}:${effectiveFrom.toISOString().slice(0, 10)}`,
    action: input.replaceExisting ? 'BULK_REPLACE' : 'BULK_CREATE',
    afterState: {
      mode: input.mode,
      academicYearId: input.academicYearId,
      effectiveFrom,
      effectiveTo,
      createdCount: created.length,
      replaceExisting: Boolean(input.replaceExisting),
    } as unknown as Prisma.InputJsonValue,
  });

  return created;
};

export const updateAttendanceConfiguration = async (id: string, patch: ConfigurationPatch & Actor) => {
  const existing = await prisma.attendanceConfiguration.findFirst({
    where: { id, schoolId: patch.schoolId },
  });
  if (!existing) throw new HttpError(404, 'Attendance configuration not found');

  const recordedSessions = await hasRecordedSessions(existing.id);
  const historySensitiveKeys: Array<keyof ConfigurationPatch> = [
    'scope',
    'mode',
    'academicYearId',
    'classId',
    'sectionId',
    'effectiveFrom',
    'effectiveTo',
  ];
  if (recordedSessions > 0 && historySensitiveKeys.some((key) => patch[key] !== undefined)) {
    throw new HttpError(409, 'Cannot change configuration identity, mode, or effective dates after attendance has been recorded');
  }

  const next = normalizeTarget({
    schoolId: patch.schoolId,
    scope: patch.scope ?? existing.scope,
    mode: patch.mode ?? existing.mode,
    academicYearId: patch.academicYearId !== undefined ? patch.academicYearId : existing.academicYearId,
    classId: patch.classId !== undefined ? patch.classId : existing.classId,
    sectionId: patch.sectionId !== undefined ? patch.sectionId : existing.sectionId,
    effectiveFrom: patch.effectiveFrom ? toDateOnly(patch.effectiveFrom) : existing.effectiveFrom,
    effectiveTo: patch.effectiveTo === undefined ? existing.effectiveTo : patch.effectiveTo ? toDateOnly(patch.effectiveTo) : null,
    isActive: patch.isActive ?? existing.isActive,
  }) as ConfigurationInput;

  assertDateRange(next.effectiveFrom as Date, next.effectiveTo as Date | null);
  await assertScopeTarget(next);
  await assertNoOverlap(next, existing.id);

  const updated = await prisma.attendanceConfiguration.update({
    where: { id: existing.id },
    data: {
      scope: next.scope,
      mode: next.mode,
      academicYearId: next.academicYearId ?? null,
      classId: next.classId ?? null,
      sectionId: next.sectionId ?? null,
      effectiveFrom: next.effectiveFrom as Date,
      effectiveTo: (next.effectiveTo as Date | null) ?? null,
      isActive: next.isActive ?? true,
      updatedById: patch.actorId,
    },
  });

  await createAuditLog({
    schoolId: patch.schoolId,
    actorId: patch.actorId,
    actorRole: patch.actorRole,
    entityType: 'AttendanceConfiguration',
    entityId: updated.id,
    action: 'UPDATE',
    beforeState: existing as unknown as Prisma.InputJsonValue,
    afterState: updated as unknown as Prisma.InputJsonValue,
  });

  return updated;
};

export const deactivateAttendanceConfiguration = async (params: { id: string; schoolId: string } & Actor) => {
  const existing = await prisma.attendanceConfiguration.findFirst({
    where: { id: params.id, schoolId: params.schoolId },
  });
  if (!existing) throw new HttpError(404, 'Attendance configuration not found');
  if (!existing.isActive) return existing;

  const updated = await prisma.attendanceConfiguration.update({
    where: { id: existing.id },
    data: { isActive: false, updatedById: params.actorId },
  });

  await createAuditLog({
    schoolId: params.schoolId,
    actorId: params.actorId,
    actorRole: params.actorRole,
    entityType: 'AttendanceConfiguration',
    entityId: updated.id,
    action: 'DEACTIVATE',
    beforeState: { isActive: existing.isActive },
    afterState: { isActive: updated.isActive },
  });

  return updated;
};
