import { prisma } from '../src/config/db';
import {
  decryptStaffRecord,
  encryptStaffSensitiveFields,
  encryptTeacherBankDetailsForStorage,
  STAFF_BANK_ENCRYPT_FIELDS,
  STAFF_PROFILE_ENCRYPT_FIELDS,
  STAFF_PROFILE_LOOKUP_HASH_FIELDS,
} from '../src/modules/staff/utils/staff-sensitive-fields';
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
      console.log('Usage: tsx scripts/migrate-staff-sensitive-encryption.ts [--dry-run] [--apply] [--school-id <id>] [--limit <n>]');
      process.exit(0);
    }
  }
  if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit < 1)) {
    throw new Error('--limit must be a positive integer');
  }
  return options;
};

const profileStorageFields = Array.from(new Set([
  ...STAFF_PROFILE_ENCRYPT_FIELDS,
  ...STAFF_PROFILE_LOOKUP_HASH_FIELDS.map((field) => `${field}Hash` as const),
]));

const main = async () => {
  const options = parseOptions();
  if (env.SENSITIVE_FIELD_ENCRYPTION_ENABLED && !env.SENSITIVE_FIELD_ENCRYPTION_KEY) {
    throw new Error('SENSITIVE_FIELD_ENCRYPTION_KEY is required to migrate staff sensitive encryption');
  }

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
  for (const field of profileStorageFields) changedProfileFields[field] = 0;
  const changedBankFields: Record<string, number> = {};
  for (const field of STAFF_BANK_ENCRYPT_FIELDS) changedBankFields[field] = 0;

  let changedProfileRows = 0;
  let changedBankRows = 0;

  for (const rawRow of rows) {
    const decrypted = decryptStaffRecord(rawRow);
    const encryptedProfile = encryptStaffSensitiveFields(decrypted);
    const profileData: Record<string, string | null> = {};

    for (const field of profileStorageFields) {
      const before = rawRow[field as keyof typeof rawRow];
      const after = encryptedProfile[field as keyof typeof encryptedProfile];
      if (
        (STAFF_PROFILE_ENCRYPT_FIELDS as readonly string[]).includes(field) &&
        isEncryptedSensitiveField(before)
      ) {
        continue;
      }
      if (before === after) continue;
      profileData[field] = after ?? null;
      changedProfileFields[field] += 1;
    }

    if (Object.keys(profileData).length) {
      changedProfileRows += 1;
      if (options.apply) {
        await prisma.teacherProfile.update({
          where: { id: rawRow.id },
          data: profileData,
        });
      }
    }

    if (!rawRow.bankDetails) continue;
    const encryptedBank = encryptTeacherBankDetailsForStorage(decrypted.bankDetails ?? {});
    const bankData: Record<string, string | null> = {};
    for (const field of STAFF_BANK_ENCRYPT_FIELDS) {
      const before = rawRow.bankDetails[field as keyof typeof rawRow.bankDetails];
      const after = encryptedBank[field as keyof typeof encryptedBank];
      if (isEncryptedSensitiveField(before)) continue;
      if (before === after) continue;
      bankData[field] = after ?? null;
      changedBankFields[field] += 1;
    }

    if (Object.keys(bankData).length) {
      changedBankRows += 1;
      if (options.apply) {
        await prisma.teacherBankDetails.update({
          where: { id: rawRow.bankDetails.id },
          data: bankData,
        });
      }
    }
  }

  console.log(JSON.stringify({
    ok: true,
    dryRun: !options.apply,
    modifiedDatabase: options.apply && (changedProfileRows > 0 || changedBankRows > 0),
    scope: {
      schoolId: options.schoolId ?? null,
      limit: options.limit ?? null,
    },
    scannedRows: rows.length,
    changedProfileRows,
    changedBankRows,
    changedProfileFields: Object.fromEntries(
      Object.entries(changedProfileFields).filter(([, count]) => count > 0),
    ),
    changedBankFields: Object.fromEntries(
      Object.entries(changedBankFields).filter(([, count]) => count > 0),
    ),
  }, null, 2));
};

main()
  .catch((error) => {
    console.error(JSON.stringify({
      ok: false,
      message: error instanceof Error ? error.message : 'Staff sensitive encryption migration failed.',
    }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
