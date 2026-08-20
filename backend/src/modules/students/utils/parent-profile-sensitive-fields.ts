import type { Prisma } from '@prisma/client';
import { env } from '../../../config/env';
import {
  hashSensitiveLookupValue,
  maybeDecryptSensitiveField,
  maybeEncryptSensitiveField,
} from '../../../utils/sensitiveFieldCrypto';

export const PARENT_PROFILE_ENCRYPT_FIELDS = [
  'phone',
  'email',
] as const;

export const PARENT_PROFILE_LOOKUP_HASH_FIELDS = [
  'phone',
  'email',
] as const;

type ParentProfileEncryptField = (typeof PARENT_PROFILE_ENCRYPT_FIELDS)[number];
type ParentProfileLookupField = (typeof PARENT_PROFILE_LOOKUP_HASH_FIELDS)[number];
type ParentProfileFieldMap = Partial<Record<ParentProfileEncryptField, string | null | undefined>>;
type ParentProfileStorageFieldMap = ParentProfileFieldMap &
  Partial<Record<`${ParentProfileLookupField}Hash`, string | null | undefined>>;

const associatedDataFor = (field: ParentProfileEncryptField) => `ParentProfile.${field}`;

const lookupHashFor = (value: string | null | undefined) => {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === '') return null;
  if (!env.SENSITIVE_FIELD_ENCRYPTION_KEY) return null;
  return hashSensitiveLookupValue(value);
};

export const parentProfileLookupHashFor = (value: string | null | undefined) => {
  const hash = lookupHashFor(value);
  return hash && typeof hash === 'string' ? hash : null;
};

export const encryptParentProfileSensitiveFields = <T extends ParentProfileStorageFieldMap>(
  data: T,
): T & ParentProfileStorageFieldMap => {
  const next = { ...data };
  for (const field of PARENT_PROFILE_LOOKUP_HASH_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(next, field)) continue;
    next[`${field}Hash`] = lookupHashFor(next[field]) as T[`${typeof field}Hash`];
  }
  for (const field of PARENT_PROFILE_ENCRYPT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(next, field)) continue;
    next[field] = maybeEncryptSensitiveField(next[field], {
      associatedData: associatedDataFor(field),
    }) as T[typeof field];
  }
  return next as T & ParentProfileStorageFieldMap;
};

export const decryptParentProfileSensitiveFields = <T extends ParentProfileFieldMap | null | undefined>(
  parent: T,
): T => {
  if (!parent) return parent;
  const next = { ...parent };
  for (const field of PARENT_PROFILE_ENCRYPT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(next, field)) continue;
    next[field] = maybeDecryptSensitiveField(next[field], {
      associatedData: associatedDataFor(field),
    }) as typeof next[typeof field];
  }
  return next as T;
};

export const decryptParentProfileSensitiveFieldList = <T extends ParentProfileFieldMap>(
  parents: T[],
) => parents.map((parent) => decryptParentProfileSensitiveFields(parent));

export const parentProfileContactWhere = (
  field: ParentProfileLookupField,
  values: string[],
): Prisma.ParentProfileWhereInput[] => {
  const rawValues = values.filter((value) => value.trim() !== '');
  const hashes = rawValues
    .map((value) => parentProfileLookupHashFor(value))
    .filter((value): value is string => Boolean(value));

  const predicates: Prisma.ParentProfileWhereInput[] = [];
  if (hashes.length) predicates.push({ [`${field}Hash`]: { in: hashes } });
  if (rawValues.length) predicates.push({ [field]: { in: rawValues } });
  return predicates;
};

export const parentProfileAnyContactWhere = (
  value: string | null | undefined,
): Prisma.ParentProfileWhereInput[] => {
  const hash = parentProfileLookupHashFor(value);
  const predicates: Prisma.ParentProfileWhereInput[] = [];
  if (hash) predicates.push({ phoneHash: hash }, { emailHash: hash });
  if (value?.trim()) {
    predicates.push(
      { phone: { contains: value.trim(), mode: 'insensitive' } },
      { email: { contains: value.trim(), mode: 'insensitive' } },
    );
  }
  return predicates;
};
