import type { NextFunction, Request, Response } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { env } from '../config/env';
import { HttpError } from './error.middleware';

export type AuthContext = {
  userId: string;
  schoolId: string | null;
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

const extractBearer = (req: Request) => {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
};

export const authMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  const token = extractBearer(req);
  if (!token) {
    next(new HttpError(401, 'Missing authorization token'));
    return;
  }

  let decoded: JwtPayload | { sub?: string; schoolId?: string | null; typ?: string };
  try {
    decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload | {
      sub?: string;
      schoolId?: string | null;
      typ?: string;
    };
  } catch {
    next(new HttpError(401, 'Invalid token'));
    return;
  }

  if (typeof decoded === 'string' || decoded.typ !== 'access' || !decoded.sub) {
    next(new HttpError(401, 'Invalid token'));
    return;
  }

  req.auth = {
    userId: decoded.sub,
    schoolId: decoded.schoolId ?? null,
  };

  next();
};
