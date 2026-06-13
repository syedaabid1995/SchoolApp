import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { env } from './config/env';
import { logger } from './config/logger';

type TraceAttributes = Record<string, string | number | boolean | null | undefined>;
type TraceContext = {
  traceId: string;
  name: string;
  attributes: TraceAttributes;
  startedAt: bigint;
};

const durationMsSince = (startedAt: bigint) => Number(process.hrtime.bigint() - startedAt) / 1_000_000;
const traceStorage = new AsyncLocalStorage<TraceContext>();

export const initializeTelemetry = () => {
  if (!env.OTEL_ENABLED) {
    logger.debug('opentelemetry disabled');
    return;
  }

  logger.info(
    {
      serviceName: env.OTEL_SERVICE_NAME,
    },
    'opentelemetry foundation enabled',
  );
};

export const getTraceContext = () => traceStorage.getStore();

export const runWithTraceContext = <T>(
  name: string,
  attributes: TraceAttributes,
  operation: () => T,
): T => {
  if (!env.OTEL_ENABLED) {
    return operation();
  }

  const context: TraceContext = {
    traceId: randomUUID(),
    name,
    attributes,
    startedAt: process.hrtime.bigint(),
  };

  logger.debug({ traceId: context.traceId, trace: name, ...attributes }, 'trace context start');
  return traceStorage.run(context, operation);
};

export const recordTraceEvent = (layer: string, name: string, attributes: TraceAttributes = {}) => {
  if (!env.OTEL_ENABLED) return;
  const context = getTraceContext();
  logger.debug(
    {
      traceId: context?.traceId ?? 'unscoped',
      rootTrace: context?.name,
      layer,
      trace: name,
      elapsedMs: context ? durationMsSince(context.startedAt) : undefined,
      ...attributes,
    },
    'trace event',
  );
};

export const withTrace = async <T>(
  name: string,
  operation: () => Promise<T>,
  attributes: TraceAttributes = {},
): Promise<T> => {
  if (!env.OTEL_ENABLED) {
    return operation();
  }

  const context = getTraceContext();
  const startedAt = process.hrtime.bigint();
  logger.debug({ traceId: context?.traceId, trace: name, ...attributes }, 'trace start');

  try {
    const result = await operation();
    logger.debug({ traceId: context?.traceId, trace: name, durationMs: durationMsSince(startedAt), ...attributes }, 'trace end');
    return result;
  } catch (err) {
    logger.error({ traceId: context?.traceId, trace: name, durationMs: durationMsSince(startedAt), err, ...attributes }, 'trace error');
    throw err;
  }
};
