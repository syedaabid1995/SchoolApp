import type { Prisma } from '@prisma/client';
import { env } from '../../../config/env';
import {
  hashSensitiveLookupValue,
  maybeDecryptSensitiveField,
  maybeEncryptSensitiveField,
} from '../../../utils/sensitiveFieldCrypto';

export const STAFF_PROFILE_ENCRYPT_FIELDS = [
  'phone',
  'address',
  'emergencyMobile',
  'drivingLicense',
  'currentAddress',
  'permanentAddress',
] as const;

export const STAFF_PROFILE_LOOKUP_HASH_FIELDS = [
  'phone',
  'emergencyMobile',
] as const;

export const STAFF_BANK_ENCRYPT_FIELDS = [
  'accountNumber',
  'ifscCode',
  'panNumber',
] as const;

type StaffProfileEncryptField = (typeof STAFF_PROFILE_ENCRYPT_FIELDS)[number];
type StaffProfileLookupField = (typeof STAFF_PROFILE_LOOKUP_HASH_FIELDS)[number];
type StaffBankEncryptField = (typeof STAFF_BANK_ENCRYPT_FIELDS)[number];

type StaffProfileSensitiveFieldMap = Partial<Record<StaffProfileEncryptField, string | null | undefined>>;
type StaffProfileLookupFieldMap = Partial<Record<StaffProfileLookupField, string | null | undefined>>;
type StaffProfileStorageFieldMap = StaffProfileSensitiveFieldMap &
  StaffProfileLookupFieldMap &
  Partial<Record<`${StaffProfileLookupField}Hash`, string | null | undefined>>;
type StaffBankSensitiveFieldMap = Partial<Record<StaffBankEncryptField, string | null | undefined>>;

const profileAssociatedDataFor = (field: StaffProfileEncryptField) => `TeacherProfile.${field}`;
const bankAssociatedDataFor = (field: StaffBankEncryptField) => `TeacherBankDetails.${field}`;

const lookupHashFor = (value: string | null | undefined) => {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === '') return null;
  if (!env.SENSITIVE_FIELD_ENCRYPTION_KEY) return null;
  return hashSensitiveLookupValue(value);
};

export const encryptStaffSensitiveFields = <T extends StaffProfileStorageFieldMap>(
  data: T,
): T & StaffProfileStorageFieldMap => {
  const next = { ...data };
  for (const field of STAFF_PROFILE_LOOKUP_HASH_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(next, field)) continue;
    next[`${field}Hash`] = lookupHashFor(next[field]) as T[`${typeof field}Hash`];
  }
  for (const field of STAFF_PROFILE_ENCRYPT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(next, field)) continue;
    next[field] = maybeEncryptSensitiveField(next[field], {
      associatedData: profileAssociatedDataFor(field),
    }) as T[typeof field];
  }
  return next as T & StaffProfileStorageFieldMap;
};

export const decryptStaffSensitiveFields = <T extends StaffProfileSensitiveFieldMap | null | undefined>(
  staff: T,
): T => {
  if (!staff) return staff;
  const next = { ...staff };
  for (const field of STAFF_PROFILE_ENCRYPT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(next, field)) continue;
    next[field] = maybeDecryptSensitiveField(next[field], {
      associatedData: profileAssociatedDataFor(field),
    }) as typeof next[typeof field];
  }
  return next as T;
};

export const encryptTeacherBankDetailsForStorage = <T extends StaffBankSensitiveFieldMap>(
  bankDetails: T,
): T => {
  const next = { ...bankDetails };
  for (const field of STAFF_BANK_ENCRYPT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(next, field)) continue;
    next[field] = maybeEncryptSensitiveField(next[field], {
      associatedData: bankAssociatedDataFor(field),
    }) as T[typeof field];
  }
  return next as T;
};

export const decryptTeacherBankDetails = <T extends StaffBankSensitiveFieldMap | null | undefined>(
  bankDetails: T,
): T => {
  if (!bankDetails) return bankDetails;
  const next = { ...bankDetails };
  for (const field of STAFF_BANK_ENCRYPT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(next, field)) continue;
    next[field] = maybeDecryptSensitiveField(next[field], {
      associatedData: bankAssociatedDataFor(field),
    }) as typeof next[typeof field];
  }
  return next as T;
};

export const decryptStaffRecord = <T extends StaffProfileSensitiveFieldMap & { bankDetails?: StaffBankSensitiveFieldMap | null }>(
  staff: T,
) => {
  const decrypted = decryptStaffSensitiveFields(staff);
  if (!Object.prototype.hasOwnProperty.call(decrypted, 'bankDetails')) return decrypted;
  return {
    ...decrypted,
    bankDetails: decryptTeacherBankDetails(decrypted.bankDetails),
  };
};

export const staffContactHashWhere = (
  value: string | null | undefined,
): Prisma.TeacherProfileWhereInput[] => {
  const hash = lookupHashFor(value);
  if (!hash || typeof hash !== 'string') return [];
  return [{ phoneHash: hash }, { emergencyMobileHash: hash }];
};
