import pino from 'pino';
import { env } from './env';

const isDev = env.NODE_ENV !== 'production';
const SENSITIVE_KEY_PATTERN =
  /(password|pass|token|accessToken|refreshToken|authorization|cookie|jwt|secret|apiKey|privateKey|DATABASE_URL|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|S3|session|credential)/i;
const REDACTED = '[REDACTED]';

const redactString = (value: string) =>
  value
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${REDACTED}`)
    .replace(/postgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@/gi, 'postgresql://[REDACTED]@')
    .replace(/redis:\/\/[^:\s]+:[^@\s]+@/gi, 'redis://[REDACTED]@')
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, REDACTED)
    .replace(/-----BEGIN (?:RSA |EC |OPENSSH |)?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |)?PRIVATE KEY-----/g, REDACTED);

export const redactSensitive = (value: unknown, seen = new WeakSet<object>()): unknown => {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactString(value);
  if (typeof value !== 'object') return value;
  if (value instanceof Date) return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (value instanceof Error) {
    return {
      type: value.name,
      message: redactString(value.message),
      stack: value.stack ? redactString(value.stack) : undefined,
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, seen));
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : redactSensitive(item, seen),
    ]),
  );
};

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'password',
      'pass',
      'token',
      'accessToken',
      'refreshToken',
      'authorization',
      'cookie',
      'jwt',
      'secret',
      'apiKey',
      'privateKey',
      'DATABASE_URL',
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
      'session',
      'credentials',
      'req.headers.authorization',
      'req.headers.cookie',
      'headers.authorization',
      'headers.cookie',
    ],
    censor: REDACTED,
  },
  hooks: {
    logMethod(args, method) {
      method.apply(this, args.map((arg) => redactSensitive(arg)));
    },
  },
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard' },
      }
    : undefined,
});
