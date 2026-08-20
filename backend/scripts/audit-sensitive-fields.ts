import { NotificationChannel } from '@prisma/client';
import { prisma } from '../src/config/db';
import {
  STUDENT_ENCRYPT_ONLY_FIELDS,
  STUDENT_LOOKUP_HASH_FIELDS,
} from '../src/modules/students/utils/student-sensitive-fields';
import { isEncryptedSensitiveField, isSensitiveLookupHash } from '../src/utils/sensitiveFieldCrypto';
import { isEncryptedSecret } from '../src/utils/cryptoVault';
import { isMessagingSecretCredentialKey } from '../src/utils/messagingCredentialsCrypto';
import {
  STAFF_BANK_ENCRYPT_FIELDS,
  STAFF_PROFILE_ENCRYPT_FIELDS,
  STAFF_PROFILE_LOOKUP_HASH_FIELDS,
} from '../src/modules/staff/utils/staff-sensitive-fields';
import {
  PARENT_GUARDIAN_ENCRYPT_FIELDS,
  PARENT_GUARDIAN_LOOKUP_HASH_FIELDS,
} from '../src/modules/students/utils/parent-guardian-sensitive-fields';
import {
  PARENT_PROFILE_ENCRYPT_FIELDS,
  PARENT_PROFILE_LOOKUP_HASH_FIELDS,
} from '../src/modules/students/utils/parent-profile-sensitive-fields';

type Options = {
  schoolId?: string;
  limit?: number;
};

type ValueCounts = {
  empty: number;
  plaintext: number;
  encrypted: number;
};

type HashCounts = {
  empty: number;
  hash: number;
  invalid: number;
};

type MessagingSecretCounts = {
  plaintext: number;
  sensitiveEncrypted: number;
  legacyVaultEncrypted: number;
};

const STUDENT_FIELD_COLUMNS: Record<string, string> = {
  email: 'email',
  phone: 'phone',
  fatherPhone: 'father_phone',
  motherPhone: 'mother_phone',
  parentPhone: 'parent_phone',
  parentEmail: 'parent_email',
  presentAddress: 'present_address',
  permanentAddress: 'permanent_address',
  addressLine1: 'address_line1',
  addressLine2: 'address_line2',
  city: 'city',
  state: 'state',
  pincode: 'pincode',
  emergencyContact: 'emergency_contact',
  bloodGroup: 'blood_group',
  medicalConditions: 'medical_conditions',
  allergies: 'allergies',
  doctorContact: 'doctor_contact',
  docBirthCert: 'doc_birth_cert',
  docTransferCert: 'doc_transfer_cert',
  docAadhaar: 'doc_aadhaar',
  docReportCard: 'doc_report_card',
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

const STAFF_PROFILE_FIELD_COLUMNS: Record<string, string> = {
  phone: 'phone',
  address: 'address',
  emergencyMobile: 'emergency_mobile',
  drivingLicense: 'driving_license',
  currentAddress: 'current_address',
  permanentAddress: 'permanent_address',
  phoneHash: 'phone_hash',
  emergencyMobileHash: 'emergency_mobile_hash',
};

const STAFF_BANK_FIELD_COLUMNS: Record<string, string> = {
  accountNumber: 'account_number',
  ifscCode: 'ifsc_code',
  panNumber: 'pan_number',
};

const PARENT_GUARDIAN_FIELD_COLUMNS: Record<string, string> = {
  phone: 'phone',
  email: 'email',
  phoneHash: 'phone_hash',
  emailHash: 'email_hash',
};

const PARENT_PROFILE_FIELD_COLUMNS: Record<string, string> = {
  phone: 'phone',
  email: 'email',
  phoneHash: 'phone_hash',
  emailHash: 'email_hash',
};

const parseOptions = (): Options => {
  const args = process.argv.slice(2);
  const options: Options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--school-id') options.schoolId = args[++index];
    else if (arg === '--limit') options.limit = Number(args[++index]);
    else if (arg === '--help') {
      console.log('Usage: tsx scripts/audit-sensitive-fields.ts [--school-id <id>] [--limit <n>]');
      process.exit(0);
    }
  }
  if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit < 1)) {
    throw new Error('--limit must be a positive integer');
  }
  return options;
};

const emptyValueCounts = (): ValueCounts => ({ empty: 0, plaintext: 0, encrypted: 0 });
const emptyHashCounts = (): HashCounts => ({ empty: 0, hash: 0, invalid: 0 });
const emptyMessagingSecretCounts = (): MessagingSecretCounts => ({
  plaintext: 0,
  sensitiveEncrypted: 0,
  legacyVaultEncrypted: 0,
});

const classifySensitiveValue = (counts: ValueCounts, value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) {
    counts.empty += 1;
    return;
  }
  if (isEncryptedSensitiveField(value)) counts.encrypted += 1;
  else counts.plaintext += 1;
};

const classifyHashValue = (counts: HashCounts, value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) {
    counts.empty += 1;
    return;
  }
  if (isSensitiveLookupHash(value)) counts.hash += 1;
  else counts.invalid += 1;
};

const classifyMessagingSecret = (counts: MessagingSecretCounts, value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return;
  if (isEncryptedSensitiveField(value)) counts.sensitiveEncrypted += 1;
  else if (isEncryptedSecret(value)) counts.legacyVaultEncrypted += 1;
  else counts.plaintext += 1;
};

const existingStudentColumns = async () => {
  const rows = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'students'
  `;
  return new Set(rows.map((row) => row.column_name));
};

const existingColumns = async (tableName: string) => {
  const rows = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${tableName}
  `;
  return new Set(rows.map((row) => row.column_name));
};

const main = async () => {
  const options = parseOptions();
  const studentColumns = await existingStudentColumns();
  const staffProfileColumns = await existingColumns('employee_profiles');
  const staffBankColumns = await existingColumns('teacher_bank_details');
  const parentGuardianColumns = await existingColumns('parent_guardians');
  const parentProfileColumns = await existingColumns('parent_profiles');
  const unavailableStudentFields = Object.entries(STUDENT_FIELD_COLUMNS)
    .filter(([, column]) => !studentColumns.has(column))
    .map(([field]) => field);
  const availableEncryptedFields = STUDENT_ENCRYPT_ONLY_FIELDS.filter((field) =>
    studentColumns.has(STUDENT_FIELD_COLUMNS[field]),
  );
  const availableHashFields = STUDENT_LOOKUP_HASH_FIELDS.filter((field) =>
    studentColumns.has(STUDENT_FIELD_COLUMNS[`${field}Hash`]),
  );
  const availableStaffEncryptedFields = STAFF_PROFILE_ENCRYPT_FIELDS.filter((field) =>
    staffProfileColumns.has(STAFF_PROFILE_FIELD_COLUMNS[field]),
  );
  const availableStaffHashFields = STAFF_PROFILE_LOOKUP_HASH_FIELDS.filter((field) =>
    staffProfileColumns.has(STAFF_PROFILE_FIELD_COLUMNS[`${field}Hash`]),
  );
  const availableStaffBankFields = STAFF_BANK_ENCRYPT_FIELDS.filter((field) =>
    staffBankColumns.has(STAFF_BANK_FIELD_COLUMNS[field]),
  );
  const availableParentGuardianEncryptedFields = PARENT_GUARDIAN_ENCRYPT_FIELDS.filter((field) =>
    parentGuardianColumns.has(PARENT_GUARDIAN_FIELD_COLUMNS[field]),
  );
  const availableParentGuardianHashFields = PARENT_GUARDIAN_LOOKUP_HASH_FIELDS.filter((field) =>
    parentGuardianColumns.has(PARENT_GUARDIAN_FIELD_COLUMNS[`${field}Hash`]),
  );
  const availableParentProfileEncryptedFields = PARENT_PROFILE_ENCRYPT_FIELDS.filter((field) =>
    parentProfileColumns.has(PARENT_PROFILE_FIELD_COLUMNS[field]),
  );
  const availableParentProfileHashFields = PARENT_PROFILE_LOOKUP_HASH_FIELDS.filter((field) =>
    parentProfileColumns.has(PARENT_PROFILE_FIELD_COLUMNS[`${field}Hash`]),
  );

  const studentSelect = {
    id: true,
    schoolId: true,
    ...Object.fromEntries(availableEncryptedFields.map((field) => [field, true])),
    ...Object.fromEntries(availableHashFields.map((field) => [`${field}Hash`, true])),
  };
  const staffSelect = {
    id: true,
    schoolId: true,
    ...Object.fromEntries(availableStaffEncryptedFields.map((field) => [field, true])),
    ...Object.fromEntries(availableStaffHashFields.map((field) => [`${field}Hash`, true])),
    bankDetails: {
      select: {
        id: true,
        ...Object.fromEntries(availableStaffBankFields.map((field) => [field, true])),
      },
    },
  };
  const parentGuardianSelect = {
    id: true,
    schoolId: true,
    ...Object.fromEntries(availableParentGuardianEncryptedFields.map((field) => [field, true])),
    ...Object.fromEntries(availableParentGuardianHashFields.map((field) => [`${field}Hash`, true])),
  };
  const parentProfileSelect = {
    id: true,
    ...Object.fromEntries(availableParentProfileEncryptedFields.map((field) => [field, true])),
    ...Object.fromEntries(availableParentProfileHashFields.map((field) => [`${field}Hash`, true])),
  };

  const parentProfileWhere = options.schoolId
    ? { links: { some: { student: { schoolId: options.schoolId } } } }
    : {};

  const [students, staffProfiles, parentGuardians, parentProfiles, configs] = await Promise.all([
    prisma.student.findMany({
      where: options.schoolId ? { schoolId: options.schoolId } : {},
      select: studentSelect,
      take: options.limit,
    }),
    prisma.teacherProfile.findMany({
      where: options.schoolId ? { schoolId: options.schoolId } : {},
      select: staffSelect,
      take: options.limit,
    }),
    prisma.parentGuardian.findMany({
      where: options.schoolId ? { schoolId: options.schoolId } : {},
      select: parentGuardianSelect,
      take: options.limit,
    }),
    prisma.parentProfile.findMany({
      where: parentProfileWhere,
      select: parentProfileSelect,
      take: options.limit,
    }),
    prisma.schoolMessagingConfig.findMany({
      where: options.schoolId ? { schoolId: options.schoolId } : {},
      select: {
        id: true,
        schoolId: true,
        channel: true,
        credentials: true,
      },
      take: options.limit,
    }),
  ]);

  const studentEncryptedFields = Object.fromEntries(
    availableEncryptedFields.map((field) => [field, emptyValueCounts()]),
  ) as Record<string, ValueCounts>;
  const studentHashFields = Object.fromEntries(
    availableHashFields.map((field) => [`${field}Hash`, emptyHashCounts()]),
  ) as Record<string, HashCounts>;
  const staffEncryptedFields = Object.fromEntries(
    availableStaffEncryptedFields.map((field) => [field, emptyValueCounts()]),
  ) as Record<string, ValueCounts>;
  const staffHashFields = Object.fromEntries(
    availableStaffHashFields.map((field) => [`${field}Hash`, emptyHashCounts()]),
  ) as Record<string, HashCounts>;
  const staffBankFields = Object.fromEntries(
    availableStaffBankFields.map((field) => [field, emptyValueCounts()]),
  ) as Record<string, ValueCounts>;
  const parentGuardianEncryptedFields = Object.fromEntries(
    availableParentGuardianEncryptedFields.map((field) => [field, emptyValueCounts()]),
  ) as Record<string, ValueCounts>;
  const parentGuardianHashFields = Object.fromEntries(
    availableParentGuardianHashFields.map((field) => [`${field}Hash`, emptyHashCounts()]),
  ) as Record<string, HashCounts>;
  const parentProfileEncryptedFields = Object.fromEntries(
    availableParentProfileEncryptedFields.map((field) => [field, emptyValueCounts()]),
  ) as Record<string, ValueCounts>;
  const parentProfileHashFields = Object.fromEntries(
    availableParentProfileHashFields.map((field) => [`${field}Hash`, emptyHashCounts()]),
  ) as Record<string, HashCounts>;

  for (const student of students as Array<Record<string, unknown>>) {
    for (const field of availableEncryptedFields) {
      classifySensitiveValue(studentEncryptedFields[field], student[field]);
    }
    for (const field of availableHashFields) {
      const hashField = `${field}Hash`;
      classifyHashValue(studentHashFields[hashField], student[hashField]);
    }
  }

  for (const staff of staffProfiles as Array<Record<string, unknown>>) {
    for (const field of availableStaffEncryptedFields) {
      classifySensitiveValue(staffEncryptedFields[field], staff[field]);
    }
    for (const field of availableStaffHashFields) {
      const hashField = `${field}Hash`;
      classifyHashValue(staffHashFields[hashField], staff[hashField]);
    }
    const bankDetails =
      staff.bankDetails && typeof staff.bankDetails === 'object' && !Array.isArray(staff.bankDetails)
        ? (staff.bankDetails as Record<string, unknown>)
        : {};
    for (const field of availableStaffBankFields) {
      classifySensitiveValue(staffBankFields[field], bankDetails[field]);
    }
  }

  for (const guardian of parentGuardians as Array<Record<string, unknown>>) {
    for (const field of availableParentGuardianEncryptedFields) {
      classifySensitiveValue(parentGuardianEncryptedFields[field], guardian[field]);
    }
    for (const field of availableParentGuardianHashFields) {
      const hashField = `${field}Hash`;
      classifyHashValue(parentGuardianHashFields[hashField], guardian[hashField]);
    }
  }

  for (const parent of parentProfiles as Array<Record<string, unknown>>) {
    for (const field of availableParentProfileEncryptedFields) {
      classifySensitiveValue(parentProfileEncryptedFields[field], parent[field]);
    }
    for (const field of availableParentProfileHashFields) {
      const hashField = `${field}Hash`;
      classifyHashValue(parentProfileHashFields[hashField], parent[hashField]);
    }
  }

  const messagingBySecretKey = new Map<string, MessagingSecretCounts>();
  const messagingByChannel = new Map<NotificationChannel, number>();
  for (const config of configs) {
    messagingByChannel.set(config.channel, (messagingByChannel.get(config.channel) ?? 0) + 1);
    const credentials =
      config.credentials && typeof config.credentials === 'object' && !Array.isArray(config.credentials)
        ? (config.credentials as Record<string, unknown>)
        : {};
    for (const [key, value] of Object.entries(credentials)) {
      if (!isMessagingSecretCredentialKey(key)) continue;
      const existing = messagingBySecretKey.get(key) ?? emptyMessagingSecretCounts();
      classifyMessagingSecret(existing, value);
      messagingBySecretKey.set(key, existing);
    }
  }

  console.log(JSON.stringify({
    ok: true,
    dryRun: true,
    modifiedDatabase: false,
    scope: {
      schoolId: options.schoolId ?? null,
      limit: options.limit ?? null,
    },
    unavailableStudentFields,
    students: {
      scannedRows: students.length,
      encryptedFields: studentEncryptedFields,
      hashFields: studentHashFields,
    },
    staff: {
      scannedRows: staffProfiles.length,
      encryptedFields: staffEncryptedFields,
      hashFields: staffHashFields,
      bankFields: staffBankFields,
    },
    parentGuardians: {
      scannedRows: parentGuardians.length,
      encryptedFields: parentGuardianEncryptedFields,
      hashFields: parentGuardianHashFields,
    },
    parentProfiles: {
      scannedRows: parentProfiles.length,
      encryptedFields: parentProfileEncryptedFields,
      hashFields: parentProfileHashFields,
    },
    messagingCredentials: {
      scannedConfigs: configs.length,
      byChannel: Object.fromEntries([...messagingByChannel.entries()].sort()),
      bySecretKey: Object.fromEntries([...messagingBySecretKey.entries()].sort()),
    },
  }, null, 2));
};

main()
  .catch((error) => {
    console.error(JSON.stringify({
      ok: false,
      dryRun: true,
      modifiedDatabase: false,
      message: error instanceof Error ? error.message : 'Sensitive field audit failed.',
    }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
