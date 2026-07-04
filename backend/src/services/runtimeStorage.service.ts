import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import { createReadStream, createWriteStream } from 'fs';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { env } from '../config/env';

export type RuntimeStorageCategory =
  | 'uploads'
  | 'homework'
  | 'imports'
  | 'exports'
  | 'audit-exports'
  | 'backups'
  | 'attendance-photos'
  | 'face-samples'
  | 'student-transfers'
  | 'tmp';

export type RuntimeObject = {
  body: unknown;
  contentType?: string;
  contentLength?: number;
  cacheControl?: string;
};

type PutObjectParams = {
  key: string;
  body: Buffer | Uint8Array | string | Readable;
  contentType: string;
  metadata?: Record<string, string>;
};

type BuildKeyParams = {
  schoolId?: string | null;
  category: RuntimeStorageCategory;
  filename?: string | null;
  extension?: string | null;
  id?: string;
  now?: Date;
};

export const getStorageDriver = () => env.STORAGE_DRIVER;

const bucketName = () => {
  if (!env.S3_BUCKET) throw new Error('S3_BUCKET is required for S3 storage');
  return env.S3_BUCKET;
};

const localStorageRoot = () => path.resolve(process.cwd(), env.STORAGE_LOCAL_ROOT);
const localSignedPath = '/api/v1/uploads/local-signed';

let s3Client: S3Client | null = null;

const getS3Client = () => {
  if (s3Client) return s3Client;
  if (!env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY || !env.S3_REGION) {
    throw new Error('S3 credentials are not configured');
  }
  s3Client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  });
  return s3Client;
};

export const resetRuntimeStorageClientForTests = () => {
  s3Client = null;
};

export const sanitizeFilename = (value?: string | null) => {
  const fallback = 'file';
  const parsed = path.parse(value ?? fallback);
  const safeBase = (parsed.name || fallback)
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/_{2,}/g, '_')
    .replace(/-{2,}/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, 80);
  const safeExt = parsed.ext.toLowerCase().replace(/[^a-z0-9.]/g, '').slice(0, 16);
  return `${safeBase || fallback}${safeExt}`;
};

const extensionFrom = (params: Pick<BuildKeyParams, 'filename' | 'extension'>) => {
  const explicit = params.extension?.trim().toLowerCase();
  if (explicit) return explicit.startsWith('.') ? explicit : `.${explicit}`;
  const ext = path.extname(sanitizeFilename(params.filename));
  return ext || '';
};

const safePathSegment = (value: string) =>
  value
    .trim()
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, 120);

export const buildRuntimeObjectKey = (params: BuildKeyParams) => {
  const now = params.now ?? new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const root = params.schoolId ? `schools/${params.schoolId}` : 'platform';
  const id = safePathSegment(params.id ?? crypto.randomUUID());
  return `${root}/${params.category}/${year}/${month}/${id}${extensionFrom(params)}`;
};

const assertSafeKey = (key: string) => {
  if (!key || key.startsWith('/') || key.includes('\\') || key.split('/').some((part) => part === '..' || part === '')) {
    throw new Error('Invalid storage key');
  }
  return key;
};

const assertSafeLocalPath = (key: string) => {
  assertSafeKey(key);
  const root = localStorageRoot();
  const targetPath = path.resolve(root, key);
  if (!targetPath.startsWith(root + path.sep) && targetPath !== root) {
    throw new Error('Invalid storage key');
  }
  return targetPath;
};

const localLegacyUploadRoots = () => {
  const cwd = process.cwd();
  return [...new Set([
    path.resolve(cwd, 'uploads'),
    path.resolve(cwd, 'backend/uploads'),
    path.resolve(cwd, '../uploads'),
  ])];
};

const resolveLocalReadPath = async (key: string) => {
  const primaryPath = assertSafeLocalPath(key);
  try {
    const stat = await fs.stat(primaryPath);
    if (stat.isFile()) return { filePath: primaryPath, stat };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  if (!env.STORAGE_LEGACY_LOCAL_UPLOADS_READ_ENABLED) {
    throw new Error('Storage object not found');
  }

  if (!key.startsWith('schools/') && !key.startsWith('platform/')) {
    throw new Error('Storage object not found');
  }

  for (const root of localLegacyUploadRoots()) {
    const targetPath = path.resolve(root, key);
    if (!targetPath.startsWith(root + path.sep) && targetPath !== root) continue;
    try {
      const stat = await fs.stat(targetPath);
      if (stat.isFile()) return { filePath: targetPath, stat };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  throw new Error('Storage object not found');
};

export const storageRefForKey = (key: string) =>
  getStorageDriver() === 'local' ? `local://${assertSafeKey(key)}` : `s3://${bucketName()}/${assertSafeKey(key)}`;

export const storageKeyFromRef = (value: string) => {
  if (value.startsWith('s3://')) {
    const withoutScheme = value.slice('s3://'.length);
    const separatorIndex = withoutScheme.indexOf('/');
    return separatorIndex >= 0 ? withoutScheme.slice(separatorIndex + 1) : null;
  }

  if (value.startsWith('local://')) {
    return value.slice('local://'.length);
  }

  const localPrefix = '/uploads/';
  if (value.startsWith(localPrefix)) {
    return value.slice(localPrefix.length).split('/').map(decodeURIComponent).join('/');
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol === 's3:') return storageKeyFromRef(value);
    if (parsed.protocol === 'local:') return parsed.pathname.replace(/^\/+/, '');
    if (parsed.pathname.startsWith(localPrefix)) {
      return parsed.pathname.slice(localPrefix.length).split('/').map(decodeURIComponent).join('/');
    }
  } catch {
    return null;
  }

  return null;
};

export const localVirtualUrlForKey = (key: string) =>
  `/uploads/${assertSafeKey(key).split('/').map((part) => encodeURIComponent(part)).join('/')}`;

export const publicCompatibleUrlForKey = (key: string) =>
  getStorageDriver() === 'local' ? localVirtualUrlForKey(key) : storageRefForKey(key);

const signLocalStorageUrl = (key: string, expiresAt: number) =>
  crypto.createHmac('sha256', env.JWT_SECRET).update(`${key}.${expiresAt}`).digest('base64url');

export const verifyLocalSignedStorageUrl = (params: {
  key: string;
  expires: string;
  signature: string;
}) => {
  try {
    const expiresAt = Number(params.expires);
    if (!Number.isInteger(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
      return false;
    }
    assertSafeLocalPath(params.key);
    const expected = signLocalStorageUrl(params.key, expiresAt);
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(params.signature);
    if (expectedBuffer.length !== actualBuffer.length) return false;
    return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
  } catch {
    return false;
  }
};

export const getSignedDownloadUrl = async (params: { key: string; expiresInSeconds?: number }) => {
  const key = assertSafeKey(params.key);
  const expiresInSeconds = params.expiresInSeconds ?? env.SIGNED_URL_EXPIRES_SECONDS;

  if (getStorageDriver() === 'local') {
    assertSafeLocalPath(key);
    const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const query = new URLSearchParams({
      key,
      expires: String(expiresAt),
      signature: signLocalStorageUrl(key, expiresAt),
    });
    return `${localSignedPath}?${query.toString()}`;
  }

  return getSignedUrl(
    getS3Client(),
    new GetObjectCommand({
      Bucket: bucketName(),
      Key: key,
    }),
    { expiresIn: expiresInSeconds },
  );
};

export const getSignedDownloadUrlForStoredRef = async (params: { storageRef: string; expiresInSeconds?: number }) => {
  const key = storageKeyFromRef(params.storageRef);
  if (!key) throw new Error('Unsupported storage reference');
  return getSignedDownloadUrl({ key, expiresInSeconds: params.expiresInSeconds });
};

export const putRuntimeObject = async (params: PutObjectParams) => {
  const key = assertSafeKey(params.key);
  if (getStorageDriver() === 'local') {
    const targetPath = assertSafeLocalPath(key);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, params.body as string | Uint8Array);
    return { bucket: 'local', key, storageRef: storageRefForKey(key), url: publicCompatibleUrlForKey(key) };
  }

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: bucketName(),
      Key: key,
      Body: params.body,
      ContentType: params.contentType,
      Metadata: params.metadata,
    }),
  );
  return { bucket: bucketName(), key, storageRef: storageRefForKey(key), url: publicCompatibleUrlForKey(key) };
};

export const putRuntimeFile = async (params: {
  key: string;
  filePath: string;
  contentType: string;
  metadata?: Record<string, string>;
}) => {
  const key = assertSafeKey(params.key);
  if (getStorageDriver() === 'local') {
    const targetPath = assertSafeLocalPath(key);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(params.filePath, targetPath);
    return { bucket: 'local', key, storageRef: storageRefForKey(key), url: publicCompatibleUrlForKey(key) };
  }

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: bucketName(),
      Key: key,
      Body: createReadStream(params.filePath),
      ContentType: params.contentType,
      Metadata: params.metadata,
    }),
  );
  return { bucket: bucketName(), key, storageRef: storageRefForKey(key), url: publicCompatibleUrlForKey(key) };
};

const contentTypeFromKey = (key: string) => {
  const ext = path.extname(key).toLowerCase();
  if (ext === '.csv') return 'text/csv';
  if (ext === '.json') return 'application/json';
  if (ext === '.xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.doc') return 'application/msword';
  if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ext === '.dump') return 'application/octet-stream';
  return 'application/octet-stream';
};

export const getRuntimeObject = async (params: { key: string }): Promise<RuntimeObject> => {
  const key = assertSafeKey(params.key);
  if (getStorageDriver() === 'local') {
    const { filePath, stat } = await resolveLocalReadPath(key);
    return {
      body: createReadStream(filePath),
      contentType: contentTypeFromKey(key),
      contentLength: stat.size,
      cacheControl: 'private, max-age=300',
    };
  }

  const result = await getS3Client().send(
    new GetObjectCommand({
      Bucket: bucketName(),
      Key: key,
    }),
  );

  return {
    body: result.Body,
    contentType: result.ContentType,
    contentLength: result.ContentLength,
    cacheControl: result.CacheControl,
  };
};

export const deleteRuntimeObject = async (params: { key: string }) => {
  const key = assertSafeKey(params.key);
  if (getStorageDriver() === 'local') {
    await fs.rm(assertSafeLocalPath(key), { force: true });
    return;
  }

  await getS3Client().send(new DeleteObjectCommand({ Bucket: bucketName(), Key: key }));
};

export const copyRuntimeObject = async (params: { sourceKey: string; destinationKey: string; deleteSource?: boolean }) => {
  const sourceKey = assertSafeKey(params.sourceKey);
  const destinationKey = assertSafeKey(params.destinationKey);
  if (sourceKey === destinationKey) return;

  if (getStorageDriver() === 'local') {
    const sourcePath = assertSafeLocalPath(sourceKey);
    const destinationPath = assertSafeLocalPath(destinationKey);
    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    await fs.copyFile(sourcePath, destinationPath);
    if (params.deleteSource) await fs.rm(sourcePath, { force: true });
    return;
  }

  await getS3Client().send(
    new CopyObjectCommand({
      Bucket: bucketName(),
      CopySource: `${bucketName()}/${sourceKey}`,
      Key: destinationKey,
    }),
  );
  if (params.deleteSource) await deleteRuntimeObject({ key: sourceKey });
};

const bodyToReadable = async (body: unknown) => {
  if (body instanceof Readable) return body;
  if (body && typeof (body as { transformToByteArray?: () => Promise<Uint8Array> }).transformToByteArray === 'function') {
    const bytes = await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
    return Readable.from(Buffer.from(bytes));
  }
  if (body && typeof (body as AsyncIterable<Uint8Array>)[Symbol.asyncIterator] === 'function') {
    return Readable.from(body as AsyncIterable<Uint8Array>);
  }
  if (body instanceof Uint8Array || Buffer.isBuffer(body) || typeof body === 'string') {
    return Readable.from(body);
  }
  throw new Error('Unsupported storage object body');
};

export const writeStoredObjectToFile = async (params: { storageRef: string; filePath: string }) => {
  const key = storageKeyFromRef(params.storageRef);
  if (!key) throw new Error('Unsupported storage reference');
  const object = await getRuntimeObject({ key });
  await fs.mkdir(path.dirname(params.filePath), { recursive: true });
  await pipeline(await bodyToReadable(object.body), createWriteStream(params.filePath, { flags: 'w', mode: 0o600 }));
};

export const withTemporaryStoredObjectFile = async <T>(params: {
  storageRef: string;
  extension?: string | null;
  handler: (filePath: string) => Promise<T>;
}) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'academify-storage-'));
  const filePath = path.join(tempDir, `${crypto.randomUUID()}${extensionFrom({ extension: params.extension })}`);
  try {
    await writeStoredObjectToFile({ storageRef: params.storageRef, filePath });
    return await params.handler(filePath);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
};

export const rewriteStorageRefSchoolScope = (value: string | null | undefined, fromSchoolId: string, toSchoolId: string) => {
  if (!value) return value ?? null;
  const oldPath = `schools/${fromSchoolId}/`;
  const newPath = `schools/${toSchoolId}/`;
  const key = storageKeyFromRef(value);
  if (!key?.startsWith(oldPath)) return value;
  const nextKey = `${newPath}${key.slice(oldPath.length)}`;
  if (value.startsWith('s3://')) return `s3://${bucketName()}/${nextKey}`;
  if (value.startsWith('local://')) return `local://${nextKey}`;
  if (value.startsWith('/uploads/')) return localVirtualUrlForKey(nextKey);
  return value.replace(oldPath, newPath);
};

export const moveStoredObjectSchoolScope = async (params: {
  storageRef: string | null | undefined;
  fromSchoolId: string;
  toSchoolId: string;
}) => {
  if (!params.storageRef) return;
  const sourceKey = storageKeyFromRef(params.storageRef);
  if (!sourceKey?.startsWith(`schools/${params.fromSchoolId}/`)) return;
  const destinationKey = sourceKey.replace(`schools/${params.fromSchoolId}/`, `schools/${params.toSchoolId}/`);
  await copyRuntimeObject({ sourceKey, destinationKey, deleteSource: true });
};
