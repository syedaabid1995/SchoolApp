import type { Request } from 'express';
import { env } from '../config/env';
import {
  buildSchoolDomainUrl,
  normalizeSchoolSubdomain,
  resolveSchoolRootDomainFromHost,
} from './schoolDomain';

const requestHeaderValue = (req: Request, name: string) => {
  const value = req.headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
};

const appendLoginPath = (value: string) => `${value.replace(/\/+$/, '')}/login`;

export const resolveSchoolRootDomainFromRequest = (req: Request) => {
  const candidates = [
    requestHeaderValue(req, 'x-forwarded-host'),
    requestHeaderValue(req, 'origin'),
    requestHeaderValue(req, 'referer'),
    requestHeaderValue(req, 'host'),
  ];

  for (const candidate of candidates) {
    const rootDomain = resolveSchoolRootDomainFromHost(candidate);
    if (rootDomain) return rootDomain;
  }
  return null;
};

export const buildPlatformLoginUrlFromRequest = (req: Request) => {
  const rootDomain = resolveSchoolRootDomainFromRequest(req);
  if (rootDomain) return `https://${rootDomain}/login`;
  return appendLoginPath(env.FRONTEND_URL);
};

export const buildSchoolLoginUrlFromRequest = (
  req: Request,
  school?: { code?: string | null; subdomain?: string | null; domainUrl?: string | null } | null,
) => {
  const subdomain = normalizeSchoolSubdomain(school?.code ?? school?.subdomain ?? '');
  if (subdomain) {
    const rootDomain = resolveSchoolRootDomainFromRequest(req) ?? undefined;
    return appendLoginPath(buildSchoolDomainUrl(subdomain, rootDomain));
  }

  return school?.domainUrl ? appendLoginPath(school.domainUrl) : buildPlatformLoginUrlFromRequest(req);
};
