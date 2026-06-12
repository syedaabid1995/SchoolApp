import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodType } from 'zod';

export type ValidationIssue = {
  field: string;
  message: string;
};

export class RequestValidationError extends Error {
  statusCode = 400;
  errors: ValidationIssue[];

  constructor(errors: ValidationIssue[]) {
    super('Validation failed');
    this.errors = errors;
  }
}

export const formatZodIssues = (error: ZodError): ValidationIssue[] =>
  error.issues.map((issue) => ({
    field: issue.path.map(String).join('.') || 'request',
    message: issue.message,
  }));

const validateRequestPart = (target: 'body' | 'query' | 'params') => (schema: ZodType) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req[target]);
    if (!parsed.success) {
      next(new RequestValidationError(formatZodIssues(parsed.error)));
      return;
    }

    req[target] = parsed.data;
    next();
  };

export const validateBody = validateRequestPart('body');
export const validateQuery = validateRequestPart('query');
export const validateParams = validateRequestPart('params');
