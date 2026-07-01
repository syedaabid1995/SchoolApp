import type { Response } from 'express';
import { HttpError } from '../middlewares/error.middleware';

export const DEFAULT_LIST_LIMIT = 50;
export const MAX_LIST_LIMIT = 100;
export const DEFAULT_EXPORT_ROW_LIMIT = 5_000;
export const MAX_EXPORT_ROW_LIMIT = 10_000;
export const DEFAULT_NESTED_LIST_LIMIT = 100;

type LimitMode = 'clamp' | 'reject';

type LimitOptions = {
  defaultLimit?: number;
  maxLimit?: number;
  mode?: LimitMode;
};

export type CursorPagination = {
  limit: number;
  cursor?: string;
};

export type CursorPageInfo = {
  limit: number;
  nextCursor: string | null;
  hasNextPage: boolean;
};

export type OffsetPagination = {
  page: number;
  limit: number;
  skip: number;
};

export type OffsetPageInfo = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
};

const firstValue = (value: unknown) => (Array.isArray(value) ? value[0] : value);

const positiveIntegerFrom = (value: unknown, fieldName: string) => {
  const raw = firstValue(value);
  if (raw === undefined || raw === null || raw === '') return undefined;
  const numberValue = Number(raw);
  if (!Number.isInteger(numberValue) || numberValue < 1) {
    throw new HttpError(400, `${fieldName} must be a positive integer`);
  }
  return numberValue;
};

export const parseLimit = (value: unknown, options: LimitOptions = {}) => {
  const defaultLimit = options.defaultLimit ?? DEFAULT_LIST_LIMIT;
  const maxLimit = options.maxLimit ?? MAX_LIST_LIMIT;
  const mode = options.mode ?? 'clamp';
  const requested = positiveIntegerFrom(value, 'limit') ?? defaultLimit;
  if (requested > maxLimit) {
    if (mode === 'reject') {
      throw new HttpError(400, `limit must be less than or equal to ${maxLimit}`);
    }
    return maxLimit;
  }
  return requested;
};

export const parsePage = (value: unknown) => positiveIntegerFrom(value, 'page') ?? 1;

export const encodeCursor = (id: string) => Buffer.from(JSON.stringify({ id }), 'utf8').toString('base64url');

export const decodeCursor = (cursor: unknown) => {
  const raw = firstValue(cursor);
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw !== 'string') throw new HttpError(400, 'cursor must be a string');
  try {
    const decoded = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as { id?: unknown };
    if (typeof decoded.id !== 'string' || !decoded.id.trim()) throw new Error('missing id');
    return decoded.id;
  } catch {
    throw new HttpError(400, 'Invalid cursor');
  }
};

export const parseCursorPagination = (
  query: Record<string, unknown>,
  options: LimitOptions = {},
): CursorPagination => ({
  limit: parseLimit(query.limit, options),
  cursor: decodeCursor(query.cursor),
});

export const parseOffsetPagination = (
  query: Record<string, unknown>,
  options: LimitOptions = {},
): OffsetPagination => {
  const page = parsePage(query.page);
  const limit = parseLimit(query.limit, options);
  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

export const cursorPrismaArgs = (pagination: CursorPagination): { take: number; cursor?: { id: string }; skip?: number } => ({
  take: pagination.limit + 1,
  ...(pagination.cursor ? { cursor: { id: pagination.cursor }, skip: 1 } : {}),
});

export const toCursorPage = <T extends { id: string }>(
  rows: T[],
  limit: number,
): { data: T[]; pageInfo: CursorPageInfo } => {
  const data = rows.slice(0, limit);
  const hasNextPage = rows.length > limit;
  const last = data[data.length - 1];
  return {
    data,
    pageInfo: {
      limit,
      nextCursor: hasNextPage && last ? encodeCursor(last.id) : null,
      hasNextPage,
    },
  };
};

export const toOffsetPageInfo = (pagination: OffsetPagination, total: number): OffsetPageInfo => {
  const totalPages = Math.max(1, Math.ceil(total / pagination.limit));
  return {
    page: pagination.page,
    limit: pagination.limit,
    total,
    totalPages,
    hasNextPage: pagination.page < totalPages,
  };
};

export const setCursorPaginationHeaders = (res: Response, pageInfo: CursorPageInfo) => {
  res.setHeader('X-Page-Limit', String(pageInfo.limit));
  res.setHeader('X-Has-Next-Page', String(pageInfo.hasNextPage));
  if (pageInfo.nextCursor) res.setHeader('X-Next-Cursor', pageInfo.nextCursor);
};

export const setOffsetPaginationHeaders = (res: Response, pageInfo: OffsetPageInfo) => {
  res.setHeader('X-Page', String(pageInfo.page));
  res.setHeader('X-Page-Limit', String(pageInfo.limit));
  res.setHeader('X-Total-Count', String(pageInfo.total));
  res.setHeader('X-Total-Pages', String(pageInfo.totalPages));
  res.setHeader('X-Has-Next-Page', String(pageInfo.hasNextPage));
};
