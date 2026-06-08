import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planAiOperations } from '../services/aiOperationPlanner.service';
import type { AiOperationPlan } from '../types/aiAssistant.types';

const operationPlanFor = async (prompt: string) => {
  const plan = await planAiOperations(prompt);
  assert.ok(plan, 'expected planner result');
  assert.equal(plan.type, 'operation_plan');
  return plan as AiOperationPlan;
};

const sectionNames = (plan: AiOperationPlan) => {
  const operation = plan.operations.find((entry) => entry.entity === 'Section');
  assert.ok(operation, 'expected Section operation');
  assert.ok(Array.isArray(operation.data), 'expected Section bulk data');
  return operation.data.map((entry) => String(entry.name));
};

const mappingCount = (plan: AiOperationPlan) =>
  plan.operations
    .filter((entry) => entry.entity === 'ClassSection')
    .reduce((total, operation) => total + (Array.isArray(operation.data) ? operation.data.length : 0), 0);

const entityOperation = (plan: AiOperationPlan, entity: string) => {
  const operation = plan.operations.find((entry) => entry.entity === entity);
  assert.ok(operation, `expected ${entity} operation`);
  return operation;
};

test('planner creates sections A and B without extra text in names', async () => {
  const plan = await operationPlanFor('Create sections A and B');
  assert.deepEqual(sectionNames(plan), ['A', 'B']);
  assert.equal(plan.operations.length, 1);
});

test('planner separates section creation from A/B mapping in one sentence', async () => {
  const plan = await operationPlanFor('Create sections A, B and map A/B to classes 1-5');
  assert.deepEqual(sectionNames(plan), ['A', 'B']);
  assert.equal(plan.operations.length, 2);
  assert.equal(mappingCount(plan), 10);
});

test('planner creates sections A B C and maps all of them', async () => {
  const plan = await operationPlanFor('Create sections A, B, C and map A/B/C to classes 1-3');
  assert.deepEqual(sectionNames(plan), ['A', 'B', 'C']);
  assert.equal(mappingCount(plan), 9);
});

test('planner handles multi-line mixed create and map prompts', async () => {
  const plan = await operationPlanFor(`Create sections A, B
Map A/B to classes 1-5
Map only A to classes 6-12`);

  assert.deepEqual(sectionNames(plan), ['A', 'B']);
  assert.equal(plan.operations.length, 3);
  assert.equal(mappingCount(plan), 17);
});

test('planner handles full academic setup prompt with ISO dates and sentence separators', async () => {
  const plan = await operationPlanFor(
    'Create academic year 2027-2028 starting 2027-01-01 to 2028-12-31. Create classes 1 to 12. Create sections A and B. Map sections A and B to classes 1 to 5. Map only section A to classes 6 to 12.',
  );

  assert.equal(plan.operations.length, 5);
  assert.deepEqual(entityOperation(plan, 'AcademicYear').data, {
    name: '2027-2028',
    startDate: '2027-01-01',
    endDate: '2028-12-31',
  });
  const classOperation = entityOperation(plan, 'Class');
  assert.ok(Array.isArray(classOperation.data));
  assert.equal(classOperation.data.length, 12);
  assert.deepEqual(sectionNames(plan), ['A', 'B']);
  assert.equal(mappingCount(plan), 17);
});

test('planner handles quoted full academic setup prompt', async () => {
  const plan = await operationPlanFor(
    'Create academic year "2027-2028" starting "2027-01-01" to "2028-12-31". Create classes "1 to 12". Create sections "A and B". Map sections "A and B" to classes "1 to 5". Map only section "A" to classes "6 to 12".',
  );

  assert.deepEqual(sectionNames(plan), ['A', 'B']);
  assert.equal(mappingCount(plan), 17);
});

test('planner handles comma-separated mixed create and map prompts', async () => {
  const plan = await operationPlanFor('Create sections A, B, map A/B to classes 1-5, map only A to classes 6-12');
  assert.deepEqual(sectionNames(plan), ['A', 'B']);
  assert.equal(plan.operations.length, 3);
  assert.equal(mappingCount(plan), 17);
});

test('planner supports pronoun mapping after creating sections', async () => {
  const plan = await operationPlanFor('Create sections A, B, C and map them to classes 1-2');
  assert.deepEqual(sectionNames(plan), ['A', 'B', 'C']);
  assert.equal(mappingCount(plan), 6);
});

test('planner handles legacy combined mapping with onwards suffix', async () => {
  const plan = await operationPlanFor('Map sections A and B to Classes 1 to 5, and only section A from Class 6 onwards');
  assert.equal(plan.operations.length, 2);
  assert.equal(mappingCount(plan), 17);
});

test('planner does not concatenate mapping instructions into section names', async () => {
  const plan = await operationPlanFor(`Create sections A, B
Map A/B to classes 1-5
Map only A to classes 6-12`);

  for (const name of sectionNames(plan)) {
    assert.doesNotMatch(name, /map|classes|only/i);
  }
});
