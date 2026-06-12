import type { Request, Response } from 'express';
import { z } from 'zod';
import { resolveSchoolId } from '../utils/tenant';
import { logAudit } from '../utils/audit';
import { HttpError } from '../middlewares/error.middleware';
import { PermissionCodes as P } from '../permissions/permission-manifest';
import { AuthorizationService } from '../services/authorization.service';
import {
  generateTermReport,
  generateAnnualReport,
  generateRankCard,
  getReportData,
  getReportDefinition,
  listReportCatalog,
  toCsv,
  toReportPdf,
} from '../services/report.service';
import type { ReportQuery } from '../services/report.service';

const termSchema = z.object({
  studentId: z.string().uuid(),
  termId: z.string().uuid(),
  schoolId: z.string().uuid().optional(),
});

const annualSchema = z.object({
  studentId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  schoolId: z.string().uuid().optional(),
});

const rankSchema = z.object({
  examId: z.string().uuid(),
  studentId: z.string().uuid(),
  schoolId: z.string().uuid().optional(),
});

const reportQuerySchema = z.object({
  schoolId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  teacherId: z.string().uuid().optional(),
  examId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  status: z.string().trim().min(1).max(60).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

const exportQuerySchema = reportQuerySchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(2000).default(1000),
});

const buildReportQuery = (req: Request, forExport = false) => {
  const payload = (forExport ? exportQuerySchema : reportQuerySchema).parse(req.query);
  if (payload.fromDate && payload.toDate && payload.fromDate > payload.toDate) {
    throw new HttpError(400, 'fromDate must be before toDate');
  }
  const schoolId = resolveSchoolId(req, payload.schoolId);
  return { ...payload, schoolId, page: payload.page ?? 1, pageSize: payload.pageSize ?? (forExport ? 1000 : 25) } satisfies ReportQuery;
};

const filenameFor = (reportKey: string, extension: string) => `${reportKey.replace(/[^a-z0-9_.-]/gi, '-')}.${extension}`;

const managedRoles = new Set(['SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'STAFF']);

const requireReportPermission = async (req: Request, reportKey: string, options?: { export?: boolean }) => {
  const report = getReportDefinition(reportKey);
  if (!req.auth?.schoolId || req.auth.role === 'SUPER_ADMIN' || !managedRoles.has(req.auth.role ?? '')) return report;

  const required = [report.permission, ...(options?.export ? [P.reportsExport] : [])];
  const permissionCodes = await AuthorizationService.getEffectivePermissionCodesForUser(req.auth.schoolId, req.auth.userId, req.auth.role);
  const missing = required.find((code) => !permissionCodes.includes(code));
  if (missing) {
    throw new HttpError(403, `Missing required report permission: ${missing}`);
  }
  return report;
};

export const listReportCatalogApi = async (req: Request, res: Response) => {
  if (req.auth?.schoolId) resolveSchoolId(req, req.query.schoolId as string | undefined);
  res.status(200).json({ reports: listReportCatalog() });
};

export const getReportApi = async (req: Request, res: Response) => {
  const query = buildReportQuery(req);
  const report = await requireReportPermission(req, req.params.reportKey);
  const result = await getReportData(req.params.reportKey, query);
  res.status(200).json({
    report,
    rows: result.rows,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / query.pageSize),
    },
  });
};

export const exportReportCsvApi = async (req: Request, res: Response) => {
  const query = buildReportQuery(req, true);
  const report = await requireReportPermission(req, req.params.reportKey, { export: true });
  const result = await getReportData(req.params.reportKey, query);
  await logAudit(req, {
    schoolId: query.schoolId,
    entityType: 'REPORT_EXPORT',
    entityId: req.params.reportKey,
    action: 'EXPORT_CSV',
    afterState: { reportKey: req.params.reportKey, rows: result.rows.length },
  });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filenameFor(req.params.reportKey, 'csv')}"`);
  res.status(200).send(toCsv(report.columns, result.rows));
};

export const exportReportPdfApi = async (req: Request, res: Response) => {
  const query = buildReportQuery(req, true);
  const report = await requireReportPermission(req, req.params.reportKey, { export: true });
  const result = await getReportData(req.params.reportKey, query);
  const buffer = await toReportPdf({ schoolId: query.schoolId, report, rows: result.rows, filters: req.query });
  await logAudit(req, {
    schoolId: query.schoolId,
    entityType: 'REPORT_EXPORT',
    entityId: req.params.reportKey,
    action: 'EXPORT_PDF',
    afterState: { reportKey: req.params.reportKey, rows: result.rows.length },
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filenameFor(req.params.reportKey, 'pdf')}"`);
  res.status(200).send(buffer);
};

export const downloadTermReport = async (req: Request, res: Response) => {
  const payload = termSchema.parse(req.query);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  const buffer = await generateTermReport({
    schoolId,
    studentId: payload.studentId,
    termId: payload.termId,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="term-report.pdf"');
  res.status(200).send(buffer);
};

export const downloadAnnualReport = async (req: Request, res: Response) => {
  const payload = annualSchema.parse(req.query);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  const buffer = await generateAnnualReport({
    schoolId,
    studentId: payload.studentId,
    academicYearId: payload.academicYearId,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="annual-report.pdf"');
  res.status(200).send(buffer);
};

export const downloadRankCard = async (req: Request, res: Response) => {
  const payload = rankSchema.parse(req.query);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  const buffer = await generateRankCard({
    schoolId,
    examId: payload.examId,
    studentId: payload.studentId,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="rank-card.pdf"');
  res.status(200).send(buffer);
};
