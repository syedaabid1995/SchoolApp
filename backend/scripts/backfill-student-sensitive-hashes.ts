import { prisma } from '../src/config/db';
import { env } from '../src/config/env';
import {
  STUDENT_LOOKUP_HASH_FIELDS,
  decryptStudentSensitiveFields,
} from '../src/modules/students/utils/student-sensitive-fields';
import { hashSensitiveLookupValue } from '../src/utils/sensitiveFieldCrypto';

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
      console.log('Usage: tsx scripts/backfill-student-sensitive-hashes.ts [--dry-run] [--apply] [--school-id <id>] [--limit <n>]');
      process.exit(0);
    }
  }
  if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit < 1)) {
    throw new Error('--limit must be a positive integer');
  }
  return options;
};

const hashForValue = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  return hashSensitiveLookupValue(value);
};

const STUDENT_HASH_COLUMNS: Record<string, string> = {
  emailHash: 'email_hash',
  phoneHash: 'phone_hash',
  fatherPhoneHash: 'father_phone_hash',
  motherPhoneHash: 'mother_phone_hash',
  parentPhoneHash: 'parent_phone_hash',
  parentEmailHash: 'parent_email_hash',
  emergencyContactHash: 'emergency_contact_hash',
  doctorContactHash: 'doctor_contact_hash',
  docAadhaarHash: 'doc_aadhaar_hash',
};

const assertHashColumnsExist = async () => {
  const rows = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'students'
  `;
  const columns = new Set(rows.map((row) => row.column_name));
  const missing = Object.entries(STUDENT_HASH_COLUMNS)
    .filter(([, column]) => !columns.has(column))
    .map(([field]) => field);
  if (missing.length) {
    throw new Error(`Student hash columns are missing. Apply Prisma migrations before backfill: ${missing.join(', ')}`);
  }
};

const main = async () => {
  const options = parseOptions();
  if (!env.SENSITIVE_FIELD_ENCRYPTION_KEY) {
    throw new Error('SENSITIVE_FIELD_ENCRYPTION_KEY is required to backfill sensitive lookup hashes');
  }
  await assertHashColumnsExist();

  const select = {
    id: true,
    schoolId: true,
    ...Object.fromEntries(STUDENT_LOOKUP_HASH_FIELDS.map((field) => [field, true])),
    ...Object.fromEntries(STUDENT_LOOKUP_HASH_FIELDS.map((field) => [`${field}Hash`, true])),
  };

  const rows = await prisma.student.findMany({
    where: options.schoolId ? { schoolId: options.schoolId } : {},
    select,
    take: options.limit,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

  let changedRows = 0;
  let updatedRows = 0;
  const changedFields: Record<string, number> = Object.fromEntries(
    STUDENT_LOOKUP_HASH_FIELDS.map((field) => [`${field}Hash`, 0]),
  );

  for (const rawRow of rows as Array<Record<string, unknown>>) {
    const row = decryptStudentSensitiveFields(rawRow as any) as Record<string, unknown>;
    const data: Record<string, string | null> = {};

    for (const field of STUDENT_LOOKUP_HASH_FIELDS) {
      const hashField = `${field}Hash`;
      const desired = hashForValue(row[field]);
      if (rawRow[hashField] === desired) continue;
      data[hashField] = desired;
      changedFields[hashField] += 1;
    }

    if (!Object.keys(data).length) continue;
    changedRows += 1;

    if (options.apply) {
      await prisma.student.update({
        where: { id: rawRow.id as string },
        data,
      });
      updatedRows += 1;
    }
  }

  console.log(JSON.stringify({
    ok: true,
    dryRun: !options.apply,
    applied: options.apply,
    modifiedDatabase: options.apply,
    scope: {
      schoolId: options.schoolId ?? null,
      limit: options.limit ?? null,
    },
    scannedRows: rows.length,
    changedRows,
    updatedRows,
    changedFields,
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
      message: error instanceof Error ? error.message : 'Student sensitive hash backfill failed.',
    }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
