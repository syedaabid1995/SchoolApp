import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../config/db';
import { env } from '../config/env';
import { generateRankCard } from '../services/report.service';
import {
  getReportData,
  getReportDefinition,
  listReportCatalog,
  toCsv,
  toReportPdf,
} from '../services/report.service';
import { requestOtp } from '../services/otp.service';
import {
  exportReportCsvApi,
  exportReportPdfApi,
  getReportApi,
} from '../controllers/report.controller';
import { createExam } from '../controllers/exam.controller';
import { uploadMarks } from '../controllers/marks.controller';
import { rejectRestore, runRestore } from '../controllers/backup.controller';
import { HttpError } from '../middlewares/error.middleware';
import {
  activateSchoolOnboarding,
  recalculateSchoolOnboarding,
} from '../services/schoolOnboarding.service';
import {
  confirmTeacherCredentialManualShare,
  recalculateTeacherOnboarding,
  updateTeacherOnboarding,
} from '../services/teacherOnboarding.service';
import { timetableReadService } from '../modules/timetable/services/timetable-read.service';
import { listExamCentersApi } from '../controllers/examOperations.controller';
import {
  assignExamInvigilator,
  autoAssignExamInvigilators,
  buildHallTicketPdf,
  createExamCenter,
  createExamRoom,
  generateExamSeating,
} from '../services/examOperations.service';
import {
  approveAdminDeletionRequest,
  approveAdminExportRequest,
  getAdminComplianceSummary,
  getComplianceJobHistory,
  listAdminExportRequests,
  rejectAdminDeletionRequest,
  rejectAdminExportRequest,
} from '../services/dataCompliance.service';
import {
  approveDeletionRequestApi,
  approveExportRequestApi,
  getExportRequestByIdApi,
  listExportRequestsApi,
} from '../controllers/dataCompliance.controller';
import {
  SCHOOL_A_ID,
  SCHOOL_B_ID,
  SCHOOL_ADMIN_A_ID,
  SUPER_ADMIN_ID,
  TEST_ACADEMIC_YEAR_A_ID,
  TEST_CLASS_A_ID,
  TEST_SECTION_A_ID,
  TEST_STAFF_PROFILE_A_ID,
  closeBackgroundHandles,
  patchSecurityTestDependencies,
  restoreSecurityTestDependencies,
  seedSecurityUsers,
} from './test-utils';

const BACKUP_ID = '10101010-1010-4101-8101-101010101010';
const RESTORE_ID = '20202020-2020-4202-8202-202020202020';
const EXAM_ID = '30303030-3030-4303-8303-303030303030';
const STUDENT_ID = '40404040-4040-4404-8404-404040404040';
const SUBJECT_ID = '50505050-5050-4505-8505-505050505050';
const SUBJECT_TWO_ID = '51515151-5151-4515-8515-515151515151';
const PAPER_ID = '60606060-6060-4606-8606-606060606060';
const ONBOARDING_ROW_ID = '80808080-8080-4808-8808-808080808080';
const TEACHER_ONBOARDING_ID = '90909090-9090-4909-8909-909090909090';
const CENTER_ID = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1';
const ROOM_ID = 'b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1';
const STUDENT_TWO_ID = 'c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1';
const COMPLIANCE_EXPORT_ID = 'd1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1';
const COMPLIANCE_DELETION_ID = 'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1';

test.after(async () => {
  await closeBackgroundHandles();
});

const patch = <T extends object, K extends keyof T>(target: T, key: K, value: T[K]) => {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
};

const makeResponse = () => {
  const response: any = {
    statusCode: 200,
    body: undefined,
    headers: new Map<string, string>(),
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader(key: string, value: string) {
      this.headers.set(key, value);
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
    send(body: unknown) {
      this.body = body;
      return this;
    },
  };
  return response;
};

const backupInclude = {
  id: BACKUP_ID,
  schoolId: SCHOOL_A_ID,
  status: 'COMPLETED',
  storagePath: '/tmp/test.dump',
  requestedById: SUPER_ADMIN_ID,
  reason: 'DR test',
  startedAt: null,
  finishedAt: null,
  createdAt: new Date('2026-06-04T00:00:00.000Z'),
  updatedAt: new Date('2026-06-04T00:00:00.000Z'),
  school: { id: SCHOOL_A_ID, name: 'School A', code: 'SCHA' },
};

const restoreRow = (status = 'REQUESTED') => ({
  id: RESTORE_ID,
  backupId: BACKUP_ID,
  status,
  approvedById: null,
  requestedById: SUPER_ADMIN_ID,
  reason: 'DR validation',
  startedAt: null,
  finishedAt: null,
  createdAt: new Date('2026-06-04T00:00:00.000Z'),
  updatedAt: new Date('2026-06-04T00:00:00.000Z'),
  backup: backupInclude,
  requestedBy: { id: SUPER_ADMIN_ID, email: 'super-admin@test.local' },
  approvedBy: null,
});

const actorRow = {
  id: SCHOOL_ADMIN_A_ID,
  email: 'school-admin-a@test.local',
  roles: [{ role: { name: 'SCHOOL_ADMIN' } }],
  teacherProfile: null,
  parentProfiles: [],
};

const schoolRow = (schoolId = SCHOOL_A_ID) => ({
  id: schoolId,
  name: schoolId === SCHOOL_B_ID ? 'School B' : 'School A',
  code: schoolId === SCHOOL_B_ID ? 'SCHB' : 'SCHA',
});

const exportJobRow = (overrides: any = {}) => ({
  id: COMPLIANCE_EXPORT_ID,
  schoolId: SCHOOL_A_ID,
  status: 'REQUESTED',
  requestedById: SCHOOL_ADMIN_A_ID,
  reviewedById: null,
  reviewNote: null,
  rejectionReason: null,
  reviewedAt: null,
  startedAt: null,
  finishedAt: null,
  createdAt: new Date('2026-06-04T00:00:00.000Z'),
  updatedAt: new Date('2026-06-04T00:00:00.000Z'),
  school: schoolRow(overrides.schoolId ?? SCHOOL_A_ID),
  requestedBy: actorRow,
  reviewedBy: null,
  ...overrides,
});

const deletionJobRow = (overrides: any = {}) => ({
  id: COMPLIANCE_DELETION_ID,
  schoolId: SCHOOL_A_ID,
  status: 'REQUESTED',
  reason: 'Parent requested erasure',
  requestedById: SCHOOL_ADMIN_A_ID,
  approvedById: null,
  reviewedById: null,
  reviewNote: null,
  rejectionReason: null,
  reviewedAt: null,
  startedAt: null,
  finishedAt: null,
  createdAt: new Date('2026-06-04T00:00:00.000Z'),
  updatedAt: new Date('2026-06-04T00:00:00.000Z'),
  school: schoolRow(overrides.schoolId ?? SCHOOL_A_ID),
  requestedBy: actorRow,
  approvedBy: null,
  reviewedBy: null,
  ...overrides,
});

const patchComplianceWorkflowStore = (options: { exportStatus?: string; deletionStatus?: string; schoolId?: string } = {}) => {
  let exportRow = exportJobRow({ status: options.exportStatus ?? 'REQUESTED', schoolId: options.schoolId ?? SCHOOL_A_ID });
  let deletionRow = deletionJobRow({ status: options.deletionStatus ?? 'REQUESTED', schoolId: options.schoolId ?? SCHOOL_A_ID });
  const histories: any[] = [];
  const auditRows: any[] = [];
  const restoreExportFindUnique = patch(prisma.dataExportJob as any, 'findUnique', async ({ include }: any = {}) =>
    include ? exportRow : { ...exportRow, school: undefined, requestedBy: undefined, reviewedBy: undefined },
  );
  const restoreExportFindMany = patch(prisma.dataExportJob as any, 'findMany', async ({ where }: any = {}) =>
    !where?.schoolId || where.schoolId === exportRow.schoolId ? [exportRow] : [],
  );
  const restoreExportCount = patch(prisma.dataExportJob as any, 'count', async ({ where }: any = {}) => {
    if (where?.schoolId && where.schoolId !== exportRow.schoolId) return 0;
    if (where?.status && where.status !== exportRow.status) return 0;
    return 1;
  });
  const restoreExportUpdate = patch(prisma.dataExportJob as any, 'update', async ({ data }: any) => {
    exportRow = {
      ...exportRow,
      ...data,
      reviewedBy: data.reviewedById ? actorRow : exportRow.reviewedBy,
      updatedAt: new Date('2026-06-04T00:02:00.000Z'),
    };
    return exportRow;
  });
  const restoreDeletionFindUnique = patch(prisma.dataDeletionJob as any, 'findUnique', async ({ include }: any = {}) =>
    include ? deletionRow : { ...deletionRow, school: undefined, requestedBy: undefined, approvedBy: undefined, reviewedBy: undefined },
  );
  const restoreDeletionFindMany = patch(prisma.dataDeletionJob as any, 'findMany', async ({ where }: any = {}) =>
    !where?.schoolId || where.schoolId === deletionRow.schoolId ? [deletionRow] : [],
  );
  const restoreDeletionCount = patch(prisma.dataDeletionJob as any, 'count', async ({ where }: any = {}) => {
    if (where?.schoolId && where.schoolId !== deletionRow.schoolId) return 0;
    if (where?.status && where.status !== deletionRow.status) return 0;
    return 1;
  });
  const restoreDeletionUpdate = patch(prisma.dataDeletionJob as any, 'update', async ({ data }: any) => {
    deletionRow = {
      ...deletionRow,
      ...data,
      approvedBy: data.approvedById ? actorRow : deletionRow.approvedBy,
      reviewedBy: data.reviewedById ? actorRow : deletionRow.reviewedBy,
      updatedAt: new Date('2026-06-04T00:02:00.000Z'),
    };
    return deletionRow;
  });
  const restoreHistoryCreate = patch(prisma.complianceJobStatusHistory as any, 'create', async ({ data }: any) => {
    const row = {
      id: `history-${histories.length + 1}`,
      ...data,
      createdAt: new Date('2026-06-04T00:03:00.000Z'),
      school: schoolRow(data.schoolId),
      actor: actorRow,
    };
    histories.push(row);
    return row;
  });
  const restoreHistoryFindMany = patch(prisma.complianceJobStatusHistory as any, 'findMany', async ({ where }: any = {}) =>
    histories.filter((row) => !where?.jobId || row.jobId === where.jobId),
  );
  const restoreAuditCreate = patch(prisma.auditLog as any, 'create', async ({ data }: any) => {
    auditRows.push(data);
    return { id: `audit-${auditRows.length}`, ...data };
  });

  return {
    histories,
    auditRows,
    restore: () => {
      restoreAuditCreate();
      restoreHistoryFindMany();
      restoreHistoryCreate();
      restoreDeletionUpdate();
      restoreDeletionCount();
      restoreDeletionFindMany();
      restoreDeletionFindUnique();
      restoreExportUpdate();
      restoreExportCount();
      restoreExportFindMany();
      restoreExportFindUnique();
    },
  };
};

test('OTP request does not expose code in production responses', async () => {
  patchSecurityTestDependencies();
  seedSecurityUsers();
  const restoreEnv = patch(env, 'NODE_ENV', 'production');
  const restoreOtpCreate = patch(prisma.otpCode as any, 'create', async ({ data }: any) => ({ id: 'otp-1', ...data }));

  try {
    const response = await requestOtp({
      schoolId: SCHOOL_A_ID,
      phone: '9999999999',
    });

    assert.equal(response.sent, true);
    assert.equal(Object.prototype.hasOwnProperty.call(response, 'code'), false);
  } finally {
    restoreOtpCreate();
    restoreEnv();
    restoreSecurityTestDependencies();
  }
});

test('rank card generation returns a PDF from persisted exam marks', async () => {
  patchSecurityTestDependencies();
  const restoreExam = patch(prisma.exam as any, 'findFirst', async () => ({
    id: EXAM_ID,
    schoolId: SCHOOL_A_ID,
    name: 'Mid Term',
    academicYear: { id: TEST_ACADEMIC_YEAR_A_ID, name: '2026-2027' },
    term: { id: 'term-a', name: 'Term 1' },
    class: { id: TEST_CLASS_A_ID, name: 'Class 1' },
    section: { id: TEST_SECTION_A_ID, name: 'A' },
  }));
  const restoreStudent = patch(prisma.student as any, 'findFirst', async () => ({
    id: STUDENT_ID,
    schoolId: SCHOOL_A_ID,
    admissionNo: 'ADM-001',
    firstName: 'Student',
    lastName: 'A',
    fullName: 'Student A',
    classId: TEST_CLASS_A_ID,
    sectionId: TEST_SECTION_A_ID,
    class: { id: TEST_CLASS_A_ID, name: 'Class 1' },
    section: { id: TEST_SECTION_A_ID, name: 'A' },
  }));
  const restoreMarks = patch(prisma.mark as any, 'findMany', async ({ where }: any) => {
    const rows = [
      {
        studentId: STUDENT_ID,
        marks: 86,
        grade: 'A+',
        student: { id: STUDENT_ID, classId: TEST_CLASS_A_ID, sectionId: TEST_SECTION_A_ID },
        examPaper: {
          id: PAPER_ID,
          examId: EXAM_ID,
          subjectId: SUBJECT_ID,
          classId: TEST_CLASS_A_ID,
          maxMarks: 100,
          passMarks: 33,
          subject: { id: SUBJECT_ID, name: 'Mathematics' },
        },
      },
      {
        studentId: '70707070-7070-4707-8707-707070707070',
        marks: 75,
        grade: 'A',
        student: { id: '70707070-7070-4707-8707-707070707070', classId: TEST_CLASS_A_ID, sectionId: TEST_SECTION_A_ID },
        examPaper: {
          id: PAPER_ID,
          examId: EXAM_ID,
          subjectId: SUBJECT_ID,
          classId: TEST_CLASS_A_ID,
          maxMarks: 100,
          passMarks: 33,
          subject: { id: SUBJECT_ID, name: 'Mathematics' },
        },
      },
    ];
    return where?.studentId ? rows.filter((row) => row.studentId === where.studentId) : rows;
  });
  const restoreGrading = patch(prisma.examGradingSetting as any, 'findUnique', async () => null);

  try {
    const pdf = await generateRankCard({ schoolId: SCHOOL_A_ID, examId: EXAM_ID, studentId: STUDENT_ID });
    assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
    assert.ok(pdf.length > 500);
  } finally {
    restoreGrading();
    restoreMarks();
    restoreStudent();
    restoreExam();
    restoreSecurityTestDependencies();
  }
});

test('reports catalog returns available and unavailable reports', () => {
  const catalog = listReportCatalog();
  const studentList = catalog.find((report) => report.key === 'students.list');
  const unavailableReport = catalog.find((report) => !report.available && report.unavailableReason);

  assert.equal(studentList?.available, true);
  assert.equal(studentList?.permission, 'reports.students.view');
  assert.ok(unavailableReport?.unavailableReason);
});

test('school admin cannot access another school report data', async () => {
  patchSecurityTestDependencies();
  seedSecurityUsers();
  const response = makeResponse();

  try {
    await assert.rejects(
      () =>
        getReportApi({
          auth: { userId: SCHOOL_ADMIN_A_ID, schoolId: SCHOOL_A_ID, role: 'SCHOOL_ADMIN' },
          params: { reportKey: 'students.list' },
          query: { schoolId: SCHOOL_B_ID },
          body: {},
        } as any, response as any),
      (error: unknown) => error instanceof HttpError && error.statusCode === 403 && /Tenant scope/.test(error.message),
    );
  } finally {
    restoreSecurityTestDependencies();
  }
});

test('student list report returns paginated real rows', async () => {
  patchSecurityTestDependencies();
  seedSecurityUsers();
  const students = [
    {
      id: STUDENT_ID,
      schoolId: SCHOOL_A_ID,
      admissionNo: 'ADM-001',
      firstName: 'Student',
      lastName: 'A',
      fullName: 'Student A',
      status: 'ENROLLED',
      rollNo: '1',
      class: { id: TEST_CLASS_A_ID, name: 'Class 1' },
      section: { id: TEST_SECTION_A_ID, name: 'A' },
      _count: { parentLinks: 2 },
    },
  ];
  const restoreFindMany = patch(prisma.student as any, 'findMany', async () => students);
  const restoreCount = patch(prisma.student as any, 'count', async () => 1);
  const response = makeResponse();

  try {
    await getReportApi({
      auth: { userId: SCHOOL_ADMIN_A_ID, schoolId: SCHOOL_A_ID, role: 'SCHOOL_ADMIN' },
      params: { reportKey: 'students.list' },
      query: { page: '1', pageSize: '10' },
      body: {},
    } as any, response as any);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.pagination.total, 1);
    assert.equal(response.body.pagination.pageSize, 10);
    assert.deepEqual(response.body.rows[0], {
      admissionNo: 'ADM-001',
      studentName: 'Student A',
      class: 'Class 1',
      section: 'A',
      status: 'ENROLLED',
      parents: 2,
    });
  } finally {
    restoreCount();
    restoreFindMany();
    restoreSecurityTestDependencies();
  }
});

test('csv export escapes commas quotes and newlines', () => {
  const csv = toCsv(
    [
      { key: 'name', label: 'Name' },
      { key: 'note', label: 'Note' },
    ],
    [{ name: 'A "quoted", value', note: 'Line 1\nLine 2' }],
  );

  assert.equal(csv, 'Name,Note\n"A ""quoted"", value","Line 1\nLine 2"');
});

test('pdf export returns a PDF buffer', async () => {
  patchSecurityTestDependencies();
  const report = getReportDefinition('students.list');

  try {
    const pdf = await toReportPdf({
      schoolId: SCHOOL_A_ID,
      report,
      rows: [{ admissionNo: 'ADM-001', studentName: 'Student A', class: 'Class 1', section: 'A', status: 'ENROLLED', parents: 1 }],
      filters: { classId: TEST_CLASS_A_ID },
    });
    assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
  } finally {
    restoreSecurityTestDependencies();
  }
});

test('unsupported report returns clear error', async () => {
  await assert.rejects(
    () => getReportData('students.profile_summary', { schoolId: SCHOOL_A_ID, page: 1, pageSize: 25 }),
    (error: unknown) => error instanceof HttpError && error.statusCode === 404 && /profile completeness/i.test(error.message),
  );
});

test('report export writes audit log', async () => {
  patchSecurityTestDependencies();
  seedSecurityUsers();
  let auditPayload: any = null;
  const restoreFindMany = patch(prisma.student as any, 'findMany', async () => [
    {
      id: STUDENT_ID,
      schoolId: SCHOOL_A_ID,
      admissionNo: 'ADM-001',
      firstName: 'Student',
      lastName: 'A',
      fullName: 'Student A',
      status: 'ENROLLED',
      rollNo: '1',
      class: { id: TEST_CLASS_A_ID, name: 'Class 1' },
      section: { id: TEST_SECTION_A_ID, name: 'A' },
      _count: { parentLinks: 1 },
    },
  ]);
  const restoreCount = patch(prisma.student as any, 'count', async () => 1);
  const restoreAudit = patch(prisma.auditLog as any, 'create', async ({ data }: any) => {
    auditPayload = data;
    return { id: 'report-audit-1', ...data };
  });
  const response = makeResponse();

  try {
    await exportReportCsvApi({
      auth: { userId: SCHOOL_ADMIN_A_ID, schoolId: SCHOOL_A_ID, role: 'SCHOOL_ADMIN' },
      params: { reportKey: 'students.list' },
      query: {},
      body: {},
      headers: {},
      socket: {},
    } as any, response as any);

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers.get('Content-Type'), 'text/csv');
    assert.equal(auditPayload.action, 'EXPORT_CSV');
    assert.equal(auditPayload.afterState.reportKey, 'students.list');
    assert.equal(auditPayload.afterState.rows, 1);
  } finally {
    restoreAudit();
    restoreCount();
    restoreFindMany();
    restoreSecurityTestDependencies();
  }
});

test('report-specific permission is enforced for data and exports', async () => {
  patchSecurityTestDependencies();
  seedSecurityUsers();
  let planPermissions = [
    { permissionCode: 'reports.view', enabled: true },
    { permissionCode: 'reports.export', enabled: true },
  ];
  const restorePlanPermissions = patch(prisma.subscriptionPlanPermission as any, 'findMany', async () => [
    ...planPermissions,
  ]);

  try {
    await assert.rejects(
      () =>
        getReportApi({
          auth: { userId: SCHOOL_ADMIN_A_ID, schoolId: SCHOOL_A_ID, role: 'SCHOOL_ADMIN' },
          params: { reportKey: 'fees.collection_summary' },
          query: {},
          body: {},
        } as any, makeResponse() as any),
      (error: unknown) => error instanceof HttpError && error.statusCode === 403 && /reports\.fees\.view/.test(error.message),
    );

    await assert.rejects(
      () =>
        exportReportPdfApi({
          auth: { userId: SCHOOL_ADMIN_A_ID, schoolId: SCHOOL_A_ID, role: 'SCHOOL_ADMIN' },
          params: { reportKey: 'fees.collection_summary' },
          query: {},
          body: {},
        } as any, makeResponse() as any),
      (error: unknown) => error instanceof HttpError && error.statusCode === 403 && /reports\.fees\.view/.test(error.message),
    );

    planPermissions = [
      { permissionCode: 'reports.view', enabled: true },
      { permissionCode: 'reports.fees.view', enabled: true },
    ];
    await assert.rejects(
      () =>
        exportReportPdfApi({
          auth: { userId: SCHOOL_ADMIN_A_ID, schoolId: SCHOOL_A_ID, role: 'SCHOOL_ADMIN' },
          params: { reportKey: 'fees.collection_summary' },
          query: {},
          body: {},
        } as any, makeResponse() as any),
      (error: unknown) => error instanceof HttpError && error.statusCode === 403 && /reports\.export/.test(error.message),
    );
  } finally {
    restorePlanPermissions();
    restoreSecurityTestDependencies();
  }
});

test('compliance summary is scoped for School Admin tenants', async () => {
  patchSecurityTestDependencies();
  const store = patchComplianceWorkflowStore();

  try {
    const summary = await getAdminComplianceSummary({ schoolId: SCHOOL_A_ID });
    assert.equal(summary.exportRequests.pending, 1);
    assert.equal(summary.deletionRequests.pending, 1);

    const otherSummary = await getAdminComplianceSummary({ schoolId: SCHOOL_B_ID });
    assert.equal(otherSummary.exportRequests.total, 0);
    assert.equal(otherSummary.deletionRequests.total, 0);
  } finally {
    store.restore();
    restoreSecurityTestDependencies();
  }
});

test('School Admin export list is forced to their own tenant', async () => {
  patchSecurityTestDependencies();
  seedSecurityUsers();
  const store = patchComplianceWorkflowStore();
  let listWhere: any = null;
  const restoreFindMany = patch(prisma.dataExportJob as any, 'findMany', async ({ where }: any) => {
    listWhere = where;
    return [exportJobRow()];
  });
  const response = makeResponse();

  try {
    await listExportRequestsApi({
      auth: { userId: SCHOOL_ADMIN_A_ID, schoolId: SCHOOL_A_ID, role: 'SCHOOL_ADMIN' },
      query: { schoolId: SCHOOL_A_ID },
      params: {},
      body: {},
    } as any, response as any);

    assert.equal(response.statusCode, 200);
    assert.equal(listWhere.schoolId, SCHOOL_A_ID);
  } finally {
    restoreFindMany();
    store.restore();
    restoreSecurityTestDependencies();
  }
});

test('School Admin cannot request another tenant compliance list', async () => {
  patchSecurityTestDependencies();
  seedSecurityUsers();

  try {
    await assert.rejects(
      () =>
        listExportRequestsApi({
          auth: { userId: SCHOOL_ADMIN_A_ID, schoolId: SCHOOL_A_ID, role: 'SCHOOL_ADMIN' },
          query: { schoolId: SCHOOL_B_ID },
          params: {},
          body: {},
        } as any, makeResponse() as any),
      (error: unknown) => error instanceof HttpError && error.statusCode === 403 && /Tenant scope/.test(error.message),
    );
  } finally {
    restoreSecurityTestDependencies();
  }
});

test('School Admin cannot read another tenant export detail', async () => {
  patchSecurityTestDependencies();
  seedSecurityUsers();
  const store = patchComplianceWorkflowStore({ schoolId: SCHOOL_B_ID });

  try {
    await assert.rejects(
      () =>
        getExportRequestByIdApi({
          auth: { userId: SCHOOL_ADMIN_A_ID, schoolId: SCHOOL_A_ID, role: 'SCHOOL_ADMIN' },
          params: { id: COMPLIANCE_EXPORT_ID },
          query: {},
          body: {},
        } as any, makeResponse() as any),
      (error: unknown) => error instanceof HttpError && error.statusCode === 403 && /Tenant scope/.test(error.message),
    );
  } finally {
    store.restore();
    restoreSecurityTestDependencies();
  }
});

test('export review approval records reviewer status history and audit', async () => {
  patchSecurityTestDependencies();
  seedSecurityUsers();
  const store = patchComplianceWorkflowStore();

  try {
    const result = await approveAdminExportRequest({
      id: COMPLIANCE_EXPORT_ID,
      actorId: SCHOOL_ADMIN_A_ID,
      actorRole: 'SCHOOL_ADMIN',
      actorSchoolId: SCHOOL_A_ID,
      note: 'Verified requester identity',
    });

    assert.equal(result.status, 'APPROVED');
    assert.equal(result.approvedBy?.id, SCHOOL_ADMIN_A_ID);
    assert.equal(store.histories[0].oldStatus, 'REQUESTED');
    assert.equal(store.histories[0].newStatus, 'APPROVED');
    assert.equal(store.auditRows[0].action, 'DATA_EXPORT_REQUEST_APPROVED');
  } finally {
    store.restore();
    restoreSecurityTestDependencies();
  }
});

test('export review rejection requires reason and records rejection metadata', async () => {
  patchSecurityTestDependencies();
  seedSecurityUsers();
  const store = patchComplianceWorkflowStore();

  try {
    await assert.rejects(
      () =>
        rejectAdminExportRequest({
          id: COMPLIANCE_EXPORT_ID,
          actorId: SCHOOL_ADMIN_A_ID,
          actorRole: 'SCHOOL_ADMIN',
          actorSchoolId: SCHOOL_A_ID,
          reason: ' ',
        }),
      (error: unknown) => error instanceof HttpError && error.statusCode === 400 && /reason is required/i.test(error.message),
    );

    const result = await rejectAdminExportRequest({
      id: COMPLIANCE_EXPORT_ID,
      actorId: SCHOOL_ADMIN_A_ID,
      actorRole: 'SCHOOL_ADMIN',
      actorSchoolId: SCHOOL_A_ID,
      reason: 'Requester mismatch',
    });

    assert.equal(result.status, 'REJECTED');
    assert.equal(result.rejectionReason, 'Requester mismatch');
    assert.equal(store.histories[0].newStatus, 'REJECTED');
    assert.equal(store.auditRows[0].action, 'DATA_EXPORT_REQUEST_REJECTED');
  } finally {
    store.restore();
    restoreSecurityTestDependencies();
  }
});

test('export review only allows pending or requested jobs', async () => {
  patchSecurityTestDependencies();
  seedSecurityUsers();
  const store = patchComplianceWorkflowStore({ exportStatus: 'COMPLETED' });

  try {
    await assert.rejects(
      () =>
        approveAdminExportRequest({
          id: COMPLIANCE_EXPORT_ID,
          actorId: SCHOOL_ADMIN_A_ID,
          actorRole: 'SCHOOL_ADMIN',
          actorSchoolId: SCHOOL_A_ID,
        }),
      (error: unknown) => error instanceof HttpError && error.statusCode === 409 && /requested export jobs/i.test(error.message),
    );
  } finally {
    store.restore();
    restoreSecurityTestDependencies();
  }
});

test('deletion review approval records reviewer status history and audit', async () => {
  patchSecurityTestDependencies();
  seedSecurityUsers();
  const store = patchComplianceWorkflowStore();

  try {
    const result = await approveAdminDeletionRequest({
      id: COMPLIANCE_DELETION_ID,
      actorId: SCHOOL_ADMIN_A_ID,
      actorRole: 'SCHOOL_ADMIN',
      actorSchoolId: SCHOOL_A_ID,
      note: 'DPO approved',
    });

    assert.equal(result.status, 'APPROVED');
    assert.equal(result.approvedBy?.id, SCHOOL_ADMIN_A_ID);
    assert.equal(store.histories[0].jobType, 'DATA_DELETION');
    assert.equal(store.histories[0].newStatus, 'APPROVED');
    assert.equal(store.auditRows[0].action, 'DATA_DELETION_REQUEST_APPROVED');
  } finally {
    store.restore();
    restoreSecurityTestDependencies();
  }
});

test('deletion review rejection requires reason and records rejection metadata', async () => {
  patchSecurityTestDependencies();
  seedSecurityUsers();
  const store = patchComplianceWorkflowStore();

  try {
    await assert.rejects(
      () =>
        rejectAdminDeletionRequest({
          id: COMPLIANCE_DELETION_ID,
          actorId: SCHOOL_ADMIN_A_ID,
          actorRole: 'SCHOOL_ADMIN',
          actorSchoolId: SCHOOL_A_ID,
          reason: '',
        }),
      (error: unknown) => error instanceof HttpError && error.statusCode === 400 && /reason is required/i.test(error.message),
    );

    const result = await rejectAdminDeletionRequest({
      id: COMPLIANCE_DELETION_ID,
      actorId: SCHOOL_ADMIN_A_ID,
      actorRole: 'SCHOOL_ADMIN',
      actorSchoolId: SCHOOL_A_ID,
      reason: 'Legal hold active',
    });

    assert.equal(result.status, 'REJECTED');
    assert.equal(result.rejectionReason, 'Legal hold active');
    assert.equal(store.histories[0].newStatus, 'REJECTED');
    assert.equal(store.auditRows[0].action, 'DATA_DELETION_REQUEST_REJECTED');
  } finally {
    store.restore();
    restoreSecurityTestDependencies();
  }
});

test('School Admin cannot review another tenant compliance request', async () => {
  patchSecurityTestDependencies();
  seedSecurityUsers();
  const store = patchComplianceWorkflowStore({ schoolId: SCHOOL_B_ID });

  try {
    await assert.rejects(
      () =>
        approveAdminDeletionRequest({
          id: COMPLIANCE_DELETION_ID,
          actorId: SCHOOL_ADMIN_A_ID,
          actorRole: 'SCHOOL_ADMIN',
          actorSchoolId: SCHOOL_A_ID,
        }),
      (error: unknown) => error instanceof HttpError && error.statusCode === 403 && /Tenant scope/.test(error.message),
    );
  } finally {
    store.restore();
    restoreSecurityTestDependencies();
  }
});

test('compliance job history is returned and tenant scoped', async () => {
  patchSecurityTestDependencies();
  seedSecurityUsers();
  const store = patchComplianceWorkflowStore();

  try {
    await approveAdminExportRequest({
      id: COMPLIANCE_EXPORT_ID,
      actorId: SCHOOL_ADMIN_A_ID,
      actorRole: 'SCHOOL_ADMIN',
      actorSchoolId: SCHOOL_A_ID,
      note: 'Approved',
    });

    const history = await getComplianceJobHistory({ jobId: COMPLIANCE_EXPORT_ID, actorSchoolId: SCHOOL_A_ID });
    assert.equal(history.length, 1);
    assert.equal(history[0].newStatus, 'APPROVED');

    await assert.rejects(
      () => getComplianceJobHistory({ jobId: COMPLIANCE_EXPORT_ID, actorSchoolId: SCHOOL_B_ID }),
      (error: unknown) => error instanceof HttpError && error.statusCode === 403 && /Tenant scope/.test(error.message),
    );
  } finally {
    store.restore();
    restoreSecurityTestDependencies();
  }
});

test('export and deletion review permissions are enforced for School Admins', async () => {
  patchSecurityTestDependencies();
  seedSecurityUsers();
  const store = patchComplianceWorkflowStore();
  const restorePlanPermissions = patch(prisma.subscriptionPlanPermission as any, 'findMany', async () => [
    { permissionCode: 'compliance.view', enabled: true },
    { permissionCode: 'compliance.review', enabled: true },
  ]);

  try {
    await assert.rejects(
      () =>
        approveExportRequestApi({
          auth: { userId: SCHOOL_ADMIN_A_ID, schoolId: SCHOOL_A_ID, role: 'SCHOOL_ADMIN' },
          params: { id: COMPLIANCE_EXPORT_ID },
          query: {},
          body: {},
        } as any, makeResponse() as any),
      (error: unknown) => error instanceof HttpError && error.statusCode === 403 && /compliance\.export\.review/.test(error.message),
    );

    await assert.rejects(
      () =>
        approveDeletionRequestApi({
          auth: { userId: SCHOOL_ADMIN_A_ID, schoolId: SCHOOL_A_ID, role: 'SCHOOL_ADMIN' },
          params: { id: COMPLIANCE_DELETION_ID },
          query: {},
          body: {},
        } as any, makeResponse() as any),
      (error: unknown) => error instanceof HttpError && error.statusCode === 403 && /compliance\.deletion\.review/.test(error.message),
    );
  } finally {
    restorePlanPermissions();
    store.restore();
    restoreSecurityTestDependencies();
  }
});

test('school admin cannot read another school exam centers', async () => {
  patchSecurityTestDependencies();
  seedSecurityUsers();
  const response = makeResponse();
  try {
    await assert.rejects(
      () =>
        listExamCentersApi({
          auth: { userId: SCHOOL_ADMIN_A_ID, schoolId: SCHOOL_A_ID, role: 'SCHOOL_ADMIN' },
          query: { schoolId: SCHOOL_B_ID },
          params: {},
          body: {},
        } as any, response as any),
      (error: unknown) => error instanceof HttpError && error.statusCode === 403 && /Tenant scope/.test(error.message),
    );
  } finally {
    restoreSecurityTestDependencies();
  }
});

test('exam creation uses assigned subjects for selected class and section', async () => {
  patchSecurityTestDependencies();
  seedSecurityUsers();
  const response = makeResponse();
  const createdPapers: any[] = [];
  const req = {
    auth: { userId: SCHOOL_ADMIN_A_ID, schoolId: SCHOOL_A_ID, role: 'SCHOOL_ADMIN' },
    query: {},
    params: {},
    body: {
      schoolId: SCHOOL_A_ID,
      academicYearId: TEST_ACADEMIC_YEAR_A_ID,
      classId: TEST_CLASS_A_ID,
      sectionId: TEST_SECTION_A_ID,
      type: 'MIDTERM',
      name: 'Assigned Subject Exam',
      scheduledAt: '2026-07-01T04:30:00.000Z',
      subjectMappings: [
        { subjectId: SUBJECT_ID, maxMarks: 100, passMarks: 35, scheduledAt: '2026-07-01T04:30:00.000Z' },
        { subjectId: SUBJECT_TWO_ID, maxMarks: 50, passMarks: 20, scheduledAt: '2026-07-02T04:30:00.000Z' },
      ],
    },
  } as any;

  const restoreExamTypeCount = patch(prisma.examTypeConfig as any, 'count', async () => 1);
  const restoreExamTypeFind = patch(prisma.examTypeConfig as any, 'findFirst', async () => ({ id: 'exam-type-1', code: 'MIDTERM', isActive: true }));
  const restoreSubjects = patch(prisma.subject as any, 'findMany', async () => [
    { id: SUBJECT_ID, name: 'Mathematics', classId: null, academicYearId: null },
    { id: SUBJECT_TWO_ID, name: 'English', classId: null, academicYearId: null },
  ]);
  const restoreAssignments = patch(prisma.assignSubject as any, 'findMany', async ({ where }: any) =>
    [SUBJECT_ID, SUBJECT_TWO_ID]
      .filter((subjectId) => where.subjectId.in.includes(subjectId))
      .map((subjectId) => ({ subjectId })),
  );
  const restoreTransaction = patch(prisma as any, '$transaction', async (callback: any) =>
    callback({
      exam: {
        create: async ({ data }: any) => ({ id: EXAM_ID, ...data }),
      },
      examPaper: {
        createMany: async ({ data }: any) => {
          createdPapers.push(...data);
          return { count: data.length };
        },
      },
    }),
  );
  const restoreAudit = patch(prisma.auditLog as any, 'create', async ({ data }: any) => ({ id: 'audit-1', ...data }));

  try {
    await createExam(req, response as any);
    assert.equal(response.statusCode, 201);
    assert.equal(response.body.classId, TEST_CLASS_A_ID);
    assert.equal(response.body.sectionId, TEST_SECTION_A_ID);
    assert.deepEqual(createdPapers.map((paper) => paper.subjectId).sort(), [SUBJECT_ID, SUBJECT_TWO_ID].sort());
    assert.equal(createdPapers.every((paper) => paper.classId === TEST_CLASS_A_ID), true);
  } finally {
    restoreAudit();
    restoreTransaction();
    restoreAssignments();
    restoreSubjects();
    restoreExamTypeFind();
    restoreExamTypeCount();
    restoreSecurityTestDependencies();
  }
});

test('exam creation rejects unassigned duplicate or invalid subject mappings', async () => {
  patchSecurityTestDependencies();
  seedSecurityUsers();
  const baseReq = {
    auth: { userId: SCHOOL_ADMIN_A_ID, schoolId: SCHOOL_A_ID, role: 'SCHOOL_ADMIN' },
    query: {},
    params: {},
  };

  const restoreExamTypeCount = patch(prisma.examTypeConfig as any, 'count', async () => 1);
  const restoreExamTypeFind = patch(prisma.examTypeConfig as any, 'findFirst', async () => ({ id: 'exam-type-1', code: 'MIDTERM', isActive: true }));
  const restoreSubjects = patch(prisma.subject as any, 'findMany', async () => [
    { id: SUBJECT_ID, name: 'Mathematics', classId: null, academicYearId: null },
  ]);
  const restoreAssignments = patch(prisma.assignSubject as any, 'findMany', async () => []);

  try {
    await assert.rejects(
      () =>
        createExam({
          ...baseReq,
          body: {
            schoolId: SCHOOL_A_ID,
            academicYearId: TEST_ACADEMIC_YEAR_A_ID,
            classId: TEST_CLASS_A_ID,
            sectionId: TEST_SECTION_A_ID,
            type: 'MIDTERM',
            subjectMappings: [{ subjectId: SUBJECT_ID, maxMarks: 100, passMarks: 35, scheduledAt: '2026-07-01T04:30:00.000Z' }],
          },
        } as any, makeResponse() as any),
      (error: unknown) => error instanceof HttpError && error.statusCode === 400 && /not assigned/.test(error.message),
    );

    await assert.rejects(
      () =>
        createExam({
          ...baseReq,
          body: {
            schoolId: SCHOOL_A_ID,
            academicYearId: TEST_ACADEMIC_YEAR_A_ID,
            classId: TEST_CLASS_A_ID,
            sectionId: TEST_SECTION_A_ID,
            type: 'MIDTERM',
            subjectMappings: [
              { subjectId: SUBJECT_ID, maxMarks: 100, passMarks: 35, scheduledAt: '2026-07-01T04:30:00.000Z' },
              { subjectId: SUBJECT_ID, maxMarks: 100, passMarks: 35, scheduledAt: '2026-07-02T04:30:00.000Z' },
            ],
          },
        } as any, makeResponse() as any),
      (error: unknown) => error instanceof HttpError && error.statusCode === 400 && /Duplicate/.test(error.message),
    );

    await assert.rejects(
      () =>
        createExam({
          ...baseReq,
          body: {
            schoolId: SCHOOL_A_ID,
            academicYearId: TEST_ACADEMIC_YEAR_A_ID,
            classId: TEST_CLASS_A_ID,
            sectionId: TEST_SECTION_A_ID,
            type: 'MIDTERM',
            subjectMappings: [{ subjectId: SUBJECT_ID, maxMarks: 40, passMarks: 50, scheduledAt: '2026-07-01T04:30:00.000Z' }],
          },
        } as any, makeResponse() as any),
      /Pass marks cannot exceed max marks/,
    );
  } finally {
    restoreAssignments();
    restoreSubjects();
    restoreExamTypeFind();
    restoreExamTypeCount();
    restoreSecurityTestDependencies();
  }
});

test('marks upload rejects marks above paper maximum', async () => {
  patchSecurityTestDependencies();
  seedSecurityUsers();
  const req = {
    auth: { userId: SCHOOL_ADMIN_A_ID, schoolId: SCHOOL_A_ID, role: 'SCHOOL_ADMIN' },
    query: {},
    params: {},
    body: {
      schoolId: SCHOOL_A_ID,
      examPaperId: PAPER_ID,
      entries: [{ studentId: STUDENT_ID, marks: 101 }],
    },
  } as any;

  const restorePaper = patch(prisma.examPaper as any, 'findFirst', async () => ({ id: PAPER_ID, maxMarks: 100 }));
  const restoreSettings = patch(prisma.examGradingSetting as any, 'findUnique', async () => null);
  const restoreTransaction = patch(prisma as any, '$transaction', async (callback: any) =>
    callback({
      student: { findFirst: async () => ({ id: STUDENT_ID }) },
      mark: { upsert: async () => ({ studentId: STUDENT_ID, grade: 'A' }) },
    }),
  );

  try {
    await assert.rejects(
      () => uploadMarks(req, makeResponse() as any),
      (error: unknown) => error instanceof HttpError && error.statusCode === 422 && /Marks exceed max marks/.test(error.message),
    );
  } finally {
    restoreTransaction();
    restoreSettings();
    restorePaper();
    restoreSecurityTestDependencies();
  }
});

test('exam center and room creation validate room capacity shape', async () => {
  patchSecurityTestDependencies();
  seedSecurityUsers();
  const req = { auth: { userId: SCHOOL_ADMIN_A_ID, schoolId: SCHOOL_A_ID, role: 'SCHOOL_ADMIN' } } as any;
  const restoreCenterCreate = patch(prisma.examCenter as any, 'create', async ({ data }: any) => ({ id: CENTER_ID, ...data }));
  const restoreCenterFind = patch(prisma.examCenter as any, 'findFirst', async () => ({ id: CENTER_ID, schoolId: SCHOOL_A_ID, isActive: true }));
  const restoreRoomCreate = patch(prisma.examRoom as any, 'create', async ({ data }: any) => ({ id: ROOM_ID, ...data, center: { id: CENTER_ID, name: 'Main Center' } }));

  try {
    const center = await createExamCenter(req, {
      schoolId: SCHOOL_A_ID,
      name: 'Main Center',
      code: 'main',
      address: 'Campus Road',
    });
    assert.equal(center.code, 'MAIN');

    const room = await createExamRoom(req, {
      schoolId: SCHOOL_A_ID,
      centerId: CENTER_ID,
      name: 'Room 101',
      code: 'r101',
      capacity: 20,
      rows: 4,
      columns: 5,
    });
    assert.equal(room.code, 'R101');

    await assert.rejects(
      () =>
        createExamRoom(req, {
          schoolId: SCHOOL_A_ID,
          centerId: CENTER_ID,
          name: 'Invalid',
          code: 'bad',
          capacity: 21,
          rows: 4,
          columns: 5,
        }),
      (error: unknown) => error instanceof HttpError && error.statusCode === 400 && /rows and columns/.test(error.message),
    );
  } finally {
    restoreRoomCreate();
    restoreCenterFind();
    restoreCenterCreate();
    restoreSecurityTestDependencies();
  }
});

test('seating generation blocks insufficient capacity and writes deterministic allocations with audit', async () => {
  patchSecurityTestDependencies();
  seedSecurityUsers();
  const req = { auth: { userId: SCHOOL_ADMIN_A_ID, schoolId: SCHOOL_A_ID, role: 'SCHOOL_ADMIN' } } as any;
  const exam = {
    id: EXAM_ID,
    schoolId: SCHOOL_A_ID,
    name: 'Mid Term',
    classId: TEST_CLASS_A_ID,
    sectionId: TEST_SECTION_A_ID,
    scheduledAt: new Date('2026-07-01T04:30:00.000Z'),
    papers: [],
    class: { id: TEST_CLASS_A_ID, name: 'Class 1' },
    section: { id: TEST_SECTION_A_ID, name: 'A' },
    academicYear: { id: TEST_ACADEMIC_YEAR_A_ID, name: '2026-2027' },
    school: { id: SCHOOL_A_ID, name: 'School A' },
  };
  let roomCapacity = 1;
  let createdRows: any[] = [];
  const restoreExam = patch(prisma.exam as any, 'findFirst', async () => exam);
  const restoreCount = patch(prisma.examSeatingAllocation as any, 'count', async () => 0);
  const restoreRooms = patch(prisma.examRoom as any, 'findMany', async () => [
    { id: ROOM_ID, schoolId: SCHOOL_A_ID, centerId: CENTER_ID, name: 'Room 101', code: 'R101', capacity: roomCapacity, rows: 1, columns: Math.max(1, roomCapacity), isActive: true, center: { id: CENTER_ID, name: 'Main Center', code: 'MAIN' } },
  ]);
  const restoreStudents = patch(prisma.student as any, 'findMany', async () => [
    { id: STUDENT_ID, admissionNo: 'ADM-002', rollNo: '2', fullName: 'Student B' },
    { id: STUDENT_TWO_ID, admissionNo: 'ADM-001', rollNo: '1', fullName: 'Student A' },
  ]);
  const restoreCreateMany = patch(prisma.examSeatingAllocation as any, 'createMany', async ({ data }: any) => {
    createdRows = data;
    return { count: data.length };
  });
  const restoreFindMany = patch(prisma.examSeatingAllocation as any, 'findMany', async () => []);

  try {
    await assert.rejects(
      () => generateExamSeating(req, SCHOOL_A_ID, EXAM_ID, {}),
      (error: unknown) => error instanceof HttpError && error.statusCode === 400 && /capacity is insufficient/.test(error.message),
    );

    roomCapacity = 2;
    await generateExamSeating(req, SCHOOL_A_ID, EXAM_ID, {});
    assert.equal(createdRows.length, 2);
    assert.equal(createdRows[0].studentId, STUDENT_ID);
    assert.equal(createdRows[0].seatNumber, 'R101-001');
  } finally {
    restoreFindMany();
    restoreCreateMany();
    restoreStudents();
    restoreRooms();
    restoreCount();
    restoreExam();
    restoreSecurityTestDependencies();
  }
});

test('invigilator double booking is blocked for overlapping exam slot', async () => {
  patchSecurityTestDependencies();
  seedSecurityUsers();
  const req = { auth: { userId: SCHOOL_ADMIN_A_ID, schoolId: SCHOOL_A_ID, role: 'SCHOOL_ADMIN' } } as any;
  const slot = new Date('2026-07-01T04:30:00.000Z');
  const restoreExam = patch(prisma.exam as any, 'findFirst', async () => ({
    id: EXAM_ID,
    schoolId: SCHOOL_A_ID,
    scheduledAt: null,
    papers: [{ id: PAPER_ID, scheduledAt: slot, subject: { id: SUBJECT_ID, name: 'English' } }],
    school: { name: 'School A' },
  }));
  const restoreTeacher = patch(prisma.teacherProfile as any, 'findFirst', async () => ({ id: TEST_STAFF_PROFILE_A_ID, schoolId: SCHOOL_A_ID, isActive: true }));
  const restoreRoom = patch(prisma.examRoom as any, 'findFirst', async () => ({ id: ROOM_ID, schoolId: SCHOOL_A_ID, centerId: CENTER_ID, isActive: true }));
  const restoreSameExam = patch(prisma.examInvigilatorAssignment as any, 'findFirst', async ({ where }: any = {}) => {
    if (where?.OR) return { id: 'same-day-assignment' };
    return null;
  });

  try {
    await assert.rejects(
      () => assignExamInvigilator(req, SCHOOL_A_ID, EXAM_ID, { examPaperId: PAPER_ID, teacherId: TEST_STAFF_PROFILE_A_ID, roomId: ROOM_ID }),
      (error: unknown) => error instanceof HttpError && error.statusCode === 409 && /already assigned on this exam date/.test(error.message),
    );
  } finally {
    restoreSameExam();
    restoreRoom();
    restoreTeacher();
    restoreExam();
    restoreSecurityTestDependencies();
  }
});

test('invigilator can be assigned to another paper on a different date', async () => {
  patchSecurityTestDependencies();
  seedSecurityUsers();
  const req = { auth: { userId: SCHOOL_ADMIN_A_ID, schoolId: SCHOOL_A_ID, role: 'SCHOOL_ADMIN' } } as any;
  const paperDate = new Date('2026-07-02T04:30:00.000Z');
  const otherDate = new Date('2026-07-01T04:30:00.000Z');
  const restoreExam = patch(prisma.exam as any, 'findFirst', async () => ({
    id: EXAM_ID,
    schoolId: SCHOOL_A_ID,
    scheduledAt: null,
    papers: [{ id: PAPER_ID, scheduledAt: paperDate, subject: { id: SUBJECT_ID, name: 'Tamil' } }],
    school: { name: 'School A' },
  }));
  const restoreTeacher = patch(prisma.teacherProfile as any, 'findFirst', async () => ({ id: TEST_STAFF_PROFILE_A_ID, schoolId: SCHOOL_A_ID, isActive: true }));
  const restoreRoom = patch(prisma.examRoom as any, 'findFirst', async () => ({ id: ROOM_ID, schoolId: SCHOOL_A_ID, centerId: CENTER_ID, isActive: true }));
  const restoreFindFirst = patch(prisma.examInvigilatorAssignment as any, 'findFirst', async () => null);
  const restoreCreate = patch(prisma.examInvigilatorAssignment as any, 'create', async ({ data }: any) => ({
    id: 'assignment-new',
    ...data,
    center: { id: CENTER_ID, name: 'Main Center' },
    room: { id: ROOM_ID, name: 'Room 101' },
    examPaper: { id: PAPER_ID, scheduledAt: paperDate, subject: { id: SUBJECT_ID, name: 'Tamil' } },
    teacher: { id: TEST_STAFF_PROFILE_A_ID, firstName: 'Teacher', lastName: 'A' },
  }));

  try {
    const result = await assignExamInvigilator(req, SCHOOL_A_ID, EXAM_ID, { examPaperId: PAPER_ID, teacherId: TEST_STAFF_PROFILE_A_ID, roomId: ROOM_ID });
    assert.equal(result.examPaperId, PAPER_ID);
    assert.equal(result.teacherId, TEST_STAFF_PROFILE_A_ID);
  } finally {
    restoreCreate();
    restoreFindFirst();
    restoreRoom();
    restoreTeacher();
    restoreExam();
    restoreSecurityTestDependencies();
  }
});

test('auto assign invigilators previews and saves teacher room assignments by paper date', async () => {
  patchSecurityTestDependencies();
  seedSecurityUsers();
  const req = { auth: { userId: SCHOOL_ADMIN_A_ID, schoolId: SCHOOL_A_ID, role: 'SCHOOL_ADMIN' } } as any;
  const paperDate = new Date('2026-07-02T04:30:00.000Z');
  const createdRows: any[] = [];
  const restoreExam = patch(prisma.exam as any, 'findFirst', async () => ({
    id: EXAM_ID,
    schoolId: SCHOOL_A_ID,
    scheduledAt: null,
    papers: [{ id: PAPER_ID, scheduledAt: paperDate, subject: { id: SUBJECT_ID, name: 'Tamil' } }],
    school: { name: 'School A' },
  }));
  const restoreRooms = patch(prisma.examRoom as any, 'findMany', async () => [
    { id: ROOM_ID, schoolId: SCHOOL_A_ID, centerId: CENTER_ID, name: 'Room 101', code: 'R101', isActive: true, center: { id: CENTER_ID, name: 'Main Center', code: 'MAIN' } },
  ]);
  const restoreTeachers = patch(prisma.teacherProfile as any, 'findMany', async () => [
    { id: TEST_STAFF_PROFILE_A_ID, firstName: 'Teacher', lastName: 'A', employeeNo: 'T-001' },
  ]);
  const restoreExisting = patch(prisma.examInvigilatorAssignment as any, 'findMany', async () => []);
  const restoreCreateMany = patch(prisma.examInvigilatorAssignment as any, 'createMany', async ({ data }: any) => {
    createdRows.push(...data);
    return { count: data.length };
  });

  try {
    const preview = await autoAssignExamInvigilators(req, SCHOOL_A_ID, EXAM_ID, { dryRun: true });
    assert.equal(preview.summary.planned, 1);
    assert.equal(createdRows.length, 0);

    const saved = await autoAssignExamInvigilators(req, SCHOOL_A_ID, EXAM_ID, { dryRun: false });
    assert.equal(saved.summary.planned, 1);
    assert.deepEqual(
      createdRows.map((row) => ({ examPaperId: row.examPaperId, teacherId: row.teacherId, roomId: row.roomId })),
      [{ examPaperId: PAPER_ID, teacherId: TEST_STAFF_PROFILE_A_ID, roomId: ROOM_ID }],
    );
  } finally {
    restoreCreateMany();
    restoreExisting();
    restoreTeachers();
    restoreRooms();
    restoreExam();
    restoreSecurityTestDependencies();
  }
});

test('hall ticket PDF requires seating and returns a PDF when allocation exists', async () => {
  patchSecurityTestDependencies();
  seedSecurityUsers();
  const req = { auth: { userId: SCHOOL_ADMIN_A_ID, schoolId: SCHOOL_A_ID, role: 'SCHOOL_ADMIN' } } as any;
  const exam = {
    id: EXAM_ID,
    schoolId: SCHOOL_A_ID,
    name: 'Mid Term',
    scheduledAt: new Date('2026-07-01T04:30:00.000Z'),
    papers: [{ subject: { name: 'Mathematics' }, scheduledAt: new Date('2026-07-01T04:30:00.000Z') }],
    school: { id: SCHOOL_A_ID, name: 'School A' },
    class: { id: TEST_CLASS_A_ID, name: 'Class 1' },
    section: { id: TEST_SECTION_A_ID, name: 'A' },
    academicYear: { id: TEST_ACADEMIC_YEAR_A_ID, name: '2026-2027' },
  };
  let allocationEnabled = false;
  const restoreExam = patch(prisma.exam as any, 'findFirst', async () => exam);
  const restoreAllocation = patch(prisma.examSeatingAllocation as any, 'findFirst', async () =>
    allocationEnabled
      ? {
          id: 'allocation-1',
          schoolId: SCHOOL_A_ID,
          examId: EXAM_ID,
          studentId: STUDENT_ID,
          centerId: CENTER_ID,
          roomId: ROOM_ID,
          seatRow: 1,
          seatColumn: 1,
          seatNumber: 'R101-001',
          center: { id: CENTER_ID, name: 'Main Center', code: 'MAIN', address: 'Campus Road' },
          room: { id: ROOM_ID, name: 'Room 101', code: 'R101' },
          student: { id: STUDENT_ID, fullName: 'Student A', admissionNo: 'ADM-001', rollNo: '1', class: { name: 'Class 1' }, section: { name: 'A' } },
        }
      : null,
  );

  try {
    await assert.rejects(
      () => buildHallTicketPdf(req, SCHOOL_A_ID, EXAM_ID, STUDENT_ID),
      (error: unknown) => error instanceof HttpError && error.statusCode === 400 && /seating allocation/.test(error.message),
    );
    allocationEnabled = true;
    const pdf = await buildHallTicketPdf(req, SCHOOL_A_ID, EXAM_ID, STUDENT_ID);
    assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
    assert.ok(pdf.length > 500);
  } finally {
    restoreAllocation();
    restoreExam();
    restoreSecurityTestDependencies();
  }
});

test('exam seating generation requires force before replacing existing allocations', async () => {
  patchSecurityTestDependencies();
  const restoreExam = patch(prisma.exam as any, 'findFirst', async () => ({
    id: EXAM_ID,
    schoolId: SCHOOL_A_ID,
    name: 'Mid Term',
    classId: TEST_CLASS_A_ID,
    sectionId: TEST_SECTION_A_ID,
    scheduledAt: new Date('2026-06-10T04:30:00.000Z'),
    papers: [],
    class: { id: TEST_CLASS_A_ID, name: 'Class 1' },
    section: { id: TEST_SECTION_A_ID, name: 'A' },
    academicYear: { id: TEST_ACADEMIC_YEAR_A_ID, name: '2026-2027' },
    school: { id: SCHOOL_A_ID, name: 'School A' },
  }));
  const restoreSeatingCount = patch(prisma.examSeatingAllocation as any, 'count', async () => 1);
  const restoreRooms = patch(prisma.examRoom as any, 'findMany', async () => [
    { id: 'room-a', schoolId: SCHOOL_A_ID, centerId: 'center-a', name: 'Room A', code: 'RA', capacity: 2, rows: 1, columns: 2, center: { id: 'center-a', name: 'Center A', code: 'CA' } },
  ]);
  const restoreStudents = patch(prisma.student as any, 'findMany', async () => [
    { id: STUDENT_ID, admissionNo: 'ADM-001', rollNo: '1', fullName: 'Student A' },
  ]);

  try {
    await assert.rejects(
      () => generateExamSeating({} as any, SCHOOL_A_ID, EXAM_ID, {}),
      (error: unknown) => error instanceof HttpError && error.statusCode === 409 && /Seating already exists/.test(error.message),
    );
  } finally {
    restoreStudents();
    restoreRooms();
    restoreSeatingCount();
    restoreExam();
    restoreSecurityTestDependencies();
  }
});

test('exam seating generation allocates students deterministically by room grid', async () => {
  patchSecurityTestDependencies();
  const createdRows: any[] = [];
  const students = [
    { id: STUDENT_ID, admissionNo: 'ADM-001', rollNo: '1', fullName: 'Student A', class: { name: 'Class 1' }, section: { name: 'A' } },
    { id: '70707070-7070-4707-8707-707070707070', admissionNo: 'ADM-002', rollNo: '2', fullName: 'Student B', class: { name: 'Class 1' }, section: { name: 'A' } },
  ];
  const rooms = [
    { id: 'room-a', schoolId: SCHOOL_A_ID, centerId: 'center-a', name: 'Room A', code: 'RA', capacity: 2, rows: 1, columns: 2, center: { id: 'center-a', name: 'Center A', code: 'CA' } },
  ];
  const restoreExam = patch(prisma.exam as any, 'findFirst', async () => ({
    id: EXAM_ID,
    schoolId: SCHOOL_A_ID,
    name: 'Mid Term',
    classId: TEST_CLASS_A_ID,
    sectionId: TEST_SECTION_A_ID,
    scheduledAt: new Date('2026-06-10T04:30:00.000Z'),
    papers: [],
    class: { id: TEST_CLASS_A_ID, name: 'Class 1' },
    section: { id: TEST_SECTION_A_ID, name: 'A' },
    academicYear: { id: TEST_ACADEMIC_YEAR_A_ID, name: '2026-2027' },
    school: { id: SCHOOL_A_ID, name: 'School A' },
  }));
  const restoreSeatingCount = patch(prisma.examSeatingAllocation as any, 'count', async () => 0);
  const restoreRooms = patch(prisma.examRoom as any, 'findMany', async () => rooms);
  const restoreStudents = patch(prisma.student as any, 'findMany', async () => students);
  const restoreSeatingFindMany = patch(prisma.examSeatingAllocation as any, 'findMany', async () =>
    createdRows.map((row, index) => ({
      id: `seat-${index + 1}`,
      ...row,
      center: rooms[0].center,
      room: rooms[0],
      student: students.find((student) => student.id === row.studentId),
    })),
  );
  const restoreTransaction = patch(prisma as any, '$transaction', async (callback: any) =>
    callback({
      examSeatingAllocation: {
        deleteMany: async () => undefined,
        createMany: async ({ data }: any) => {
          createdRows.push(...data);
          return { count: data.length };
        },
      },
    }),
  );

  try {
    const result = await generateExamSeating({} as any, SCHOOL_A_ID, EXAM_ID, {});
    assert.equal(result.summary.allocated, 2);
    assert.deepEqual(
      createdRows.map((row) => ({ studentId: row.studentId, seatNumber: row.seatNumber, seatRow: row.seatRow, seatColumn: row.seatColumn })),
      [
        { studentId: STUDENT_ID, seatNumber: 'RA-001', seatRow: 1, seatColumn: 1 },
        { studentId: '70707070-7070-4707-8707-707070707070', seatNumber: 'RA-002', seatRow: 1, seatColumn: 2 },
      ],
    );
  } finally {
    restoreTransaction();
    restoreSeatingFindMany();
    restoreStudents();
    restoreRooms();
    restoreSeatingCount();
    restoreExam();
    restoreSecurityTestDependencies();
  }
});

test('exam invigilator assignment rejects a second invigilator for the same room', async () => {
  patchSecurityTestDependencies();
  const slot = new Date('2026-06-10T04:30:00.000Z');
  const restoreExam = patch(prisma.exam as any, 'findFirst', async () => ({
    id: EXAM_ID,
    schoolId: SCHOOL_A_ID,
    name: 'Mid Term',
    scheduledAt: null,
    papers: [{ id: PAPER_ID, scheduledAt: slot, subject: { id: SUBJECT_ID, name: 'English' } }],
    class: null,
    section: null,
    academicYear: null,
    school: { id: SCHOOL_A_ID, name: 'School A' },
  }));
  const restoreRoom = patch(prisma.examRoom as any, 'findFirst', async () => ({
    id: 'room-a',
    schoolId: SCHOOL_A_ID,
    centerId: 'center-a',
    name: 'Room A',
    code: 'RA',
    isActive: true,
  }));
  const restoreInvigilatorFindFirst = patch(prisma.examInvigilatorAssignment as any, 'findFirst', async ({ where }: any) => {
    if (where?.OR) return null;
    if (where?.teacherId) return null;
    if (where?.roomId) return { id: 'assignment-existing', schoolId: SCHOOL_A_ID, examId: EXAM_ID, examPaperId: PAPER_ID, roomId: where.roomId };
    return null;
  });

  try {
    await assert.rejects(
      () => assignExamInvigilator({} as any, SCHOOL_A_ID, EXAM_ID, { examPaperId: PAPER_ID, teacherId: TEST_STAFF_PROFILE_A_ID, roomId: 'room-a' }),
      (error: unknown) => error instanceof HttpError && error.statusCode === 409 && /Room already has an invigilator for this paper/.test(error.message),
    );
  } finally {
    restoreInvigilatorFindFirst();
    restoreRoom();
    restoreExam();
    restoreSecurityTestDependencies();
  }
});

test('restore request can be rejected and audit context remains platform scoped', async () => {
  patchSecurityTestDependencies();
  seedSecurityUsers();
  const restoreFindFirst = patch(prisma.restoreJob as any, 'findFirst', async () => restoreRow('REQUESTED'));
  const restoreUpdate = patch(prisma.restoreJob as any, 'update', async ({ data }: any) => ({
    ...restoreRow(data.status),
    ...data,
    updatedAt: new Date('2026-06-04T00:05:00.000Z'),
  }));

  const response = makeResponse();
  try {
    await rejectRestore({
      auth: { userId: SUPER_ADMIN_ID, schoolId: null, role: 'SUPER_ADMIN' },
      params: { id: RESTORE_ID },
      body: { reason: 'Insufficient approval evidence' },
      query: {},
    } as any, response as any);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.status, 'REJECTED');
    assert.equal(response.body.scope, 'PLATFORM');
  } finally {
    restoreUpdate();
    restoreFindFirst();
    restoreSecurityTestDependencies();
  }
});

test('production restore run is blocked without explicit restore flag', async () => {
  patchSecurityTestDependencies();
  seedSecurityUsers();
  const restoreEnv = patch(env, 'NODE_ENV', 'production');
  const originalAllowRestore = process.env.ALLOW_PRODUCTION_RESTORE;
  delete process.env.ALLOW_PRODUCTION_RESTORE;
  const restoreFindUnique = patch(prisma.restoreJob as any, 'findUnique', async () => ({
    ...restoreRow('APPROVED'),
    approvedById: SCHOOL_ADMIN_A_ID,
    approvedBy: { id: SCHOOL_ADMIN_A_ID, email: 'school-admin@test.local' },
  }));

  const response = makeResponse();
  try {
    await assert.rejects(
      () =>
        runRestore({
          auth: { userId: SUPER_ADMIN_ID, schoolId: null, role: 'SUPER_ADMIN' },
          params: { id: RESTORE_ID },
          body: {},
          query: {},
        } as any, response as any),
      (error: unknown) => error instanceof HttpError && error.statusCode === 403 && /Production restore requires/.test(error.message),
    );
  } finally {
    if (originalAllowRestore === undefined) {
      delete process.env.ALLOW_PRODUCTION_RESTORE;
    } else {
      process.env.ALLOW_PRODUCTION_RESTORE = originalAllowRestore;
    }
    restoreFindUnique();
    restoreEnv();
    restoreSecurityTestDependencies();
  }
});

const patchOnboardingStore = () => {
  const rows = new Map<string, any>();
  const restoreFindMany = patch(prisma.schoolOnboardingChecklist as any, 'findMany', async ({ where }: any = {}) =>
    Array.from(rows.values()).filter((row) => !where?.schoolId || row.schoolId === where.schoolId),
  );
  const restoreFindUnique = patch(prisma.schoolOnboardingChecklist as any, 'findUnique', async ({ where }: any = {}) =>
    rows.get(`${where?.schoolId_key?.schoolId}:${where?.schoolId_key?.key}`) ?? null,
  );
  const restoreUpsert = patch(prisma.schoolOnboardingChecklist as any, 'upsert', async ({ where, create, update }: any) => {
    const mapKey = `${where.schoolId_key.schoolId}:${where.schoolId_key.key}`;
    const previous = rows.get(mapKey);
    const row = {
      id: previous?.id ?? `${ONBOARDING_ROW_ID}-${rows.size}`,
      createdAt: previous?.createdAt ?? new Date('2026-06-04T00:00:00.000Z'),
      updatedAt: new Date('2026-06-04T00:01:00.000Z'),
      ...(previous ? { ...previous, ...update } : create),
    };
    rows.set(mapKey, row);
    return row;
  });
  return () => {
    restoreUpsert();
    restoreFindUnique();
    restoreFindMany();
  };
};

const patchOnboardingReadinessSignals = (ready: boolean) => {
  let onboardingStatus = 'DRAFT';
  const restores = [
    patch(prisma.school as any, 'findUnique', async ({ where }: any) => ({
      id: where.id,
      name: where.id === SCHOOL_B_ID ? 'School B' : 'School A',
      code: where.id === SCHOOL_B_ID ? 'SCHB' : 'SCHA',
      status: 'ACTIVE',
      onboardingStatus,
      deletedAt: null,
      statusReason: null,
    })),
    patch(prisma.academicYear as any, 'count', async () => ready ? 1 : 0),
    patch(prisma.class as any, 'count', async () => ready ? 1 : 0),
    patch(prisma.section as any, 'count', async () => ready ? 1 : 0),
    patch(prisma.subject as any, 'count', async () => ready ? 1 : 0),
    patch(prisma.teacherProfile as any, 'count', async () => ready ? 1 : 0),
    patch(prisma.classTeacher as any, 'count', async () => ready ? 1 : 0),
    patch(prisma.assignSubject as any, 'count', async () => ready ? 1 : 0),
    patch(prisma.attendancePeriod as any, 'count', async () => ready ? 1 : 0),
    patch(prisma.classRoom as any, 'count', async () => ready ? 1 : 0),
    patch(prisma.schoolMessagingConfig as any, 'count', async () => ready ? 1 : 0),
    patch(prisma.student as any, 'count', async () => ready ? 1 : 0),
    patch(prisma.studentParent as any, 'count', async () => ready ? 1 : 0),
    patch(prisma.user as any, 'findFirst', async () => ready ? { mustChangePassword: false } : null),
    patch(prisma.school as any, 'update', async ({ where, data, select }: any) => {
      onboardingStatus = data.onboardingStatus ?? onboardingStatus;
      return {
        id: where.id,
        name: where.id === SCHOOL_B_ID ? 'School B' : 'School A',
        code: where.id === SCHOOL_B_ID ? 'SCHB' : 'SCHA',
        onboardingStatus,
        ...(select ? {} : data),
      };
    }),
  ];
  return () => restores.reverse().forEach((restore) => restore());
};

test('school onboarding recalculation completes checklist and writes audit log', async () => {
  patchSecurityTestDependencies();
  seedSecurityUsers();
  const restoreStore = patchOnboardingStore();
  const restoreSignals = patchOnboardingReadinessSignals(true);
  let auditCount = 0;
  const restoreAudit = patch(prisma.auditLog as any, 'create', async ({ data }: any) => {
    auditCount += 1;
    return { id: `audit-${auditCount}`, ...data };
  });

  try {
    const result = await recalculateSchoolOnboarding(SCHOOL_A_ID, {
      userId: SCHOOL_ADMIN_A_ID,
      role: 'SCHOOL_ADMIN',
      schoolId: SCHOOL_A_ID,
    });

    assert.equal(result.summary.requiredIncomplete, 0);
    assert.equal(result.school.onboardingStatus, 'READY_FOR_REVIEW');
    assert.ok(auditCount >= 1);
  } finally {
    restoreAudit();
    restoreSignals();
    restoreStore();
    restoreSecurityTestDependencies();
  }
});

test('school onboarding go-live blocks incomplete setup unless Super Admin gives override reason', async () => {
  patchSecurityTestDependencies();
  seedSecurityUsers();
  const restoreStore = patchOnboardingStore();
  const restoreSignals = patchOnboardingReadinessSignals(false);

  try {
    await assert.rejects(
      () => activateSchoolOnboarding(SCHOOL_A_ID, { userId: SUPER_ADMIN_ID, role: 'SUPER_ADMIN', schoolId: null }),
      (error: unknown) => error instanceof HttpError && error.statusCode === 409,
    );
    await assert.rejects(
      () => activateSchoolOnboarding(SCHOOL_A_ID, { userId: SUPER_ADMIN_ID, role: 'SUPER_ADMIN', schoolId: null }, null, true),
      (error: unknown) => error instanceof HttpError && error.statusCode === 409,
    );

    const result = await activateSchoolOnboarding(
      SCHOOL_A_ID,
      { userId: SUPER_ADMIN_ID, role: 'SUPER_ADMIN', schoolId: null },
      'Approved with manual verification',
      true,
    );
    assert.equal(result.school.onboardingStatus, 'ACTIVE');
  } finally {
    restoreSignals();
    restoreStore();
    restoreSecurityTestDependencies();
  }
});

test('school onboarding rejects cross-tenant School Admin access', async () => {
  patchSecurityTestDependencies();
  seedSecurityUsers();
  const restoreStore = patchOnboardingStore();
  const restoreSignals = patchOnboardingReadinessSignals(true);

  try {
    await assert.rejects(
      () => recalculateSchoolOnboarding(SCHOOL_B_ID, { userId: SCHOOL_ADMIN_A_ID, role: 'SCHOOL_ADMIN', schoolId: SCHOOL_A_ID }),
      (error: unknown) => error instanceof HttpError && error.statusCode === 403,
    );
  } finally {
    restoreSignals();
    restoreStore();
    restoreSecurityTestDependencies();
  }
});

const patchTeacherOnboardingStore = () => {
  let row: any = null;
  const restoreFindUnique = patch(prisma.teacherOnboarding as any, 'findUnique', async () => row);
  const restoreUpsert = patch(prisma.teacherOnboarding as any, 'upsert', async ({ create, update }: any) => {
    row = {
      id: row?.id ?? TEACHER_ONBOARDING_ID,
      createdAt: row?.createdAt ?? new Date('2026-06-04T00:00:00.000Z'),
      updatedAt: new Date('2026-06-04T00:01:00.000Z'),
      ...(row ? { ...row, ...update } : create),
    };
    return row;
  });
  const restoreUpdate = patch(prisma.teacherOnboarding as any, 'update', async ({ data }: any) => {
    row = { ...(row ?? { id: TEACHER_ONBOARDING_ID, schoolId: SCHOOL_A_ID, teacherId: TEST_STAFF_PROFILE_A_ID }), ...data, updatedAt: new Date('2026-06-04T00:02:00.000Z') };
    return row;
  });
  return () => {
    restoreUpdate();
    restoreUpsert();
    restoreFindUnique();
  };
};

const patchTeacherReadinessSignals = (ready: boolean) => {
  const restores = [
    patch(prisma.teacherClassAssignment as any, 'count', async () => ready ? 1 : 0),
    patch(prisma.teacherSubjectAssignment as any, 'count', async () => ready ? 1 : 0),
    patch(timetableReadService as any, 'getTeacherTimetable', async () => ({ slots: ready ? [{ sourceId: 'slot-1' }] : [] })),
    patch(prisma.teacherSelfAttendance as any, 'count', async () => ready ? 1 : 0),
  ];
  return () => restores.reverse().forEach((restore) => restore());
};

test('teacher onboarding recalculates readiness from assignments and audit logs action', async () => {
  patchSecurityTestDependencies();
  seedSecurityUsers();
  const restoreStore = patchTeacherOnboardingStore();
  const restoreSignals = patchTeacherReadinessSignals(true);
  let auditCount = 0;
  const restoreAudit = patch(prisma.auditLog as any, 'create', async ({ data }: any) => {
    auditCount += 1;
    return { id: `teacher-audit-${auditCount}`, ...data };
  });

  try {
    const result = await recalculateTeacherOnboarding(SCHOOL_A_ID, TEST_STAFF_PROFILE_A_ID, {
      userId: SCHOOL_ADMIN_A_ID,
      role: 'SCHOOL_ADMIN',
      schoolId: SCHOOL_A_ID,
    });
    assert.equal(result.readinessStatus, 'READY');
    assert.equal(result.classAssigned, true);
    assert.equal(result.subjectAssigned, true);
    assert.ok(auditCount >= 1);
  } finally {
    restoreAudit();
    restoreSignals();
    restoreStore();
    restoreSecurityTestDependencies();
  }
});

test('teacher onboarding cannot be marked ready without required assignments', async () => {
  patchSecurityTestDependencies();
  seedSecurityUsers();
  const restoreStore = patchTeacherOnboardingStore();
  const restoreSignals = patchTeacherReadinessSignals(false);

  try {
    await recalculateTeacherOnboarding(SCHOOL_A_ID, TEST_STAFF_PROFILE_A_ID, {
      userId: SCHOOL_ADMIN_A_ID,
      role: 'SCHOOL_ADMIN',
      schoolId: SCHOOL_A_ID,
    });
    await assert.rejects(
      () =>
        updateTeacherOnboarding(
          SCHOOL_A_ID,
          TEST_STAFF_PROFILE_A_ID,
          { readinessStatus: 'READY' },
          { userId: SCHOOL_ADMIN_A_ID, role: 'SCHOOL_ADMIN', schoolId: SCHOOL_A_ID },
        ),
      (error: unknown) => error instanceof HttpError && error.statusCode === 409,
    );
  } finally {
    restoreSignals();
    restoreStore();
    restoreSecurityTestDependencies();
  }
});

test('teacher credential manual share requires note and updates readiness state', async () => {
  patchSecurityTestDependencies();
  seedSecurityUsers();
  const restoreStore = patchTeacherOnboardingStore();
  const restoreSignals = patchTeacherReadinessSignals(true);

  try {
    await assert.rejects(
      () => confirmTeacherCredentialManualShare(SCHOOL_A_ID, TEST_STAFF_PROFILE_A_ID, '', { userId: SCHOOL_ADMIN_A_ID, role: 'SCHOOL_ADMIN', schoolId: SCHOOL_A_ID }),
      (error: unknown) => error instanceof HttpError && error.statusCode === 400,
    );
    const result = await confirmTeacherCredentialManualShare(
      SCHOOL_A_ID,
      TEST_STAFF_PROFILE_A_ID,
      'Shared credentials in person after ID verification',
      { userId: SCHOOL_ADMIN_A_ID, role: 'SCHOOL_ADMIN', schoolId: SCHOOL_A_ID },
    );
    assert.equal(result.manualShareConfirmed, true);
    assert.equal(result.temporaryPasswordShared, true);
  } finally {
    restoreSignals();
    restoreStore();
    restoreSecurityTestDependencies();
  }
});

test('teacher onboarding rejects cross-tenant School Admin access', async () => {
  patchSecurityTestDependencies();
  seedSecurityUsers();
  const restoreStore = patchTeacherOnboardingStore();
  const restoreSignals = patchTeacherReadinessSignals(true);

  try {
    await assert.rejects(
      () => recalculateTeacherOnboarding(SCHOOL_B_ID, TEST_STAFF_PROFILE_A_ID, { userId: SCHOOL_ADMIN_A_ID, role: 'SCHOOL_ADMIN', schoolId: SCHOOL_A_ID }),
      (error: unknown) => error instanceof HttpError && error.statusCode === 403,
    );
  } finally {
    restoreSignals();
    restoreStore();
    restoreSecurityTestDependencies();
  }
});
