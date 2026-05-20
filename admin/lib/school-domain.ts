const ROOT_DOMAIN = 'akademify.techstageit.com';
const RESERVED_SUBDOMAINS = new Set(['www', 'admin', 'app', 'api', 'assets', 'static']);

const cleanHost = (host?: string | null) => {
  if (!host) return null;
  const withoutProtocol = host.trim().toLowerCase().replace(/^https?:\/\//, '');
  const hostOnly = withoutProtocol.split('/')[0]?.trim();
  if (!hostOnly) return null;
  return hostOnly.replace(/\.$/, '').split(':')[0] || null;
};

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

export const resolveSchoolSubdomainFromHost = (host?: string | null) => {
  const hostname = cleanHost(host);
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') return null;

  if (hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}`) return null;

  const localhostSuffix = '.localhost';
  if (hostname.endsWith(localhostSuffix)) {
    const subdomain = hostname.slice(0, -localhostSuffix.length);
    return isValidSubdomain(subdomain) ? normalizeSchoolSubdomain(subdomain) : null;
  }

  const rootSuffix = `.${ROOT_DOMAIN}`;
  if (!hostname.endsWith(rootSuffix)) return null;

  const subdomain = hostname.slice(0, -rootSuffix.length);
  if (!subdomain || subdomain.includes('.')) return null;
  return isValidSubdomain(subdomain) ? normalizeSchoolSubdomain(subdomain) : null;
};

export const buildProductionSchoolUrl = (subdomain: string) => `https://${subdomain}.${ROOT_DOMAIN}`;
export const buildLocalSchoolUrl = (subdomain: string, port = '3001') => `http://${subdomain}.localhost:${port}`;
