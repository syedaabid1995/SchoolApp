import type { Request } from 'express';

type MockRequestOptions = {
  body?: unknown;
  query?: Record<string, unknown>;
  params?: Record<string, unknown>;
  headers?: Record<string, string | undefined>;
  auth?: { userId: string; schoolId: string | null; role?: string | null };
  originalUrl?: string;
  path?: string;
  method?: string;
  ip?: string;
};

const normalizeHeaders = (headers: Record<string, string | undefined>) => {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    normalized[key.toLowerCase()] = value;
  }
  return normalized;
};

export const createMockRequest = (options: MockRequestOptions = {}) => {
  const headers = normalizeHeaders(options.headers ?? {});
  const lookupHeader = (name: string) => headers[name.toLowerCase()];

  return {
    body: options.body ?? {},
    query: options.query ?? {},
    params: options.params ?? {},
    headers,
    ip: options.ip ?? '127.0.0.1',
    socket: { remoteAddress: options.ip ?? '127.0.0.1' },
    auth: options.auth,
    originalUrl: options.originalUrl ?? '/',
    path: options.path ?? options.originalUrl ?? '/',
    method: options.method ?? 'GET',
    header: lookupHeader,
    get: lookupHeader,
  } as unknown as Request;
};
