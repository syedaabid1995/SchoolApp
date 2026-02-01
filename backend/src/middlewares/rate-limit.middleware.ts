import type { NextFunction, Request, Response } from 'express';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { HttpError } from './error.middleware';

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

export const rateLimit = () => async (req: Request, _res: Response, next: NextFunction) => {
  try {
    await defaultLimiter.consume(keyFor(req));
    return next();
  } catch {
    return next(new HttpError(429, 'Too many requests'));
  }
};

export const otpRateLimit = () => async (_req: Request, _res: Response, next: NextFunction) => {
  return next();
};

export const aiRateLimit = () => async (req: Request, _res: Response, next: NextFunction) => {
  try {
    await aiLimiter.consume(keyFor(req));
    return next();
  } catch {
    return next(new HttpError(429, 'AI rate limit exceeded'));
  }
};
