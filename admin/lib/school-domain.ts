const DEFAULT_ROOT_DOMAIN = 'app.akademifyy.in';
const DEFAULT_ADDITIONAL_ROOT_DOMAINS = ['app.saapttech.com'];
const RESERVED_SUBDOMAINS = new Set(['www', 'admin', 'app', 'api', 'assets', 'static']);

const cleanHost = (host?: string | null) => {
  if (!host) return null;
  const withoutProtocol = host.trim().toLowerCase().replace(/^https?:\/\//, '');
  const hostOnly = withoutProtocol.split('/')[0]?.trim();
  if (!hostOnly) return null;
  return hostOnly.replace(/\.$/, '').split(':')[0] || null;
};

const normalizeRootDomain = (value?: string | null) =>
  cleanHost(value)?.replace(/^www\./, '') ?? null;

const parseRootDomains = (value?: string | null) =>
  (value ?? '')
    .split(/[,\s]+/)
    .map((item) => normalizeRootDomain(item))
    .filter((item): item is string => Boolean(item));

export const getSchoolRootDomains = () => {
  const roots = [
    normalizeRootDomain(process.env.NEXT_PUBLIC_SCHOOL_ROOT_DOMAIN || DEFAULT_ROOT_DOMAIN),
    ...parseRootDomains(process.env.NEXT_PUBLIC_SCHOOL_ROOT_DOMAINS),
    ...parseRootDomains(process.env.NEXT_PUBLIC_ADDITIONAL_SCHOOL_ROOT_DOMAINS),
    ...DEFAULT_ADDITIONAL_ROOT_DOMAINS,
  ].filter((item): item is string => Boolean(item));

  return Array.from(new Set(roots));
};

export const getPrimarySchoolRootDomain = () => getSchoolRootDomains()[0] ?? DEFAULT_ROOT_DOMAIN;

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

const isValidSubdomain = (value?: string | null) => {
  const normalized = normalizeSchoolSubdomain(value);
  return Boolean(normalized && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(normalized) && !RESERVED_SUBDOMAINS.has(normalized));
};

export const resolveSchoolRootDomainFromHost = (host?: string | null) => {
  const hostname = cleanHost(host);
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') return null;

  return (
    getSchoolRootDomains()
      .sort((a, b) => b.length - a.length)
      .find((rootDomain) => hostname === rootDomain || hostname === `www.${rootDomain}` || hostname.endsWith(`.${rootDomain}`)) ?? null
  );
};

export const resolveSchoolSubdomainFromHost = (host?: string | null) => {
  const hostname = cleanHost(host);
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') return null;

  const localhostSuffix = '.localhost';
  if (hostname.endsWith(localhostSuffix)) {
    const subdomain = hostname.slice(0, -localhostSuffix.length);
    return isValidSubdomain(subdomain) ? normalizeSchoolSubdomain(subdomain) : null;
  }

  const rootDomain = resolveSchoolRootDomainFromHost(hostname);
  if (!rootDomain || hostname === rootDomain || hostname === `www.${rootDomain}`) return null;

  const rootSuffix = `.${rootDomain}`;

  const subdomain = hostname.slice(0, -rootSuffix.length);
  if (!subdomain || subdomain.includes('.')) return null;
  return isValidSubdomain(subdomain) ? normalizeSchoolSubdomain(subdomain) : null;
};

export const buildProductionSchoolUrl = (subdomain: string, rootDomain = getPrimarySchoolRootDomain()) =>
  `https://${subdomain}.${rootDomain}`;
export const buildLocalSchoolUrl = (subdomain: string, port = '3001') => `http://${subdomain}.localhost:${port}`;
