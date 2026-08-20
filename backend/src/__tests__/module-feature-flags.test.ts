import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { prisma } from '../config/db';
import {
  assertModuleFeatureEnabled,
  ensureModuleFeatureFlags,
  getEffectiveModuleFeatureFlags,
  MODULE_FEATURE_KEYS,
} from '../services/feature-flag.service';

type TestFeatureFlagRow = {
  key: string;
  status: 'ENABLED' | 'DISABLED';
  overrides: Array<{
    schoolId?: string | null;
    userId?: string | null;
    status: 'ENABLED' | 'DISABLED';
  }>;
};

let restoreFindMany: (() => void) | null = null;
let restoreCreate: (() => void) | null = null;
let restoreUpdate: (() => void) | null = null;
let restoreTransaction: (() => void) | null = null;

const patchFeatureFlags = (rows: TestFeatureFlagRow[]) => {
  const original = prisma.featureFlag.findMany;
  (prisma.featureFlag.findMany as any) = async () => rows;
  restoreFindMany = () => {
    (prisma.featureFlag.findMany as any) = original;
    restoreFindMany = null;
  };
};

afterEach(() => {
  restoreFindMany?.();
  restoreCreate?.();
  restoreUpdate?.();
  restoreTransaction?.();
});

test('module flags default to enabled when flag rows are missing', async () => {
  patchFeatureFlags([]);

  const flags = await getEffectiveModuleFeatureFlags();

  assert.equal(flags.module_ai_assistant, true);
  assert.equal(flags.module_expenses, true);
});

test('module global disabled is a hard platform disable even with enabled overrides', async () => {
  patchFeatureFlags([
    {
      key: 'module_ai_assistant',
      status: 'DISABLED',
      overrides: [{ schoolId: 'school-1', userId: 'user-1', status: 'ENABLED' }],
    },
  ]);

  const flags = await getEffectiveModuleFeatureFlags({ schoolId: 'school-1', userId: 'user-1' });

  assert.equal(flags.module_ai_assistant, false);
  await assert.rejects(
    () => assertModuleFeatureEnabled({ key: 'module_ai_assistant', schoolId: 'school-1', userId: 'user-1' }),
    /disabled by the platform administrator/i,
  );
});

test('module overrides can disable a globally enabled module for a school or user', async () => {
  patchFeatureFlags([
    {
      key: 'module_expenses',
      status: 'ENABLED',
      overrides: [
        { schoolId: 'school-1', userId: null, status: 'DISABLED' },
        { schoolId: 'school-2', userId: 'user-2', status: 'DISABLED' },
      ],
    },
  ]);

  assert.equal((await getEffectiveModuleFeatureFlags({ schoolId: 'school-1' })).module_expenses, false);
  assert.equal((await getEffectiveModuleFeatureFlags({ schoolId: 'school-2', userId: 'user-2' })).module_expenses, false);
  assert.equal((await getEffectiveModuleFeatureFlags({ schoolId: 'school-3' })).module_expenses, true);
});

test('module flag backfill creates missing rows without overwriting existing status', async () => {
  const createCalls: any[] = [];
  const updateCalls: any[] = [];
  const originalFindMany = prisma.featureFlag.findMany;
  const originalCreate = prisma.featureFlag.create;
  const originalUpdate = prisma.featureFlag.update;
  const originalTransaction = prisma.$transaction;

  (prisma.featureFlag.findMany as any) = async () => [
    {
      key: 'module_ai_assistant',
      name: 'Legacy AI Assistant',
      description: 'Legacy description',
    },
  ];
  (prisma.featureFlag.create as any) = async ({ data }: any) => {
    createCalls.push(data);
    return data;
  };
  (prisma.featureFlag.update as any) = async ({ where, data }: any) => {
    updateCalls.push({ where, data });
    return { ...where, ...data };
  };
  (prisma.$transaction as any) = async (operations: Array<Promise<unknown>>) => Promise.all(operations);

  restoreFindMany = () => {
    (prisma.featureFlag.findMany as any) = originalFindMany;
    restoreFindMany = null;
  };
  restoreCreate = () => {
    (prisma.featureFlag.create as any) = originalCreate;
    restoreCreate = null;
  };
  restoreUpdate = () => {
    (prisma.featureFlag.update as any) = originalUpdate;
    restoreUpdate = null;
  };
  restoreTransaction = () => {
    (prisma.$transaction as any) = originalTransaction;
    restoreTransaction = null;
  };

  await ensureModuleFeatureFlags();

  assert.equal(createCalls.length, MODULE_FEATURE_KEYS.length - 1);
  assert.ok(createCalls.every((data) => data.status === 'ENABLED'));
  assert.equal(updateCalls.length, 1);
  assert.deepEqual(updateCalls[0].where, { key: 'module_ai_assistant' });
  assert.equal(Object.prototype.hasOwnProperty.call(updateCalls[0].data, 'status'), false);
});
