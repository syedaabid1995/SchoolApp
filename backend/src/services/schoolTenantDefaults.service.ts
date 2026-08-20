import { Prisma } from '@prisma/client';
import {
  EMPLOYEE_PERMISSION_CATALOG,
  MANAGED_EMPLOYEE_ROLES,
  getDefaultPermissionCodes,
} from '../utils/employeePermissions';

type DbClient = Prisma.TransactionClient;

export const DEFAULT_EXPENSE_CATEGORIES = [
  ['Salary', 10],
  ['Transport', 20],
  ['Maintenance', 30],
  ['Utilities', 40],
  ['Stationery', 50],
  ['Rent', 60],
  ['Events', 70],
  ['Exam', 80],
  ['Library', 90],
  ['Other', 100],
] as const;

const normalizeText = (value: string) => value.trim().replace(/\s+/g, ' ');
const normalizeName = (value: string) => normalizeText(value).toLowerCase();

export const seedDefaultExpenseCategories = async (client: DbClient, schoolId: string) => {
  let upserted = 0;
  for (const [name, sortOrder] of DEFAULT_EXPENSE_CATEGORIES) {
    await client.expenseCategory.upsert({
      where: {
        unique_expense_category_normalized_name: {
          schoolId,
          normalizedName: normalizeName(name),
        },
      },
      update: {
        name,
        status: 'ACTIVE',
        isDefault: true,
        sortOrder,
        deletedAt: null,
      },
      create: {
        schoolId,
        name,
        normalizedName: normalizeName(name),
        status: 'ACTIVE',
        isDefault: true,
        sortOrder,
      },
    });
    upserted += 1;
  }
  return upserted;
};

export const seedEmployeeRolePermissions = async (client: DbClient, schoolId: string) => {
  const permissionCodes = EMPLOYEE_PERMISSION_CATALOG.map((entry) => entry.code);
  const rows = [];

  for (const roleName of MANAGED_EMPLOYEE_ROLES) {
    const enabledCodes = new Set(getDefaultPermissionCodes(roleName));
    for (const permissionCode of permissionCodes) {
      rows.push({
        schoolId,
        roleName,
        permissionCode,
        enabled: enabledCodes.has(permissionCode),
      });
    }
  }

  const result = await client.employeeRolePermission.createMany({
    data: rows,
    skipDuplicates: true,
  });

  return result.count;
};

export const seedSchoolTenantDefaults = async (client: DbClient, schoolId: string) => {
  const expenseCategories = await seedDefaultExpenseCategories(client, schoolId);
  const employeeRolePermissions = await seedEmployeeRolePermissions(client, schoolId);

  return {
    expenseCategories,
    employeeRolePermissions,
  };
};
