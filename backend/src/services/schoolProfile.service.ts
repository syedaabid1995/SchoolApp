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

export const buildSchoolProfile = (school: {
  id: string;
  name: string;
  code: string;
  systemSetting?: { general: Prisma.JsonValue } | null;
}): SchoolProfileDetails => {
  const general = isRecord(school.systemSetting?.general) ? school.systemSetting.general : {};
  return {
    id: school.id,
    name: cleanString(general.schoolName, 160) || school.name,
    code: cleanString(general.schoolCode, 80) || school.code,
    address: nullableString(general.address, 500),
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
