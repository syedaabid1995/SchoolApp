import crypto from 'crypto';
import path from 'path';
import { Readable } from 'stream';

const hasFlag = (flag: string) => process.argv.slice(2).includes(flag);

const maskLocalRoot = (value: string) => {
  const resolved = path.resolve(process.cwd(), value);
  const relative = path.relative(process.cwd(), resolved);
  return relative && !relative.startsWith('..') ? `<cwd>/${relative}` : `<path>/${path.basename(resolved)}`;
};

const endpointHostOnly = (value?: string) => {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return '<invalid-endpoint>';
  }
};

const signedUrlSummary = (value: string) => {
  try {
    const parsed = new URL(value, 'http://local-storage');
    return parsed.host === 'local-storage'
      ? { type: 'local-signed-route', path: parsed.pathname }
      : { type: parsed.protocol.replace(':', ''), host: parsed.host };
  } catch {
    return { type: 'generated' };
  }
};

const bodyToBuffer = async (body: unknown) => {
  if (body instanceof Readable) {
    const chunks: Buffer[] = [];
    for await (const chunk of body) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return Buffer.concat(chunks);
  }
  if (body && typeof (body as { transformToByteArray?: () => Promise<Uint8Array> }).transformToByteArray === 'function') {
    const bytes = await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
    return Buffer.from(bytes);
  }
  if (body instanceof Uint8Array || Buffer.isBuffer(body)) return Buffer.from(body);
  if (typeof body === 'string') return Buffer.from(body);
  throw new Error('Storage object body could not be read');
};

const main = async () => {
  const startedAt = new Date();
  const random = crypto.randomBytes(8).toString('hex');
  const key = `system/storage-validation/${startedAt.toISOString().replace(/[:.]/g, '-')}-${random}.txt`;
  const payload = Buffer.from(`academify runtime storage validation ${startedAt.toISOString()}\n`, 'utf8');
  let cleanup: 'not-started' | 'ok' | 'failed' = 'not-started';

  try {
    const [{ env }, storage] = await Promise.all([
      import('../src/config/env'),
      import('../src/services/runtimeStorage.service'),
    ]);

    if (env.NODE_ENV === 'production' && !hasFlag('--allow-production')) {
      throw new Error('Refusing to run against NODE_ENV=production without --allow-production.');
    }

    const target =
      env.STORAGE_DRIVER === 'local'
        ? { localRoot: maskLocalRoot(env.STORAGE_LOCAL_ROOT), legacyLocalUploadsReadEnabled: env.STORAGE_LEGACY_LOCAL_UPLOADS_READ_ENABLED }
        : {
            bucket: env.S3_BUCKET ?? '<missing>',
            region: env.S3_REGION ?? '<missing>',
            endpoint: endpointHostOnly(env.S3_ENDPOINT),
            forcePathStyle: env.S3_FORCE_PATH_STYLE,
          };

    const uploaded = await storage.putRuntimeObject({
      key,
      body: payload,
      contentType: 'text/plain; charset=utf-8',
      metadata: { purpose: 'storage-validation' },
    });

    const signedUrl = await storage.getSignedDownloadUrl({ key, expiresInSeconds: 300 });
    const object = await storage.getRuntimeObject({ key });
    const readBack = await bodyToBuffer(object.body);
    if (!readBack.equals(payload)) {
      throw new Error('Uploaded validation object did not round-trip correctly.');
    }

    await storage.deleteRuntimeObject({ key });
    cleanup = 'ok';

    console.log(JSON.stringify({
      ok: true,
      driver: env.STORAGE_DRIVER,
      target,
      validationKeyPrefix: 'system/storage-validation/',
      upload: 'ok',
      signedDownloadUrl: { generated: true, summary: signedUrlSummary(signedUrl) },
      readBack: 'ok',
      cleanup,
    }, null, 2));
  } catch (error) {
    if (cleanup === 'not-started') {
      try {
        const storage = await import('../src/services/runtimeStorage.service');
        await storage.deleteRuntimeObject({ key });
        cleanup = 'ok';
      } catch {
        cleanup = 'failed';
      }
    }

    console.error(JSON.stringify({
      ok: false,
      upload: 'failed',
      cleanup,
      message: error instanceof Error ? error.message : 'Storage validation failed.',
    }, null, 2));
    process.exitCode = 1;
  }
};

void main();
