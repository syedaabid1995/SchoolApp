import type { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import { redis } from '../config/redis';
import { HttpError } from './error.middleware';

const headerName = 'idempotency-key';
const ttlSeconds = 300;

export const idempotencyMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const key = req.headers[headerName] as string | undefined;
  if (!key) {
    return next(new HttpError(400, 'Idempotency-Key header required'));
  }

  const signature = crypto
    .createHash('sha256')
    .update(`${req.method}:${req.originalUrl}:${JSON.stringify(req.body ?? {})}`)
    .digest('hex');

  const redisKey = `idempotency:${key}`;
  let existing: string | null = null;
  try {
    existing = await redis.get(redisKey);
  } catch {
    return next();
  }

  if (existing) {
    const parsed = JSON.parse(existing) as {
      signature: string;
      status: number;
      body: unknown;
    };

    if (parsed.signature !== signature) {
      return next(new HttpError(409, 'Idempotency key reuse with different payload'));
    }

    return res.status(parsed.status).json(parsed.body);
  }

  const originalJson = res.json.bind(res);
  res.json = (body: unknown) => {
    const payload = JSON.stringify({
      signature,
      status: res.statusCode,
      body,
    });
    void redis.set(redisKey, payload, 'EX', ttlSeconds).catch(() => {
      // Ignore cache failures; request already succeeded.
    });
    return originalJson(body);
  };

  return next();
};
