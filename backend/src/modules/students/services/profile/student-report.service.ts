import type { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { StudentProfileRepository } from '../../repositories/profile.repository';
import { StudentRepository } from '../../repositories/student.repository';
import { HttpError } from '../../../../middlewares/error.middleware';
import { resolveSchoolId } from '../../../../utils/tenant';
import { buildStudentAttendanceReport } from '../../../../services/attendanceStudentReport.service';

const uuidSchema = z.string().uuid();

const reportQuerySchema = z.object({
  schoolId: uuidSchema.optional(),
  academicSessionId: uuidSchema.optional(),
});

const dateKey = (value?: Date | string | null) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

const numberValue = (value: Prisma.Decimal | number | string | null | undefined) => {
  if (value === null || value === undefined || value === '') return '';
  const parsed = Number(value);
  return Number.isNaN(parsed) ? '' : parsed;
};

const textValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '';
  return String(value);
};

const fullName = (student: { fullName?: string | null; firstName?: string | null; lastName?: string | null }) =>
  student.fullName || [student.firstName, student.lastName].filter(Boolean).join(' ').trim();

const safeFilenamePart = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'student';

const setColumns = (sheet: ExcelJS.Worksheet, columns: Array<{ header: string; key: string; width?: number }>) => {
  sheet.columns = columns.map((column) => ({ ...column, width: column.width ?? 20 }));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };
};

const addKeyValueSheet = (workbook: ExcelJS.Workbook, name: string, rows: Array<[string, unknown]>) => {
  const sheet = workbook.addWorksheet(name);
  setColumns(sheet, [
    { header: 'Field', key: 'field', width: 30 },
    { header: 'Value', key: 'value', width: 48 },
  ]);
  rows.forEach(([field, value]) => sheet.addRow({ field, value: value instanceof Date ? dateKey(value) : textValue(value) }));
  return sheet;
};

const addTableSheet = (
  workbook: ExcelJS.Workbook,
  name: string,
  columns: Array<{ header: string; key: string; width?: number }>,
  rows: Array<Record<string, unknown>>,
) => {
  const sheet = workbook.addWorksheet(name);
  setColumns(sheet, columns);
  if (rows.length) {
    rows.forEach((row) => sheet.addRow(row));
  } else {
    sheet.addRow({ [columns[0].key]: 'No records' });
  }
  return sheet;
};

type AttendanceReportWorkbook = Awaited<ReturnType<typeof buildStudentAttendanceReport>>;

const attendanceUnitHeader = (column: AttendanceReportWorkbook['columns'][number]) => {
  const label = column.label === 'Day' ? 'Daily' : column.label;
  return column.startTime ? `${label} (${column.startTime}-${column.endTime ?? ''})` : label;
};

const attendanceCellValue = (cell: AttendanceReportWorkbook['rows'][number]['cells'][string]) =>
  [
    cell.status,
    cell.subject ? `Subject: ${cell.subject}` : '',
    cell.note ? `Note: ${cell.note}` : '',
  ].filter(Boolean).join('\n');

const attendanceFillByStatus: Partial<Record<string, ExcelJS.Fill>> = {
  PRESENT: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } },
  LATE: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } },
  ABSENT: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE3B0' } },
  EXCUSED: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCACA' } },
  HOLIDAY: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCACA' } },
  LEAVE: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCACA' } },
  UNMARKED: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } },
};

const holidayRowFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE2E2' } };
const holidayStatuses = new Set(['EXCUSED', 'HOLIDAY', 'LEAVE', 'CASUAL_LEAVE', 'LOP']);

const addAttendanceSheet = (
  workbook: ExcelJS.Workbook,
  attendanceReport: AttendanceReportWorkbook | null,
) => {
  if (!attendanceReport) {
    return addTableSheet(workbook, 'Attendance', [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Day', key: 'day', width: 12 },
      { header: 'Daily', key: 'daily', width: 56 },
    ], [{
      date: '',
      day: '',
      daily: 'No attendance class/section found for this academic session',
    }]);
  }

  const unitColumns = attendanceReport.columns.map((column) => ({
    header: attendanceUnitHeader(column),
    key: `unit_${column.key.replace(/[^a-zA-Z0-9]+/g, '_')}`,
    width: Math.max(18, Math.min(34, attendanceUnitHeader(column).length + 4)),
    sourceKey: column.key,
  }));
  const rows = attendanceReport.rows.map((row) => {
    const output: Record<string, unknown> = {
      date: row.date,
      day: row.day,
    };

    unitColumns.forEach((column) => {
      const cell = row.cells[column.sourceKey] ?? { status: 'UNMARKED' as const };
      output[column.key] = attendanceCellValue(cell);
    });
    return output;
  });

  const columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Day', key: 'day', width: 12 },
    ...unitColumns.map(({ header, key, width }) => ({ header, key, width })),
  ];
  const sheet = addTableSheet(workbook, 'Attendance', columns, rows);

  attendanceReport.rows.forEach((reportRow, rowIndex) => {
    const excelRow = sheet.getRow(rowIndex + 2);
    const hasHolidayOrLeave = unitColumns.some((column) =>
      holidayStatuses.has(reportRow.cells[column.sourceKey]?.status ?? 'UNMARKED'),
    );

    if (hasHolidayOrLeave) {
      for (let columnIndex = 1; columnIndex <= columns.length; columnIndex += 1) {
        excelRow.getCell(columnIndex).fill = holidayRowFill;
      }
      return;
    }

    unitColumns.forEach((column, unitIndex) => {
      const status = reportRow.cells[column.sourceKey]?.status ?? 'UNMARKED';
      const fill = attendanceFillByStatus[status];
      if (fill) {
        excelRow.getCell(unitIndex + 3).fill = fill;
      }
    });
  });

  return sheet;
};

export const downloadStudentReportWorkbook = async (req: Request, res: Response) => {
  if (!req.auth?.userId) throw new HttpError(401, 'Unauthorized');
  const query = reportQuerySchema.parse(req.query);
  const schoolId = resolveSchoolId(req, query.schoolId);
  const { id } = req.params;

  const student = await StudentProfileRepository.student.findFirst({
    where: { id, schoolId },
    include: StudentRepository.detailInclude(),
  });
  if (!student) throw new HttpError(404, 'Student not found');

  const academicSession =
    (query.academicSessionId
      ? await StudentProfileRepository.academicYear.findFirst({
          where: { id: query.academicSessionId, schoolId },
        })
      : null) ??
    (student.academicSessionId
      ? await StudentProfileRepository.academicYear.findFirst({
          where: { id: student.academicSessionId, schoolId, isActive: true },
        })
      : null) ??
    (await StudentProfileRepository.academicYear.findFirst({
      where: { schoolId, isActive: true },
      orderBy: { startDate: 'desc' },
    })) ??
    (student.academicSessionId
      ? await StudentProfileRepository.academicYear.findFirst({
          where: { id: student.academicSessionId, schoolId },
        })
      : null);

  if (!academicSession) throw new HttpError(400, 'Active academic session not found');

  const sessionEnrollment = student.enrollments.find((item) => item.academicSessionId === academicSession.id);
  const reportClassId = sessionEnrollment?.classId ?? student.classId;
  const reportSectionId = sessionEnrollment?.sectionId ?? student.sectionId;
  const transportAssignments = await StudentProfileRepository.studentTransportAssignment.findMany({
    where: { schoolId, studentId: id },
    include: { route: true, vehicle: true },
    orderBy: [{ active: 'desc' }, { assignedAt: 'desc' }],
  });
  const transportRouteIds = transportAssignments.map((item) => item.routeId);

  const [
    attendanceReport,
    feeInvoices,
    feeAssignments,
    applicableFeeStructures,
    feeGroupAssignments,
    dormitoryAssignments,
    libraryMembers,
  ] = await Promise.all([
    reportClassId
      ? buildStudentAttendanceReport({
          schoolId,
          academicYearId: academicSession.id,
          classId: reportClassId,
          sectionId: reportSectionId,
          studentId: id,
        })
      : Promise.resolve(null),
    StudentProfileRepository.feeInvoice.findMany({
      where: { schoolId, studentId: id, academicSessionId: academicSession.id, deletedAt: null },
      include: {
        feeType: { select: { name: true } },
        feeGroup: { select: { name: true } },
        feeStructure: { select: { name: true } },
        class: { select: { name: true } },
        section: { select: { name: true } },
        items: { orderBy: { sortOrder: 'asc' }, include: { particular: { select: { name: true, code: true, type: true } }, feeMaster: { select: { name: true, code: true } } } },
        payments: { orderBy: { paidAt: 'desc' } },
        receipts: { orderBy: { receiptDate: 'desc' } },
      },
      orderBy: [{ issueDate: 'desc' }, { invoiceNumber: 'asc' }],
    }),
    StudentProfileRepository.studentFeeAssignment.findMany({
      where: {
        schoolId,
        academicSessionId: academicSession.id,
        deletedAt: null,
        OR: [
          { studentId: id },
          ...(reportClassId ? [{ targetType: 'CLASS' as const, classId: reportClassId }] : []),
          ...(reportClassId && reportSectionId ? [{ targetType: 'SECTION' as const, classId: reportClassId, sectionId: reportSectionId }] : []),
          ...(student.studentGroupId ? [{ targetType: 'GROUP' as const, groupId: student.studentGroupId }] : []),
          ...(student.studentCategoryId ? [{ targetType: 'CATEGORY' as const, categoryId: student.studentCategoryId }] : []),
          ...(transportRouteIds.length ? [{ targetType: 'TRANSPORT_ROUTE' as const, transportRouteId: { in: transportRouteIds } }] : []),
        ],
      },
      include: {
        feeStructure: {
          include: {
            feeType: { select: { name: true, schedule: true } },
            class: { select: { name: true } },
            section: { select: { name: true } },
            items: { orderBy: { sortOrder: 'asc' }, include: { particular: { select: { name: true, code: true, type: true } } } },
          },
        },
        class: { select: { name: true } },
        section: { select: { name: true } },
        group: { select: { name: true } },
        category: { select: { name: true } },
        transportRoute: { select: { title: true, fare: true } },
      },
      orderBy: [{ status: 'asc' }, { assignedAt: 'desc' }],
    }),
    reportClassId
      ? StudentProfileRepository.feeStructure.findMany({
          where: {
            schoolId,
            academicSessionId: academicSession.id,
            classId: reportClassId,
            deletedAt: null,
            OR: [{ sectionId: null }, ...(reportSectionId ? [{ sectionId: reportSectionId }] : [])],
          },
          include: {
            feeType: { select: { name: true, schedule: true } },
            class: { select: { name: true } },
            section: { select: { name: true } },
            items: { orderBy: { sortOrder: 'asc' }, include: { particular: { select: { name: true, code: true, type: true } } } },
          },
          orderBy: [{ status: 'asc' }, { name: 'asc' }],
        })
      : Promise.resolve([]),
    StudentProfileRepository.studentFeeGroupAssignment.findMany({
      where: { schoolId, studentId: id, academicSessionId: academicSession.id, deletedAt: null },
      include: { feeGroup: true },
      orderBy: [{ status: 'asc' }, { assignedAt: 'desc' }],
    }),
    StudentProfileRepository.studentDormitoryAssignment.findMany({
      where: { schoolId, studentId: id },
      include: { dormitory: true, room: true },
      orderBy: [{ active: 'desc' }, { assignedAt: 'desc' }],
    }),
    StudentProfileRepository.libraryMember.findMany({
      where: { schoolId, studentId: id },
      include: { issues: { include: { book: true }, orderBy: { issueDate: 'desc' } } },
      orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
    }),
  ]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SchoolApp';
  workbook.created = new Date();
  workbook.modified = new Date();

  addKeyValueSheet(workbook, 'Summary', [
    ['Student Name', fullName(student)],
    ['Admission No', student.admissionNo],
    ['Roll No', student.rollNo],
    ['Academic Session', academicSession.name],
    ['Session Start', academicSession.startDate],
    ['Session End', academicSession.endDate],
    ['Class', sessionEnrollment?.class?.name ?? student.class?.name],
    ['Section', sessionEnrollment?.section?.name ?? student.section?.name],
    ['Status', student.status],
    ['Generated At', new Date().toISOString()],
  ]);

  addKeyValueSheet(workbook, 'Personal Details', [
    ['Full Name', fullName(student)],
    ['First Name', student.firstName],
    ['Last Name', student.lastName],
    ['Admission No', student.admissionNo],
    ['Roll No', student.rollNo],
    ['Date of Birth', student.dob],
    ['Gender', student.gender],
    ['Blood Group', student.bloodGroup],
    ['Religion', student.religion],
    ['Caste', student.caste],
    ['Category', student.category ?? student.studentCategory?.name],
    ['Student Group', student.studentGroup?.name],
    ['Phone', student.phone],
    ['Email', student.email],
    ['Admission Date', student.admissionDate],
    ['Height', numberValue(student.height)],
    ['Weight', numberValue(student.weight)],
    ['Present Address', student.presentAddress ?? student.addressLine1],
    ['Permanent Address', student.permanentAddress ?? student.addressLine2],
    ['City', student.city],
    ['State', student.state],
    ['Pincode', student.pincode],
    ['Emergency Contact', student.emergencyContact],
    ['Medical Conditions', student.medicalConditions],
    ['Allergies', student.allergies],
    ['Doctor Contact', student.doctorContact],
  ]);

  addTableSheet(workbook, 'Parent Details', [
    { header: 'Source', key: 'source', width: 18 },
    { header: 'Type/Relation', key: 'relation', width: 20 },
    { header: 'Name', key: 'name', width: 28 },
    { header: 'Occupation', key: 'occupation', width: 24 },
    { header: 'Phone', key: 'phone', width: 18 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Primary', key: 'primary', width: 12 },
  ], [
    ...student.guardians.map((guardian) => ({
      source: 'Guardian Profile',
      relation: guardian.relation || guardian.type,
      name: guardian.name,
      occupation: guardian.occupation,
      phone: guardian.phone,
      email: guardian.email,
      primary: guardian.isPrimary ? 'Yes' : 'No',
    })),
    ...student.parentLinks.map((link) => ({
      source: 'Parent Login',
      relation: 'Linked Account',
      name: fullName(link.parent),
      occupation: '',
      phone: link.parent.phone,
      email: link.parent.email,
      primary: '',
    })),
    {
      source: 'Legacy Fields',
      relation: 'Father',
      name: student.fatherName,
      occupation: student.fatherOccupation,
      phone: student.fatherPhone,
      email: '',
      primary: '',
    },
    {
      source: 'Legacy Fields',
      relation: 'Mother',
      name: student.motherName,
      occupation: student.motherOccupation,
      phone: student.motherPhone,
      email: '',
      primary: '',
    },
    {
      source: 'Legacy Fields',
      relation: student.guardianRelationship ?? 'Guardian',
      name: student.guardianName,
      occupation: '',
      phone: student.parentPhone,
      email: student.parentEmail,
      primary: '',
    },
  ].filter((row) => Object.values(row).some(Boolean)));

  addAttendanceSheet(workbook, attendanceReport);

  addTableSheet(workbook, 'Fee Invoices', [
    { header: 'Invoice No', key: 'invoiceNumber', width: 20 },
    { header: 'Fee Month', key: 'feeMonth', width: 14 },
    { header: 'Issue Date', key: 'issueDate', width: 14 },
    { header: 'Due Date', key: 'dueDate', width: 14 },
    { header: 'Fee Type', key: 'feeType', width: 22 },
    { header: 'Fee Group', key: 'feeGroup', width: 22 },
    { header: 'Structure', key: 'structure', width: 26 },
    { header: 'Status', key: 'status', width: 18 },
    { header: 'Previous Balance', key: 'previousBalance', width: 18 },
    { header: 'Discount', key: 'discountAmount', width: 14 },
    { header: 'Fine', key: 'fineAmount', width: 14 },
    { header: 'Total', key: 'totalAmount', width: 14 },
    { header: 'Paid', key: 'paidAmount', width: 14 },
    { header: 'Due', key: 'dueAmount', width: 14 },
    { header: 'Receipts', key: 'receipts', width: 30 },
  ], feeInvoices.map((invoice) => ({
    invoiceNumber: invoice.invoiceNumber,
    feeMonth: invoice.feeMonth,
    issueDate: dateKey(invoice.issueDate),
    dueDate: dateKey(invoice.dueDate),
    feeType: invoice.feeType?.name,
    feeGroup: invoice.feeGroup?.name,
    structure: invoice.feeStructure?.name,
    status: invoice.status,
    previousBalance: numberValue(invoice.previousBalance),
    discountAmount: numberValue(invoice.discountAmount),
    fineAmount: numberValue(invoice.fineAmount),
    totalAmount: numberValue(invoice.totalAmount),
    paidAmount: numberValue(invoice.paidAmount),
    dueAmount: numberValue(invoice.dueAmount),
    receipts: invoice.receipts.map((receipt) => `${receipt.receiptNumber} (${dateKey(receipt.receiptDate)})`).join(', '),
  })));

  const assignedFeeStructureIds = new Set(feeAssignments.map((assignment) => assignment.feeStructureId));
  const assignedFeeStructureRows = feeAssignments.flatMap((assignment) => {
    const items = assignment.feeStructure.items.length ? assignment.feeStructure.items : [null];
    const targetName =
      assignment.studentId === id ? fullName(student)
      : assignment.class?.name || assignment.section?.name || assignment.group?.name || assignment.category?.name || assignment.transportRoute?.title || '';
    return items.map((item) => ({
      target: assignment.targetType,
      targetName,
      structure: assignment.feeStructure.name,
      feeType: assignment.feeStructure.feeType.name,
      schedule: assignment.feeStructure.feeType.schedule,
      particular: item?.particular.name ?? '',
      particularType: item?.particular.type ?? '',
      amount: item ? numberValue(item.amount) : '',
      overrideAmount: numberValue(assignment.overrideAmount),
      status: assignment.status,
      assignedAt: dateKey(assignment.assignedAt),
    }));
  });
  const applicableFeeStructureRows = applicableFeeStructures
    .filter((structure) => !assignedFeeStructureIds.has(structure.id))
    .flatMap((structure) => {
      const items = structure.items.length ? structure.items : [null];
      return items.map((item) => ({
        target: 'APPLICABLE_STRUCTURE',
        targetName: [structure.class.name, structure.section?.name].filter(Boolean).join(' / '),
        structure: structure.name,
        feeType: structure.feeType.name,
        schedule: structure.feeType.schedule,
        particular: item?.particular.name ?? '',
        particularType: item?.particular.type ?? '',
        amount: item ? numberValue(item.amount) : '',
        overrideAmount: '',
        status: structure.status,
        assignedAt: '',
      }));
    });

  addTableSheet(workbook, 'Fee Structure', [
    { header: 'Assignment Target', key: 'target', width: 20 },
    { header: 'Target Name', key: 'targetName', width: 28 },
    { header: 'Structure', key: 'structure', width: 28 },
    { header: 'Fee Type', key: 'feeType', width: 22 },
    { header: 'Schedule', key: 'schedule', width: 18 },
    { header: 'Particular', key: 'particular', width: 30 },
    { header: 'Particular Type', key: 'particularType', width: 20 },
    { header: 'Amount', key: 'amount', width: 14 },
    { header: 'Override Amount', key: 'overrideAmount', width: 18 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Assigned At', key: 'assignedAt', width: 14 },
  ], [...assignedFeeStructureRows, ...applicableFeeStructureRows]);

  addTableSheet(workbook, 'Fee Groups', [
    { header: 'Fee Group', key: 'feeGroup', width: 28 },
    { header: 'Source', key: 'source', width: 18 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Assigned At', key: 'assignedAt', width: 14 },
    { header: 'Notes', key: 'notes', width: 36 },
  ], feeGroupAssignments.map((assignment) => ({
    feeGroup: assignment.feeGroup.name,
    source: assignment.source,
    status: assignment.status,
    assignedAt: dateKey(assignment.assignedAt),
    notes: assignment.notes,
  })));

  addTableSheet(workbook, 'Transport', [
    { header: 'Route', key: 'route', width: 28 },
    { header: 'Fare', key: 'fare', width: 14 },
    { header: 'Vehicle Number', key: 'vehicleNumber', width: 18 },
    { header: 'Vehicle Model', key: 'vehicleModel', width: 20 },
    { header: 'Driver', key: 'driver', width: 24 },
    { header: 'Driver Contact', key: 'driverContact', width: 18 },
    { header: 'Assigned At', key: 'assignedAt', width: 14 },
    { header: 'Dropped At', key: 'droppedAt', width: 14 },
    { header: 'Active', key: 'active', width: 12 },
    { header: 'Note', key: 'note', width: 36 },
  ], transportAssignments.map((assignment) => ({
    route: assignment.route.title,
    fare: numberValue(assignment.route.fare),
    vehicleNumber: assignment.vehicle?.vehicleNumber,
    vehicleModel: assignment.vehicle?.vehicleModel,
    driver: assignment.vehicle?.driverName,
    driverContact: assignment.vehicle?.driverContact,
    assignedAt: dateKey(assignment.assignedAt),
    droppedAt: dateKey(assignment.droppedAt),
    active: assignment.active ? 'Yes' : 'No',
    note: assignment.note,
  })));

  addTableSheet(workbook, 'Dormitory', [
    { header: 'Dormitory', key: 'dormitory', width: 28 },
    { header: 'Room', key: 'room', width: 18 },
    { header: 'Assigned At', key: 'assignedAt', width: 14 },
    { header: 'Vacated At', key: 'vacatedAt', width: 14 },
    { header: 'Active', key: 'active', width: 12 },
    { header: 'Note', key: 'note', width: 36 },
  ], dormitoryAssignments.map((assignment) => ({
    dormitory: assignment.dormitory.name,
    room: assignment.room?.roomNumber,
    assignedAt: dateKey(assignment.assignedAt),
    vacatedAt: dateKey(assignment.vacatedAt),
    active: assignment.active ? 'Yes' : 'No',
    note: assignment.note,
  })));

  addTableSheet(workbook, 'Library', [
    { header: 'Member Code', key: 'memberCode', width: 18 },
    { header: 'Book', key: 'book', width: 34 },
    { header: 'Issue Date', key: 'issueDate', width: 14 },
    { header: 'Return Date', key: 'returnDate', width: 14 },
    { header: 'Returned At', key: 'returnedAt', width: 14 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Note', key: 'note', width: 36 },
  ], libraryMembers.flatMap((member) => {
    if (!member.issues.length) {
      return [{ memberCode: member.memberCode, book: '', issueDate: '', returnDate: '', returnedAt: '', status: member.active ? 'ACTIVE' : 'CANCELLED', note: '' }];
    }
    return member.issues.map((issue) => ({
      memberCode: member.memberCode,
      book: issue.book.title,
      issueDate: dateKey(issue.issueDate),
      returnDate: dateKey(issue.returnDate),
      returnedAt: dateKey(issue.returnedAt),
      status: issue.status,
      note: issue.note,
    }));
  }));

  addTableSheet(workbook, 'Exam Results', [
    { header: 'Exam', key: 'exam', width: 28 },
    { header: 'Exam Type', key: 'examType', width: 18 },
    { header: 'Subject', key: 'subject', width: 24 },
    { header: 'Subject Code', key: 'subjectCode', width: 16 },
    { header: 'Marks', key: 'marks', width: 12 },
    { header: 'Max Marks', key: 'maxMarks', width: 14 },
    { header: 'Pass Marks', key: 'passMarks', width: 14 },
    { header: 'Grade', key: 'grade', width: 12 },
    { header: 'Status', key: 'status', width: 14 },
  ], student.marks.map((mark) => ({
    exam: mark.examPaper?.exam?.name,
    examType: mark.examPaper?.exam?.type,
    subject: mark.examPaper?.subject?.name,
    subjectCode: mark.examPaper?.subject?.code,
    marks: numberValue(mark.marks),
    maxMarks: numberValue(mark.examPaper?.maxMarks),
    passMarks: numberValue(mark.examPaper?.passMarks),
    grade: mark.grade,
    status: mark.status,
  })));

  addTableSheet(workbook, 'Documents', [
    { header: 'Title', key: 'title', width: 28 },
    { header: 'File Name', key: 'fileName', width: 32 },
    { header: 'Mime Type', key: 'mimeType', width: 24 },
    { header: 'Size Bytes', key: 'sizeBytes', width: 14 },
    { header: 'URL', key: 'url', width: 48 },
    { header: 'Created At', key: 'createdAt', width: 14 },
  ], student.documents.map((document) => ({
    title: document.title,
    fileName: document.fileName,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes ?? '',
    url: document.url,
    createdAt: dateKey(document.createdAt),
  })));

  addTableSheet(workbook, 'Timeline', [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Title', key: 'title', width: 32 },
    { header: 'Description', key: 'description', width: 60 },
    { header: 'Created At', key: 'createdAt', width: 14 },
  ], student.timelines.map((item) => ({
    date: dateKey(item.timelineDate),
    title: item.title,
    description: item.description,
    createdAt: dateKey(item.createdAt),
  })));

  workbook.eachSheet((sheet) => {
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.alignment = { vertical: 'top', wrapText: true };
      });
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `${safeFilenamePart(fullName(student) || student.admissionNo)}-${safeFilenamePart(academicSession.name)}-report.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(Buffer.from(buffer));
};
