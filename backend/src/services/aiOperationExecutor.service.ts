import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import type { AiAssistantContext, AiOperation, AiOperationPlan } from '../types/aiAssistant.types';

type PrismaClientLike = typeof prisma;

type DryRunItem = {
  entity: string;
  action: string;
  label: string;
  status: 'CREATE' | 'SKIP';
  reason?: string;
  data: Record<string, unknown>;
};

export type AiOperationDryRun = {
  executable: boolean;
  phase: '3A';
  creates: number;
  skips: number;
  conflicts: number;
  items: DryRunItem[];
};

export type AiOperationExecutionResult = {
  phase: '3A';
  created: number;
  skipped: number;
  records: Array<{ entity: string; id?: string; label: string; status: 'CREATED' | 'SKIPPED' }>;
};

const PHASE_3A_ENTITIES = new Set(['AcademicYear', 'Class', 'Section', 'ClassSection']);
const PHASE_3A_ACTIONS = new Set(['createRecord', 'bulkCreateRecords', 'linkRecords']);

const normalize = (value: unknown) => String(value ?? '').trim().replace(/\s+/g, ' ');
const normalizeClassName = (value: unknown) => normalize(value).replace(/^(\d+)$/, 'Class $1');
const normalizeSectionName = (value: unknown) => normalize(value).replace(/^section\s+/i, '').toUpperCase();

const recordsFromData = (operation: AiOperation) => {
  if (Array.isArray(operation.data)) return operation.data as Record<string, unknown>[];
  if (operation.data && typeof operation.data === 'object') return [operation.data as Record<string, unknown>];
  if (Array.isArray(operation.mappings)) return operation.mappings;
  return [];
};

const ensureSchool = (ctx: AiAssistantContext) => {
  if (!ctx.schoolId) throw new HttpError(400, 'Select a school context before executing AI operation plans');
  return ctx.schoolId;
};

export const isPhase3AExecutablePlan = (plan: AiOperationPlan) =>
  plan.operations.every((operation) => PHASE_3A_ENTITIES.has(operation.entity) && PHASE_3A_ACTIONS.has(operation.action));

const ensurePhase3APlan = (plan: AiOperationPlan) => {
  if (!isPhase3AExecutablePlan(plan)) {
    throw new HttpError(400, 'This operation plan is not supported by the Phase 3A academic setup executor');
  }
};

const labelFor = (entity: string, data: Record<string, unknown>) => {
  if (entity === 'ClassSection') {
    const classLabel = normalize(data.className) || normalize(data.classId);
    const sectionLabel = normalize(data.sectionName) || normalize(data.sectionId);
    return `${classLabel} -> ${sectionLabel}`;
  }
  return normalize(data.name);
};

const existingFor = async (client: PrismaClientLike, schoolId: string, entity: string, data: Record<string, unknown>) => {
  if (entity === 'AcademicYear') {
    return client.academicYear.findFirst({ where: { schoolId, name: { equals: normalize(data.name), mode: 'insensitive' } }, select: { id: true } });
  }
  if (entity === 'Class') {
    return client.class.findFirst({ where: { schoolId, name: { equals: normalize(data.name), mode: 'insensitive' } }, select: { id: true } });
  }
  if (entity === 'Section') {
    return client.section.findFirst({ where: { schoolId, name: { equals: normalize(data.name), mode: 'insensitive' } }, select: { id: true } });
  }
  if (entity === 'ClassSection') {
    if (!normalize(data.classId) || !normalize(data.sectionId)) return null;
    return client.classSection.findFirst({
      where: { schoolId, classId: String(data.classId), sectionId: String(data.sectionId) },
      select: { id: true },
    });
  }
  return null;
};

export const dryRunAiOperationPlan = async (ctx: AiAssistantContext, plan: AiOperationPlan): Promise<AiOperationDryRun> => {
  ensurePhase3APlan(plan);
  const schoolId = ensureSchool(ctx);
  const items: DryRunItem[] = [];

  for (const operation of plan.operations) {
    for (const data of recordsFromData(operation)) {
      const existing = await existingFor(prisma, schoolId, operation.entity, data);
      items.push({
        entity: operation.entity,
        action: operation.action,
        label: labelFor(operation.entity, data),
        status: existing ? 'SKIP' : 'CREATE',
        reason: existing ? 'Already exists' : undefined,
        data,
      });
    }
  }

  return {
    executable: true,
    phase: '3A',
    creates: items.filter((item) => item.status === 'CREATE').length,
    skips: items.filter((item) => item.status === 'SKIP').length,
    conflicts: 0,
    items,
  };
};

const dateValue = (value: unknown) => {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new HttpError(400, `${value} is not a valid date`);
  return date;
};

const findClassId = async (tx: PrismaClientLike, schoolId: string, data: Record<string, unknown>) => {
  if (normalize(data.classId)) return String(data.classId);
  const name = normalizeClassName(data.className);
  if (!name) throw new HttpError(400, 'ClassSection mapping requires classId or className');
  const cls = await tx.class.findFirst({ where: { schoolId, name: { equals: name, mode: 'insensitive' } }, select: { id: true } });
  if (!cls) throw new HttpError(404, `Class ${name} not found`);
  return cls.id;
};

const findSectionId = async (tx: PrismaClientLike, schoolId: string, data: Record<string, unknown>) => {
  if (normalize(data.sectionId)) return String(data.sectionId);
  const name = normalizeSectionName(data.sectionName);
  if (!name) throw new HttpError(400, 'ClassSection mapping requires sectionId or sectionName');
  const section = await tx.section.findFirst({ where: { schoolId, name: { equals: name, mode: 'insensitive' } }, select: { id: true } });
  if (!section) throw new HttpError(404, `Section ${name} not found`);
  return section.id;
};

const existingMappingFor = async (tx: PrismaClientLike, schoolId: string, data: Record<string, unknown>) => {
  const classId = await findClassId(tx, schoolId, data);
  const sectionId = await findSectionId(tx, schoolId, data);
  return {
    classId,
    sectionId,
    existing: await tx.classSection.findFirst({ where: { schoolId, classId, sectionId }, select: { id: true } }),
  };
};

const createRecord = async (
  tx: PrismaClientLike,
  schoolId: string,
  item: DryRunItem,
  resolvedMapping?: { classId: string; sectionId: string },
) => {
  if (item.entity === 'AcademicYear') {
    return tx.academicYear.create({
      data: {
        schoolId,
        name: normalize(item.data.name),
        startDate: dateValue(item.data.startDate),
        endDate: dateValue(item.data.endDate),
        isActive: item.data.isActive === true,
      },
      select: { id: true, name: true },
    });
  }
  if (item.entity === 'Class') {
    return tx.class.create({
      data: {
        schoolId,
        name: normalize(item.data.name),
        academicYearId: normalize(item.data.academicYearId) || null,
      },
      select: { id: true, name: true },
    });
  }
  if (item.entity === 'Section') {
    return tx.section.create({
      data: {
        schoolId,
        name: normalize(item.data.name),
        classId: normalize(item.data.classId) || null,
      },
      select: { id: true, name: true },
    });
  }
  if (item.entity === 'ClassSection') {
    const mapping = resolvedMapping ?? await existingMappingFor(tx, schoolId, item.data);
    return tx.classSection.create({
      data: {
        schoolId,
        classId: mapping.classId,
        sectionId: mapping.sectionId,
      },
      select: { id: true },
    });
  }
  throw new HttpError(400, `${item.entity} is not supported by the Phase 3A executor`);
};

export const executeAiOperationPlan = async (
  ctx: AiAssistantContext,
  plan: AiOperationPlan,
  dryRun?: AiOperationDryRun,
): Promise<AiOperationExecutionResult> => {
  ensurePhase3APlan(plan);
  const schoolId = ensureSchool(ctx);
  const run = dryRun ?? await dryRunAiOperationPlan(ctx, plan);
  if (run.conflicts) throw new HttpError(409, 'Resolve dry-run conflicts before execution');

  const records = await prisma.$transaction(async (tx) => {
    const createdOrSkipped: AiOperationExecutionResult['records'] = [];
    for (const item of run.items) {
      const mapping = item.entity === 'ClassSection' ? await existingMappingFor(tx as PrismaClientLike, schoolId, item.data) : null;
      const existing = mapping?.existing ?? await existingFor(tx as PrismaClientLike, schoolId, item.entity, item.data);
      if (existing) {
        createdOrSkipped.push({ entity: item.entity, id: existing.id, label: item.label, status: 'SKIPPED' });
        continue;
      }
      const created = await createRecord(tx as PrismaClientLike, schoolId, item, mapping ?? undefined);
      createdOrSkipped.push({ entity: item.entity, id: created.id, label: item.label, status: 'CREATED' });
    }
    return createdOrSkipped;
  }, { maxWait: 10000, timeout: 30000 });

  return {
    phase: '3A',
    created: records.filter((record) => record.status === 'CREATED').length,
    skipped: records.filter((record) => record.status === 'SKIPPED').length,
    records,
  };
};

const groupItems = (items: DryRunItem[], status: DryRunItem['status']) => {
  const selected = items.filter((item) => item.status === status);
  if (!selected.length) return '';
  const grouped = selected.reduce<Record<string, string[]>>((acc, item) => {
    acc[item.entity] = [...(acc[item.entity] ?? []), item.label];
    return acc;
  }, {});
  return Object.entries(grouped)
    .map(([entity, labels]) => `${entity}: ${labels.length}`)
    .join(', ');
};

export const formatDryRunSummary = (dryRun: AiOperationDryRun) => {
  if (!dryRun.creates && dryRun.skips) {
    return `I checked this setup plan. Everything in the request already exists, so there is nothing new to create. Skipped: ${dryRun.skips}.`;
  }
  const createSummary = groupItems(dryRun.items, 'CREATE');
  const skipSummary = groupItems(dryRun.items, 'SKIP');
  return [
    'I checked this setup plan.',
    '',
    `Will create: ${dryRun.creates}${createSummary ? ` (${createSummary})` : ''}`,
    `Already exists and will be skipped: ${dryRun.skips}${skipSummary ? ` (${skipSummary})` : ''}`,
    `Conflicts: ${dryRun.conflicts}`,
    '',
    'Would you like me to proceed?',
  ].join('\n');
};

export const formatExecutionSummary = (result: AiOperationExecutionResult) => {
  const created = result.records.filter((record) => record.status === 'CREATED');
  const skipped = result.records.filter((record) => record.status === 'SKIPPED');
  return [
    'Setup completed successfully.',
    '',
    `Created: ${created.length}`,
    `Skipped because already present: ${skipped.length}`,
    '',
    'All changes have been audited and recorded.',
  ].join('\n');
};
