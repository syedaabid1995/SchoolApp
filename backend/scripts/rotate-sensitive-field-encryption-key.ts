import { prisma } from '../src/config/db';
import { env } from '../src/config/env';
import {
  STUDENT_ENCRYPT_ONLY_FIELDS,
  STUDENT_LOOKUP_HASH_FIELDS,
} from '../src/modules/students/utils/student-sensitive-fields';
import {
  PARENT_GUARDIAN_ENCRYPT_FIELDS,
  PARENT_GUARDIAN_LOOKUP_HASH_FIELDS,
} from '../src/modules/students/utils/parent-guardian-sensitive-fields';
import {
  PARENT_PROFILE_ENCRYPT_FIELDS,
  PARENT_PROFILE_LOOKUP_HASH_FIELDS,
} from '../src/modules/students/utils/parent-profile-sensitive-fields';
import {
  STAFF_BANK_ENCRYPT_FIELDS,
  STAFF_PROFILE_ENCRYPT_FIELDS,
  STAFF_PROFILE_LOOKUP_HASH_FIELDS,
} from '../src/modules/staff/utils/staff-sensitive-fields';
import {
  decryptSensitiveField,
  encryptSensitiveField,
  hashSensitiveLookupValue,
  isEncryptedSensitiveField,
} from '../src/utils/sensitiveFieldCrypto';

const SCOPES = [
  'students',
  'staff',
  'parent-guardians',
  'parent-profiles',
  'all',
] as const;

type Scope = (typeof SCOPES)[number];

type Options = {
  apply: boolean;
  schoolId?: string;
  limit?: number;
  scope: Scope;
};

type RotationKeys = {
  oldKey: string;
  newKey: string;
};

type RotationSource = 'oldEncrypted' | 'newEncrypted' | 'plaintext' | 'empty';

type RotateRecordInput = RotationKeys & {
  rowLabel: string;
  row: Record<string, unknown>;
  encryptFields: readonly string[];
  lookupFields: readonly string[];
  associatedDataFor: (field: string) => string;
};

type RotatedRecord = {
  data: Record<string, string | null>;
  changedFields: Record<string, number>;
  sources: Record<RotationSource, number>;
};

type ScopeResult = {
  scannedRows: number;
  changedRows?: number;
  changedProfileRows?: number;
  changedBankRows?: number;
  changedFields?: Record<string, number>;
  changedProfileFields?: Record<string, number>;
  changedBankFields?: Record<string, number>;
  sources?: Record<RotationSource, number>;
  profileSources?: Record<RotationSource, number>;
  bankSources?: Record<RotationSource, number>;
};

const parseOptions = (): Options => {
  const args = process.argv.slice(2);
  const options: Options = { apply: false, scope: 'all' };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--apply') options.apply = true;
    else if (arg === '--dry-run') options.apply = false;
    else if (arg === '--school-id') options.schoolId = args[++index];
    else if (arg === '--limit') options.limit = Number(args[++index]);
    else if (arg === '--scope') options.scope = args[++index] as Scope;
    else if (arg === '--help') {
      console.log([
        'Usage: tsx scripts/rotate-sensitive-field-encryption-key.ts [--dry-run] [--apply] [--school-id <id>] [--limit <n>] [--scope <scope>]',
        '',
        'Scopes:',
        '  all, students, staff, parent-guardians, parent-profiles',
        '',
        'Required environment variables:',
        '  OLD_SENSITIVE_FIELD_ENCRYPTION_KEY  key currently used by existing encrypted rows',
        '  SENSITIVE_FIELD_ENCRYPTION_KEY      new key to write encrypted rows and lookup hashes',
        '',
        'Default mode is --dry-run. The script never prints plaintext sensitive values or keys.',
      ].join('\n'));
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!SCOPES.includes(options.scope)) {
    throw new Error(`--scope must be one of: ${SCOPES.join(', ')}`);
  }
  if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit < 1)) {
    throw new Error('--limit must be a positive integer');
  }
  return options;
};

const requireKeys = (): RotationKeys => {
  const oldKey = env.OLD_SENSITIVE_FIELD_ENCRYPTION_KEY;
  const newKey = env.SENSITIVE_FIELD_ENCRYPTION_KEY;

  if (!env.SENSITIVE_FIELD_ENCRYPTION_ENABLED) {
    throw new Error('SENSITIVE_FIELD_ENCRYPTION_ENABLED must be true before rotating sensitive field encryption keys');
  }
  if (!oldKey) {
    throw new Error('OLD_SENSITIVE_FIELD_ENCRYPTION_KEY is required for key rotation');
  }
  if (!newKey) {
    throw new Error('SENSITIVE_FIELD_ENCRYPTION_KEY is required for key rotation');
  }
  if (oldKey === newKey) {
    throw new Error('OLD_SENSITIVE_FIELD_ENCRYPTION_KEY and SENSITIVE_FIELD_ENCRYPTION_KEY must be different');
  }

  return { oldKey, newKey };
};

const emptySources = (): Record<RotationSource, number> => ({
  oldEncrypted: 0,
  newEncrypted: 0,
  plaintext: 0,
  empty: 0,
});

const addCounts = <T extends string>(
  target: Record<T, number>,
  source: Record<T, number>,
) => {
  for (const [key, value] of Object.entries(source) as Array<[T, number]>) {
    target[key] = (target[key] ?? 0) + value;
  }
};

const nonZeroCounts = (counts: Record<string, number>) =>
  Object.fromEntries(Object.entries(counts).filter(([, count]) => count > 0));

const storageFieldsFor = (
  encryptFields: readonly string[],
  lookupFields: readonly string[],
) => Array.from(new Set([
  ...encryptFields,
  ...lookupFields.map((field) => `${field}Hash`),
]));

const decodeField = (
  value: unknown,
  field: string,
  input: Pick<RotateRecordInput, 'oldKey' | 'newKey' | 'associatedDataFor' | 'rowLabel'>,
): { plaintext: string | null; source: RotationSource } => {
  if (value === null || value === undefined || value === '') {
    return { plaintext: null, source: 'empty' };
  }
  if (typeof value !== 'string') {
    throw new Error(`${input.rowLabel}.${field} must be a string, null, or undefined`);
  }
  if (!isEncryptedSensitiveField(value)) {
    return { plaintext: value, source: 'plaintext' };
  }

  const associatedData = input.associatedDataFor(field);
  try {
    return {
      plaintext: decryptSensitiveField(value, { key: input.oldKey, associatedData }),
      source: 'oldEncrypted',
    };
  } catch {
    try {
      return {
        plaintext: decryptSensitiveField(value, { key: input.newKey, associatedData }),
        source: 'newEncrypted',
      };
    } catch {
      throw new Error(
        `${input.rowLabel}.${field} could not be decrypted with the old or new sensitive field key`,
      );
    }
  }
};

const rotateRecord = (input: RotateRecordInput): RotatedRecord => {
  const data: Record<string, string | null> = {};
  const changedFields: Record<string, number> = {};
  const sources = emptySources();
  const plaintextByField: Record<string, string | null> = {};

  for (const field of input.encryptFields) {
    if (!Object.prototype.hasOwnProperty.call(input.row, field)) continue;

    const before = input.row[field];
    const decoded = decodeField(before, field, input);
    sources[decoded.source] += 1;
    plaintextByField[field] = decoded.plaintext;

    const after = decoded.plaintext === null
      ? null
      : decoded.source === 'newEncrypted'
        ? before
        : encryptSensitiveField(decoded.plaintext, {
          key: input.newKey,
          encryptionEnabled: true,
          associatedData: input.associatedDataFor(field),
        });

    if (before !== after) {
      data[field] = after as string | null;
      changedFields[field] = (changedFields[field] ?? 0) + 1;
    }
  }

  for (const field of input.lookupFields) {
    if (!Object.prototype.hasOwnProperty.call(plaintextByField, field)) continue;

    const hashField = `${field}Hash`;
    const before = input.row[hashField];
    const plaintext = plaintextByField[field];
    const after = plaintext === null || plaintext.trim() === ''
      ? null
      : hashSensitiveLookupValue(plaintext, { key: input.newKey, encryptionEnabled: true });

    if (before !== after) {
      data[hashField] = after;
      changedFields[hashField] = (changedFields[hashField] ?? 0) + 1;
    }
  }

  return { data, changedFields, sources };
};

const rotateStudents = async (
  options: Options,
  keys: RotationKeys,
): Promise<ScopeResult> => {
  const storageFields = storageFieldsFor(STUDENT_ENCRYPT_ONLY_FIELDS, STUDENT_LOOKUP_HASH_FIELDS);
  const rows = await prisma.student.findMany({
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
  const sources = emptySources();
  let changedRows = 0;

  for (const row of rows) {
    const rotated = rotateRecord({
      ...keys,
      row,
      rowLabel: `student:${row.id}`,
      encryptFields: STUDENT_ENCRYPT_ONLY_FIELDS,
      lookupFields: STUDENT_LOOKUP_HASH_FIELDS,
      associatedDataFor: (field) => `Student.${field}`,
    });
    addCounts(changedFields, rotated.changedFields);
    addCounts(sources, rotated.sources);

    if (!Object.keys(rotated.data).length) continue;
    changedRows += 1;
    if (options.apply) {
      await prisma.student.update({
        where: { id: row.id },
        data: rotated.data,
      });
    }
  }

  return {
    scannedRows: rows.length,
    changedRows,
    changedFields: nonZeroCounts(changedFields),
    sources,
  };
};

const rotateParentGuardians = async (
  options: Options,
  keys: RotationKeys,
): Promise<ScopeResult> => {
  const storageFields = storageFieldsFor(PARENT_GUARDIAN_ENCRYPT_FIELDS, PARENT_GUARDIAN_LOOKUP_HASH_FIELDS);
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
  const sources = emptySources();
  let changedRows = 0;

  for (const row of rows) {
    const rotated = rotateRecord({
      ...keys,
      row,
      rowLabel: `parentGuardian:${row.id}`,
      encryptFields: PARENT_GUARDIAN_ENCRYPT_FIELDS,
      lookupFields: PARENT_GUARDIAN_LOOKUP_HASH_FIELDS,
      associatedDataFor: (field) => `ParentGuardian.${field}`,
    });
    addCounts(changedFields, rotated.changedFields);
    addCounts(sources, rotated.sources);

    if (!Object.keys(rotated.data).length) continue;
    changedRows += 1;
    if (options.apply) {
      await prisma.parentGuardian.update({
        where: { id: row.id },
        data: rotated.data,
      });
    }
  }

  return {
    scannedRows: rows.length,
    changedRows,
    changedFields: nonZeroCounts(changedFields),
    sources,
  };
};

const rotateParentProfiles = async (
  options: Options,
  keys: RotationKeys,
): Promise<ScopeResult> => {
  const storageFields = storageFieldsFor(PARENT_PROFILE_ENCRYPT_FIELDS, PARENT_PROFILE_LOOKUP_HASH_FIELDS);
  const rows = await prisma.parentProfile.findMany({
    where: {
      ...(options.schoolId ? { links: { some: { student: { schoolId: options.schoolId } } } } : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: options.limit,
    select: Object.fromEntries([
      ['id', true],
      ...storageFields.map((field) => [field, true]),
    ]),
  });

  const changedFields: Record<string, number> = {};
  const sources = emptySources();
  let changedRows = 0;

  for (const row of rows) {
    const rotated = rotateRecord({
      ...keys,
      row,
      rowLabel: `parentProfile:${row.id}`,
      encryptFields: PARENT_PROFILE_ENCRYPT_FIELDS,
      lookupFields: PARENT_PROFILE_LOOKUP_HASH_FIELDS,
      associatedDataFor: (field) => `ParentProfile.${field}`,
    });
    addCounts(changedFields, rotated.changedFields);
    addCounts(sources, rotated.sources);

    if (!Object.keys(rotated.data).length) continue;
    changedRows += 1;
    if (options.apply) {
      await prisma.parentProfile.update({
        where: { id: row.id },
        data: rotated.data,
      });
    }
  }

  return {
    scannedRows: rows.length,
    changedRows,
    changedFields: nonZeroCounts(changedFields),
    sources,
  };
};

const rotateStaff = async (
  options: Options,
  keys: RotationKeys,
): Promise<ScopeResult> => {
  const profileStorageFields = storageFieldsFor(
    STAFF_PROFILE_ENCRYPT_FIELDS,
    STAFF_PROFILE_LOOKUP_HASH_FIELDS,
  );
  const rows = await prisma.teacherProfile.findMany({
    where: {
      ...(options.schoolId ? { schoolId: options.schoolId } : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: options.limit,
    select: {
      id: true,
      schoolId: true,
      phone: true,
      phoneHash: true,
      address: true,
      emergencyMobile: true,
      emergencyMobileHash: true,
      drivingLicense: true,
      currentAddress: true,
      permanentAddress: true,
      bankDetails: {
        select: {
          id: true,
          accountNumber: true,
          ifscCode: true,
          panNumber: true,
        },
      },
    },
  });

  const changedProfileFields: Record<string, number> = {};
  const changedBankFields: Record<string, number> = {};
  const profileSources = emptySources();
  const bankSources = emptySources();
  let changedProfileRows = 0;
  let changedBankRows = 0;

  for (const row of rows) {
    const rotatedProfile = rotateRecord({
      ...keys,
      row,
      rowLabel: `teacherProfile:${row.id}`,
      encryptFields: STAFF_PROFILE_ENCRYPT_FIELDS,
      lookupFields: STAFF_PROFILE_LOOKUP_HASH_FIELDS,
      associatedDataFor: (field) => `TeacherProfile.${field}`,
    });
    addCounts(changedProfileFields, rotatedProfile.changedFields);
    addCounts(profileSources, rotatedProfile.sources);

    if (Object.keys(rotatedProfile.data).length) {
      changedProfileRows += 1;
      if (options.apply) {
        await prisma.teacherProfile.update({
          where: { id: row.id },
          data: rotatedProfile.data,
        });
      }
    }

    if (!row.bankDetails) continue;

    const rotatedBank = rotateRecord({
      ...keys,
      row: row.bankDetails,
      rowLabel: `teacherBankDetails:${row.bankDetails.id}`,
      encryptFields: STAFF_BANK_ENCRYPT_FIELDS,
      lookupFields: [],
      associatedDataFor: (field) => `TeacherBankDetails.${field}`,
    });
    addCounts(changedBankFields, rotatedBank.changedFields);
    addCounts(bankSources, rotatedBank.sources);

    if (Object.keys(rotatedBank.data).length) {
      changedBankRows += 1;
      if (options.apply) {
        await prisma.teacherBankDetails.update({
          where: { id: row.bankDetails.id },
          data: rotatedBank.data,
        });
      }
    }
  }

  return {
    scannedRows: rows.length,
    changedProfileRows,
    changedBankRows,
    changedProfileFields: nonZeroCounts(changedProfileFields),
    changedBankFields: nonZeroCounts(changedBankFields),
    profileSources,
    bankSources,
  };
};

const selectedScopes = (scope: Scope): Exclude<Scope, 'all'>[] => {
  if (scope === 'all') {
    return ['students', 'staff', 'parent-guardians', 'parent-profiles'];
  }
  return [scope];
};

const main = async () => {
  const options = parseOptions();
  const keys = requireKeys();
  const results: Partial<Record<Exclude<Scope, 'all'>, ScopeResult>> = {};

  for (const scope of selectedScopes(options.scope)) {
    if (scope === 'students') results[scope] = await rotateStudents(options, keys);
    else if (scope === 'staff') results[scope] = await rotateStaff(options, keys);
    else if (scope === 'parent-guardians') results[scope] = await rotateParentGuardians(options, keys);
    else if (scope === 'parent-profiles') results[scope] = await rotateParentProfiles(options, keys);
  }

  const changedRows = Object.values(results).reduce((total, result) => {
    if (!result) return total;
    return total +
      (result.changedRows ?? 0) +
      (result.changedProfileRows ?? 0) +
      (result.changedBankRows ?? 0);
  }, 0);

  console.log(JSON.stringify({
    ok: true,
    dryRun: !options.apply,
    modifiedDatabase: options.apply && changedRows > 0,
    scope: {
      selected: options.scope,
      schoolId: options.schoolId ?? null,
      limitPerScope: options.limit ?? null,
    },
    changedRows,
    results,
  }, null, 2));
};

main()
  .catch((error) => {
    console.error(JSON.stringify({
      ok: false,
      message: error instanceof Error ? error.message : 'Sensitive field key rotation failed.',
    }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
