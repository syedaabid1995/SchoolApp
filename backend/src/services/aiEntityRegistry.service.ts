import type { AiEntityDefinition, AiOperationAction } from '../types/aiAssistant.types';

import { PermissionCodes as P } from '../permissions/permission-manifest';
export const AI_ENTITY_REGISTRY: Record<string, AiEntityDefinition> = {
  AcademicYear: {
    entity: 'AcademicYear',
    prismaModel: 'academicYear',
    label: 'academic year',
    pluralLabel: 'academic years',
    schoolScoped: true,
    allowedActions: ['findRecords', 'createRecord', 'updateRecord'],
    readableFields: ['id', 'name', 'startDate', 'endDate', 'isActive'],
    defaultOrderBy: { startDate: 'desc' },
    defaultLimit: 25,
    maxLimit: 50,
    permissions: {
      findRecords: [P.academicsSetup],
      createRecord: [P.academicsSetup],
      updateRecord: [P.academicsSetup],
    },
    fields: {
      id: { type: 'uuid', filterable: true },
      name: { type: 'string', required: true, writable: true, filterable: true, aliases: ['academicYearName', 'year'] },
      startDate: { type: 'date', required: true, writable: true, aliases: ['startingDate', 'fromDate'] },
      endDate: { type: 'date', required: true, writable: true, aliases: ['endingDate', 'toDate'] },
      isActive: { type: 'boolean', writable: true, filterable: true, aliases: ['active'] },
    },
  },
  Class: {
    entity: 'Class',
    prismaModel: 'class',
    label: 'class',
    pluralLabel: 'classes',
    schoolScoped: true,
    allowedActions: ['findRecords', 'createRecord', 'bulkCreateRecords', 'updateRecord'],
    readableFields: ['id', 'name', 'academicYearId'],
    defaultOrderBy: { name: 'asc' },
    defaultLimit: 50,
    maxLimit: 100,
    maxBulkCount: 50,
    permissions: {
      findRecords: [P.academicClassView, P.academicsSetup],
      createRecord: [P.academicClassCreate],
      bulkCreateRecords: [P.academicClassCreate],
      updateRecord: [P.academicClassEdit],
    },
    fields: {
      id: { type: 'uuid', filterable: true },
      name: { type: 'string', required: true, writable: true, filterable: true, aliases: ['className', 'grade'] },
      academicYearId: { type: 'uuid', writable: true, filterable: true },
      academicYearName: { type: 'string', writable: true, aliases: ['academicYear'] },
      classSections: { type: 'string', filterable: true },
      assignSubjects: { type: 'string', filterable: true },
    },
  },
  Section: {
    entity: 'Section',
    prismaModel: 'section',
    label: 'section',
    pluralLabel: 'sections',
    schoolScoped: true,
    allowedActions: ['findRecords', 'createRecord', 'bulkCreateRecords', 'updateRecord'],
    readableFields: ['id', 'name', 'classId'],
    defaultOrderBy: { name: 'asc' },
    defaultLimit: 50,
    maxLimit: 100,
    maxBulkCount: 50,
    permissions: {
      findRecords: [P.academicSectionView, P.academicsSetup],
      createRecord: [P.academicSectionCreate],
      bulkCreateRecords: [P.academicSectionCreate],
      updateRecord: [P.academicSectionEdit],
    },
    fields: {
      id: { type: 'uuid', filterable: true },
      name: { type: 'string', required: true, writable: true, filterable: true, aliases: ['sectionName'] },
      classId: { type: 'uuid', writable: true, filterable: true },
      className: { type: 'string', writable: true, aliases: ['class'] },
      classSections: { type: 'string', filterable: true },
    },
  },
  Subject: {
    entity: 'Subject',
    prismaModel: 'subject',
    label: 'subject',
    pluralLabel: 'subjects',
    schoolScoped: true,
    allowedActions: ['findRecords', 'createRecord', 'bulkCreateRecords', 'updateRecord'],
    readableFields: ['id', 'name', 'code', 'type', 'classId', 'academicYearId'],
    defaultOrderBy: { name: 'asc' },
    defaultLimit: 50,
    maxLimit: 100,
    maxBulkCount: 50,
    permissions: {
      findRecords: [P.academicSubjectView, P.academicsSetup],
      createRecord: [P.academicSubjectCreate],
      bulkCreateRecords: [P.academicSubjectCreate],
      updateRecord: [P.academicSubjectEdit],
    },
    fields: {
      id: { type: 'uuid', filterable: true },
      name: { type: 'string', required: true, writable: true, filterable: true, aliases: ['subjectName'] },
      code: { type: 'string', writable: true, filterable: true },
      type: { type: 'enum', writable: true, filterable: true, enumValues: ['THEORY', 'PRACTICAL'] },
      classId: { type: 'uuid', writable: true, filterable: true },
      className: { type: 'string', writable: true, aliases: ['class'] },
      academicYearId: { type: 'uuid', writable: true, filterable: true },
      academicYearName: { type: 'string', writable: true, aliases: ['academicYear'] },
    },
  },
  ClassSection: {
    entity: 'ClassSection',
    prismaModel: 'classSection',
    label: 'class section mapping',
    pluralLabel: 'class section mappings',
    schoolScoped: true,
    allowedActions: ['findRecords', 'linkRecords'],
    readableFields: ['id', 'classId', 'sectionId'],
    defaultOrderBy: { createdAt: 'desc' },
    defaultLimit: 50,
    maxLimit: 100,
    maxBulkCount: 100,
    permissions: {
      findRecords: [P.academicSectionView, P.academicClassView, P.academicsSetup],
      linkRecords: [P.academicSectionCreate, P.academicClassEdit],
    },
    fields: {
      id: { type: 'uuid', filterable: true },
      classId: { type: 'uuid', required: true, writable: true, filterable: true },
      sectionId: { type: 'uuid', required: true, writable: true, filterable: true },
      className: { type: 'string', writable: true, filterable: true },
      sectionName: { type: 'string', writable: true, filterable: true },
    },
  },
};

export const getAiEntityDefinition = (entity: string) => AI_ENTITY_REGISTRY[entity] ?? null;

export const getEntityPermissionCodes = (entity: AiEntityDefinition, action: AiOperationAction) =>
  entity.permissions[action] ?? [];

export const buildSchemaPrompt = () =>
  Object.values(AI_ENTITY_REGISTRY)
    .map((entity) => {
      const fields = Object.entries(entity.fields)
        .map(([name, definition]) => `${name}${definition.writable ? ':writable' : ''}${definition.filterable ? ':filterable' : ''}`)
        .join(', ');
      return `${entity.entity}: actions=${entity.allowedActions.join('|')}; fields=${fields}`;
    })
    .join('\n');
