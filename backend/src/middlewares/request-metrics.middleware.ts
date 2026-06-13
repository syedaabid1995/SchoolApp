import type { NextFunction, Request, Response } from 'express';
import { metricsRegistry } from '../services/observability/metrics.service';
import { recordTraceEvent, runWithTraceContext } from '../telemetry';

type RequestWithAuth = Request & {
  auth?: {
    schoolId?: string | null;
  };
};

const resolveRouteLabel = (req: Request) => {
  const routePath = typeof req.route?.path === 'string' ? req.route.path : undefined;
  if (routePath) {
    return `${req.baseUrl ?? ''}${routePath}`;
  }
  return req.originalUrl.split('?')[0] || req.path;
};

const resolveSchoolId = (req: RequestWithAuth) => {
  if (req.auth?.schoolId) return req.auth.schoolId;
  if (typeof req.query.schoolId === 'string') return req.query.schoolId;
  if (typeof req.headers['x-school-id'] === 'string') return req.headers['x-school-id'];
  return 'unknown';
};

export const requestMetricsMiddleware = (req: RequestWithAuth, res: Response, next: NextFunction) => {
  runWithTraceContext('http.request', {
    method: req.method,
    route: req.originalUrl.split('?')[0] || req.path,
  }, () => {
    const startedAt = process.hrtime.bigint();

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const route = resolveRouteLabel(req);
      const labels = {
        route,
        method: req.method,
        schoolId: resolveSchoolId(req),
        statusCode: res.statusCode,
      };

      metricsRegistry.increment('http_requests_total', 'Total HTTP requests processed.', {
        route,
        method: req.method,
        schoolId: labels.schoolId,
      });
      metricsRegistry.increment('http_responses_total', 'Total HTTP responses by status code.', labels);
      metricsRegistry.observe('http_request_duration_ms', 'HTTP request duration in milliseconds.', labels, durationMs);
      recordTraceEvent('request', 'http.response', {
        route,
        method: req.method,
        statusCode: res.statusCode,
        durationMs,
      });

      if (res.statusCode >= 500) {
        metricsRegistry.increment('http_errors_total', 'Total HTTP error responses.', labels);
      }
    });

    next();
  });
};
