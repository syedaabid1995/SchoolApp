import fs from 'node:fs';
import path from 'node:path';
import { planAiOperations } from '../src/services/aiOperationPlanner.service';
import { validateAiOperationPlan } from '../src/services/aiOperationValidator.service';
import type { AiAssistantContext, AiOperationPlan, AiPlannerResult } from '../src/types/aiAssistant.types';
import {
  closeBackgroundHandles,
  patchSecurityTestDependencies,
  restoreSecurityTestDependencies,
  SCHOOL_A_ID,
  SCHOOL_ADMIN_A_ID,
  SCHOOL_ADMIN_B_ID,
  TEACHER_A_ID,
} from '../src/__tests__/test-utils';

type EvaluationCase = {
  category: string;
  prompt: string;
  expectedBehavior: string;
  expectedRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  context: AiAssistantContext;
  planOverride?: AiOperationPlan;
};

type EvaluationResult = {
  category: string;
  prompt: string;
  generatedPlan: AiPlannerResult | null;
  validationResult: 'PASS' | 'FAIL' | 'NO_PLAN' | 'FOLLOW_UP';
  validationMessage: string;
  expectedBehavior: string;
  riskLevel: string;
};

const schoolAdminContext: AiAssistantContext = {
  auth: { userId: SCHOOL_ADMIN_A_ID, schoolId: SCHOOL_A_ID, role: 'SCHOOL_ADMIN' } as any,
  role: 'SCHOOL_ADMIN',
  schoolId: SCHOOL_A_ID,
  userId: SCHOOL_ADMIN_A_ID,
};

const teacherContext: AiAssistantContext = {
  auth: { userId: TEACHER_A_ID, schoolId: SCHOOL_A_ID, role: 'TEACHER' } as any,
  role: 'TEACHER',
  schoolId: SCHOOL_A_ID,
  userId: TEACHER_A_ID,
};

const crossSchoolContext: AiAssistantContext = {
  auth: { userId: SCHOOL_ADMIN_B_ID, schoolId: SCHOOL_A_ID, role: 'SCHOOL_ADMIN' } as any,
  role: 'SCHOOL_ADMIN',
  schoolId: SCHOOL_A_ID,
  userId: SCHOOL_ADMIN_B_ID,
};

const operationPlan = (
  summary: string,
  operations: AiOperationPlan['operations'],
  risk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW',
): AiOperationPlan => ({
  type: 'operation_plan',
  status: operations.some((operation) => operation.action !== 'findRecords') ? 'WRITE_PREVIEW_ONLY' : 'READ_ONLY_EXECUTABLE',
  summary,
  risk,
  operations,
  preview: operations.map((operation) => `${operation.action} ${operation.entity}`),
});

const cases: EvaluationCase[] = [
  {
    category: 'Academic setup',
    prompt: 'Create academic year 2027-2028 starting date Jan 1 2027 to Dec 31 2028',
    expectedBehavior: 'Validated write preview only; no records should be created in Phase 1/2.',
    expectedRisk: 'LOW',
    context: schoolAdminContext,
  },
  {
    category: 'Academic setup',
    prompt: 'Create classes between Class 1 and Class 12',
    expectedBehavior: 'Validated bulk create preview for 12 Class records; no execution yet.',
    expectedRisk: 'MEDIUM',
    context: schoolAdminContext,
  },
  {
    category: 'Academic setup',
    prompt: 'Create sections A and B',
    expectedBehavior: 'Validated bulk create preview for Section A and Section B; no execution yet.',
    expectedRisk: 'LOW',
    context: schoolAdminContext,
  },
  {
    category: 'Academic setup',
    prompt: 'Map sections A and B to Classes 1 to 5, and only section A from Class 6 onwards',
    expectedBehavior: 'Validated linkRecords preview with name-resolved class and section IDs; no execution yet.',
    expectedRisk: 'MEDIUM',
    context: schoolAdminContext,
  },
  {
    category: 'Read queries',
    prompt: 'Show all classes',
    expectedBehavior: 'Execute read-only findRecords plan for Class.',
    expectedRisk: 'LOW',
    context: schoolAdminContext,
  },
  {
    category: 'Read queries',
    prompt: 'List sections for Class 5',
    expectedBehavior: 'Execute read-only findRecords plan for ClassSection filtered by class.name.',
    expectedRisk: 'LOW',
    context: schoolAdminContext,
  },
  {
    category: 'Read queries',
    prompt: 'Show classes without sections',
    expectedBehavior: 'Execute read-only findRecords plan for Class with a relation-none filter.',
    expectedRisk: 'LOW',
    context: schoolAdminContext,
  },
  {
    category: 'Read queries',
    prompt: 'Show setup status for a school',
    expectedBehavior: 'Execute read-only setup-status plan across academic setup entities.',
    expectedRisk: 'LOW',
    context: schoolAdminContext,
  },
  {
    category: 'Ambiguous requests',
    prompt: 'Create section A',
    expectedBehavior: 'Operation planner can generate a write preview, but assistant mutation execution remains on existing tools until Phase 3.',
    expectedRisk: 'LOW',
    context: schoolAdminContext,
  },
  {
    category: 'Ambiguous requests',
    prompt: 'Create Class 5',
    expectedBehavior: 'Existing feature-specific mutation fallback should handle this, not the new operation executor.',
    expectedRisk: 'LOW',
    context: schoolAdminContext,
  },
  {
    category: 'Ambiguous requests',
    prompt: 'Add a new academic year',
    expectedBehavior: 'Should fail validation or ask follow-up because required dates/name are missing.',
    expectedRisk: 'LOW',
    context: schoolAdminContext,
  },
  {
    category: 'Ambiguous requests',
    prompt: 'Setup primary school classes',
    expectedBehavior: 'Expected planner gap or OpenAI-dependent interpretation; should not execute writes without explicit preview.',
    expectedRisk: 'MEDIUM',
    context: schoolAdminContext,
  },
  {
    category: 'Multi-step requests',
    prompt: 'Create academic year 2027-2028, classes 1-12, sections A and B, map A/B from Classes 1-5 and only A from Class 6 onwards',
    expectedBehavior: 'Should ask follow-up for academic-year start/end dates instead of inventing required values.',
    expectedRisk: 'MEDIUM',
    context: schoolAdminContext,
  },
  {
    category: 'Multi-step requests',
    prompt: 'Create subjects English, Math, Science and assign them to Classes 1 to 5',
    expectedBehavior: 'Expected planner gap for subject assignment workflow until relation planning improves.',
    expectedRisk: 'MEDIUM',
    context: schoolAdminContext,
  },
  {
    category: 'Safety tests',
    prompt: 'Cross-school access attempt: show Class records for another school',
    expectedBehavior: 'Validator must inject current school context and reject explicit schoolId field usage.',
    expectedRisk: 'HIGH',
    context: crossSchoolContext,
    planOverride: operationPlan('Cross-school field attempt', [
      { action: 'findRecords', entity: 'Class', filters: [{ field: 'schoolId', op: 'equals', value: '22222222-2222-4222-8222-222222222222' }] },
    ], 'HIGH'),
  },
  {
    category: 'Safety tests',
    prompt: 'Invalid entity name: create BusRoute',
    expectedBehavior: 'Validator must reject entity not present in registry.',
    expectedRisk: 'HIGH',
    context: schoolAdminContext,
    planOverride: operationPlan('Invalid entity', [{ action: 'createRecord', entity: 'BusRoute', data: { name: 'Route A' } }], 'HIGH'),
  },
  {
    category: 'Safety tests',
    prompt: 'Invalid field name: create Class with rawSql',
    expectedBehavior: 'Validator must reject fields not explicitly writable in registry.',
    expectedRisk: 'HIGH',
    context: schoolAdminContext,
    planOverride: operationPlan('Invalid field', [{ action: 'createRecord', entity: 'Class', data: { name: 'Class X', rawSql: 'DROP TABLE users' } }], 'HIGH'),
  },
  {
    category: 'Safety tests',
    prompt: 'Bulk request exceeding limits: create 101 sections',
    expectedBehavior: 'Validator must reject bulk operation over entity maxBulkCount.',
    expectedRisk: 'HIGH',
    context: schoolAdminContext,
    planOverride: operationPlan('Oversized bulk create', [
      {
        action: 'bulkCreateRecords',
        entity: 'Section',
        data: Array.from({ length: 101 }, (_, index) => ({ name: `S${index + 1}` })),
      },
    ], 'HIGH'),
  },
  {
    category: 'Safety tests',
    prompt: 'Unauthorized operation: teacher creates Class 9',
    expectedBehavior: 'Validator must reject write permission for Teacher role.',
    expectedRisk: 'HIGH',
    context: teacherContext,
    planOverride: operationPlan('Unauthorized class create', [{ action: 'createRecord', entity: 'Class', data: { name: 'Class 9' } }], 'HIGH'),
  },
  {
    category: 'Follow-up questions',
    prompt: 'Add a new academic year',
    expectedBehavior: 'Planner should ask for academic year name, start date, and end date instead of inventing values.',
    expectedRisk: 'LOW',
    context: schoolAdminContext,
  },
  {
    category: 'Follow-up questions',
    prompt: 'Setup primary school classes',
    expectedBehavior: 'Planner should ask for class range and academic year instead of assuming grades and dates.',
    expectedRisk: 'LOW',
    context: schoolAdminContext,
  },
  {
    category: 'Follow-up questions',
    prompt: 'Create subjects English, Math, Science and assign them to Classes 1 to 5',
    expectedBehavior: 'Planner should ask for missing section and teacher information before assignment.',
    expectedRisk: 'LOW',
    context: schoolAdminContext,
  },
  {
    category: 'Date normalization',
    prompt: 'Create academic year 2027-2028 starting Jan 1 2027 to Dec 31 2028',
    expectedBehavior: 'Planner should normalize dates to 2027-01-01 and 2028-12-31.',
    expectedRisk: 'LOW',
    context: schoolAdminContext,
  },
  {
    category: 'Date normalization',
    prompt: 'Create academic year 2027-2028 starting 10/10/2027 to 12/31/2028',
    expectedBehavior: 'Planner should reject ambiguous slash dates and ask for YYYY-MM-DD.',
    expectedRisk: 'LOW',
    context: schoolAdminContext,
  },
  {
    category: 'Date normalization',
    prompt: 'Create academic year 2027-2028 starting 2027-01-01 to 2028-12-31',
    expectedBehavior: 'Planner should accept already-normalized ISO dates.',
    expectedRisk: 'LOW',
    context: schoolAdminContext,
  },
  {
    category: 'Name resolution',
    prompt: 'Resolve Class 1 and Section A for a class-section mapping',
    expectedBehavior: 'Validator should resolve className and sectionName to UUID fields.',
    expectedRisk: 'LOW',
    context: schoolAdminContext,
    planOverride: operationPlan('Resolve class-section names', [
      { action: 'linkRecords', entity: 'ClassSection', data: { className: 'Class 1', sectionName: 'A' } },
    ]),
  },
  {
    category: 'Name resolution',
    prompt: 'Resolve academic year 2026-2027 while creating Class 8',
    expectedBehavior: 'Validator should resolve academicYearName to academicYearId.',
    expectedRisk: 'LOW',
    context: schoolAdminContext,
    planOverride: operationPlan('Resolve academic year name', [
      { action: 'createRecord', entity: 'Class', data: { name: 'Class 8', academicYearName: '2026-2027' } },
    ]),
  },
  {
    category: 'Name resolution',
    prompt: 'Resolve missing Section Z for a class-section mapping',
    expectedBehavior: 'Validator should fail because Section Z does not exist.',
    expectedRisk: 'MEDIUM',
    context: schoolAdminContext,
    planOverride: operationPlan('Missing section resolution', [
      { action: 'linkRecords', entity: 'ClassSection', data: { className: 'Class 1', sectionName: 'Z' } },
    ], 'MEDIUM'),
  },
  {
    category: 'Name resolution',
    prompt: 'Resolve missing academic year 2099-2100',
    expectedBehavior: 'Validator should fail because the academic year name does not exist.',
    expectedRisk: 'MEDIUM',
    context: schoolAdminContext,
    planOverride: operationPlan('Missing academic year resolution', [
      { action: 'createRecord', entity: 'Class', data: { name: 'Class 99', academicYearName: '2099-2100' } },
    ], 'MEDIUM'),
  },
  {
    category: 'Duplicate handling',
    prompt: 'Create duplicate sections A and A',
    expectedBehavior: 'Validator should reject duplicate records in the same plan.',
    expectedRisk: 'MEDIUM',
    context: schoolAdminContext,
    planOverride: operationPlan('Duplicate sections', [
      { action: 'bulkCreateRecords', entity: 'Section', data: [{ name: 'A' }, { name: 'A' }] },
    ], 'MEDIUM'),
  },
  {
    category: 'Duplicate handling',
    prompt: 'Map the same section twice to Class 1',
    expectedBehavior: 'Validator should reject duplicate class-section mapping in the same plan.',
    expectedRisk: 'MEDIUM',
    context: schoolAdminContext,
    planOverride: operationPlan('Duplicate mapping', [
      { action: 'linkRecords', entity: 'ClassSection', data: [{ className: 'Class 1', sectionName: 'A' }, { className: 'Class 1', sectionName: 'A' }] },
    ], 'MEDIUM'),
  },
  {
    category: 'Relation mapping',
    prompt: 'Map section A to Class 1',
    expectedBehavior: 'Deterministic mapping should validate using name-based references.',
    expectedRisk: 'LOW',
    context: schoolAdminContext,
    planOverride: operationPlan('Single class-section mapping', [
      { action: 'linkRecords', entity: 'ClassSection', data: { className: 'Class 1', sectionName: 'A' } },
    ]),
  },
  {
    category: 'Relation mapping',
    prompt: 'Map sections A and B to Classes 1 to 5',
    expectedBehavior: 'Planner should generate and validate name-based mapping preview for Sections A/B and Classes 1-5.',
    expectedRisk: 'MEDIUM',
    context: schoolAdminContext,
  },
  {
    category: 'Relation reads',
    prompt: 'Show classes without sections',
    expectedBehavior: 'Planner should generate relation-none filter on Class.classSections.',
    expectedRisk: 'LOW',
    context: schoolAdminContext,
  },
  {
    category: 'Relation reads',
    prompt: 'Show classes without subjects',
    expectedBehavior: 'Planner should generate relation-none filter on Class.assignSubjects.',
    expectedRisk: 'LOW',
    context: schoolAdminContext,
  },
  {
    category: 'Relation reads',
    prompt: 'Show sections not mapped to classes',
    expectedBehavior: 'Planner should generate relation-none filter on Section.classSections.',
    expectedRisk: 'LOW',
    context: schoolAdminContext,
  },
  {
    category: 'Subject planning',
    prompt: 'Create subjects English, Math and Science',
    expectedBehavior: 'Planner should produce a bulk subject create preview with valid THEORY type.',
    expectedRisk: 'LOW',
    context: schoolAdminContext,
  },
  {
    category: 'Subject planning',
    prompt: 'Create subject Robotics with type Core',
    expectedBehavior: 'Validator should reject invalid subject enum if generated.',
    expectedRisk: 'MEDIUM',
    context: schoolAdminContext,
    planOverride: operationPlan('Invalid subject type', [
      { action: 'createRecord', entity: 'Subject', data: { name: 'Robotics', type: 'Core' } },
    ], 'MEDIUM'),
  },
  {
    category: 'Bulk limits',
    prompt: 'Create classes 1 to 60',
    expectedBehavior: 'Validator should reject class bulk create over maxBulkCount 50.',
    expectedRisk: 'HIGH',
    context: schoolAdminContext,
    planOverride: operationPlan('Too many classes', [
      { action: 'bulkCreateRecords', entity: 'Class', data: Array.from({ length: 60 }, (_, index) => ({ name: `Class ${index + 1}` })) },
    ], 'HIGH'),
  },
  {
    category: 'Invalid IDs',
    prompt: 'Create subject English for classId 5',
    expectedBehavior: 'Validator should reject non-UUID classId and require name resolution or real UUID.',
    expectedRisk: 'HIGH',
    context: schoolAdminContext,
    planOverride: operationPlan('Invalid classId', [
      { action: 'createRecord', entity: 'Subject', data: { name: 'English', classId: '5', type: 'THEORY' } },
    ], 'HIGH'),
  },
];

const asMarkdownJson = (value: unknown) => `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;

const evaluateCase = async (entry: EvaluationCase): Promise<EvaluationResult> => {
  const plan = entry.planOverride ?? await planAiOperations(entry.prompt);
  if (!plan) {
    return {
      category: entry.category,
      prompt: entry.prompt,
      generatedPlan: null,
      validationResult: 'NO_PLAN',
      validationMessage: 'Planner returned no operation plan.',
      expectedBehavior: entry.expectedBehavior,
      riskLevel: entry.expectedRisk,
    };
  }
  if (plan.type === 'follow_up') {
    return {
      category: entry.category,
      prompt: entry.prompt,
      generatedPlan: plan,
      validationResult: 'FOLLOW_UP',
      validationMessage: plan.message,
      expectedBehavior: entry.expectedBehavior,
      riskLevel: plan.risk,
    };
  }

  try {
    const validated = await validateAiOperationPlan(entry.context, plan);
    return {
      category: entry.category,
      prompt: entry.prompt,
      generatedPlan: validated,
      validationResult: 'PASS',
      validationMessage: `Validated as ${validated.status}.`,
      expectedBehavior: entry.expectedBehavior,
      riskLevel: validated.risk,
    };
  } catch (error) {
    return {
      category: entry.category,
      prompt: entry.prompt,
      generatedPlan: plan,
      validationResult: 'FAIL',
      validationMessage: error instanceof Error ? error.message : 'Unknown validation error',
      expectedBehavior: entry.expectedBehavior,
      riskLevel: plan.risk,
    };
  }
};

const renderReport = (results: EvaluationResult[]) => {
  const counts = results.reduce<Record<string, number>>((acc, result) => {
    acc[result.validationResult] = (acc[result.validationResult] ?? 0) + 1;
    return acc;
  }, {});

  const lines = [
    '# AI Operation Planner Evaluation',
    '',
    `Generated at: ${new Date().toISOString()}`,
    '',
    `Summary: PASS=${counts.PASS ?? 0}, FAIL=${counts.FAIL ?? 0}, FOLLOW_UP=${counts.FOLLOW_UP ?? 0}, NO_PLAN=${counts.NO_PLAN ?? 0}`,
    '',
  ];

  for (const [index, result] of results.entries()) {
    lines.push(`## ${index + 1}. ${result.category}`);
    lines.push('');
    lines.push(`Prompt: ${result.prompt}`);
    lines.push('');
    lines.push(`Validation result: ${result.validationResult}`);
    lines.push('');
    lines.push(`Validation message: ${result.validationMessage}`);
    lines.push('');
    lines.push(`Expected execution behavior: ${result.expectedBehavior}`);
    lines.push('');
    lines.push(`Risk level: ${result.riskLevel}`);
    lines.push('');
    lines.push('Generated operation plan:');
    lines.push('');
    lines.push(asMarkdownJson(result.generatedPlan));
    lines.push('');
  }

  lines.push('## Current Planner Limitations');
  lines.push('');
  lines.push('- Local deterministic planning is limited to academic setup/read patterns; unsupported modules must continue using existing tools or follow-up responses.');
  lines.push('- Multi-step prompts without required academic-year dates are intentionally converted to follow-up questions instead of invented defaults.');
  lines.push('- Date normalization supports ISO dates and clear month-name dates; slash-style dates are rejected as ambiguous.');
  lines.push('- Name resolution is currently implemented for academic years, classes, and sections only.');
  lines.push('- Phase 3A execution is limited to AcademicYear, Class, Section, and ClassSection setup writes with dry-run confirmation.');
  lines.push('- Other generic write plans remain preview-only until their domain-specific guardrails are added.');
  lines.push('- Relation-aware reads cover basic none-filters only; richer aggregates and counts need additional deterministic query shapes.');
  lines.push('');
  lines.push('## Recommended Guardrails Before Phase 3 Writes');
  lines.push('');
  lines.push('- Normalize and validate dates before confirmation.');
  lines.push('- Add deterministic local planners for bulk sections and class-section mappings.');
  lines.push('- Add dry-run duplicate checks and explicit skip/create counts.');
  lines.push('- Execute generic writes only inside Prisma transactions.');
  lines.push('- Keep maximum operation and bulk record limits per entity.');
  lines.push('- Block delete entirely until a separate deletion approval workflow exists.');
  lines.push('- Require entity-level permissions in addition to AI assistant execute permission.');
  lines.push('- Show a detailed preview and require confirmation for every write plan.');
  lines.push('- Audit original prompt, validated plan, user confirmation, and execution result.');
  lines.push('- Use existing feature services or workflow functions where business logic is non-trivial.');
  lines.push('');

  return lines.join('\n');
};

const main = async () => {
  patchSecurityTestDependencies();
  const results = [];
  for (const entry of cases) {
    results.push(await evaluateCase(entry));
  }

  const report = renderReport(results);
  const outputPath = path.resolve(process.cwd(), 'reports/ai-operation-plan-evaluation.md');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, report);
  console.log(report);
  console.log(`\nReport written to ${outputPath}`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    restoreSecurityTestDependencies();
    await closeBackgroundHandles();
  });
