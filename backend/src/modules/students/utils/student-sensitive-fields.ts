import {
  hashSensitiveLookupValue,
  maybeDecryptSensitiveField,
  maybeEncryptSensitiveField,
} from '../../../utils/sensitiveFieldCrypto';
import { env } from '../../../config/env';
import type { Prisma } from '@prisma/client';
import {
  decryptParentGuardianSensitiveFieldList,
} from './parent-guardian-sensitive-fields';
import {
  decryptParentProfileSensitiveFields,
} from './parent-profile-sensitive-fields';

export const STUDENT_ENCRYPT_ONLY_FIELDS = [
  'email',
  'phone',
  'fatherPhone',
  'motherPhone',
  'parentPhone',
  'parentEmail',
  'presentAddress',
  'permanentAddress',
  'addressLine1',
  'addressLine2',
  'city',
  'state',
  'pincode',
  'emergencyContact',
  'bloodGroup',
  'medicalConditions',
  'allergies',
  'doctorContact',
  'docBirthCert',
  'docTransferCert',
  'docAadhaar',
  'docReportCard',
] as const;

export const STUDENT_LOOKUP_HASH_FIELDS = [
  'email',
  'phone',
  'fatherPhone',
  'motherPhone',
  'parentPhone',
  'parentEmail',
  'emergencyContact',
  'doctorContact',
  'docAadhaar',
] as const;

export const STUDENT_SEARCHABLE_CONTACT_HASH_FIELDS = [
  'email',
  'phone',
  'fatherPhone',
  'motherPhone',
  'parentPhone',
  'parentEmail',
] as const;

type StudentSensitiveField = (typeof STUDENT_ENCRYPT_ONLY_FIELDS)[number];
type StudentSensitiveLookupField = (typeof STUDENT_LOOKUP_HASH_FIELDS)[number];
export type StudentSearchableContactHashField = (typeof STUDENT_SEARCHABLE_CONTACT_HASH_FIELDS)[number];
type StudentSensitiveFieldMap = Partial<Record<StudentSensitiveField, string | null | undefined>>;
type StudentSensitiveLookupFieldMap = Partial<Record<StudentSensitiveLookupField, string | null | undefined>>;
type StudentSensitiveStorageFieldMap = StudentSensitiveFieldMap &
  StudentSensitiveLookupFieldMap &
  Partial<Record<`${StudentSensitiveLookupField}Hash`, string | null | undefined>>;

const associatedDataFor = (field: StudentSensitiveField) => `Student.${field}`;

const lookupHashFor = (value: string | null | undefined) => {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === '') return null;
  if (!env.SENSITIVE_FIELD_ENCRYPTION_KEY) return null;
  return hashSensitiveLookupValue(value);
};

export const isStudentSensitiveField = (field: string): field is StudentSensitiveField =>
  (STUDENT_ENCRYPT_ONLY_FIELDS as readonly string[]).includes(field);

export const isStudentSearchableContactHashField = (field: string): field is StudentSearchableContactHashField =>
  (STUDENT_SEARCHABLE_CONTACT_HASH_FIELDS as readonly string[]).includes(field);

export const studentContactHashWhere = (
  schoolId: string,
  field: StudentSearchableContactHashField,
  value: string | null | undefined,
): Prisma.StudentWhereInput => {
  const hash = lookupHashFor(value);
  return {
    schoolId,
    [`${field}Hash`]: hash && typeof hash === 'string' ? hash : '__no_match__',
  };
};

export const studentAnyContactHashWhere = (
  schoolId: string,
  value: string | null | undefined,
): Prisma.StudentWhereInput => {
  const hash = lookupHashFor(value);
  return {
    schoolId,
    OR: hash && typeof hash === 'string'
      ? STUDENT_SEARCHABLE_CONTACT_HASH_FIELDS.map((field) => ({ [`${field}Hash`]: hash }))
      : [{ emailHash: '__no_match__' }],
  };
};

export const encryptStudentSensitiveFields = <T extends StudentSensitiveStorageFieldMap>(
  data: T,
): T & StudentSensitiveStorageFieldMap => {
  const next = { ...data };
  for (const field of STUDENT_LOOKUP_HASH_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(next, field)) continue;
    next[`${field}Hash`] = lookupHashFor(next[field]) as T[`${typeof field}Hash`];
  }
  for (const field of STUDENT_ENCRYPT_ONLY_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(next, field)) continue;
    next[field] = maybeEncryptSensitiveField(next[field], {
      associatedData: associatedDataFor(field),
    }) as T[typeof field];
  }
  return next as T & StudentSensitiveStorageFieldMap;
};

export const decryptStudentSensitiveFields = <T extends StudentSensitiveFieldMap | null | undefined>(
  student: T,
): T => {
  if (!student) return student;
  const next = { ...student };
  for (const field of STUDENT_ENCRYPT_ONLY_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(next, field)) continue;
    next[field] = maybeDecryptSensitiveField(next[field], {
      associatedData: associatedDataFor(field),
    }) as typeof next[typeof field];
  }
  if (
    Object.prototype.hasOwnProperty.call(next, 'guardians') &&
    Array.isArray((next as T & { guardians?: unknown }).guardians)
  ) {
    (next as T & { guardians: Array<Record<string, string | null | undefined>> }).guardians =
      decryptParentGuardianSensitiveFieldList(
        (next as T & { guardians: Array<Record<string, string | null | undefined>> }).guardians,
      );
  }
  if (
    Object.prototype.hasOwnProperty.call(next, 'parentLinks') &&
    Array.isArray((next as T & { parentLinks?: unknown }).parentLinks)
  ) {
    (next as T & { parentLinks: Array<{ parent?: Record<string, string | null | undefined> | null }> }).parentLinks =
      (next as T & { parentLinks: Array<{ parent?: Record<string, string | null | undefined> | null }> }).parentLinks.map((link) => ({
        ...link,
        parent: link.parent ? decryptParentProfileSensitiveFields(link.parent) : link.parent,
      }));
  }
  return next as T;
};

export const decryptStudentSensitiveFieldList = <T extends StudentSensitiveFieldMap>(
  students: T[],
) => students.map((student) => decryptStudentSensitiveFields(student));
