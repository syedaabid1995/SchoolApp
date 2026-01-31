import type { NextFunction, Request, Response } from 'express';
import { HttpError } from './error.middleware';

export const aiProtection = (req: Request, _res: Response, next: NextFunction) => {
  const confidence = req.body?.confidence as number | undefined;
  if (confidence !== undefined && (confidence < 0.5 || confidence > 1)) {
    return next(new HttpError(422, 'Invalid confidence score'));
  }

  return next();
};
