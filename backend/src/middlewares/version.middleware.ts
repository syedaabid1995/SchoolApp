import type { NextFunction, Request, Response } from 'express';
import { HttpError } from './error.middleware';

const MIN_VERSION = '1.0.0';
const DEPRECATED_BEFORE = '1.1.0';

const parseVersion = (value: string) => value.split('.').map((part) => Number(part));

const isLessThan = (a: string, b: string) => {
  const [a1, a2, a3] = parseVersion(a);
  const [b1, b2, b3] = parseVersion(b);
  if (a1 !== b1) return a1 < b1;
  if (a2 !== b2) return a2 < b2;
  return a3 < b3;
};

export const apiVersionMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const version = (req.headers['x-api-version'] as string) ?? MIN_VERSION;

  if (isLessThan(version, MIN_VERSION)) {
    return next(new HttpError(426, 'API version not supported'));
  }

  if (isLessThan(version, DEPRECATED_BEFORE)) {
    res.setHeader('x-api-deprecation', 'true');
  }

  return next();
};
