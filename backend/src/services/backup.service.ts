import { HttpError } from '../middlewares/error.middleware';
import { spawn } from 'child_process';
import fs from 'fs';
import fsp from 'fs/promises';
import os from 'os';
import path from 'path';
import { pipeline } from 'stream/promises';
import { prisma } from '../config/db';
import { env } from '../config/env';
import { buildRuntimeObjectKey, getSignedDownloadUrlForStoredRef, putRuntimeFile, withTemporaryStoredObjectFile } from './runtimeStorage.service';

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

const createBackupTempDir = () => fsp.mkdtemp(path.join(os.tmpdir(), 'academify-backup-'));

const runCommandToFile = async (command: string, args: string[], outputPath: string, envVars: NodeJS.ProcessEnv) => {
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
    await fsp.rm(outputPath, { force: true });
    throw new HttpError(
      500,
      `${command} failed to start`,
      error instanceof Error ? error.message : 'Install PostgreSQL client tools and ensure they are on PATH.',
    );
  }

  if (exitCode !== 0) {
    await fsp.rm(outputPath, { force: true });
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

const getBackupForDownload = async (backupId: string) => {
  const backup = await prisma.backupJob.findUnique({ where: { id: backupId } });
  if (!backup) throw new HttpError(404, 'Backup not found');
  if (backup.status !== 'COMPLETED' || !backup.storagePath) throw new HttpError(409, 'Backup is not available for download');
  return backup;
};

export const getBackupDownloadUrl = async (backupId: string) => {
  const backup = await getBackupForDownload(backupId);
  return getSignedDownloadUrlForStoredRef({ storageRef: backup.storagePath! });
};

export const createBackup = async (payload: BackupRequest) => {
  const url = databaseUrl();
  const tempDir = await createBackupTempDir();
  const outputPath = path.join(tempDir, `${payload.jobId}.dump`);

  await prisma.backupJob.update({
    where: { id: payload.jobId },
    data: { status: 'RUNNING', startedAt: new Date() },
  });

  try {
    await runCommandToFile('pg_dump', ['--format=custom', '--no-owner', '--no-privileges'], outputPath, pgEnv(url));
    const key = buildRuntimeObjectKey({
      schoolId: payload.schoolId,
      category: 'backups',
      filename: `${payload.jobId}.dump`,
      id: payload.jobId,
    });
    const uploaded = await putRuntimeFile({
      key,
      filePath: outputPath,
      contentType: 'application/octet-stream',
      metadata: {
        backupJobId: payload.jobId,
        schoolId: payload.schoolId,
      },
    });
    await prisma.backupJob.update({
      where: { id: payload.jobId },
      data: { status: 'COMPLETED', storagePath: uploaded.storageRef, finishedAt: new Date() },
    });
  } catch (error) {
    await prisma.backupJob.update({
      where: { id: payload.jobId },
      data: { status: 'FAILED', finishedAt: new Date() },
    });
    throw error;
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
};

export const restoreBackup = async (payload: RestoreRequest) => {
  if (env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_RESTORE !== 'true') {
    throw new HttpError(403, 'Production restore requires ALLOW_PRODUCTION_RESTORE=true');
  }

  const url = databaseUrl();

  await prisma.restoreJob.update({
    where: { id: payload.jobId },
    data: { status: 'RUNNING', startedAt: new Date() },
  });

  const backup = await getBackupForDownload(payload.backupId);
  await withTemporaryStoredObjectFile({
    storageRef: backup.storagePath!,
    extension: '.dump',
    handler: async (backupFile) => {
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
    },
  });

  await prisma.restoreJob.update({
    where: { id: payload.jobId },
    data: { status: 'COMPLETED', finishedAt: new Date() },
  });
};
