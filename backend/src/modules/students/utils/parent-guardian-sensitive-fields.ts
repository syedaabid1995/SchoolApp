import type { Prisma } from '@prisma/client';
import { env } from '../../../config/env';
import {
  hashSensitiveLookupValue,
  maybeDecryptSensitiveField,
  maybeEncryptSensitiveField,
} from '../../../utils/sensitiveFieldCrypto';

export const PARENT_GUARDIAN_ENCRYPT_FIELDS = [
  'phone',
  'email',
] as const;

export const PARENT_GUARDIAN_LOOKUP_HASH_FIELDS = [
  'phone',
  'email',
] as const;

type ParentGuardianEncryptField = (typeof PARENT_GUARDIAN_ENCRYPT_FIELDS)[number];
type ParentGuardianLookupField = (typeof PARENT_GUARDIAN_LOOKUP_HASH_FIELDS)[number];
type ParentGuardianFieldMap = Partial<Record<ParentGuardianEncryptField, string | null | undefined>>;
type ParentGuardianStorageFieldMap = ParentGuardianFieldMap &
  Partial<Record<`${ParentGuardianLookupField}Hash`, string | null | undefined>>;

const associatedDataFor = (field: ParentGuardianEncryptField) => `ParentGuardian.${field}`;

const lookupHashFor = (value: string | null | undefined) => {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === '') return null;
  if (!env.SENSITIVE_FIELD_ENCRYPTION_KEY) return null;
  return hashSensitiveLookupValue(value);
};

export const parentGuardianLookupHashFor = (value: string | null | undefined) => {
  const hash = lookupHashFor(value);
  return hash && typeof hash === 'string' ? hash : null;
};

export const encryptParentGuardianSensitiveFields = <T extends ParentGuardianStorageFieldMap>(
  data: T,
): T & ParentGuardianStorageFieldMap => {
  const next = { ...data };
  for (const field of PARENT_GUARDIAN_LOOKUP_HASH_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(next, field)) continue;
    next[`${field}Hash`] = lookupHashFor(next[field]) as T[`${typeof field}Hash`];
  }
  for (const field of PARENT_GUARDIAN_ENCRYPT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(next, field)) continue;
    next[field] = maybeEncryptSensitiveField(next[field], {
      associatedData: associatedDataFor(field),
    }) as T[typeof field];
  }
  return next as T & ParentGuardianStorageFieldMap;
};

export const decryptParentGuardianSensitiveFields = <T extends ParentGuardianFieldMap | null | undefined>(
  guardian: T,
): T => {
  if (!guardian) return guardian;
  const next = { ...guardian };
  for (const field of PARENT_GUARDIAN_ENCRYPT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(next, field)) continue;
    next[field] = maybeDecryptSensitiveField(next[field], {
      associatedData: associatedDataFor(field),
    }) as typeof next[typeof field];
  }
  return next as T;
};

export const decryptParentGuardianSensitiveFieldList = <T extends ParentGuardianFieldMap>(
  guardians: T[],
) => guardians.map((guardian) => decryptParentGuardianSensitiveFields(guardian));

export const parentGuardianContactWhere = (
  schoolId: string,
  field: ParentGuardianLookupField,
  values: string[],
): Prisma.ParentGuardianWhereInput[] => {
  const rawValues = values.filter((value) => value.trim() !== '');
  const hashes = rawValues
    .map((value) => parentGuardianLookupHashFor(value))
    .filter((value): value is string => Boolean(value));

  const predicates: Prisma.ParentGuardianWhereInput[] = [];
  if (hashes.length) predicates.push({ schoolId, [`${field}Hash`]: { in: hashes } });
  if (rawValues.length) predicates.push({ schoolId, [field]: { in: rawValues } });
  return predicates;
};
