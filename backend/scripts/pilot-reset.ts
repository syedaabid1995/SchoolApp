import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/password';

type Mode = 'dry-run' | 'apply';

type PrismaTable = {
  model: string;
  table: string;
};

type DatabaseTarget = {
  host: string;
  port: string | null;
  database: string;
  sslmode: string | null;
};

const prisma = new PrismaClient();
const args = process.argv.slice(2);

const PRESERVED_TABLES = new Set([
  'roles',
  'permissions',
  'role_permissions',
  'subscription_plans',
  'subscription_plan_permissions',
  'feature_flags',
  'config_entries',
  'messaging_services',
  'consent_documents',
]);

const NEVER_CLEAR_TABLES = new Set(['_prisma_migrations']);

const hasFlag = (flag: string) => args.includes(flag);
const argValue = (name: string) => {
  const prefix = `${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
};

const fail = (message: string): never => {
  console.error(`Pilot reset refused: ${message}`);
  process.exit(1);
};

const printUsage = () => {
  console.log([
    'Usage: npm run pilot:reset -- [--dry-run] [--apply --allow-pilot-reset --confirm-dry-run-reviewed] [--create-clean-admin]',
    '',
    'Defaults to --dry-run. Apply mode is destructive and requires --apply, --allow-pilot-reset, and --confirm-dry-run-reviewed.',
    'NODE_ENV=production also requires --allow-pilot-reset, even for dry-run.',
    '',
    'Optional clean admin creation after apply:',
    '  --create-clean-admin requires PILOT_SUPER_ADMIN_EMAIL and PILOT_SUPER_ADMIN_PASSWORD.',
    '',
    'The script never deletes S3 objects and never touches _prisma_migrations.',
  ].join('\n'));
};

const parseMode = (): Mode => {
  const dryRun = hasFlag('--dry-run');
  const apply = hasFlag('--apply');

  if (dryRun && apply) fail('use either --dry-run or --apply, not both.');
  return apply ? 'apply' : 'dry-run';
};

const assertSafeFlags = (mode: Mode) => {
  if (hasFlag('--help') || hasFlag('-h')) {
    printUsage();
    process.exit(0);
  }

  if (hasFlag('--allow-pilot-reset') && mode === 'dry-run') {
    console.warn('Pilot reset warning: --allow-pilot-reset was supplied in dry-run mode; no rows will be deleted.');
  }

  if (mode === 'apply' && !hasFlag('--allow-pilot-reset')) {
    fail('destructive apply requires --allow-pilot-reset.');
  }

  if (mode === 'apply' && !hasFlag('--confirm-dry-run-reviewed')) {
    fail('destructive apply requires --confirm-dry-run-reviewed after reviewing dry-run output.');
  }

  if (process.env.NODE_ENV === 'production' && !hasFlag('--allow-pilot-reset')) {
    fail('NODE_ENV=production requires --allow-pilot-reset. Run only after backup and operator review.');
  }

  if (hasFlag('--create-clean-admin') && mode !== 'apply') {
    console.warn('Pilot reset warning: --create-clean-admin is ignored in dry-run mode.');
  }
};

const parseDatabaseTarget = (): DatabaseTarget => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) fail('DATABASE_URL is not set.');

  try {
    const url = new URL(databaseUrl);
    return {
      host: url.hostname || '(local socket)',
      port: url.port || null,
      database: url.pathname.replace(/^\//, '') || '(unknown)',
      sslmode: url.searchParams.get('sslmode'),
    };
  } catch {
    return {
      host: '(unparseable DATABASE_URL)',
      port: null,
      database: '(unparseable DATABASE_URL)',
      sslmode: null,
    };
  }
};

const assertIdentifier = (identifier: string) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier parsed from Prisma schema: ${identifier}`);
  }
  return identifier;
};

const quoteIdentifier = (identifier: string) => `"${assertIdentifier(identifier).replace(/"/g, '""')}"`;

const getSchemaPath = () => {
  const candidates = [
    path.join(process.cwd(), 'prisma', 'schema.prisma'),
    path.join(process.cwd(), 'backend', 'prisma', 'schema.prisma'),
  ];
  const schemaPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!schemaPath) fail('could not find prisma/schema.prisma.');
  return schemaPath;
};

const getPrismaTables = (): PrismaTable[] => {
  const schema = fs.readFileSync(getSchemaPath(), 'utf8');
  const modelBlocks = schema.match(/^model\s+\w+\s+\{[\s\S]*?^\}/gm) ?? [];

  const tables = modelBlocks.map((block) => {
    const model = block.match(/^model\s+(\w+)\s+\{/m)?.[1];
    const mappedTable = block.match(/@@map\("([^"]+)"\)/)?.[1];
    if (!model) throw new Error('Failed to parse a Prisma model block.');
    return {
      model,
      table: assertIdentifier(mappedTable ?? model),
    };
  });

  const unique = new Map<string, PrismaTable>();
  for (const table of tables) unique.set(table.table, table);
  return Array.from(unique.values()).sort((a, b) => a.table.localeCompare(b.table));
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

const countRows = async (table: string) => {
  const rows = await prisma.$queryRawUnsafe<Array<{ row_count: bigint | number | string }>>(
    `SELECT COUNT(*)::bigint AS row_count FROM ${quoteIdentifier(table)}`,
  );
  const value = rows[0]?.row_count ?? 0;
  return typeof value === 'bigint' ? value.toString() : String(value);
};

const buildTablePlan = async () => {
  const prismaTables = getPrismaTables();
  const existingTables = await getExistingPublicTables();
  const missingTables = prismaTables.filter((entry) => !existingTables.has(entry.table)).map((entry) => entry.table);
  const clearTables = prismaTables
    .filter((entry) => existingTables.has(entry.table))
    .filter((entry) => !PRESERVED_TABLES.has(entry.table))
    .filter((entry) => !NEVER_CLEAR_TABLES.has(entry.table))
    .map((entry) => entry.table);
  const preservedTables = prismaTables
    .filter((entry) => existingTables.has(entry.table))
    .filter((entry) => PRESERVED_TABLES.has(entry.table))
    .map((entry) => entry.table);

  if (clearTables.some((table) => NEVER_CLEAR_TABLES.has(table))) {
    fail('_prisma_migrations appeared in the clear list. This should be impossible; refusing to continue.');
  }

  return { clearTables, preservedTables, missingTables };
};

const collectCounts = async (tables: string[]) => {
  const counts: Array<{ table: string; rows: string }> = [];
  for (const table of tables) {
    counts.push({ table, rows: await countRows(table) });
  }
  return counts;
};

const printCounts = (label: string, counts: Array<{ table: string; rows: string }>) => {
  console.log(`${label} (${counts.length}):`);
  for (const entry of counts) {
    console.log(`  ${entry.table}: ${entry.rows}`);
  }
};

const truncateApplicationTables = async (tables: string[]) => {
  if (!tables.length) {
    console.log('No application tables found to truncate.');
    return;
  }

  const tableList = tables.map(quoteIdentifier).join(', ');
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY`);
    },
    { maxWait: 5000, timeout: 120000 },
  );
};

const maskEmail = (email: string) => {
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return '<masked-email>';
  return `${localPart.slice(0, 2)}${'*'.repeat(Math.max(localPart.length - 2, 3))}@${domain}`;
};

const createCleanSuperAdmin = async () => {
  const email = process.env.PILOT_SUPER_ADMIN_EMAIL;
  const password = process.env.PILOT_SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    fail('--create-clean-admin requires PILOT_SUPER_ADMIN_EMAIL and PILOT_SUPER_ADMIN_PASSWORD.');
  }
  if (password.length < 12) {
    fail('PILOT_SUPER_ADMIN_PASSWORD must be at least 12 characters.');
  }

  const passwordHash = await hashPassword(password);
  const role = await prisma.role.upsert({
    where: { name: 'SUPER_ADMIN' },
    update: {},
    create: { name: 'SUPER_ADMIN' },
  });

  const existing = await prisma.user.findFirst({
    where: {
      schoolId: null,
      email: { equals: email, mode: 'insensitive' },
    },
    select: { id: true },
  });

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          email,
          passwordHash,
          status: 'ACTIVE',
          mustChangePassword: true,
          mfaEnabled: false,
          mfaMethod: null,
        },
        select: { id: true, email: true },
      })
    : await prisma.user.create({
        data: {
          schoolId: null,
          email,
          passwordHash,
          status: 'ACTIVE',
          mustChangePassword: true,
          mfaEnabled: false,
          mfaMethod: null,
        },
        select: { id: true, email: true },
      });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });

  console.log(JSON.stringify({
    cleanAdminCreated: true,
    email: maskEmail(user.email),
    role: 'SUPER_ADMIN',
    passwordPrinted: false,
    mustChangePassword: true,
  }, null, 2));
};

const main = async () => {
  const mode = parseMode();
  assertSafeFlags(mode);

  const target = parseDatabaseTarget();
  console.log(JSON.stringify({
    action: 'pilot-reset',
    mode,
    destructiveActionsEnabled: mode === 'apply',
    target,
    secretsPrinted: false,
    s3ObjectsDeleted: false,
    prismaMigrationsPreserved: true,
  }, null, 2));

  console.warn('WARNING: This script is intended only for demo/test data before a pilot launch.');
  console.warn('WARNING: Take and verify a database backup before running apply mode.');
  console.warn('WARNING: S3 objects are not deleted by this script.');

  const plan = await buildTablePlan();
  const clearCounts = await collectCounts(plan.clearTables);
  const preservedCounts = await collectCounts(plan.preservedTables);

  printCounts('Application tables planned for clearing', clearCounts);
  printCounts('Preserved baseline tables', preservedCounts);

  if (plan.missingTables.length) {
    console.log(`Schema tables not present in this database (${plan.missingTables.length}): ${plan.missingTables.join(', ')}`);
  }

  if (mode === 'dry-run') {
    console.log('Dry-run complete. No rows were deleted.');
    return;
  }

  console.warn('APPLY MODE ENABLED: truncating application data tables now.');
  await truncateApplicationTables(plan.clearTables);

  if (hasFlag('--create-clean-admin')) {
    await createCleanSuperAdmin();
  } else {
    console.log('No clean admin created. Use the app/API or rerun apply with --create-clean-admin and reviewed env values.');
  }

  const postCounts = await collectCounts(plan.clearTables);
  printCounts('Application table counts after reset', postCounts);
  console.log('Pilot reset apply complete. _prisma_migrations and preserved baseline tables were not truncated by this script.');
};

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Pilot reset failed.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
