import type { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { redis } from '../config/redis';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { prisma } from '../config/db';
import { buildAuthAuditMetadata, createAuthAuditLog, maskEmailForAudit } from '../utils/audit';
import { HttpError } from './error.middleware';

export const AUTH_RATE_LIMIT_MESSAGE = 'Too many attempts. Please try again later.';

const defaultLimiter = new RateLimiterMemory({
  points: 100,
  duration: 60,
});

const otpLimiter = new RateLimiterMemory({
  points: 5,
  duration: 300,
});

const aiLimiter = new RateLimiterMemory({
  points: 20,
  duration: 60,
});

const keyFor = (req: Request) => req.auth?.schoolId ?? req.ip;

type MemoryCounter = {
  count: number;
  expiresAt: number;
};

type RateLimitResult = {
  limited: boolean;
  retryAfterSeconds: number;
};

const memoryCounters = new Map<string, MemoryCounter>();

const firstHeaderValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const normalizeIdentifier = (value?: unknown) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const normalizeScope = (value?: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : 'none';

const hashPart = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

const requestIp = (req: Request) => {
  const forwardedFor = firstHeaderValue(req.headers['x-forwarded-for']);
  const realIp = firstHeaderValue(req.headers['x-real-ip']);
  return forwardedFor?.split(',')[0]?.trim() || realIp?.trim() || req.ip || req.socket.remoteAddress || 'unknown';
};

export const authLimiterSchoolScope = (body: unknown) => {
  const record = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const schoolId = normalizeIdentifier(record.schoolId);
  const schoolCode = normalizeIdentifier(record.schoolCode);
  return schoolId || schoolCode || 'none';
};

export const authLimiterIdentifier = (body: unknown) => {
  const record = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  return normalizeIdentifier(record.email) || normalizeIdentifier(record.username);
};

export const loginFailureKey = (identifier: string, schoolScope: string) =>
  `auth:rate:login:fail:identity:${hashPart(`${identifier}|${schoolScope}`)}`;

const loginIpKey = (req: Request) => `auth:rate:login:ip:${hashPart(requestIp(req))}`;

const forgotIdentityKey = (identifier: string, schoolScope: string) =>
  `auth:rate:forgot:identity:${hashPart(`${identifier}|${schoolScope}`)}`;

const forgotIpKey = (req: Request) => `auth:rate:forgot:ip:${hashPart(requestIp(req))}`;

const mfaChallengeKey = (userId: string, schoolId: string | null) =>
  `auth:rate:mfa:challenge:${hashPart(`${userId}|${schoolId ?? 'none'}`)}`;

const mfaVerifyIpKey = (req: Request) => `auth:rate:mfa:verify:ip:${hashPart(requestIp(req))}`;

const mfaVerifyChallengeKey = (challengeId: string) =>
  `auth:rate:mfa:verify:challenge:${hashPart(challengeId)}`;

const mfaResendIpKey = (req: Request) => `auth:rate:mfa:resend:ip:${hashPart(requestIp(req))}`;

const mfaResendChallengeKey = (challengeId: string) =>
  `auth:rate:mfa:resend:challenge:${hashPart(challengeId)}`;

const mfaResendUserKey = (userId: string) => `auth:rate:mfa:resend:user:${hashPart(userId)}`;

const totpSetupVerifyKey = (userId: string) => `auth:rate:totp:setup-verify:${hashPart(userId)}`;

const totpDisableKey = (userId: string) => `auth:rate:totp:disable:${hashPart(userId)}`;

const schoolIdFromBody = async (body: unknown) => {
  const record = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const schoolId = typeof record.schoolId === 'string' && record.schoolId.trim() ? record.schoolId.trim() : null;
  if (schoolId) return schoolId;

  const schoolCode = typeof record.schoolCode === 'string' && record.schoolCode.trim() ? record.schoolCode.trim() : null;
  if (!schoolCode) return null;

  const school = await prisma.school.findFirst({
    where: { code: schoolCode },
    select: { id: true },
  });
  return school?.id ?? null;
};

const auditRateLimitTriggered = async (req: Request, limiter: 'LOGIN' | 'FORGOT_PASSWORD') => {
  try {
    const identifier = authLimiterIdentifier(req.body);
    const schoolId = await schoolIdFromBody(req.body);
    if (!identifier) {
      logger.warn(
        buildAuthAuditMetadata(req, {
          action: 'RATE_LIMIT_TRIGGERED',
          limiter,
          schoolId,
          skippedReason: 'identifier_missing',
        }),
        'auth rate limit audit skipped because actor is unknown',
      );
      return;
    }

    const user = await prisma.user.findFirst({
      where: {
        email: { equals: identifier, mode: 'insensitive' },
        schoolId,
      },
      select: { id: true, schoolId: true },
    });
    if (!user) {
      logger.warn(
        buildAuthAuditMetadata(req, {
          action: 'RATE_LIMIT_TRIGGERED',
          limiter,
          identifier: maskEmailForAudit(identifier),
          schoolId,
          skippedReason: 'audit_actor_unknown',
        }),
        'auth rate limit audit skipped because actor is unknown',
      );
      return;
    }

    await createAuthAuditLog({
      req,
      schoolId: user.schoolId ?? null,
      userId: user.id,
      entityId: user.id,
      action: 'RATE_LIMIT_TRIGGERED',
      metadata: {
        limiter,
        identifier: maskEmailForAudit(identifier),
      },
    });
  } catch {
    // Rate limiting must not depend on audit logging.
  }
};

const memoryConsume = (key: string, limit: number, windowSeconds: number): RateLimitResult => {
  const now = Date.now();
  const existing = memoryCounters.get(key);
  const current = existing && existing.expiresAt > now ? existing : { count: 0, expiresAt: now + windowSeconds * 1000 };
  current.count += 1;
  memoryCounters.set(key, current);
  return {
    limited: current.count > limit,
    retryAfterSeconds: Math.max(1, Math.ceil((current.expiresAt - now) / 1000)),
  };
};

const memoryPeek = (key: string, limit: number): RateLimitResult => {
  const now = Date.now();
  const existing = memoryCounters.get(key);
  if (!existing || existing.expiresAt <= now) {
    memoryCounters.delete(key);
    return { limited: false, retryAfterSeconds: 0 };
  }
  return {
    limited: existing.count >= limit,
    retryAfterSeconds: Math.max(1, Math.ceil((existing.expiresAt - now) / 1000)),
  };
};

const consumeRedis = async (key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> => {
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSeconds);
  }
  const ttl = await redis.ttl(key);
  return {
    limited: count > limit,
    retryAfterSeconds: ttl > 0 ? ttl : windowSeconds,
  };
};

const peekRedis = async (key: string, limit: number): Promise<RateLimitResult> => {
  const [rawCount, ttl] = await Promise.all([redis.get(key), redis.ttl(key)]);
  const count = Number(rawCount ?? 0);
  return {
    limited: count >= limit,
    retryAfterSeconds: ttl > 0 ? ttl : 0,
  };
};

const deleteRedisKey = async (key: string) => {
  await redis.del(key);
};

const consumeAuthBucket = async (key: string, limit: number, windowSeconds: number) => {
  try {
    return await consumeRedis(key, limit, windowSeconds);
  } catch (err) {
    if (env.NODE_ENV === 'development') {
      logger.warn({ err, key }, 'redis rate limiter unavailable; using development memory fallback');
      return memoryConsume(key, limit, windowSeconds);
    }
    logger.error({ err, key }, 'redis rate limiter unavailable');
    throw new HttpError(429, AUTH_RATE_LIMIT_MESSAGE);
  }
};

const peekAuthBucket = async (key: string, limit: number) => {
  try {
    return await peekRedis(key, limit);
  } catch (err) {
    if (env.NODE_ENV === 'development') {
      logger.warn({ err, key }, 'redis rate limiter unavailable; using development memory fallback');
      return memoryPeek(key, limit);
    }
    logger.error({ err, key }, 'redis rate limiter unavailable');
    throw new HttpError(429, AUTH_RATE_LIMIT_MESSAGE);
  }
};

const clearAuthBucket = async (key: string) => {
  try {
    await deleteRedisKey(key);
  } catch (err) {
    if (env.NODE_ENV === 'development') {
      memoryCounters.delete(key);
      return;
    }
    logger.error({ err, key }, 'failed to clear auth rate limit key');
  }
};

const rejectAuthRateLimit = (result: RateLimitResult, next: NextFunction) => {
  void result;
  const error = new HttpError(429, AUTH_RATE_LIMIT_MESSAGE);
  return next(error);
};

export const rateLimit = () => async (req: Request, _res: Response, next: NextFunction) => {
  if (env.NODE_ENV === 'test') {
    return next();
  }
  try {
    await defaultLimiter.consume(keyFor(req));
    return next();
  } catch {
    return next(new HttpError(429, 'Too many requests'));
  }
};

const otpKeyFor = (req: Request) => {
  const bodyPhone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
  if (bodyPhone) return `otp:phone:${bodyPhone}`;
  return `otp:ip:${req.ip}`;
};

export const otpRateLimit = () => async (req: Request, _res: Response, next: NextFunction) => {
  try {
    await otpLimiter.consume(otpKeyFor(req));
    return next();
  } catch {
    return next(new HttpError(429, 'OTP rate limit exceeded'));
  }
};

export const aiRateLimit = () => async (req: Request, _res: Response, next: NextFunction) => {
  try {
    await aiLimiter.consume(keyFor(req));
    return next();
  } catch {
    return next(new HttpError(429, 'AI rate limit exceeded'));
  }
};

export const loginIpRateLimit = () => async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const result = await consumeAuthBucket(loginIpKey(req), 20, 15 * 60);
    if (result.limited) {
      await auditRateLimitTriggered(req, 'LOGIN');
      return rejectAuthRateLimit(result, next);
    }
    return next();
  } catch (err) {
    return next(err);
  }
};

export const forgotPasswordRateLimit = () => async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const ipResult = await consumeAuthBucket(forgotIpKey(req), 10, 60 * 60);
    if (ipResult.limited) {
      await auditRateLimitTriggered(req, 'FORGOT_PASSWORD');
      return rejectAuthRateLimit(ipResult, next);
    }

    const identifier = normalizeIdentifier((req.body as Record<string, unknown> | undefined)?.email);
    if (identifier) {
      const schoolScope = (await schoolIdFromBody(req.body)) ?? authLimiterSchoolScope(req.body);
      const identityResult = await consumeAuthBucket(forgotIdentityKey(identifier, schoolScope), 3, 60 * 60);
      if (identityResult.limited) {
        await auditRateLimitTriggered(req, 'FORGOT_PASSWORD');
        return rejectAuthRateLimit(identityResult, next);
      }
    }

    return next();
  } catch (err) {
    return next(err);
  }
};

export const assertLoginFailureLimit = async (identifier: string, schoolScope: string) => {
  const result = await peekAuthBucket(loginFailureKey(identifier, schoolScope), 5);
  if (result.limited) {
    throw new HttpError(429, AUTH_RATE_LIMIT_MESSAGE);
  }
};

export const recordLoginFailure = async (identifier: string, schoolScope: string) => {
  if (!identifier) return { limited: false, retryAfterSeconds: 0 };
  return consumeAuthBucket(loginFailureKey(identifier, schoolScope), 5, 15 * 60);
};

export const resetLoginFailureCounter = async (identifier: string, schoolScope: string) => {
  if (!identifier) return;
  await clearAuthBucket(loginFailureKey(identifier, schoolScope));
};

export const consumeMfaChallengeLimit = async (userId: string, schoolId: string | null) => {
  const result = await consumeAuthBucket(mfaChallengeKey(userId, schoolId), 5, 15 * 60);
  if (result.limited) {
    throw new HttpError(429, AUTH_RATE_LIMIT_MESSAGE);
  }
};

export const mfaVerifyRateLimit = () => async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const ipResult = await consumeAuthBucket(mfaVerifyIpKey(req), 20, 15 * 60);
    if (ipResult.limited) {
      return rejectAuthRateLimit(ipResult, next);
    }

    const challengeId = normalizeIdentifier((req.body as Record<string, unknown> | undefined)?.challengeId);
    if (challengeId) {
      const challengeResult = await consumeAuthBucket(mfaVerifyChallengeKey(challengeId), 10, 15 * 60);
      if (challengeResult.limited) {
        return rejectAuthRateLimit(challengeResult, next);
      }
    }

    return next();
  } catch (err) {
    return next(err);
  }
};

export const mfaResendIpRateLimit = () => async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const ipResult = await consumeAuthBucket(mfaResendIpKey(req), 10, 60 * 60);
    if (ipResult.limited) {
      return rejectAuthRateLimit(ipResult, next);
    }

    return next();
  } catch (err) {
    return next(err);
  }
};

export const consumeMfaResendLimit = async (params: {
  challengeId: string;
  userId: string;
}) => {
  const challengeResult = await consumeAuthBucket(mfaResendChallengeKey(params.challengeId), 3, 60 * 60);
  if (challengeResult.limited) {
    throw new HttpError(429, AUTH_RATE_LIMIT_MESSAGE);
  }

  const userResult = await consumeAuthBucket(mfaResendUserKey(params.userId), 5, 60 * 60);
  if (userResult.limited) {
    throw new HttpError(429, AUTH_RATE_LIMIT_MESSAGE);
  }
};

export const consumeTotpSetupVerifyLimit = async (userId: string) => {
  const result = await consumeAuthBucket(totpSetupVerifyKey(userId), 5, 15 * 60);
  if (result.limited) {
    throw new HttpError(429, AUTH_RATE_LIMIT_MESSAGE);
  }
};

export const consumeTotpDisableLimit = async (userId: string) => {
  const result = await consumeAuthBucket(totpDisableKey(userId), 5, 15 * 60);
  if (result.limited) {
    throw new HttpError(429, AUTH_RATE_LIMIT_MESSAGE);
  }
};
