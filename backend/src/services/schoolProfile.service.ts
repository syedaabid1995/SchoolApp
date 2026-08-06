import type { Prisma } from '@prisma/client';
import { prisma } from '../config/db';

export type SchoolContactDetail = {
  id: string;
  department: string;
  name: string;
  email: string;
  contactNumber: string;
};

export type SchoolProfileDetails = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  email: string | null;
  mobileNumber: string | null;
  contacts: SchoolContactDetail[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const cleanString = (value: unknown, maxLength: number) => {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
};

export const normalizeSchoolContacts = (value: unknown): SchoolContactDetail[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const source = isRecord(item) ? item : {};
      return {
        id: cleanString(source.id, 80) || `contact-${index + 1}`,
        department: cleanString(source.department, 80),
        name: cleanString(source.name, 120),
        email: cleanString(source.email, 160),
        contactNumber: cleanString(source.contactNumber, 40),
      };
    })
    .filter((item) => item.department || item.name || item.email || item.contactNumber)
    .slice(0, 50);
};

const nullableString = (value: unknown, maxLength: number) => {
  const next = cleanString(value, maxLength);
  return next || null;
};

const PLACEHOLDER_SCHOOL_NAMES = new Set([
  'infix',
  'infix school erp',
]);

const PLACEHOLDER_SCHOOL_CODES = new Set(['1000']);

const PLACEHOLDER_ADDRESSES = new Set([
  'dhanmondi 32, dhaka',
  'dhaka',
]);

const resolveGeneralValue = (
  value: unknown,
  maxLength: number,
  placeholders: Set<string>,
) => {
  const cleaned = cleanString(value, maxLength);
  if (!cleaned) return '';
  if (placeholders.has(cleaned.toLowerCase())) return '';
  return cleaned;
};

export const buildSchoolProfile = (school: {
  id: string;
  name: string;
  code: string;
  systemSetting?: { general: Prisma.JsonValue } | null;
}): SchoolProfileDetails => {
  const general = isRecord(school.systemSetting?.general)
    ? school.systemSetting.general
    : {};
  const configuredName = resolveGeneralValue(
    general.schoolName,
    160,
    PLACEHOLDER_SCHOOL_NAMES,
  );
  const configuredCode = resolveGeneralValue(
    general.schoolCode,
    80,
    PLACEHOLDER_SCHOOL_CODES,
  );
  const configuredAddress = resolveGeneralValue(
    general.address,
    500,
    PLACEHOLDER_ADDRESSES,
  );

  return {
    id: school.id,
    name: configuredName || school.name,
    code: configuredCode || school.code,
    address: configuredAddress || 'India',
    email: nullableString(general.email, 160),
    mobileNumber: nullableString(general.phone, 40),
    contacts: normalizeSchoolContacts(general.contacts),
  };
};

export const getSchoolProfilesByIds = async (schoolIds: string[]) => {
  const uniqueIds = Array.from(new Set(schoolIds.filter(Boolean)));
  if (!uniqueIds.length) return [];
  const schools = await prisma.school.findMany({
    where: { id: { in: uniqueIds } },
    select: {
      id: true,
      name: true,
      code: true,
      systemSetting: { select: { general: true } },
    },
    orderBy: { name: 'asc' },
  });
  return schools.map(buildSchoolProfile);
};
