import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { PrismaClient, type RoleName } from '@prisma/client';
import { hashPassword } from '../src/utils/password';

const prisma = new PrismaClient();

const REQUIRED_ALLOW_FLAG = 'true';
const REQUIRED_CONFIRM_FLAG = 'RESET';
const DEFAULT_SUPER_ADMIN_EMAIL = 'techstageit@admin.com';
const DEFAULT_SUPER_ADMIN_PASSWORD = 'Password@123';

const PRESERVED_TABLES = new Set([
  'roles',
  'permissions',
  'role_permissions',
  'subscription_plans',
  'subscription_plan_permissions',
  'feature_flags',
  'config_entries',
  'notification_templates',
  'messaging_services',
  'consent_documents',
]);

const ROLE_NAMES: RoleName[] = [
  'SUPER_ADMIN',
  'SCHOOL_ADMIN',
  'TEACHER',
  'ACCOUNTANT',
  'LIBRARIAN',
  'STAFF',
  'PARENT',
];

type DatabaseTarget = {
  host: string;
  database: string;
};

const fail = (message: string): never => {
  console.error(`QA reset refused: ${message}`);
  process.exit(1);
};

const parseDatabaseTarget = (): DatabaseTarget => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    fail('DATABASE_URL is not set.');
  }

  try {
    const url = new URL(databaseUrl);
    return {
      host: url.hostname || '(local socket)',
      database: url.pathname.replace(/^\//, '') || '(unknown)',
    };
  } catch {
    return { host: '(unparseable DATABASE_URL)', database: '(unparseable DATABASE_URL)' };
  }
};

const requireResetGuards = () => {
  if (process.env.NODE_ENV === 'production') {
    fail('NODE_ENV=production is never allowed.');
  }

  if (process.env.ALLOW_QA_DB_RESET !== REQUIRED_ALLOW_FLAG) {
    fail(`set ALLOW_QA_DB_RESET=${REQUIRED_ALLOW_FLAG}.`);
  }

  if (process.env.CONFIRM_QA_DB_RESET !== REQUIRED_CONFIRM_FLAG) {
    fail(`set CONFIRM_QA_DB_RESET=${REQUIRED_CONFIRM_FLAG}.`);
  }

  if ((process.env.RESET_SCOPE ?? 'tenant') !== 'tenant') {
    fail('only RESET_SCOPE=tenant is supported. Full reset is intentionally not implemented because the repo seed creates demo school data.');
  }
};

const getPrismaTableNames = () => {
  const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  const tables: string[] = [];
  const modelBlocks = schema.match(/^model\s+\w+\s+\{[\s\S]*?^\}/gm) ?? [];

  for (const block of modelBlocks) {
    const modelName = block.match(/^model\s+(\w+)\s+\{/m)?.[1];
    const mappedName = block.match(/@@map\("([^"]+)"\)/)?.[1];
    if (mappedName) {
      tables.push(mappedName);
    } else if (modelName) {
      tables.push(modelName);
    }
  }

  return Array.from(new Set(tables)).sort();
};

const getExistingPublicTables = async () => {
  const rows = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
  `;

  return new Set(rows.map((row) => row.table_name));
};

const quoteIdentifier = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`;

const truncateTables = async (tables: string[]) => {
  if (!tables.length) {
    console.log('No QA data tables found to truncate.');
    return;
  }

  const tableList = tables.map(quoteIdentifier).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
};

const ensureGlobalRoles = async () => {
  for (const name of ROLE_NAMES) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
};

const ensureGlobalSuperAdmin = async () => {
  const email = process.env.QA_SUPER_ADMIN_EMAIL ?? DEFAULT_SUPER_ADMIN_EMAIL;
  const password = process.env.QA_SUPER_ADMIN_PASSWORD ?? DEFAULT_SUPER_ADMIN_PASSWORD;
  const passwordHash = await hashPassword(password);
  const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'SUPER_ADMIN' } });

  const existingUser = await prisma.user.findFirst({
    where: {
      schoolId: null,
      email: { equals: email, mode: 'insensitive' },
    },
  });

  const user = existingUser
    ? await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          email,
          passwordHash,
          status: 'ACTIVE',
          mustChangePassword: false,
          mfaEnabled: false,
          mfaMethod: 'email',
        },
      })
    : await prisma.user.create({
        data: {
          schoolId: null,
          email,
          passwordHash,
          status: 'ACTIVE',
          mustChangePassword: false,
          mfaEnabled: false,
          mfaMethod: 'email',
        },
      });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: superAdminRole.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: superAdminRole.id,
    },
  });

  console.log(`Global Super Admin ready: ${email}`);
};

const main = async () => {
  requireResetGuards();

  const target = parseDatabaseTarget();
  console.log('QA database reset target:');
  console.log(`  Host: ${target.host}`);
  console.log(`  Database: ${target.database}`);
  console.log('  Scope: tenant');

  const schemaTables = getPrismaTableNames();
  const existingTables = await getExistingPublicTables();
  const tablesToTruncate = schemaTables.filter(
    (table) => existingTables.has(table) && table !== '_prisma_migrations' && !PRESERVED_TABLES.has(table),
  );

  console.log(`Preserved tables (${PRESERVED_TABLES.size}): ${Array.from(PRESERVED_TABLES).sort().join(', ')}`);
  console.log(`Deleting/truncating tables (${tablesToTruncate.length}): ${tablesToTruncate.join(', ')}`);

  await truncateTables(tablesToTruncate);
  await ensureGlobalRoles();
  await ensureGlobalSuperAdmin();

  console.log('QA database reset complete.');
  console.log('No schools, students, teachers, parents, attendance, exam, report, compliance, backup, support, fee, transport, dormitory, homework, or library tenant data should remain.');
};

main()
  .catch((error) => {
    console.error('QA reset failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
