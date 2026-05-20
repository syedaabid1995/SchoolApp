import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const boolEnv = (defaultValue: boolean) =>
  z.preprocess((value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    if (typeof value === 'number') return value === 1;
    return defaultValue;
  }, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  TOTP_ENCRYPTION_KEY: z.string().min(32).optional(),
  AUTH_TWO_STEP_ENABLED: boolEnv(false).default(false),
  REDIS_URL: z.string().min(1),
  FRONTEND_URL: z.string().url().default('http://localhost:3001'),
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  REDIS_CACHE_ENABLED: boolEnv(true).default(true),
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
  ATTENDANCE_ENABLED: boolEnv(true).default(true),
  TEACHER_SELF_ATTENDANCE_ENABLED: boolEnv(true).default(true),
  LEAVE_BASIC_ENABLED: boolEnv(true).default(true),
  WHATSAPP_FALLBACK_TO: z.string().default('8072428026'),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  AWS_REGION: z.string().min(1),
  AWS_S3_BUCKET: z.string().min(1),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.flatten().fieldErrors;
  throw new Error(`Invalid environment variables: ${JSON.stringify(details)}`);
}

export const env = parsed.data;
