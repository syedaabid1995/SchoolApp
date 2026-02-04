import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { Prisma } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { prisma } from '../config/db';
import { hashPassword } from '../utils/password';
import { incrementUsage, enforceLimits } from './subscription.service';

export type ImportRowError = {
  rowNumber: number;
  field?: string;
  message: string;
  rawData?: Record<string, unknown>;
};

type StudentRow = {
  admission_no: string;
  first_name: string;
  last_name: string;
  dob?: string;
};

type TeacherRow = {
  email: string;
  first_name: string;
  last_name: string;
  employee_no?: string;
  phone?: string;
};

const normalizeKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

const normalizeRow = (row: Record<string, unknown>) => {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[normalizeKey(key)] = typeof value === 'string' ? value.trim() : value;
  }
  return normalized;
};

const loadFileRows = async (filePath: string) => {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.csv') {
    const content = fs.readFileSync(filePath, 'utf8');
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
    const headers = headerValues
      .slice(1)
      .map((value) => String(value ?? '').trim())
      .filter((value) => value);

    const rows: Record<string, unknown>[] = [];
    for (let rowIndex = 2; rowIndex <= sheet.rowCount; rowIndex += 1) {
      const row = sheet.getRow(rowIndex);
      const record: Record<string, unknown> = {};
      headers.forEach((header, idx) => {
        const cell = row.getCell(idx + 1);
        record[header] = cell.value ?? '';
      });
      if (Object.values(record).some((value) => String(value ?? '').trim() !== '')) {
        rows.push(record);
      }
    }

    return rows.map(normalizeRow);
  }

  throw new Error('Unsupported file type');
};

const validateStudentRows = async (schoolId: string, rows: Record<string, unknown>[]) => {
  const errors: ImportRowError[] = [];
  const valid: StudentRow[] = [];
  const seenAdmission = new Set<string>();

  const admissionNos = rows
    .map((row) => String(row.admission_no ?? '').trim())
    .filter((value) => value);

  const existing = await prisma.student.findMany({
    where: { schoolId, admissionNo: { in: admissionNos } },
    select: { admissionNo: true },
  });
  const existingSet = new Set(existing.map((item) => item.admissionNo));

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const admission_no = String(row.admission_no ?? '').trim();
    const first_name = String(row.first_name ?? '').trim();
    const last_name = String(row.last_name ?? '').trim();
    const dob = row.dob ? String(row.dob).trim() : undefined;

    const rowErrors: ImportRowError[] = [];
    if (!admission_no) rowErrors.push({ rowNumber, field: 'admission_no', message: 'Required' });
    if (!first_name) rowErrors.push({ rowNumber, field: 'first_name', message: 'Required' });
    if (!last_name) rowErrors.push({ rowNumber, field: 'last_name', message: 'Required' });

    if (dob && Number.isNaN(Date.parse(dob))) {
      rowErrors.push({ rowNumber, field: 'dob', message: 'Invalid date' });
    }

    if (admission_no && seenAdmission.has(admission_no)) {
      rowErrors.push({ rowNumber, field: 'admission_no', message: 'Duplicate in file' });
    }

    if (admission_no && existingSet.has(admission_no)) {
      rowErrors.push({ rowNumber, field: 'admission_no', message: 'Already exists' });
    }

    if (rowErrors.length) {
      errors.push(...rowErrors.map((err) => ({ ...err, rawData: row })));
      return;
    }

    seenAdmission.add(admission_no);
    valid.push({ admission_no, first_name, last_name, dob });
  });

  return { valid, errors };
};

const validateTeacherRows = async (schoolId: string, rows: Record<string, unknown>[]) => {
  const errors: ImportRowError[] = [];
  const valid: TeacherRow[] = [];
  const seenEmail = new Set<string>();
  const seenEmployee = new Set<string>();

  const emails = rows
    .map((row) => String(row.email ?? '').trim().toLowerCase())
    .filter((value) => value);

  const existingUsers = await prisma.user.findMany({
    where: { schoolId, email: { in: emails } },
    select: { email: true },
  });
  const existingEmailSet = new Set(existingUsers.map((user) => user.email.toLowerCase()));

  const employeeNos = rows
    .map((row) => String(row.employee_no ?? '').trim())
    .filter((value) => value);

  const existingEmployees = await prisma.teacherProfile.findMany({
    where: { schoolId, employeeNo: { in: employeeNos } },
    select: { employeeNo: true },
  });
  const existingEmployeeSet = new Set(existingEmployees.map((item) => item.employeeNo ?? ''));

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const email = String(row.email ?? '').trim().toLowerCase();
    const first_name = String(row.first_name ?? '').trim();
    const last_name = String(row.last_name ?? '').trim();
    const employee_no = row.employee_no ? String(row.employee_no).trim() : undefined;
    const phone = row.phone ? String(row.phone).trim() : undefined;

    const rowErrors: ImportRowError[] = [];
    if (!email) rowErrors.push({ rowNumber, field: 'email', message: 'Required' });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      rowErrors.push({ rowNumber, field: 'email', message: 'Invalid email' });
    }
    if (!first_name) rowErrors.push({ rowNumber, field: 'first_name', message: 'Required' });
    if (!last_name) rowErrors.push({ rowNumber, field: 'last_name', message: 'Required' });

    if (email && seenEmail.has(email)) {
      rowErrors.push({ rowNumber, field: 'email', message: 'Duplicate in file' });
    }

    if (email && existingEmailSet.has(email)) {
      rowErrors.push({ rowNumber, field: 'email', message: 'Already exists' });
    }

    if (employee_no && seenEmployee.has(employee_no)) {
      rowErrors.push({ rowNumber, field: 'employee_no', message: 'Duplicate in file' });
    }

    if (employee_no && existingEmployeeSet.has(employee_no)) {
      rowErrors.push({ rowNumber, field: 'employee_no', message: 'Already exists' });
    }

    if (rowErrors.length) {
      errors.push(...rowErrors.map((err) => ({ ...err, rawData: row })));
      return;
    }

    seenEmail.add(email);
    if (employee_no) seenEmployee.add(employee_no);
    valid.push({ email, first_name, last_name, employee_no, phone });
  });

  return { valid, errors };
};

const createTeacherUser = async (schoolId: string, row: TeacherRow, roleId: string) => {
  const password = crypto.randomBytes(12).toString('base64url');
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      schoolId,
      email: row.email,
      passwordHash,
      status: 'ACTIVE',
      roles: { create: [{ roleId }] },
    },
  });

  await prisma.teacherProfile.create({
    data: {
      schoolId,
      userId: user.id,
      employeeNo: row.employee_no ?? null,
      firstName: row.first_name,
      lastName: row.last_name,
      phone: row.phone ?? null,
    },
  });

  return { userId: user.id, email: row.email };
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
    const rows = await loadFileRows(importJob.filePath);
    const totalRows = rows.length;

    let validRows: StudentRow[] | TeacherRow[] = [];
    let rowErrors: ImportRowError[] = [];

    if (importJob.type === 'STUDENT') {
      const validation = await validateStudentRows(importJob.schoolId, rows);
      validRows = validation.valid;
      rowErrors = validation.errors;
    } else {
      const validation = await validateTeacherRows(importJob.schoolId, rows);
      validRows = validation.valid;
      rowErrors = validation.errors;
    }

    await prisma.importRowError.deleteMany({ where: { importJobId } });

    if (rowErrors.length) {
      await prisma.importRowError.createMany({
        data: rowErrors.map((err) => ({
          importJobId,
          rowNumber: err.rowNumber,
          field: err.field ?? null,
          message: err.message,
          rawData: (err.rawData ?? null) as Prisma.InputJsonValue | null,
        })),
      });
    }

    if (!importJob.dryRun && validRows.length) {
      if (importJob.type === 'STUDENT') {
        for (const row of validRows as StudentRow[]) {
          await enforceLimits(importJob.schoolId, 'students');
          const student = await prisma.student.create({
            data: {
              school: { connect: { id: importJob.schoolId } },
              admissionNo: row.admission_no,
              firstName: row.first_name,
              lastName: row.last_name,
              fullName: `${row.first_name} ${row.last_name}`.trim(),
              dob: row.dob ? new Date(row.dob) : null,
            },
          });
          await prisma.studentStatusHistory.create({
            data: {
              studentId: student.id,
              status: 'ENROLLED',
              reason: 'Imported',
            },
          });
          await incrementUsage(importJob.schoolId, 'students', 1);
        }
      } else {
        const teacherRole = await prisma.role.findUnique({ where: { name: 'TEACHER' } });
        if (!teacherRole) {
          throw new Error('Teacher role not found');
        }

        for (const row of validRows as TeacherRow[]) {
          await enforceLimits(importJob.schoolId, 'teachers');
          await createTeacherUser(importJob.schoolId, row, teacherRole.id);
          await incrementUsage(importJob.schoolId, 'teachers', 1);
        }
      }
    }

    await prisma.importJob.update({
      where: { id: importJobId },
      data: {
        status: 'COMPLETED',
        totalRows,
        processedRows: totalRows,
        successCount: importJob.dryRun ? 0 : validRows.length,
        errorCount: rowErrors.length,
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
