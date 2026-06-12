import type { Response } from 'express';

export type MockResponse = {
  statusCode: number;
  body: unknown;
  cookies: Record<string, { value: string; options: unknown }>;
  clearedCookies: string[];
  headers: Record<string, string>;
  status: (code: number) => MockResponse;
  json: (body: unknown) => MockResponse;
  cookie: (name: string, value: string, options: unknown) => MockResponse;
  clearCookie: (name: string) => MockResponse;
  set: (name: string, value: string) => MockResponse;
};

export const createMockResponse = () => {
  const response: MockResponse = {
    statusCode: 200,
    body: null,
    cookies: {},
    clearedCookies: [],
    headers: {},
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
    cookie(name: string, value: string, options: unknown) {
      this.cookies[name] = { value, options };
      return this;
    },
    clearCookie(name: string) {
      this.clearedCookies.push(name);
      return this;
    },
    set(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
  };

  return response as MockResponse & Response;
};
