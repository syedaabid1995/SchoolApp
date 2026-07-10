export type PlatformBrand = {
  key: 'akademifyy' | 'saapt';
  appName: string;
  title: string;
  description: string;
  consoleName: string;
  footerText: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  apiBaseUrl: string;
};

const DEFAULT_API_BASE_URL = 'https://api.akademifyy.in/api/v1';
const SAAPT_API_BASE_URL = 'https://api.saapttech.com/api/v1';

export const akademifyyBrand: PlatformBrand = {
  key: 'akademifyy',
  appName: 'Akademifyy',
  title: 'Akademifyy',
  description: 'Akademifyy Admin Console',
  consoleName: 'Akademifyy Admin Console',
  footerText: '© 2026 Akademifyy. All rights reserved.',
  logoUrl: '/icon.png',
  faviconUrl: '/icon.png',
  primaryColor: '#2563eb',
  secondaryColor: '#0f172a',
  accentColor: '#22c55e',
  apiBaseUrl: DEFAULT_API_BASE_URL,
};

export const saaptBrand: PlatformBrand = {
  key: 'saapt',
  appName: 'SAAPT',
  title: 'SAAPT',
  description: 'SAAPT Admin Console',
  consoleName: 'SAAPT Platform Console',
  footerText: '© 2026 SAAPT. All rights reserved.',
  logoUrl: '/branding/saapt-logo.svg',
  faviconUrl: '/branding/saapt-favicon.svg',
  primaryColor: '#0f766e',
  secondaryColor: '#102a2a',
  accentColor: '#f59e0b',
  apiBaseUrl: SAAPT_API_BASE_URL,
};

export const cleanHost = (host?: string | null) => {
  if (!host) return '';
  return host
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .replace(/\.$/, '')
    .split(':')[0];
};

export const isSaaptHost = (host?: string | null) => {
  const hostname = cleanHost(host);
  return hostname === 'saapttech.com' || hostname.endsWith('.saapttech.com');
};

export const getPlatformBrandForHost = (host?: string | null): PlatformBrand =>
  isSaaptHost(host) ? saaptBrand : akademifyyBrand;

export const getCurrentPlatformBrand = () => {
  if (typeof window === 'undefined') return akademifyyBrand;
  return getPlatformBrandForHost(window.location.host);
};

export const getClientApiBaseUrl = () => {
  const hostBrand = getCurrentPlatformBrand();
  if (hostBrand.key === 'saapt') return hostBrand.apiBaseUrl;

  return (
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    (process.env.NODE_ENV === 'production' ? '' : 'http://127.0.0.1:3000/api/v1')
  );
};
