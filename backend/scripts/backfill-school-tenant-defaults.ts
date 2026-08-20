import { prisma } from '../src/config/db';
import {
  DEFAULT_EXPENSE_CATEGORIES,
  seedSchoolTenantDefaults,
} from '../src/services/schoolTenantDefaults.service';
import {
  EMPLOYEE_PERMISSION_CATALOG,
  MANAGED_EMPLOYEE_ROLES,
} from '../src/utils/employeePermissions';

type Options = {
  apply: boolean;
  schoolId?: string;
};

const parseOptions = (): Options => {
  const args = process.argv.slice(2);
  const options: Options = { apply: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--apply') options.apply = true;
    else if (arg === '--dry-run') options.apply = false;
    else if (arg === '--school-id') options.schoolId = args[++index];
    else if (arg === '--help') {
      console.log('Usage: tsx scripts/backfill-school-tenant-defaults.ts [--dry-run] [--apply] [--school-id <id>]');
      process.exit(0);
    }
  }
  return options;
};

const expectedExpenseCategories = DEFAULT_EXPENSE_CATEGORIES.length;
const expectedEmployeeRolePermissions = MANAGED_EMPLOYEE_ROLES.length * EMPLOYEE_PERMISSION_CATALOG.length;

const getSchoolDefaultCounts = async (schoolId: string) => {
  const [expenseCategories, employeeRolePermissions] = await Promise.all([
    prisma.expenseCategory.count({
      where: {
        schoolId,
        isDefault: true,
        deletedAt: null,
      },
    }),
    prisma.employeeRolePermission.count({ where: { schoolId } }),
  ]);

  return {
    expenseCategories,
    employeeRolePermissions,
    missingExpenseCategories: Math.max(0, expectedExpenseCategories - expenseCategories),
    missingEmployeeRolePermissions: Math.max(0, expectedEmployeeRolePermissions - employeeRolePermissions),
  };
};

const main = async () => {
  const options = parseOptions();
  const schools = await prisma.school.findMany({
    where: {
      deletedAt: null,
      ...(options.schoolId ? { id: options.schoolId } : {}),
    },
    select: { id: true, name: true, code: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

  const before = await Promise.all(
    schools.map(async (school) => ({
      school,
      counts: await getSchoolDefaultCounts(school.id),
    })),
  );
  const changedSchools = before.filter(
    (entry) => entry.counts.missingExpenseCategories > 0 || entry.counts.missingEmployeeRolePermissions > 0,
  );

  let appliedSchools = 0;
  if (options.apply) {
    for (const entry of changedSchools) {
      await prisma.$transaction((tx) => seedSchoolTenantDefaults(tx, entry.school.id));
      appliedSchools += 1;
    }
  }

  const after = options.apply
    ? await Promise.all(
        schools.map(async (school) => ({
          school,
          counts: await getSchoolDefaultCounts(school.id),
        })),
      )
    : before;

  console.log(JSON.stringify({
    ok: true,
    dryRun: !options.apply,
    applied: options.apply,
    modifiedDatabase: options.apply,
    scope: {
      schoolId: options.schoolId ?? null,
    },
    expected: {
      expenseCategories: expectedExpenseCategories,
      employeeRolePermissions: expectedEmployeeRolePermissions,
    },
    scannedSchools: schools.length,
    changedSchools: changedSchools.length,
    appliedSchools,
    schools: after.map((entry) => ({
      id: entry.school.id,
      code: entry.school.code,
      name: entry.school.name,
      ...entry.counts,
    })),
  }, null, 2));
};

main()
  .catch((error) => {
    const applied = process.argv.slice(2).includes('--apply');
    console.error(JSON.stringify({
      ok: false,
      dryRun: !applied,
      applied,
      modifiedDatabase: false,
      message: error instanceof Error ? error.message : 'School tenant default backfill failed.',
    }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
