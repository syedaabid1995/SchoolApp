import { prisma } from '../src/config/db';
import {
  decryptStudentSensitiveFields,
  encryptStudentSensitiveFields,
  STUDENT_ENCRYPT_ONLY_FIELDS,
  STUDENT_LOOKUP_HASH_FIELDS,
} from '../src/modules/students/utils/student-sensitive-fields';
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
      console.log('Usage: tsx scripts/migrate-student-sensitive-encryption.ts [--dry-run] [--apply] [--school-id <id>] [--limit <n>]');
      process.exit(0);
    }
  }
  if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit < 1)) {
    throw new Error('--limit must be a positive integer');
  }
  return options;
};

const allStudentStorageFields = Array.from(new Set([
  ...STUDENT_ENCRYPT_ONLY_FIELDS,
  ...STUDENT_LOOKUP_HASH_FIELDS.map((field) => `${field}Hash` as const),
]));

const hasValue = (value: unknown) => typeof value === 'string' && value.trim() !== '';

const main = async () => {
  const options = parseOptions();
  if (env.SENSITIVE_FIELD_ENCRYPTION_ENABLED && !env.SENSITIVE_FIELD_ENCRYPTION_KEY) {
    throw new Error('SENSITIVE_FIELD_ENCRYPTION_KEY is required to migrate student sensitive encryption');
  }

  const rows = await prisma.student.findMany({
    where: {
      ...(options.schoolId ? { schoolId: options.schoolId } : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: options.limit,
    select: Object.fromEntries([
      ['id', true],
      ['schoolId', true],
      ...allStudentStorageFields.map((field) => [field, true]),
    ]),
  });

  const changedFields: Record<string, number> = {};
  for (const field of allStudentStorageFields) changedFields[field] = 0;

  let changedRows = 0;
  for (const rawRow of rows) {
    const decrypted = decryptStudentSensitiveFields(rawRow);
    const encrypted = encryptStudentSensitiveFields(decrypted);
    const data: Record<string, string | null> = {};

    for (const field of allStudentStorageFields) {
      const before = rawRow[field as keyof typeof rawRow];
      const after = encrypted[field as keyof typeof encrypted];
      if (
        (STUDENT_ENCRYPT_ONLY_FIELDS as readonly string[]).includes(field) &&
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
      await prisma.student.update({
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
    nonEmptyFields: Object.fromEntries(
      STUDENT_ENCRYPT_ONLY_FIELDS.map((field) => [
        field,
        rows.filter((row) => hasValue(row[field as keyof typeof row])).length,
      ]),
    ),
  }, null, 2));
};

main()
  .catch((error) => {
    console.error(JSON.stringify({
      ok: false,
      message: error instanceof Error ? error.message : 'Student sensitive encryption migration failed.',
    }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
