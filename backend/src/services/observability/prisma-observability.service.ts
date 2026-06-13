import type { PrismaClient } from '@prisma/client';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { getTraceContext, recordTraceEvent } from '../../telemetry';
import { metricsRegistry } from './metrics.service';

type PrismaMiddlewareParams = {
  model?: string;
  action?: string;
};

type PrismaMiddlewareNext = (params: PrismaMiddlewareParams) => Promise<unknown>;

type PrismaClientWithMiddleware = PrismaClient & {
  $use?: (middleware: (params: PrismaMiddlewareParams, next: PrismaMiddlewareNext) => Promise<unknown>) => void;
};

let registered = false;

export const registerPrismaObservability = (client: PrismaClient) => {
  if (registered) return;
  registered = true;

  const prismaWithMiddleware = client as PrismaClientWithMiddleware;
  if (typeof prismaWithMiddleware.$use !== 'function') {
    logger.warn('prisma middleware unavailable; query observability disabled');
    return;
  }

  prismaWithMiddleware.$use(async (params, next) => {
    const startedAt = process.hrtime.bigint();
    const labels = {
      model: params.model ?? 'raw',
      action: params.action ?? 'unknown',
    };

    try {
      return await next(params);
    } catch (err) {
      metricsRegistry.increment('prisma_query_errors_total', 'Total Prisma operation errors.', labels);
      throw err;
    } finally {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      metricsRegistry.observe('prisma_query_duration_ms', 'Prisma operation duration in milliseconds.', labels, durationMs);
      recordTraceEvent('prisma', `${labels.model}.${labels.action}`, {
        durationMs,
        slow: durationMs >= env.PRISMA_SLOW_QUERY_THRESHOLD_MS,
      });

      if (durationMs >= env.PRISMA_SLOW_QUERY_THRESHOLD_MS) {
        metricsRegistry.increment('prisma_slow_queries_total', 'Total slow Prisma operations.', labels);
        if (env.NODE_ENV !== 'test') {
          const traceContext = getTraceContext();
          logger.warn(
            {
              traceId: traceContext?.traceId,
              durationMs,
              thresholdMs: env.PRISMA_SLOW_QUERY_THRESHOLD_MS,
              model: labels.model,
              action: labels.action,
            },
            'slow prisma operation',
          );
        }
      }
    }
  });
};
