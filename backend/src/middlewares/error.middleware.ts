import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from '../config/logger';
import { formatZodIssues, RequestValidationError } from './validation.middleware';

export class HttpError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const notFoundMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

export const errorMiddleware = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (err instanceof RequestValidationError) {
    res.status(err.statusCode).json({
      success: false,
      message: 'Validation failed',
      errors: err.errors,
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: formatZodIssues(err),
    });
    return;
  }

  const error =
    err instanceof HttpError
      ? err
        : new HttpError(500, 'Internal server error');

  if (!(err instanceof HttpError)) {
    logger.error({ err }, 'unhandled error');
  }

  res.status(error.statusCode).json({
    error: {
      message: error.message,
      details: error.details ?? null,
    },
  });
};
