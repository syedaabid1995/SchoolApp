import dotenv from 'dotenv';
import { z } from 'zod';
import { assertSafeCorsConfig } from './cors';
import { assertSafeStorageConfig } from './storage';

dotenv.config();

const boolEnv = (defaultValue: boolean) =>
  z.preprocess((value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    if (typeof value === 'number') return value === 1;
    return defaultValue;
  }, z.boolean());

const optionalEnvString = () =>
  z.preprocess((value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }, z.string().min(1).optional());

const optionalUrlEnvString = () =>
  z.preprocess((value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }, z.string().url().optional());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  TOTP_ENCRYPTION_KEY: z.string().min(32).optional(),
  AUTH_TWO_STEP_ENABLED: boolEnv(false).default(false),
  OTP_EXPOSE_CODE_IN_DEV: boolEnv(false).default(false),
  REDIS_URL: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().min(1).default('gpt-4o-mini'),
  AI_ASSISTANT_ENABLED: boolEnv(false).default(false),
  AI_ASSISTANT_REQUIRE_CONFIRMATION: boolEnv(true).default(true),
  FRONTEND_URL: z.string().url().default('http://localhost:3001'),
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001,http://localhost:5173,http://127.0.0.1:5173,https://app.akacemify.com'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  ACADEMIFY_PROCESS_ROLE: z.enum(['api', 'worker', 'scheduler', 'all']).default(process.env.NODE_ENV === 'production' ? 'api' : 'all'),
  RUN_API: boolEnv(true).default(true),
  RUN_WORKERS: boolEnv(process.env.NODE_ENV !== 'production').default(process.env.NODE_ENV !== 'production'),
  RUN_SCHEDULERS: boolEnv(process.env.NODE_ENV !== 'production').default(process.env.NODE_ENV !== 'production'),
  SHUTDOWN_GRACE_MS: z.coerce.number().int().min(1000).max(120000).default(30000),
  STORAGE_DRIVER: z.enum(['local', 's3']).default(process.env.NODE_ENV === 'production' ? 's3' : 'local'),
  STORAGE_LOCAL_ROOT: z.string().min(1).default('storage/runtime'),
  STORAGE_LEGACY_LOCAL_UPLOADS_READ_ENABLED: boolEnv(process.env.NODE_ENV !== 'production').default(process.env.NODE_ENV !== 'production'),
  ALLOW_LOCAL_STORAGE_IN_PRODUCTION: boolEnv(false).default(false),
  S3_ENDPOINT: optionalUrlEnvString(),
  S3_REGION: optionalEnvString(),
  S3_BUCKET: optionalEnvString(),
  S3_ACCESS_KEY_ID: optionalEnvString(),
  S3_SECRET_ACCESS_KEY: optionalEnvString(),
  S3_FORCE_PATH_STYLE: boolEnv(false).default(false),
  SIGNED_URL_EXPIRES_SECONDS: z.coerce.number().int().min(60).max(604800).default(900),
  REDIS_CACHE_ENABLED: boolEnv(true).default(true),
  REDIS_AUTHZ_CACHE_ENABLED: boolEnv(process.env.NODE_ENV !== 'test').default(process.env.NODE_ENV !== 'test'),
  REDIS_CACHE_DEBUG: boolEnv(false).default(false),
  REDIS_CACHE_DASHBOARD_ENABLED: boolEnv(true).default(true),
  REDIS_CACHE_ANALYTICS_ENABLED: boolEnv(true).default(true),
  REDIS_CACHE_SCHOOLS_ENABLED: boolEnv(true).default(true),
  REDIS_CACHE_STUDENTS_ENABLED: boolEnv(true).default(true),
  REDIS_CACHE_TEACHERS_ENABLED: boolEnv(true).default(true),
  REDIS_CACHE_ATTENDANCE_ENABLED: boolEnv(true).default(true),
  REDIS_CACHE_NOTIFICATIONS_ENABLED: boolEnv(true).default(true),
  REDIS_CACHE_SUBSCRIPTIONS_ENABLED: boolEnv(true).default(true),
  REDIS_CACHE_THEMES_ENABLED: boolEnv(true).default(true),
  REDIS_CACHE_AUDIT_LOGS_ENABLED: boolEnv(true).default(true),
  REDIS_CACHE_MARKS_ENABLED: boolEnv(true).default(true),
  METRICS_ENABLED: boolEnv(true).default(true),
  OTEL_ENABLED: boolEnv(false).default(false),
  OTEL_SERVICE_NAME: z.string().default('school-erp-backend'),
  PRISMA_SLOW_QUERY_THRESHOLD_MS: z.coerce.number().int().min(1).default(500),
  ATTENDANCE_ENABLED: boolEnv(true).default(true),
  TEACHER_SELF_ATTENDANCE_ENABLED: boolEnv(true).default(true),
  LEAVE_BASIC_ENABLED: boolEnv(true).default(true),
  WHATSAPP_FALLBACK_TO: z.string().default('8072428026'),
  AWS_ACCESS_KEY_ID: optionalEnvString(),
  AWS_SECRET_ACCESS_KEY: optionalEnvString(),
  AWS_REGION: optionalEnvString(),
  AWS_S3_BUCKET: optionalEnvString(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.flatten().fieldErrors;
  throw new Error(`Invalid environment variables: ${JSON.stringify(details)}`);
}

assertSafeCorsConfig({ nodeEnv: parsed.data.NODE_ENV, corsOrigins: parsed.data.CORS_ORIGINS });

const normalizedEnv = {
  ...parsed.data,
  S3_REGION: parsed.data.S3_REGION ?? parsed.data.AWS_REGION ?? 'us-east-1',
  S3_BUCKET: parsed.data.S3_BUCKET ?? parsed.data.AWS_S3_BUCKET,
  S3_ACCESS_KEY_ID: parsed.data.S3_ACCESS_KEY_ID ?? parsed.data.AWS_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY: parsed.data.S3_SECRET_ACCESS_KEY ?? parsed.data.AWS_SECRET_ACCESS_KEY,
};

assertSafeStorageConfig({
  nodeEnv: normalizedEnv.NODE_ENV,
  storageDriver: normalizedEnv.STORAGE_DRIVER,
  allowLocalStorageInProduction: normalizedEnv.ALLOW_LOCAL_STORAGE_IN_PRODUCTION,
  s3Bucket: normalizedEnv.S3_BUCKET,
  s3Region: normalizedEnv.S3_REGION,
  s3AccessKeyId: normalizedEnv.S3_ACCESS_KEY_ID,
  s3SecretAccessKey: normalizedEnv.S3_SECRET_ACCESS_KEY,
});

export const env = normalizedEnv;
