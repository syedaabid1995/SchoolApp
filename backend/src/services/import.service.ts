import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Prisma, type ExpensePaymentMode, type SubjectType } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { prisma } from '../config/db';
import { hashPassword } from '../utils/password';
import { incrementUsage, enforceLimits } from './subscription.service';
import { withTemporaryStoredObjectFile } from './runtimeStorage.service';

export type ImportRowError = {
  rowNumber: number;
  field?: string;
  message: string;
  rawData?: Record<string, unknown>;
};

export const importTypes = [
  'CLASS',
  'SECTION',
  'SUBJECT',
  'STUDENT',
  'TEACHER',
  'EXPENSE_CATEGORY',
  'EXPENSE',
] as const;

export type BulkImportType = typeof importTypes[number];
type NormalizedRow = Record<string, string>;

type ImportDefinition = {
  type: BulkImportType;
  label: string;
  description: string;
  requiredFields: string[];
  optionalFields: string[];
  sample: NormalizedRow;
};

const paymentModes = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'UPI', 'CARD', 'OTHER'] as const;

export const importDefinitions: ImportDefinition[] = [
  {
    type: 'CLASS',
    label: 'Classes',
    description: 'Create academic classes and optionally attach them to an academic year.',
    requiredFields: ['name'],
    optionalFields: ['academic_year'],
    sample: { name: 'Grade 1', academic_year: '2026-2027' },
  },
  {
    type: 'SECTION',
    label: 'Sections',
    description: 'Create sections and optionally link them to a class.',
    requiredFields: ['name'],
    optionalFields: ['class'],
    sample: { name: 'A', class: 'Grade 1' },
  },
  {
    type: 'SUBJECT',
    label: 'Subjects',
    description: 'Create subjects with optional class and academic-year scope.',
    requiredFields: ['name'],
    optionalFields: ['code', 'type', 'class', 'academic_year'],
    sample: { name: 'Mathematics', code: 'MATH', type: 'THEORY', class: 'Grade 1', academic_year: '2026-2027' },
  },
  {
    type: 'STUDENT',
    label: 'Students',
    description: 'Create students; class, section, and academic year create an enrollment when all three are present.',
    requiredFields: ['admission_no', 'first_name', 'last_name'],
    optionalFields: ['roll_no', 'academic_year', 'class', 'section', 'date_of_birth', 'gender', 'email', 'phone', 'admission_date', 'father_name', 'father_phone', 'mother_name', 'mother_phone'],
    sample: { admission_no: 'ADM-1001', roll_no: '1', academic_year: '2026-2027', class: 'Grade 1', section: 'A', first_name: 'Aarav', last_name: 'Sharma', date_of_birth: '2012-04-12', gender: 'Male', email: 'aarav@example.com', phone: '9000000010', admission_date: '2026-06-01', father_name: 'Rohit Sharma', father_phone: '9000000011', mother_name: 'Neha Sharma', mother_phone: '9000000012' },
  },
  {
    type: 'TEACHER',
    label: 'Teachers',
    description: 'Create teacher user accounts and profiles.',
    requiredFields: ['email', 'first_name', 'last_name'],
    optionalFields: ['employee_no', 'phone', 'address', 'password'],
    sample: { email: 'teacher@example.com', first_name: 'Priya', last_name: 'Nair', employee_no: 'T-1001', phone: '9000000020', address: 'School address', password: '' },
  },
  {
    type: 'EXPENSE_CATEGORY',
    label: 'Expense Categories',
    description: 'Create expense categories used by expense imports.',
    requiredFields: ['name'],
    optionalFields: ['description', 'status', 'sort_order'],
    sample: { name: 'Stationery', description: 'Books and stationery purchases', status: 'ACTIVE', sort_order: '10' },
  },
  {
    type: 'EXPENSE',
    label: 'Expenses',
    description: 'Create expense records by category name.',
    requiredFields: ['title', 'category', 'amount', 'expense_date', 'payment_mode'],
    optionalFields: ['paid_to', 'reference_number', 'description'],
    sample: { title: 'Notebook purchase', category: 'Stationery', amount: '1250.00', expense_date: '2026-07-01', payment_mode: 'UPI', paid_to: 'ABC Stores', reference_number: 'UPI123', description: 'Bulk notebooks' },
  },
];

const normalizeKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const normalizeText = (value: string) => value.trim().replace(/\s+/g, ' ');
const nullableText = (value?: string | null) => {
  const normalized = value?.trim().replace(/\s+/g, ' ');
  return normalized || null;
};
const normalizeName = (value: string) => normalizeText(value).toLowerCase();

const normalizeRow = (row: Record<string, unknown>) => {
  const normalized: NormalizedRow = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[normalizeKey(key)] = String(value ?? '').trim();
  }
  return normalized;
};

const getValue = (row: NormalizedRow, keys: string[]) => {
  for (const key of keys) {
    const value = row[normalizeKey(key)];
    if (value) return value.trim();
  }
  return '';
};

const isValidDateOnly = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
const optionalDate = (value: string) => value ? new Date(value) : null;

const loadLocalFileRows = async (filePath: string, originalName: string) => {
  const ext = path.extname(originalName || filePath).toLowerCase();
  if (ext === '.csv') {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('\uFFFD')) throw new Error('CSV must be UTF-8 encoded');
    const rows = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, unknown>[];
    return rows.map(normalizeRow);
  }

  if (ext === '.xlsx') {
    const workbook = new ExcelJS.Workbook();
    const wb = await workbook.xlsx.readFile(filePath);
    const sheet = wb.worksheets[0];
    if (!sheet) return [];
    const headerRow = sheet.getRow(1);
    const headerValues = Array.isArray(headerRow.values) ? headerRow.values : [];
    const headers = headerValues.slice(1).map((value) => normalizeKey(String(value ?? '')));

    const rows: Record<string, unknown>[] = [];
    for (let rowIndex = 2; rowIndex <= sheet.rowCount; rowIndex += 1) {
      const row = sheet.getRow(rowIndex);
      const record: Record<string, unknown> = {};
      headers.forEach((header, idx) => {
        if (!header) return;
        const cell = row.getCell(idx + 1);
        record[header] = cell.text || cell.value || '';
      });
      if (Object.values(record).some((value) => String(value ?? '').trim() !== '')) {
        rows.push(record);
      }
    }

    return rows.map(normalizeRow);
  }

  throw new Error('Unsupported file type');
};

export const loadBufferRows = async (file: Pick<Express.Multer.File, 'buffer' | 'originalname'>) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.csv') {
    const content = file.buffer.toString('utf8');
    if (content.includes('\uFFFD')) throw new Error('CSV must be UTF-8 encoded');
    const rows = parse(content, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, unknown>[];
    return rows.map(normalizeRow);
  }

  if (ext === '.xlsx') {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as any);
    const sheet = workbook.worksheets[0];
    if (!sheet) return [];
    const headers = (sheet.getRow(1).values as unknown[]).slice(1).map((value) => normalizeKey(String(value ?? '')));
    const rows: Record<string, unknown>[] = [];
    for (let rowIndex = 2; rowIndex <= sheet.rowCount; rowIndex += 1) {
      const row = sheet.getRow(rowIndex);
      const record: Record<string, unknown> = {};
      headers.forEach((header, idx) => {
        if (!header) return;
        const cell = row.getCell(idx + 1);
        record[header] = cell.text || cell.value || '';
      });
      if (Object.values(record).some((value) => String(value ?? '').trim() !== '')) rows.push(record);
    }
    return rows.map(normalizeRow);
  }

  throw new Error('Unsupported file type');
};

const loadFileRows = async (storageRef: string, originalName: string) =>
  withTemporaryStoredObjectFile({
    storageRef,
    extension: path.extname(originalName),
    handler: (filePath) => loadLocalFileRows(filePath, originalName),
  });

export const buildImportTemplateCsv = (type: BulkImportType) => {
  const definition = getImportDefinition(type);
  const headers = [...definition.requiredFields, ...definition.optionalFields];
  const row = headers.map((header) => csvEscape(definition.sample[header] ?? ''));
  return `${headers.join(',')}\n${row.join(',')}\n`;
};

const csvEscape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export const getImportDefinition = (type: BulkImportType) => {
  const definition = importDefinitions.find((item) => item.type === type);
  if (!definition) throw new Error('Unsupported import type');
  return definition;
};

const addRequiredErrors = (row: NormalizedRow, rowNumber: number, fields: string[], errors: ImportRowError[]) => {
  for (const field of fields) {
    if (!getValue(row, [field])) {
      errors.push({ rowNumber, field, message: 'Required', rawData: row });
    }
  }
};

type PrismaClientLike = typeof prisma | Prisma.TransactionClient;

const findAcademicYear = (db: PrismaClientLike, schoolId: string, name: string) =>
  name
    ? db.academicYear.findFirst({ where: { schoolId, name: { equals: name, mode: Prisma.QueryMode.insensitive } }, select: { id: true, name: true } })
    : Promise.resolve(null);

const findClass = (db: PrismaClientLike, schoolId: string, name: string) =>
  name
    ? db.class.findFirst({ where: { schoolId, name: { equals: name, mode: Prisma.QueryMode.insensitive } }, select: { id: true, name: true } })
    : Promise.resolve(null);

const findSection = (db: PrismaClientLike, schoolId: string, name: string) =>
  name
    ? db.section.findFirst({ where: { schoolId, name: { equals: name, mode: Prisma.QueryMode.insensitive } }, select: { id: true, name: true } })
    : Promise.resolve(null);

const validateClassRows = async (schoolId: string, rows: NormalizedRow[]) => {
  const errors: ImportRowError[] = [];
  const valid: NormalizedRow[] = [];
  const seen = new Set<string>();

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    addRequiredErrors(row, rowNumber, ['name'], errors);
    const name = normalizeText(getValue(row, ['name']));
    const academicYearName = getValue(row, ['academic_year', 'academic_year_name']);
    const key = normalizeName(name);
    const rowErrors: ImportRowError[] = [];
    if (name && seen.has(key)) rowErrors.push({ rowNumber, field: 'name', message: 'Duplicate in file', rawData: row });
    if (academicYearName && !(await findAcademicYear(prisma, schoolId, academicYearName))) {
      rowErrors.push({ rowNumber, field: 'academic_year', message: 'Academic year not found', rawData: row });
    }
    const duplicate = name
      ? await prisma.class.findFirst({ where: { schoolId, name: { equals: name, mode: Prisma.QueryMode.insensitive } }, select: { id: true } })
      : null;
    if (duplicate) rowErrors.push({ rowNumber, field: 'name', message: 'Class already exists', rawData: row });
    if (rowErrors.length) errors.push(...rowErrors);
    else if (name) {
      seen.add(key);
      valid.push(row);
    }
  }
  return { valid, errors };
};

const validateSectionRows = async (schoolId: string, rows: NormalizedRow[]) => {
  const errors: ImportRowError[] = [];
  const valid: NormalizedRow[] = [];
  const seen = new Set<string>();

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    addRequiredErrors(row, rowNumber, ['name'], errors);
    const name = normalizeText(getValue(row, ['name', 'section']));
    const className = getValue(row, ['class', 'class_name']);
    const rowErrors: ImportRowError[] = [];
    if (name && seen.has(normalizeName(name))) rowErrors.push({ rowNumber, field: 'name', message: 'Duplicate in file', rawData: row });
    if (className && !(await findClass(prisma, schoolId, className))) rowErrors.push({ rowNumber, field: 'class', message: 'Class not found', rawData: row });
    const duplicate = name
      ? await prisma.section.findFirst({ where: { schoolId, name: { equals: name, mode: Prisma.QueryMode.insensitive } }, select: { id: true } })
      : null;
    if (duplicate) rowErrors.push({ rowNumber, field: 'name', message: 'Section already exists', rawData: row });
    if (rowErrors.length) errors.push(...rowErrors);
    else if (name) {
      seen.add(normalizeName(name));
      valid.push(row);
    }
  }
  return { valid, errors };
};

const validateSubjectRows = async (schoolId: string, rows: NormalizedRow[]) => {
  const errors: ImportRowError[] = [];
  const valid: NormalizedRow[] = [];
  const seen = new Set<string>();

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    addRequiredErrors(row, rowNumber, ['name'], errors);
    const name = normalizeText(getValue(row, ['name', 'subject']));
    const type = getValue(row, ['type']).toUpperCase() || 'THEORY';
    const className = getValue(row, ['class', 'class_name']);
    const academicYearName = getValue(row, ['academic_year', 'academic_year_name']);
    const foundClass = await findClass(prisma, schoolId, className);
    const academicYear = await findAcademicYear(prisma, schoolId, academicYearName);
    const key = normalizeName(`${name}|${foundClass?.id ?? ''}|${academicYear?.id ?? ''}`);
    const rowErrors: ImportRowError[] = [];
    if (type && !['THEORY', 'PRACTICAL'].includes(type)) rowErrors.push({ rowNumber, field: 'type', message: 'Use THEORY or PRACTICAL', rawData: row });
    if (className && !foundClass) rowErrors.push({ rowNumber, field: 'class', message: 'Class not found', rawData: row });
    if (academicYearName && !academicYear) rowErrors.push({ rowNumber, field: 'academic_year', message: 'Academic year not found', rawData: row });
    if (name && seen.has(key)) rowErrors.push({ rowNumber, field: 'name', message: 'Duplicate in file', rawData: row });
    const duplicate = name
      ? await prisma.subject.findFirst({
          where: { schoolId, name: { equals: name, mode: Prisma.QueryMode.insensitive }, classId: foundClass?.id ?? null, academicYearId: academicYear?.id ?? null },
          select: { id: true },
        })
      : null;
    if (duplicate) rowErrors.push({ rowNumber, field: 'name', message: 'Subject already exists for this class/year scope', rawData: row });
    if (rowErrors.length) errors.push(...rowErrors);
    else if (name) {
      seen.add(key);
      valid.push(row);
    }
  }
  return { valid, errors };
};

const validateStudentRows = async (schoolId: string, rows: NormalizedRow[]) => {
  const errors: ImportRowError[] = [];
  const valid: NormalizedRow[] = [];
  const seenAdmission = new Set<string>();

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    addRequiredErrors(row, rowNumber, ['admission_no', 'first_name', 'last_name'], errors);
    const admissionNo = getValue(row, ['admission_no']);
    const dob = getValue(row, ['date_of_birth', 'dob']);
    const admissionDate = getValue(row, ['admission_date']);
    const className = getValue(row, ['class', 'class_name']);
    const sectionName = getValue(row, ['section', 'section_name']);
    const academicYearName = getValue(row, ['academic_year', 'academic_year_name']);
    const rowErrors: ImportRowError[] = [];
    if (dob && !isValidDateOnly(dob)) rowErrors.push({ rowNumber, field: 'date_of_birth', message: 'Use YYYY-MM-DD date format', rawData: row });
    if (admissionDate && !isValidDateOnly(admissionDate)) rowErrors.push({ rowNumber, field: 'admission_date', message: 'Use YYYY-MM-DD date format', rawData: row });
    if (admissionNo && seenAdmission.has(admissionNo)) rowErrors.push({ rowNumber, field: 'admission_no', message: 'Duplicate in file', rawData: row });
    if (admissionNo && await prisma.student.findFirst({ where: { schoolId, admissionNo }, select: { id: true } })) {
      rowErrors.push({ rowNumber, field: 'admission_no', message: 'Admission number already exists', rawData: row });
    }
    if (className && !(await findClass(prisma, schoolId, className))) rowErrors.push({ rowNumber, field: 'class', message: 'Class not found', rawData: row });
    if (sectionName && !(await findSection(prisma, schoolId, sectionName))) rowErrors.push({ rowNumber, field: 'section', message: 'Section not found', rawData: row });
    if (academicYearName && !(await findAcademicYear(prisma, schoolId, academicYearName))) rowErrors.push({ rowNumber, field: 'academic_year', message: 'Academic year not found', rawData: row });
    if (rowErrors.length) errors.push(...rowErrors);
    else if (admissionNo) {
      seenAdmission.add(admissionNo);
      valid.push(row);
    }
  }
  return { valid, errors };
};

const validateTeacherRows = async (schoolId: string, rows: NormalizedRow[]) => {
  const errors: ImportRowError[] = [];
  const valid: NormalizedRow[] = [];
  const seenEmail = new Set<string>();
  const seenEmployee = new Set<string>();

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    addRequiredErrors(row, rowNumber, ['email', 'first_name', 'last_name'], errors);
    const email = getValue(row, ['email']).toLowerCase();
    const employeeNo = getValue(row, ['employee_no']);
    const rowErrors: ImportRowError[] = [];
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) rowErrors.push({ rowNumber, field: 'email', message: 'Invalid email', rawData: row });
    if (email && seenEmail.has(email)) rowErrors.push({ rowNumber, field: 'email', message: 'Duplicate in file', rawData: row });
    if (email && await prisma.user.findFirst({ where: { schoolId, email }, select: { id: true } })) rowErrors.push({ rowNumber, field: 'email', message: 'Already exists', rawData: row });
    if (employeeNo && seenEmployee.has(employeeNo)) rowErrors.push({ rowNumber, field: 'employee_no', message: 'Duplicate in file', rawData: row });
    if (employeeNo && await prisma.teacherProfile.findFirst({ where: { schoolId, employeeNo }, select: { id: true } })) {
      rowErrors.push({ rowNumber, field: 'employee_no', message: 'Already exists', rawData: row });
    }
    if (rowErrors.length) errors.push(...rowErrors);
    else if (email) {
      seenEmail.add(email);
      if (employeeNo) seenEmployee.add(employeeNo);
      valid.push(row);
    }
  }
  return { valid, errors };
};

const validateExpenseCategoryRows = async (schoolId: string, rows: NormalizedRow[]) => {
  const errors: ImportRowError[] = [];
  const valid: NormalizedRow[] = [];
  const seen = new Set<string>();
  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    addRequiredErrors(row, rowNumber, ['name'], errors);
    const name = getValue(row, ['name', 'category']);
    const status = getValue(row, ['status']).toUpperCase() || 'ACTIVE';
    const rowErrors: ImportRowError[] = [];
    if (status && !['ACTIVE', 'INACTIVE'].includes(status)) rowErrors.push({ rowNumber, field: 'status', message: 'Use ACTIVE or INACTIVE', rawData: row });
    if (name && seen.has(normalizeName(name))) rowErrors.push({ rowNumber, field: 'name', message: 'Duplicate in file', rawData: row });
    if (name && await prisma.expenseCategory.findFirst({ where: { schoolId, normalizedName: normalizeName(name), deletedAt: null }, select: { id: true } })) {
      rowErrors.push({ rowNumber, field: 'name', message: 'Category already exists', rawData: row });
    }
    if (rowErrors.length) errors.push(...rowErrors);
    else if (name) {
      seen.add(normalizeName(name));
      valid.push(row);
    }
  }
  return { valid, errors };
};

const validateExpenseRows = async (schoolId: string, rows: NormalizedRow[]) => {
  const errors: ImportRowError[] = [];
  const valid: NormalizedRow[] = [];
  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    addRequiredErrors(row, rowNumber, ['title', 'category', 'amount', 'expense_date', 'payment_mode'], errors);
    const category = getValue(row, ['category', 'category_name']);
    const amount = Number(getValue(row, ['amount']));
    const expenseDate = getValue(row, ['expense_date', 'date']);
    const paymentMode = getValue(row, ['payment_mode']).toUpperCase();
    const rowErrors: ImportRowError[] = [];
    if (category && !(await prisma.expenseCategory.findFirst({ where: { schoolId, normalizedName: normalizeName(category), deletedAt: null, status: 'ACTIVE' }, select: { id: true } }))) {
      rowErrors.push({ rowNumber, field: 'category', message: 'Active expense category not found', rawData: row });
    }
    if (!Number.isFinite(amount) || amount <= 0) rowErrors.push({ rowNumber, field: 'amount', message: 'Amount must be greater than zero', rawData: row });
    if (expenseDate && !isValidDateOnly(expenseDate)) rowErrors.push({ rowNumber, field: 'expense_date', message: 'Use YYYY-MM-DD date format', rawData: row });
    if (paymentMode && !paymentModes.includes(paymentMode as ExpensePaymentMode)) {
      rowErrors.push({ rowNumber, field: 'payment_mode', message: `Use one of: ${paymentModes.join(', ')}`, rawData: row });
    }
    if (rowErrors.length) errors.push(...rowErrors);
    else valid.push(row);
  }
  return { valid, errors };
};

export const validateImportRows = async (schoolId: string, type: BulkImportType, rows: NormalizedRow[]) => {
  switch (type) {
    case 'CLASS': return validateClassRows(schoolId, rows);
    case 'SECTION': return validateSectionRows(schoolId, rows);
    case 'SUBJECT': return validateSubjectRows(schoolId, rows);
    case 'STUDENT': return validateStudentRows(schoolId, rows);
    case 'TEACHER': return validateTeacherRows(schoolId, rows);
    case 'EXPENSE_CATEGORY': return validateExpenseCategoryRows(schoolId, rows);
    case 'EXPENSE': return validateExpenseRows(schoolId, rows);
    default: throw new Error('Unsupported import type');
  }
};

const createTeacherUser = async (tx: Prisma.TransactionClient, schoolId: string, row: NormalizedRow, roleId: string) => {
  const providedPassword = getValue(row, ['password']);
  const password = providedPassword || crypto.randomBytes(12).toString('base64url');
  const passwordHash = await hashPassword(password);
  const email = getValue(row, ['email']).toLowerCase();

  const user = await tx.user.create({
    data: {
      schoolId,
      email,
      passwordHash,
      status: 'ACTIVE',
      mustChangePassword: !providedPassword,
      roles: { create: [{ roleId }] },
    },
  });

  await tx.teacherProfile.create({
    data: {
      schoolId,
      userId: user.id,
      employeeNo: nullableText(getValue(row, ['employee_no'])),
      firstName: normalizeText(getValue(row, ['first_name'])),
      lastName: normalizeText(getValue(row, ['last_name'])),
      phone: nullableText(getValue(row, ['phone'])),
      address: nullableText(getValue(row, ['address'])),
    },
  });
};

const applyImportRows = async (schoolId: string, userId: string | null, type: BulkImportType, rows: NormalizedRow[]) => {
  if (!rows.length) return 0;

  if (type === 'STUDENT') await enforceLimits(schoolId, 'students', rows.length);
  if (type === 'TEACHER') await enforceLimits(schoolId, 'teachers', rows.length);

  let count = 0;
  await prisma.$transaction(async (tx) => {
    if (type === 'TEACHER') {
      const teacherRole = await tx.role.upsert({ where: { name: 'TEACHER' }, update: {}, create: { name: 'TEACHER' } });
      for (const row of rows) {
        await createTeacherUser(tx, schoolId, row, teacherRole.id);
        count += 1;
      }
      return;
    }

    for (const row of rows) {
      if (type === 'CLASS') {
        const academicYear = await findAcademicYear(tx, schoolId, getValue(row, ['academic_year', 'academic_year_name']));
        await tx.class.create({
          data: {
            schoolId,
            name: normalizeText(getValue(row, ['name'])),
            academicYearId: academicYear?.id ?? null,
          },
        });
      }

      if (type === 'SECTION') {
        const foundClass = await findClass(tx, schoolId, getValue(row, ['class', 'class_name']));
        const section = await tx.section.create({
          data: {
            schoolId,
            classId: foundClass?.id ?? null,
            name: normalizeText(getValue(row, ['name', 'section'])),
          },
        });
        if (foundClass) {
          await tx.classSection.upsert({
            where: { classId_sectionId: { classId: foundClass.id, sectionId: section.id } },
            update: {},
            create: { schoolId, classId: foundClass.id, sectionId: section.id },
          });
        }
      }

      if (type === 'SUBJECT') {
        const foundClass = await findClass(tx, schoolId, getValue(row, ['class', 'class_name']));
        const academicYear = await findAcademicYear(tx, schoolId, getValue(row, ['academic_year', 'academic_year_name']));
        await tx.subject.create({
          data: {
            schoolId,
            name: normalizeText(getValue(row, ['name', 'subject'])),
            code: nullableText(getValue(row, ['code'])),
            type: (getValue(row, ['type']).toUpperCase() || 'THEORY') as SubjectType,
            classId: foundClass?.id ?? null,
            academicYearId: academicYear?.id ?? null,
          },
        });
      }

      if (type === 'STUDENT') {
        const foundClass = await findClass(tx, schoolId, getValue(row, ['class', 'class_name']));
        const section = await findSection(tx, schoolId, getValue(row, ['section', 'section_name']));
        const academicYear = await findAcademicYear(tx, schoolId, getValue(row, ['academic_year', 'academic_year_name']));
        const firstName = normalizeText(getValue(row, ['first_name']));
        const lastName = normalizeText(getValue(row, ['last_name']));
        const admissionDate = getValue(row, ['admission_date']);
        const student = await tx.student.create({
          data: {
            schoolId,
            academicSessionId: academicYear?.id ?? null,
            classId: foundClass?.id ?? null,
            sectionId: section?.id ?? null,
            admissionNo: getValue(row, ['admission_no']),
            rollNo: nullableText(getValue(row, ['roll_no'])),
            firstName,
            lastName,
            fullName: `${firstName} ${lastName}`.trim(),
            dob: optionalDate(getValue(row, ['date_of_birth', 'dob'])),
            gender: nullableText(getValue(row, ['gender'])),
            email: nullableText(getValue(row, ['email'])),
            phone: nullableText(getValue(row, ['phone'])),
            admissionDate: optionalDate(admissionDate) ?? new Date(),
            fatherName: nullableText(getValue(row, ['father_name'])),
            fatherPhone: nullableText(getValue(row, ['father_phone'])),
            motherName: nullableText(getValue(row, ['mother_name'])),
            motherPhone: nullableText(getValue(row, ['mother_phone'])),
            parentPhone: nullableText(getValue(row, ['father_phone']) || getValue(row, ['mother_phone']) || getValue(row, ['phone'])),
            parentEmail: nullableText(getValue(row, ['email'])),
            status: 'ENROLLED',
          },
        });
        if (academicYear && foundClass && section) {
          await tx.studentEnrollment.create({
            data: {
              schoolId,
              studentId: student.id,
              academicSessionId: academicYear.id,
              classId: foundClass.id,
              sectionId: section.id,
              rollNo: nullableText(getValue(row, ['roll_no'])),
              status: 'ENROLLED',
              enrolledAt: optionalDate(admissionDate) ?? new Date(),
            },
          });
        }
        await tx.studentStatusHistory.create({ data: { studentId: student.id, status: 'ENROLLED', reason: 'Bulk import' } });
      }

      if (type === 'EXPENSE_CATEGORY') {
        const name = normalizeText(getValue(row, ['name', 'category']));
        await tx.expenseCategory.create({
          data: {
            schoolId,
            name,
            normalizedName: normalizeName(name),
            description: nullableText(getValue(row, ['description'])),
            status: (getValue(row, ['status']).toUpperCase() || 'ACTIVE') as any,
            sortOrder: Number(getValue(row, ['sort_order'])) || 0,
          },
        });
      }

      if (type === 'EXPENSE') {
        const categoryName = getValue(row, ['category', 'category_name']);
        const category = await tx.expenseCategory.findFirst({
          where: { schoolId, normalizedName: normalizeName(categoryName), deletedAt: null, status: 'ACTIVE' },
          select: { id: true },
        });
        if (!category) throw new Error(`Expense category not found: ${categoryName}`);
        await tx.expense.create({
          data: {
            schoolId,
            categoryId: category.id,
            title: normalizeText(getValue(row, ['title'])),
            amount: new Prisma.Decimal(getValue(row, ['amount'])),
            expenseDate: new Date(getValue(row, ['expense_date', 'date'])),
            paymentMode: getValue(row, ['payment_mode']).toUpperCase() as ExpensePaymentMode,
            paidTo: nullableText(getValue(row, ['paid_to'])),
            referenceNumber: nullableText(getValue(row, ['reference_number', 'reference_no'])),
            description: nullableText(getValue(row, ['description'])),
            createdById: userId,
            updatedById: userId,
          },
        });
      }

      count += 1;
    }
  });

  if (type === 'STUDENT' && count > 0) await incrementUsage(schoolId, 'students', count);
  if (type === 'TEACHER' && count > 0) await incrementUsage(schoolId, 'teachers', count);
  return count;
};

export const processImportRows = async (params: {
  schoolId: string;
  userId?: string | null;
  type: BulkImportType;
  rows: NormalizedRow[];
  dryRun?: boolean;
}) => {
  const validation = await validateImportRows(params.schoolId, params.type, params.rows);
  const successCount = params.dryRun ? 0 : await applyImportRows(params.schoolId, params.userId ?? null, params.type, validation.valid);
  return {
    totalRows: params.rows.length,
    processedRows: params.rows.length,
    successCount,
    failedCount: validation.errors.length,
    validCount: validation.valid.length,
    errors: validation.errors,
  };
};

export const processImportJob = async (importJobId: string) => {
  const importJob = await prisma.importJob.findUnique({
    where: { id: importJobId },
    include: { school: true },
  });

  if (!importJob) {
    throw new Error('Import job not found');
  }

  await prisma.importJob.update({
    where: { id: importJobId },
    data: { status: 'PROCESSING', startedAt: new Date() },
  });

  try {
    const rows = await loadFileRows(importJob.filePath, importJob.originalName);
    const result = await processImportRows({
      schoolId: importJob.schoolId,
      userId: importJob.createdById,
      type: importJob.type as BulkImportType,
      rows,
      dryRun: importJob.dryRun,
    });

    await prisma.importRowError.deleteMany({ where: { importJobId } });

    if (result.errors.length) {
      await prisma.importRowError.createMany({
        data: result.errors.map((err) => ({
          importJobId,
          rowNumber: err.rowNumber,
          field: err.field ?? null,
          message: err.message,
          rawData: (err.rawData ?? null) as Prisma.InputJsonValue | null,
        })),
      });
    }

    await prisma.importJob.update({
      where: { id: importJobId },
      data: {
        status: 'COMPLETED',
        totalRows: result.totalRows,
        processedRows: result.processedRows,
        successCount: result.successCount,
        errorCount: result.failedCount,
        finishedAt: new Date(),
      },
    });
  } catch (err) {
    await prisma.importJob.update({
      where: { id: importJobId },
      data: { status: 'FAILED', finishedAt: new Date() },
    });
    throw err;
  }
};
