import { HttpError } from '../middlewares/error.middleware';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { prisma } from '../config/db';
import { env } from '../config/env';

export type BackupRequest = {
  jobId: string;
  schoolId: string;
  requestedBy: string;
  reason?: string | null;
};

export type RestoreRequest = {
  jobId: string;
  schoolId: string;
  backupId: string;
  requestedBy: string;
  reason?: string | null;
};

const backupRoot = path.resolve(process.cwd(), 'storage', 'backups');

const ensureBackupRoot = async () => {
  await fs.promises.mkdir(backupRoot, { recursive: true, mode: 0o700 });
};

const runCommandToFile = async (command: string, args: string[], outputPath: string, envVars: NodeJS.ProcessEnv) => {
  await ensureBackupRoot();
  const output = fs.createWriteStream(outputPath, { flags: 'wx', mode: 0o600 });
  const child = spawn(command, args, { env: envVars, stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';

  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const outputDone = pipeline(child.stdout, output);
  let exitCode: number | null;
  try {
    exitCode = await new Promise<number | null>((resolve, reject) => {
      child.on('error', reject);
      child.on('close', resolve);
    });
    await outputDone;
  } catch (error) {
    output.destroy();
    await fs.promises.rm(outputPath, { force: true });
    throw new HttpError(
      500,
      `${command} failed to start`,
      error instanceof Error ? error.message : 'Install PostgreSQL client tools and ensure they are on PATH.',
    );
  }

  if (exitCode !== 0) {
    await fs.promises.rm(outputPath, { force: true });
    throw new HttpError(500, `${command} failed`, stderr.trim().slice(0, 2000) || undefined);
  }
};

const databaseUrl = () => new URL(env.DATABASE_URL);

const pgEnv = (url: URL) => ({
  ...process.env,
  PGHOST: url.hostname,
  PGPORT: url.port || '5432',
  PGDATABASE: url.pathname.replace(/^\//, ''),
  PGUSER: decodeURIComponent(url.username),
  PGPASSWORD: decodeURIComponent(url.password),
});

const backupPath = (jobId: string) => path.join(backupRoot, `${jobId}.dump`);

export const getBackupFilePath = async (backupId: string) => {
  const backup = await prisma.backupJob.findUnique({ where: { id: backupId } });
  if (!backup) throw new HttpError(404, 'Backup not found');
  if (backup.status !== 'COMPLETED' || !backup.storagePath) throw new HttpError(409, 'Backup is not available for download');
  if (!path.resolve(backup.storagePath).startsWith(backupRoot)) throw new HttpError(500, 'Invalid backup storage path');
  await fs.promises.access(backup.storagePath, fs.constants.R_OK);
  return backup.storagePath;
};

export const createBackup = async (payload: BackupRequest) => {
  const outputPath = backupPath(payload.jobId);
  const url = databaseUrl();

  await prisma.backupJob.update({
    where: { id: payload.jobId },
    data: { status: 'RUNNING', startedAt: new Date() },
  });

  try {
    await runCommandToFile('pg_dump', ['--format=custom', '--no-owner', '--no-privileges'], outputPath, pgEnv(url));
    await prisma.backupJob.update({
      where: { id: payload.jobId },
      data: { status: 'COMPLETED', storagePath: outputPath, finishedAt: new Date() },
    });
  } catch (error) {
    await prisma.backupJob.update({
      where: { id: payload.jobId },
      data: { status: 'FAILED', finishedAt: new Date() },
    });
    throw error;
  }
};

export const restoreBackup = async (payload: RestoreRequest) => {
  if (env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_RESTORE !== 'true') {
    throw new HttpError(403, 'Production restore requires ALLOW_PRODUCTION_RESTORE=true');
  }

  const backupFile = await getBackupFilePath(payload.backupId);
  const url = databaseUrl();

  await prisma.restoreJob.update({
    where: { id: payload.jobId },
    data: { status: 'RUNNING', startedAt: new Date() },
  });

  const child = spawn('pg_restore', ['--clean', '--if-exists', '--no-owner', '--no-privileges', '--dbname', env.DATABASE_URL, backupFile], {
    env: pgEnv(url),
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  let exitCode: number | null;
  try {
    exitCode = await new Promise<number | null>((resolve, reject) => {
      child.on('error', reject);
      child.on('close', resolve);
    });
  } catch (error) {
    await prisma.restoreJob.update({
      where: { id: payload.jobId },
      data: { status: 'FAILED', finishedAt: new Date() },
    });
    throw new HttpError(
      500,
      'pg_restore failed to start',
      error instanceof Error ? error.message : 'Install PostgreSQL client tools and ensure they are on PATH.',
    );
  }

  if (exitCode !== 0) {
    await prisma.restoreJob.update({
      where: { id: payload.jobId },
      data: { status: 'FAILED', finishedAt: new Date() },
    });
    throw new HttpError(500, 'pg_restore failed', stderr.trim().slice(0, 2000) || undefined);
  }

  await prisma.restoreJob.update({
    where: { id: payload.jobId },
    data: { status: 'COMPLETED', finishedAt: new Date() },
  });
};
