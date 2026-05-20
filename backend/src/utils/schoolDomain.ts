const DEFAULT_ROOT_DOMAIN = 'akademify.techstageit.com';
const DEFAULT_LOCAL_HOST = 'localhost';

const RESERVED_SUBDOMAINS = new Set(['www', 'admin', 'app', 'api', 'assets', 'static']);

const cleanHost = (host?: string | null) => {
  if (!host) return null;
  const withoutProtocol = host.trim().toLowerCase().replace(/^https?:\/\//, '');
  const hostOnly = withoutProtocol.split('/')[0]?.trim();
  if (!hostOnly) return null;
  return hostOnly.replace(/\.$/, '').split(':')[0] || null;
};

export const getSchoolRootDomain = () =>
  (process.env.SCHOOL_PUBLIC_ROOT_DOMAIN || DEFAULT_ROOT_DOMAIN).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');

export const normalizeSchoolSubdomain = (value?: string | null) => {
  const normalized = (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
    .replace(/-+$/g, '');

  return normalized || null;
};

export const isValidSchoolSubdomain = (value?: string | null) => {
  const normalized = normalizeSchoolSubdomain(value);
  return Boolean(normalized && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(normalized) && !RESERVED_SUBDOMAINS.has(normalized));
};

export const buildSchoolDomainUrl = (subdomain: string) =>
  `https://${subdomain}.${getSchoolRootDomain()}`;

export const buildLocalSchoolDomainUrl = (subdomain: string, port = process.env.SCHOOL_LOCAL_PORT || '3001') =>
  `http://${subdomain}.${DEFAULT_LOCAL_HOST}:${port}`;

export const resolveSchoolSubdomainFromHost = (host?: string | null) => {
  const hostname = cleanHost(host);
  if (!hostname || hostname === DEFAULT_LOCAL_HOST || hostname === '127.0.0.1') return null;

  const rootDomain = getSchoolRootDomain();
  if (hostname === rootDomain || hostname === `www.${rootDomain}`) return null;

  const localhostSuffix = `.${DEFAULT_LOCAL_HOST}`;
  if (hostname.endsWith(localhostSuffix)) {
    const localSubdomain = hostname.slice(0, -localhostSuffix.length);
    return isValidSchoolSubdomain(localSubdomain) ? normalizeSchoolSubdomain(localSubdomain) : null;
  }

  const rootSuffix = `.${rootDomain}`;
  if (!hostname.endsWith(rootSuffix)) return null;

  const subdomain = hostname.slice(0, -rootSuffix.length);
  if (!subdomain || subdomain.includes('.')) return null;
  return isValidSchoolSubdomain(subdomain) ? normalizeSchoolSubdomain(subdomain) : null;
};

export const schoolIdentifierWhere = (identifier?: string | null) => {
  const value = identifier?.trim() ?? '';
  const subdomain = normalizeSchoolSubdomain(value) ?? value;
  return {
    OR: [
      { code: { equals: value, mode: 'insensitive' as const } },
      { subdomain: { equals: subdomain, mode: 'insensitive' as const } },
    ],
  };
};
