import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertProcessRoleAllowed,
  parseProcessRole,
  processRoleStartsApi,
  processRoleStartsSchedulers,
  processRoleStartsWorkers,
} from '../runtime/processRole';
import { createSchedulerRuntime } from '../runtime/schedulerRuntime';
import { createWorkerRuntime } from '../runtime/workerRuntime';

test('process role parser defaults to api in production and all outside production', () => {
  assert.equal(parseProcessRole(undefined, 'production'), 'api');
  assert.equal(parseProcessRole(undefined, 'development'), 'all');
  assert.equal(parseProcessRole('worker', 'production'), 'worker');
  assert.throws(() => parseProcessRole('invalid', 'production'), /Invalid ACADEMIFY_PROCESS_ROLE/);
});

test('combined all role is rejected in production', () => {
  assert.doesNotThrow(() => assertProcessRoleAllowed('api', 'production'));
  assert.doesNotThrow(() => assertProcessRoleAllowed('all', 'development'));
  assert.throws(() => assertProcessRoleAllowed('all', 'production'), /not allowed in production/);
});

test('process role capability helpers map API, workers, and schedulers explicitly', () => {
  assert.equal(processRoleStartsApi('api'), true);
  assert.equal(processRoleStartsWorkers('api'), false);
  assert.equal(processRoleStartsSchedulers('api'), false);

  assert.equal(processRoleStartsApi('worker'), false);
  assert.equal(processRoleStartsWorkers('worker'), true);
  assert.equal(processRoleStartsSchedulers('worker'), false);

  assert.equal(processRoleStartsApi('scheduler'), false);
  assert.equal(processRoleStartsWorkers('scheduler'), false);
  assert.equal(processRoleStartsSchedulers('scheduler'), true);

  assert.equal(processRoleStartsApi('all'), true);
  assert.equal(processRoleStartsWorkers('all'), true);
  assert.equal(processRoleStartsSchedulers('all'), true);
});

test('worker runtime starts once and stops started workers in reverse order', async () => {
  const events: string[] = [];
  const runtime = createWorkerRuntime([
    { name: 'first', start: () => { events.push('start:first'); }, stop: () => { events.push('stop:first'); } },
    { name: 'second', start: () => { events.push('start:second'); }, stop: () => { events.push('stop:second'); } },
  ]);

  await runtime.start();
  await runtime.start();
  assert.deepEqual(runtime.getStartedWorkerNames(), ['first', 'second']);
  await runtime.stop();

  assert.deepEqual(events, ['start:first', 'start:second', 'stop:second', 'stop:first']);
});

test('scheduler runtime starts once and clears scheduler lifecycles on stop', async () => {
  const events: string[] = [];
  const runtime = createSchedulerRuntime([
    { name: 'hourly', start: () => { events.push('start:hourly'); }, stop: () => { events.push('stop:hourly'); } },
  ]);

  await runtime.start();
  await runtime.start();
  assert.deepEqual(runtime.getStartedSchedulerNames(), ['hourly']);
  await runtime.stop();
  assert.deepEqual(runtime.getStartedSchedulerNames(), []);
  assert.deepEqual(events, ['start:hourly', 'stop:hourly']);
});
