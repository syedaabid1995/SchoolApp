import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

type CheckStatus = 'pass' | 'warn' | 'fail';

type Check = {
  name: string;
  status: CheckStatus;
  detail: string;
};

const args = new Set(process.argv.slice(2));
const backendRoot = path.basename(process.cwd()) === 'backend'
  ? process.cwd()
  : path.join(process.cwd(), 'backend');
const repoRoot = path.resolve(backendRoot, '..');

dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.join(backendRoot, '.env') });

const checks: Check[] = [];

const addCheck = (name: string, status: CheckStatus, detail: string) => {
  checks.push({ name, status, detail });
};

const value = (name: string) => {
  const raw = process.env[name];
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed ? trimmed : undefined;
};

const isPlaceholder = (raw: string) => /^(change_me|replace_me|placeholder|example)([_-].*)?$/i.test(raw);

const summarizeUrl = (raw: string) => {
  try {
    const parsed = new URL(raw);
    const credentials = parsed.username || parsed.password ? '<credentials>@' : '';
    const path = parsed.pathname && parsed.pathname !== '/' ? '/<path>' : '';
    return `${parsed.protocol}//${credentials}${parsed.host}${path}`;
  } catch {
    return '<invalid-url>';
  }
};

const requirePresent = (name: string, options: { secret?: boolean; minLength?: number; url?: boolean } = {}) => {
  const raw = value(name);
  if (!raw) {
    addCheck(name, 'fail', 'missing');
    return undefined;
  }

  if (isPlaceholder(raw)) {
    addCheck(name, 'fail', 'placeholder value is not acceptable for production-like deployment');
    return raw;
  }

  if (options.minLength && raw.length < options.minLength) {
    addCheck(name, 'fail', `present but shorter than ${options.minLength} characters`);
    return raw;
  }

  if (options.url) {
    try {
      new URL(raw);
    } catch {
      addCheck(name, 'fail', 'present but not a valid URL');
      return raw;
    }
  }

  addCheck(name, 'pass', options.secret ? 'present, value not printed' : options.url ? `present: ${summarizeUrl(raw)}` : 'present');
  return raw;
};

const nodeEnv = requirePresent('NODE_ENV');
if (nodeEnv && nodeEnv !== 'production') {
  addCheck('NODE_ENV production mode', 'warn', `expected production for prod-lite verification, got ${nodeEnv}`);
} else if (nodeEnv === 'production') {
  addCheck('NODE_ENV production mode', 'pass', 'production');
}

const processRole = requirePresent('ACADEMIFY_PROCESS_ROLE');
const validRoles = new Set(['api', 'worker', 'scheduler', 'all']);
if (processRole && !validRoles.has(processRole)) {
  addCheck('ACADEMIFY_PROCESS_ROLE validity', 'fail', 'must be api, worker, scheduler, or all');
} else if (processRole === 'all' && nodeEnv === 'production') {
  addCheck('ACADEMIFY_PROCESS_ROLE production guard', 'fail', 'all is local-only and must not run in production');
} else if (processRole) {
  addCheck('ACADEMIFY_PROCESS_ROLE validity', 'pass', processRole);
}

const boolValue = (name: string) => value(name)?.toLowerCase() === 'true';
if (processRole === 'api') {
  addCheck('process role flags', boolValue('RUN_API') && !boolValue('RUN_WORKERS') && !boolValue('RUN_SCHEDULERS') ? 'pass' : 'fail', 'api requires RUN_API=true, RUN_WORKERS=false, RUN_SCHEDULERS=false');
}
if (processRole === 'worker') {
  addCheck('process role flags', !boolValue('RUN_API') && boolValue('RUN_WORKERS') && !boolValue('RUN_SCHEDULERS') ? 'pass' : 'fail', 'worker requires RUN_API=false, RUN_WORKERS=true, RUN_SCHEDULERS=false');
}
if (processRole === 'scheduler') {
  addCheck('process role flags', !boolValue('RUN_API') && !boolValue('RUN_WORKERS') && boolValue('RUN_SCHEDULERS') ? 'pass' : 'fail', 'scheduler requires RUN_API=false, RUN_WORKERS=false, RUN_SCHEDULERS=true');
}

requirePresent('DATABASE_URL', { url: true });
requirePresent('REDIS_URL', { url: true });
requirePresent('JWT_SECRET', { secret: true, minLength: 32 });
requirePresent('FRONTEND_URL', { url: true });

const corsOrigins = requirePresent('CORS_ORIGINS');
if (corsOrigins) {
  const origins = corsOrigins.split(',').map((entry) => entry.trim()).filter(Boolean);
  const hasWildcard = origins.includes('*') || origins.some((origin) => origin.includes('*'));
  const invalidOrigins = origins.filter((origin) => {
    try {
      new URL(origin);
      return false;
    } catch {
      return true;
    }
  });

  if (nodeEnv === 'production' && (hasWildcard || origins.length === 0)) {
    addCheck('production CORS origins', 'fail', 'production CORS must use explicit origins and must not include wildcard values');
  } else if (invalidOrigins.length) {
    addCheck('production CORS origins', 'fail', `invalid URL origins: ${invalidOrigins.join(', ')}`);
  } else {
    addCheck('production CORS origins', 'pass', `${origins.length} explicit origin(s)`);
  }
}

requirePresent('API_BASE_URL', { url: true });
requirePresent('NEXT_PUBLIC_API_BASE_URL', { url: true });

const storageDriver = requirePresent('STORAGE_DRIVER');
if (storageDriver && !['local', 's3'].includes(storageDriver)) {
  addCheck('STORAGE_DRIVER validity', 'fail', 'must be local or s3');
} else if (storageDriver === 'local' && nodeEnv === 'production' && value('ALLOW_LOCAL_STORAGE_IN_PRODUCTION') !== 'true') {
  addCheck('production storage driver', 'fail', 'STORAGE_DRIVER=local is unsafe in production without ALLOW_LOCAL_STORAGE_IN_PRODUCTION=true');
} else if (storageDriver === 'local' && nodeEnv === 'production') {
  addCheck('production storage driver', 'warn', 'local storage is explicitly allowed; use only for a reviewed temporary maintenance window');
} else if (storageDriver) {
  addCheck('STORAGE_DRIVER validity', 'pass', storageDriver);
}

if (storageDriver === 's3') {
  requirePresent('S3_BUCKET');
  requirePresent('S3_REGION');
  requirePresent('S3_ACCESS_KEY_ID', { secret: true });
  requirePresent('S3_SECRET_ACCESS_KEY', { secret: true });

  const endpoint = value('S3_ENDPOINT');
  if (endpoint) {
    try {
      const parsed = new URL(endpoint);
      addCheck('S3_ENDPOINT', 'pass', `${parsed.protocol}//${parsed.host}`);
    } catch {
      addCheck('S3_ENDPOINT', 'fail', 'present but not a valid URL');
    }
  } else {
    addCheck('S3_ENDPOINT', 'warn', 'empty is valid for AWS S3; S3-compatible stores usually require an endpoint');
  }
}

const packageJsonPath = path.join(backendRoot, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { scripts?: Record<string, string> };
for (const scriptName of ['storage:validate', 'scalability:audit', 'runtime:check-entrypoints']) {
  addCheck(`npm script ${scriptName}`, packageJson.scripts?.[scriptName] ? 'pass' : 'fail', packageJson.scripts?.[scriptName] ? 'available' : 'missing');
}

const entrypoints = ['dist/server.js', 'dist/worker.js', 'dist/scheduler.js'];
const missingEntrypoints = entrypoints.filter((entrypoint) => !fs.existsSync(path.join(backendRoot, entrypoint)));
addCheck(
  'backend build entrypoints',
  missingEntrypoints.length ? 'fail' : 'pass',
  missingEntrypoints.length ? `missing: ${missingEntrypoints.join(', ')}` : entrypoints.join(', '),
);

if (args.has('--skip-prisma')) {
  addCheck('Prisma schema validate', 'warn', 'skipped by --skip-prisma');
} else {
  const prisma = spawnSync('npx', ['prisma', 'validate'], {
    cwd: backendRoot,
    env: process.env,
    encoding: 'utf8',
  });
  addCheck(
    'Prisma schema validate',
    prisma.status === 0 ? 'pass' : 'fail',
    prisma.status === 0 ? 'npx prisma validate passed' : (prisma.stderr || prisma.stdout || 'npx prisma validate failed').split('\n').slice(0, 6).join(' '),
  );
}

const failed = checks.filter((check) => check.status === 'fail');

console.log(JSON.stringify({
  ok: failed.length === 0,
  summary: {
    nodeEnv: nodeEnv ?? '<missing>',
    processRole: processRole ?? '<missing>',
    databaseUrl: value('DATABASE_URL') ? summarizeUrl(value('DATABASE_URL')!) : '<missing>',
    redisUrl: value('REDIS_URL') ? summarizeUrl(value('REDIS_URL')!) : '<missing>',
    storageDriver: storageDriver ?? '<missing>',
  },
  checks,
}, null, 2));

if (failed.length) {
  process.exitCode = 1;
}
