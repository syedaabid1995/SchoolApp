import { prisma } from '../src/config/db';
import {
  decryptParentGuardianSensitiveFields,
  encryptParentGuardianSensitiveFields,
  PARENT_GUARDIAN_ENCRYPT_FIELDS,
  PARENT_GUARDIAN_LOOKUP_HASH_FIELDS,
} from '../src/modules/students/utils/parent-guardian-sensitive-fields';
import { env } from '../src/config/env';
import { isEncryptedSensitiveField } from '../src/utils/sensitiveFieldCrypto';

type Options = {
  apply: boolean;
  schoolId?: string;
  limit?: number;
};

const parseOptions = (): Options => {
  const args = process.argv.slice(2);
  const options: Options = { apply: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--apply') options.apply = true;
    else if (arg === '--dry-run') options.apply = false;
    else if (arg === '--school-id') options.schoolId = args[++index];
    else if (arg === '--limit') options.limit = Number(args[++index]);
    else if (arg === '--help') {
      console.log('Usage: tsx scripts/migrate-parent-guardian-sensitive-encryption.ts [--dry-run] [--apply] [--school-id <id>] [--limit <n>]');
      process.exit(0);
    }
  }
  if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit < 1)) {
    throw new Error('--limit must be a positive integer');
  }
  return options;
};

const storageFields = Array.from(new Set([
  ...PARENT_GUARDIAN_ENCRYPT_FIELDS,
  ...PARENT_GUARDIAN_LOOKUP_HASH_FIELDS.map((field) => `${field}Hash` as const),
]));

const main = async () => {
  const options = parseOptions();
  if (env.SENSITIVE_FIELD_ENCRYPTION_ENABLED && !env.SENSITIVE_FIELD_ENCRYPTION_KEY) {
    throw new Error('SENSITIVE_FIELD_ENCRYPTION_KEY is required to migrate parent guardian sensitive encryption');
  }

  const rows = await prisma.parentGuardian.findMany({
    where: {
      ...(options.schoolId ? { schoolId: options.schoolId } : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: options.limit,
    select: Object.fromEntries([
      ['id', true],
      ['schoolId', true],
      ...storageFields.map((field) => [field, true]),
    ]),
  });

  const changedFields: Record<string, number> = {};
  for (const field of storageFields) changedFields[field] = 0;

  let changedRows = 0;
  for (const rawRow of rows) {
    const decrypted = decryptParentGuardianSensitiveFields(rawRow);
    const encrypted = encryptParentGuardianSensitiveFields(decrypted);
    const data: Record<string, string | null> = {};

    for (const field of storageFields) {
      const before = rawRow[field as keyof typeof rawRow];
      const after = encrypted[field as keyof typeof encrypted];
      if (
        (PARENT_GUARDIAN_ENCRYPT_FIELDS as readonly string[]).includes(field) &&
        isEncryptedSensitiveField(before)
      ) {
        continue;
      }
      if (before === after) continue;
      data[field] = after ?? null;
      changedFields[field] += 1;
    }

    if (!Object.keys(data).length) continue;
    changedRows += 1;
    if (options.apply) {
      await prisma.parentGuardian.update({
        where: { id: rawRow.id },
        data,
      });
    }
  }

  console.log(JSON.stringify({
    ok: true,
    dryRun: !options.apply,
    modifiedDatabase: options.apply && changedRows > 0,
    scope: {
      schoolId: options.schoolId ?? null,
      limit: options.limit ?? null,
    },
    scannedRows: rows.length,
    changedRows,
    changedFields: Object.fromEntries(
      Object.entries(changedFields).filter(([, count]) => count > 0),
    ),
  }, null, 2));
};

main()
  .catch((error) => {
    console.error(JSON.stringify({
      ok: false,
      message: error instanceof Error ? error.message : 'Parent guardian sensitive encryption migration failed.',
    }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
