// Test deployment - updated for CI/CD testing v2
import 'express-async-errors';
import express, { type Request, type Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import { logger } from './config/logger';
import { env } from './config/env';
import { errorMiddleware, notFoundMiddleware } from './middlewares/error.middleware';
import { authMiddleware } from './middlewares/auth.middleware';
import { writeOperationGuard } from './middlewares/subscriptionGuard.middleware';
import { authRouter } from './routes/auth.routes';
import { academicRouter } from './routes/academic.routes';
import { studentRouter } from './routes/student.routes';
import { importRouter } from './routes/import.routes';
import { faceRouter } from './routes/face.routes';
import { recognitionRouter } from './routes/recognition.routes';
import { attendanceRouter } from './routes/attendance.routes';
import { evidenceRouter } from './routes/evidence.routes';
import { examRouter } from './routes/exam.routes';
import { reportRouter } from './routes/report.routes';
import { themeRouter } from './routes/theme.routes';
import { featureFlagRouter } from './routes/feature-flag.routes';
import { jobRouter } from './routes/job.routes';
import { notificationRouter } from './routes/notification.routes';
import { backupRouter } from './routes/backup.routes';
import { attendanceApprovalRouter } from './routes/attendanceApproval.routes';
import { adminAuditExportRouter, adminAuditLogRouter, auditLogRouter } from './routes/auditLog.routes';
import { teacherAssignmentRouter } from './routes/teacherAssignment.routes';
import { adminSubscriptionRouter, subscriptionRouter } from './routes/subscription.routes';
import { otpRouter } from './routes/otp.routes';
import { consentRouter } from './routes/consent.routes';
import { adminDataComplianceRouter, dataComplianceRouter } from './routes/dataCompliance.routes';
import { adminSupportRouter, ticketRouter } from './routes/ticket.routes';
import { analyticsRouter } from './routes/analytics.routes';
import { schoolAdminRouter } from './routes/schoolAdmin.routes';
import { subscriptionMetricsRouter } from './routes/subscriptionMetrics.routes';
import { subscriptionPlanRouter } from './routes/subscriptionPlan.routes';
import { teacherRouter } from './routes/teacher.routes';
import { attendanceSummaryRouter } from './routes/attendanceSummary.routes';
import { adminDashboardRouter } from './routes/adminDashboard.routes';
import { adminSystemRouter } from './routes/adminSystem.routes';
import { adminUserRouter } from './routes/adminUser.routes';
import { userRouter } from './routes/user.routes';
import { parentPortalRouter } from './routes/parentPortal.routes';
import { leaveRouter } from './routes/leave.routes';
import { uploadRouter } from './routes/upload.routes';
import { messagingAdminRouter } from './routes/messagingAdmin.routes';
import { messagingSettingsRouter } from './routes/messagingSettings.routes';
import { publicBrandingRouter } from './routes/publicBranding.routes';
import { rateLimit } from './middlewares/rate-limit.middleware';
import { apiVersionMiddleware } from './middlewares/version.middleware';

export const createApp = () => {
  const app = express();
  const openapiPath = path.resolve(process.cwd(), 'openapi.yaml');
  const openapiSpec = YAML.load(openapiPath);
  const allowedOrigins = env.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowAllOrigins = env.NODE_ENV !== 'production' || allowedOrigins.includes('*');

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          fontSrc: ["'self'", 'https:', 'data:'],
          formAction: ["'self'"],
          frameAncestors: ["'self'"],
          imgSrc: ["'self'", 'data:', 'http://127.0.0.1:3000', 'http://localhost:3000'],
          objectSrc: ["'none'"],
          scriptSrc: ["'self'"],
          scriptSrcAttr: ["'none'"],
          styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
          upgradeInsecureRequests: [],
        },
      },
    }),
  );
  app.use(
    cors({
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!origin || allowAllOrigins) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('Origin not allowed by CORS'));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: false, limit: '10mb' }));
  app.use(rateLimit());
  app.use(apiVersionMiddleware);

  app.get('/health', async (_req: Request, res: Response) => {
    try {
      // Check database connectivity
      const { prisma } = await import('./config/db');
      await prisma.$queryRaw`SELECT 1`;
      
      res.status(200).json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        database: 'connected',
        message: 'CI/CD Pipeline Test - Redis Integration Complete'
      });
    } catch (error) {
      res.status(503).json({ 
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

  app.use('/api/v1/public/branding', publicBrandingRouter);

  const isWriteMethod = (method: string) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  const skipWriteGuard = (pathName: string) =>
    pathName.startsWith('/auth') ||
    pathName.startsWith('/public') ||
    pathName.startsWith('/subscriptions') ||
    pathName.startsWith('/admin');

  app.use('/api/v1', (req, res, next) => {
    if (!isWriteMethod(req.method) || skipWriteGuard(req.path)) {
      return next();
    }

    return authMiddleware(req, res, (authError) => {
      if (authError) return next(authError);
      return writeOperationGuard(req, res, next);
    });
  });

  app.use('/api/v1/auth', authRouter);
  // Backward-compatible auth routes for clients still calling /api/auth/*
  app.use('/api/auth', authRouter);
  app.use('/api/v1/academics', academicRouter);
  app.use('/api/v1/students', studentRouter);
  app.use('/api/v1/imports', importRouter);
  app.use('/api/v1/faces', faceRouter);
  app.use('/api/v1/recognition', recognitionRouter);
  app.use('/api/v1/attendance', attendanceRouter);
  app.use('/api/v1/leave', leaveRouter);
  app.use('/api/v1/attendance/evidence', evidenceRouter);
  app.use('/api/v1/exams', examRouter);
  app.use('/api/v1/reports', reportRouter);
  app.use('/api/v1/themes', themeRouter);
  app.use('/api/v1/features', featureFlagRouter);
  app.use('/api/v1/jobs', jobRouter);
  app.use('/api/v1/notifications', notificationRouter);
  app.use('/api/v1/backups', backupRouter);
  app.use('/api/v1/attendance-approval', attendanceApprovalRouter);
  app.use('/api/v1/audit-logs', auditLogRouter);
  app.use('/api/v1/admin/audit-logs', adminAuditLogRouter);
  app.use('/api/v1/admin/audit-exports', adminAuditExportRouter);
  app.use('/api/v1/teacher-assignments', teacherAssignmentRouter);
  app.use('/api/v1/subscriptions', subscriptionRouter);
  app.use('/api/v1/admin/subscriptions', adminSubscriptionRouter);
  app.use('/api/v1/otp', otpRouter);
  app.use('/api/v1/consents', consentRouter);
  app.use('/api/v1/compliance', dataComplianceRouter);
  app.use('/api/v1/tickets', ticketRouter);
  app.use('/api/v1/analytics', analyticsRouter);
  app.use('/api/v1/admin/schools', schoolAdminRouter);
  app.use('/api/v1/admin/subscription-plans', subscriptionPlanRouter);
  app.use('/api/v1/admin/subscription-metrics', subscriptionMetricsRouter);
  app.use('/api/v1/admin', backupRouter);
  app.use('/api/v1/teachers', teacherRouter);
  app.use('/api/v1/attendance-summary', attendanceSummaryRouter);
  app.use('/api/v1/admin/dashboard', adminDashboardRouter);
  app.use('/api/v1/admin/users', adminUserRouter);
  app.use('/api/v1/admin/support', adminSupportRouter);
  app.use('/api/v1/admin/compliance', adminDataComplianceRouter);
  app.use('/api/v1/admin', adminSystemRouter);
  app.use('/api/v1/users', userRouter);
  app.use('/api/v1/parents/portal', parentPortalRouter);
  app.use('/api/v1/uploads', uploadRouter);
  app.use('/api/v1/admin/messaging-services', messagingAdminRouter);
  app.use('/api/v1/messaging-services', messagingSettingsRouter);
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
};

export const appLogger = logger;
