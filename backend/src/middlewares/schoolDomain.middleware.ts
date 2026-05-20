import type { NextFunction, Request, Response } from 'express';
import { resolveSchoolSubdomainFromHost } from '../utils/schoolDomain';

declare module 'express-serve-static-core' {
  interface Request {
    schoolSubdomain?: string | null;
  }
}

export const schoolDomainMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  const host = req.headers['x-forwarded-host']?.toString() ?? req.headers.host;
  req.schoolSubdomain = resolveSchoolSubdomainFromHost(host);
  next();
};
