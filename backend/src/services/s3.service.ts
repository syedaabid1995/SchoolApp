import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createReadStream } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { env } from '../config/env';

const s3 = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

export const getBucketName = () => env.AWS_S3_BUCKET;

const useLocalStorage = env.NODE_ENV !== 'production';
const localUploadRoot = path.join(process.cwd(), 'uploads');

const assertSafeLocalKey = (key: string) => {
  const targetPath = path.resolve(localUploadRoot, key);
  const root = path.resolve(localUploadRoot);
  if (!targetPath.startsWith(root + path.sep) && targetPath !== root) {
    throw new Error('Invalid storage key');
  }
  return targetPath;
};

const contentTypeFromKey = (key: string) => {
  const ext = path.extname(key).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.doc') return 'application/msword';
  if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return 'application/octet-stream';
};

const localPublicUrlForKey = (key: string) =>
  `/uploads/${key.split('/').map((part) => encodeURIComponent(part)).join('/')}`;

export const uploadBuffer = async (params: {
  key: string;
  body: Buffer;
  contentType: string;
}) => {
  if (useLocalStorage) {
    const targetPath = assertSafeLocalKey(params.key);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, params.body);

    return {
      bucket: 'local',
      key: params.key,
      url: localPublicUrlForKey(params.key),
    };
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    }),
  );

  return {
    bucket: env.AWS_S3_BUCKET,
    key: params.key,
    url: `s3://${env.AWS_S3_BUCKET}/${params.key}`,
  };
};

export const getSignedUrlForKey = async (params: { key: string; expiresInSeconds?: number }) => {
  if (useLocalStorage) {
    assertSafeLocalKey(params.key);
    return localPublicUrlForKey(params.key);
  }

  const command = new GetObjectCommand({
    Bucket: env.AWS_S3_BUCKET,
    Key: params.key,
  });
  return getSignedUrl(s3, command, { expiresIn: params.expiresInSeconds ?? 900 });
};

export const getObjectForKey = async (params: { key: string }) => {
  if (useLocalStorage) {
    const targetPath = assertSafeLocalKey(params.key);
    const stat = await fs.stat(targetPath);
    return {
      body: createReadStream(targetPath),
      contentType: contentTypeFromKey(params.key),
      contentLength: stat.size,
      cacheControl: 'public, max-age=86400, immutable',
    };
  }

  const result = await s3.send(
    new GetObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: params.key,
    }),
  );

  return {
    body: result.Body,
    contentType: result.ContentType,
    contentLength: result.ContentLength,
    cacheControl: result.CacheControl,
  };
};
