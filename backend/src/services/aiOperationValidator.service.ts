import type { Prisma } from '@prisma/client';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { getEffectivePermissionCodesForUser } from '../utils/employeePermissions';
import type { AiAssistantContext, AiEntityDefinition, AiOperation, AiOperationFilter, AiOperationPlan } from '../types/aiAssistant.types';
import { getAiEntityDefinition, getEntityPermissionCodes } from './aiEntityRegistry.service';

const normalize = (value: unknown) => String(value ?? '').trim().replace(/\s+/g, ' ');
const normalizeClassName = (value: unknown) => normalize(value).replace(/^(\d+)$/, 'Class $1');
const normalizeSectionName = (value: unknown) => normalize(value).replace(/^section\s+/i, '').toUpperCase();

type AiReadOperationResult = {
  entity: string;
  action: string;
  count: number;
  rows: any[];
  operation: AiOperation;
};

const delegateFor = (entity: AiEntityDefinition) => (prisma as unknown as Record<string, any>)[entity.prismaModel];

const ensureSchool = (ctx: AiAssistantContext) => {
  if (!ctx.schoolId) throw new HttpError(400, 'Select a school context before using AI operation plans');
  return ctx.schoolId;
};

const recordsFromData = (operation: AiOperation) => {
  if (Array.isArray(operation.data)) return operation.data as Record<string, unknown>[];
  if (operation.data && typeof operation.data === 'object') return [operation.data as Record<string, unknown>];
  const fields = (operation as unknown as { fields?: unknown }).fields;
  if (Array.isArray(fields)) return fields as Record<string, unknown>[];
  if (fields && typeof fields === 'object') return [fields as Record<string, unknown>];
  return [];
};

const withRecords = (operation: AiOperation, records: Record<string, unknown>[]) => ({
  ...operation,
  data: Array.isArray(operation.data) || Array.isArray((operation as unknown as { fields?: unknown }).fields) ? records : records[0],
});

const isUuid = (value: unknown) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value));

const normalizeDate = (value: unknown) => {
  const text = normalize(value);
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(text)) {
    throw new HttpError(400, `${text} is ambiguous; use YYYY-MM-DD`);
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, `${text} is not a valid date`);
  }
  return parsed.toISOString().slice(0, 10);
};

const validateFieldValue = (entity: AiEntityDefinition, field: string, value: unknown) => {
  const definition = entity.fields[field];
  if (definition.type === 'uuid' && normalize(value) && !isUuid(value)) {
    throw new HttpError(400, `${field} must be a UUID for ${entity.entity}`);
  }
  if (definition.type === 'date' && Number.isNaN(Date.parse(String(value)))) {
    throw new HttpError(400, `${field} must be a valid date for ${entity.entity}`);
  }
  if (definition.type === 'boolean' && typeof value !== 'boolean') {
    throw new HttpError(400, `${field} must be a boolean for ${entity.entity}`);
  }
};

const validateDataFields = (entity: AiEntityDefinition, operation: AiOperation) => {
  const records = recordsFromData(operation);
  for (const record of records) {
    for (const field of Object.keys(record)) {
      const definition = entity.fields[field];
      if (!definition || !definition.writable) {
        throw new HttpError(400, `${field} is not writable for ${entity.entity}`);
      }
      if (definition.enumValues && !definition.enumValues.includes(String(record[field]))) {
        throw new HttpError(400, `${field} must be one of ${definition.enumValues.join(', ')}`);
      }
      validateFieldValue(entity, field, record[field]);
    }

    let missing = Object.entries(entity.fields)
      .filter(([, definition]) => definition.required && definition.writable)
      .map(([field]) => field)
      .filter((field) => !normalize(record[field]));
    if (entity.entity === 'ClassSection') {
      missing = [
        ...(!normalize(record.classId) && !normalize(record.className) ? ['classId or className'] : []),
        ...(!normalize(record.sectionId) && !normalize(record.sectionName) ? ['sectionId or sectionName'] : []),
      ];
    }
    if (operation.action !== 'updateRecord' && missing.length) {
      throw new HttpError(400, `Missing required fields for ${entity.entity}: ${missing.join(', ')}`);
    }
  }
};

const duplicateKeyFor = (entity: AiEntityDefinition, record: Record<string, unknown>) => {
  if (entity.entity === 'AcademicYear') return normalize(record.name).toLowerCase();
  if (entity.entity === 'Class') return normalize(record.name).toLowerCase();
  if (entity.entity === 'Section') return normalize(record.name).toLowerCase();
  if (entity.entity === 'Subject') return [normalize(record.name).toLowerCase(), normalize(record.classId), normalize(record.academicYearId)].join('|');
  if (entity.entity === 'ClassSection') {
    const classKey = normalize(record.classId) || normalizeClassName(record.className).toLowerCase();
    const sectionKey = normalize(record.sectionId) || normalizeSectionName(record.sectionName).toLowerCase();
    return [classKey, sectionKey].join('|');
  }
  return null;
};

const validateDuplicateRecords = (entity: AiEntityDefinition, operation: AiOperation) => {
  const seen = new Set<string>();
  for (const record of recordsFromData(operation)) {
    const key = duplicateKeyFor(entity, record);
    if (!key) continue;
    if (seen.has(key)) throw new HttpError(400, `Duplicate ${entity.entity} operation in the same plan`);
    seen.add(key);
  }
};

const resolveAcademicYearId = async (schoolId: string, value: unknown) => {
  const name = normalize(value);
  if (!name) return null;
  const found = await prisma.academicYear.findFirst({
    where: { schoolId, name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  });
  if (!found) throw new HttpError(404, `Academic year ${name} not found`);
  return found.id;
};

const resolveClassId = async (schoolId: string, value: unknown) => {
  const name = normalizeClassName(value);
  if (!name) return null;
  const found = await prisma.class.findFirst({
    where: { schoolId, name: { equals: name, mode: 'insensitive' } },
    select: { id: true, name: true },
  });
  if (!found) throw new HttpError(404, `Class ${name} not found`);
  return found.id;
};

const resolveSectionId = async (schoolId: string, value: unknown) => {
  const name = normalizeSectionName(value);
  if (!name) return null;
  const found = await prisma.section.findFirst({
    where: { schoolId, name: { equals: name, mode: 'insensitive' } },
    select: { id: true, name: true },
  });
  if (!found) throw new HttpError(404, `Section ${name} not found`);
  return found.id;
};

type PlannedReferenceNames = {
  classes: Set<string>;
  sections: Set<string>;
};

const plannedReferenceNames = (plan: AiOperationPlan): PlannedReferenceNames => {
  const classes = new Set<string>();
  const sections = new Set<string>();
  for (const operation of plan.operations) {
    if (!['createRecord', 'bulkCreateRecords'].includes(operation.action)) continue;
    for (const record of recordsFromData(operation)) {
      if (operation.entity === 'Class' && normalize(record.name)) classes.add(normalizeClassName(record.name).toLowerCase());
      if (operation.entity === 'Section' && normalize(record.name)) sections.add(normalizeSectionName(record.name).toLowerCase());
    }
  }
  return { classes, sections };
};

const resolveRecordReferences = async (
  schoolId: string,
  entity: AiEntityDefinition,
  record: Record<string, unknown>,
  planned: PlannedReferenceNames,
) => {
  const next = { ...record };
  for (const [field, definition] of Object.entries(entity.fields)) {
    if (definition.type === 'date' && normalize(next[field])) {
      next[field] = normalizeDate(next[field]);
    }
  }
  if (normalize(next.academicYearName)) {
    next.academicYearId = await resolveAcademicYearId(schoolId, next.academicYearName);
    delete next.academicYearName;
  }
  if (normalize(next.className) && ['Section', 'Subject', 'ClassSection'].includes(entity.entity)) {
    const className = normalizeClassName(next.className);
    if (entity.entity === 'ClassSection' && planned.classes.has(className.toLowerCase())) {
      next.className = className;
    } else {
      next.classId = await resolveClassId(schoolId, next.className);
      delete next.className;
    }
  }
  if (normalize(next.sectionName) && entity.entity === 'ClassSection') {
    const sectionName = normalizeSectionName(next.sectionName);
    if (planned.sections.has(sectionName.toLowerCase())) {
      next.sectionName = sectionName;
    } else {
      next.sectionId = await resolveSectionId(schoolId, next.sectionName);
      delete next.sectionName;
    }
  }
  return next;
};

const normalizeOperationReferences = async (ctx: AiAssistantContext, entity: AiEntityDefinition, operation: AiOperation, planned: PlannedReferenceNames) => {
  if (operation.action === 'findRecords') return operation;
  const schoolId = ensureSchool(ctx);
  const records = recordsFromData(operation);
  if (!records.length) return operation;
  const resolved = [];
  for (const record of records) {
    resolved.push(await resolveRecordReferences(schoolId, entity, record, planned));
  }
  return withRecords(operation, resolved) as AiOperation;
};

const validateFilters = (entity: AiEntityDefinition, rawFilters: unknown = []) => {
  const filters = Array.isArray(rawFilters) ? rawFilters as AiOperationFilter[] : [];
  for (const filter of filters) {
    if (filter.field.includes('.')) {
      if (entity.entity === 'ClassSection' && filter.field === 'class.name') continue;
      if (entity.entity === 'ClassSection' && filter.field === 'section.name') continue;
      throw new HttpError(400, `${filter.field} is not a supported relation filter for ${entity.entity}`);
    }
    const definition = entity.fields[filter.field];
    if (!definition || !definition.filterable) {
      throw new HttpError(400, `${filter.field} is not filterable for ${entity.entity}`);
    }
  }
};

const ensurePermissions = async (ctx: AiAssistantContext, entity: AiEntityDefinition, operation: AiOperation) => {
  if (ctx.role === 'SUPER_ADMIN') return;
  const schoolId = ensureSchool(ctx);
  const required = getEntityPermissionCodes(entity, operation.action);
  if (!required.length) throw new HttpError(403, `${operation.action} is not permitted for ${entity.entity}`);
  const effective = new Set(await getEffectivePermissionCodesForUser(schoolId, ctx.userId, ctx.role));
  if (!required.some((code) => effective.has(code))) {
    throw new HttpError(403, `You do not have permission to ${operation.action} ${entity.entity}`);
  }
};

export const validateAiOperationPlan = async (ctx: AiAssistantContext, plan: AiOperationPlan) => {
  if (plan.type !== 'operation_plan') throw new HttpError(400, 'Invalid AI operation plan');
  if (!plan.operations.length) throw new HttpError(400, 'AI operation plan is empty');
  if (plan.operations.length > 50) throw new HttpError(400, 'AI operation plan is too large');

  const validated = [] as Array<{ operation: AiOperation; entity: AiEntityDefinition }>;
  let hasWrite = false;
  const planned = plannedReferenceNames(plan);

  for (const operation of plan.operations) {
    const entity = getAiEntityDefinition(operation.entity);
    if (!entity) throw new HttpError(400, `${operation.entity} is not available to the AI operation engine`);
    if (!entity.allowedActions.includes(operation.action)) {
      throw new HttpError(400, `${operation.action} is not allowed for ${operation.entity}`);
    }

    if (entity.schoolScoped) ensureSchool(ctx);
    await ensurePermissions(ctx, entity, operation);
    validateFilters(entity, operation.filters);

    const normalizedOperation = await normalizeOperationReferences(ctx, entity, operation, planned);

    if (normalizedOperation.action !== 'findRecords') {
      hasWrite = true;
      validateDataFields(entity, normalizedOperation);
      validateDuplicateRecords(entity, normalizedOperation);
      const count = recordsFromData(normalizedOperation).length || normalizedOperation.mappings?.length || 1;
      if (entity.maxBulkCount && count > entity.maxBulkCount) {
        throw new HttpError(400, `${normalizedOperation.entity} operation exceeds the maximum of ${entity.maxBulkCount} records`);
      }
    }

    validated.push({ operation: normalizedOperation, entity });
  }

  return {
    ...plan,
    status: hasWrite ? 'WRITE_PREVIEW_ONLY' as const : 'READ_ONLY_EXECUTABLE' as const,
    operations: validated.map((entry) => entry.operation),
  };
};

const scalarFilter = (filter: AiOperationFilter) => {
  const op = filter.op ?? 'equals';
  if (op === 'contains') return { [filter.field]: { contains: String(filter.value), mode: 'insensitive' } };
  if (op === 'in') return { [filter.field]: { in: Array.isArray(filter.value) ? filter.value : [filter.value] } };
  return { [filter.field]: { equals: filter.value } };
};

const whereFor = (schoolId: string, entity: AiEntityDefinition, operation: AiOperation): Prisma.InputJsonObject => {
  const where: Record<string, unknown> = entity.schoolScoped ? { schoolId } : {};
  const filters = Array.isArray(operation.filters) ? operation.filters : [];
  for (const filter of filters) {
    if (entity.entity === 'ClassSection' && filter.field === 'class.name') {
      where.class = { name: { equals: String(filter.value), mode: 'insensitive' } };
      continue;
    }
    if (entity.entity === 'ClassSection' && filter.field === 'section.name') {
      where.section = { name: { equals: String(filter.value), mode: 'insensitive' } };
      continue;
    }
    if (entity.entity === 'Class' && filter.field === 'classSections' && filter.op === 'none') {
      where.classSections = { none: {} };
      continue;
    }
    if (entity.entity === 'Class' && filter.field === 'assignSubjects' && filter.op === 'none') {
      where.assignSubjects = { none: {} };
      continue;
    }
    if (entity.entity === 'Section' && filter.field === 'classSections' && filter.op === 'none') {
      where.classSections = { none: {} };
      continue;
    }
    Object.assign(where, scalarFilter(filter));
  }
  return where as Prisma.InputJsonObject;
};

const selectFor = (entity: AiEntityDefinition) => {
  const select = Object.fromEntries(entity.readableFields.map((field) => [field, true]));
  if (entity.entity === 'ClassSection') {
    return {
      id: true,
      classId: true,
      sectionId: true,
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
    };
  }
  return select;
};

export const executeReadOnlyAiOperationPlan = async (ctx: AiAssistantContext, plan: AiOperationPlan) => {
  const schoolId = ensureSchool(ctx);
  const results = [];

  for (const operation of plan.operations) {
    const entity = getAiEntityDefinition(operation.entity);
    if (!entity) throw new HttpError(400, `${operation.entity} is not available to the AI operation engine`);
    if (operation.action !== 'findRecords') throw new HttpError(400, 'Only read-only operation plans can be executed in this phase');
    const limit = Math.min(operation.limit ?? entity.defaultLimit ?? 25, entity.maxLimit ?? 50);
    const delegate = delegateFor(entity);
    const rows = await delegate.findMany({
      where: whereFor(schoolId, entity, operation),
      select: selectFor(entity),
      orderBy: entity.defaultOrderBy,
      take: limit,
    });
    results.push({ entity: entity.entity, action: operation.action, count: rows.length, rows, operation });
  }

  return results;
};

const rowName = (row: any) => normalize(row?.name ?? row?.fullName ?? row?.title ?? row?.id);

const bulletList = (items: string[]) => items.map((item) => `- ${item}`).join('\n');

const relationFilter = (result: AiReadOperationResult, field: string, op?: string) =>
  result.operation.filters?.some((filter) => filter.field === field && (!op || filter.op === op));

const filterValue = (result: AiReadOperationResult, field: string) =>
  normalize(result.operation.filters?.find((filter) => filter.field === field)?.value);

const summarizeEntityList = (label: string, rows: any[]) => {
  if (!rows.length) return `No ${label.toLowerCase()} found.`;
  const names = rows.map(rowName).filter(Boolean);
  return `${label}:\n\n${bulletList(names)}`;
};

const summarizeClassSections = (result: AiReadOperationResult) => {
  const className = filterValue(result, 'class.name');
  if (className) {
    if (!result.rows.length) return `No sections are mapped to ${className} yet.`;
    const sections = result.rows
      .map((row) => row?.section?.name ?? row?.sectionName ?? rowName(row))
      .map(normalize)
      .filter(Boolean);
    const intro = `${className} has ${sections.length} ${sections.length === 1 ? 'section' : 'sections'}:`;
    return `${intro}\n\n${bulletList(sections)}`;
  }

  if (!result.rows.length) return 'No class-section mappings found.';
  const grouped = new Map<string, string[]>();
  for (const row of result.rows) {
    const key = normalize(row?.class?.name ?? row?.className ?? row?.classId ?? 'Unassigned class');
    const section = normalize(row?.section?.name ?? row?.sectionName ?? row?.sectionId);
    grouped.set(key, [...(grouped.get(key) ?? []), section]);
  }
  return `Class-section mappings:\n\n${bulletList([...grouped.entries()].map(([cls, sections]) => `${cls}: ${sections.filter(Boolean).join(', ')}`))}`;
};

const setupResult = (results: AiReadOperationResult[], entity: string) =>
  results.find((result) => result.entity === entity);

const summarizeSetupStatus = (results: AiReadOperationResult[]) => {
  const academicYears = setupResult(results, 'AcademicYear')?.count ?? 0;
  const classes = setupResult(results, 'Class')?.count ?? 0;
  const sections = setupResult(results, 'Section')?.count ?? 0;
  const subjects = setupResult(results, 'Subject')?.count ?? 0;
  const mappings = setupResult(results, 'ClassSection')?.count ?? 0;

  const configured = [
    `Academic years: ${academicYears}`,
    `Classes: ${classes}`,
    `Sections: ${sections}`,
    `Subjects: ${subjects}`,
    `Class-section mappings: ${mappings}`,
  ];

  const missing = [
    ...(academicYears ? [] : ['Academic year is not configured.']),
    ...(classes ? [] : ['Classes are not created yet.']),
    ...(sections ? [] : ['Sections are not created yet.']),
    ...(subjects ? [] : ['Subjects are not configured yet.']),
    ...(classes && sections && !mappings ? ['No class-section mappings found.'] : []),
    ...(classes && mappings > 0 && mappings < classes ? ['Some classes may still be missing section mappings.'] : []),
    ...(classes && subjects ? ['Subject assignment coverage still needs review.'] : []),
  ];

  return [
    'I reviewed your academic setup.',
    '',
    'Configured:',
    bulletList(configured),
    '',
    missing.length ? 'Needs attention:' : 'Needs attention:',
    missing.length ? bulletList(missing) : '- Core academic setup looks ready for the next review step.',
    '',
    'Next: ask me to show classes without sections or classes without subjects.',
  ].join('\n');
};

const summarizeSingleOperationResult = (result: AiReadOperationResult) => {
  if (result.entity === 'Class' && relationFilter(result, 'classSections', 'none')) {
    if (!result.rows.length) return 'Every class has at least one section mapping.';
    return `Classes without section mappings:\n\n${bulletList(result.rows.map(rowName).filter(Boolean))}`;
  }
  if (result.entity === 'Class' && relationFilter(result, 'assignSubjects', 'none')) {
    if (!result.rows.length) return 'Every class has subject assignments.';
    return `Classes without subject assignments:\n\n${bulletList(result.rows.map(rowName).filter(Boolean))}`;
  }
  if (result.entity === 'Section' && relationFilter(result, 'classSections', 'none')) {
    if (!result.rows.length) return 'Every section is mapped to at least one class.';
    return `Sections not mapped to any class:\n\n${bulletList(result.rows.map(rowName).filter(Boolean))}`;
  }
  if (result.entity === 'Class') return summarizeEntityList('Classes available', result.rows);
  if (result.entity === 'Section') return summarizeEntityList('Sections configured', result.rows);
  if (result.entity === 'Subject') return summarizeEntityList('Subjects configured', result.rows);
  if (result.entity === 'AcademicYear') return summarizeEntityList('Academic years configured', result.rows);
  if (result.entity === 'ClassSection') return summarizeClassSections(result);
  if (!result.count) return `No ${result.entity} records found.`;
  return `Found ${result.count} ${result.entity} ${result.count === 1 ? 'record' : 'records'}.`;
};

export const summarizeOperationResults = (results: AiReadOperationResult[]) => {
  if (
    results.length === 5 &&
    ['AcademicYear', 'Class', 'Section', 'Subject', 'ClassSection'].every((entity) => results.some((result) => result.entity === entity))
  ) {
    return summarizeSetupStatus(results);
  }
  if (results.length === 1) {
    return summarizeSingleOperationResult(results[0]);
  }
  const count = results.reduce((total, result) => total + result.count, 0);
  const summaries = results.map(summarizeSingleOperationResult);
  return [`I found ${count} records across ${results.length} checks.`, '', ...summaries].join('\n');
};
