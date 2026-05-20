export type LoginBranding = {
  appName: string;
  schoolName?: string;
  logoUrl?: string;
  darkLogoUrl?: string;
  compactLogoUrl?: string;
  faviconUrl?: string;
  loginHeading: string;
  loginSubtitle: string;
  leftPanelTitle: string;
  leftPanelDescription: string;
  features: string[];
  securityNote: string;
  footerText: string;
  supportText: string;
  forgotPasswordText: string;
  loginButtonText: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  cardBackgroundColor: string;
  textColor: string;
  mutedTextColor: string;
  borderColor: string;
  buttonBackgroundColor?: string;
  buttonTextColor: string;
  linkColor: string;
  focusRingColor?: string;
  errorColor: string;
  successColor?: string;
  backgroundType?: 'solid' | 'gradient' | 'image' | 'pattern';
  backgroundImageUrl?: string;
  gradientFrom?: string;
  gradientTo?: string;
  borderRadius?: string;
  cardShadow?: string;
  logoSize?: string;
  illustrationUrl?: string;
  leftPanelEnabled?: boolean;
};

export const defaultLoginBranding: LoginBranding = {
  appName: 'School Management System',
  schoolName: 'School Portal',
  loginHeading: 'Welcome back',
  loginSubtitle: 'Sign in to continue to your dashboard',
  leftPanelTitle: 'Manage your school in one place',
  leftPanelDescription: 'Academics, attendance, exams, fees, and communication - all connected.',
  features: [
    'Multi-school management',
    'Attendance and exams',
    'Parent and teacher portal',
    'Secure role-based access',
  ],
  securityNote: 'Your session is protected with secure cookies.',
  footerText: '© 2026 School Management System. All rights reserved.',
  supportText: 'Need help? Contact your school administrator.',
  forgotPasswordText: 'Forgot password?',
  loginButtonText: 'Sign in',
  primaryColor: '#2563eb',
  secondaryColor: '#0f172a',
  accentColor: '#22c55e',
  backgroundColor: '#f8fafc',
  cardBackgroundColor: '#ffffff',
  textColor: '#0f172a',
  mutedTextColor: '#64748b',
  borderColor: '#e2e8f0',
  buttonBackgroundColor: '#2563eb',
  buttonTextColor: '#ffffff',
  linkColor: '#2563eb',
  focusRingColor: '#2563eb',
  errorColor: '#dc2626',
  successColor: '#16a34a',
  backgroundType: 'gradient',
  gradientFrom: '#eff6ff',
  gradientTo: '#ffffff',
  borderRadius: '24px',
  cardShadow: '0 24px 70px rgba(15, 23, 42, 0.14)',
  logoSize: '56px',
  leftPanelEnabled: true,
};

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const pickString = (value: unknown, fallback: string, maxLength = 500) => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : fallback;
};

const pickColor = (value: unknown, fallback: string) => {
  const color = pickString(value, '', 32);
  return HEX_PATTERN.test(color) ? color : fallback;
};

const pickBoolean = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);

const pickFeatures = (value: unknown) => {
  if (!Array.isArray(value)) return defaultLoginBranding.features;
  const features = value.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean);
  return features.length ? features.slice(0, 8) : defaultLoginBranding.features;
};

const pickBackgroundType = (value: unknown): LoginBranding['backgroundType'] =>
  value === 'solid' || value === 'gradient' || value === 'image' || value === 'pattern'
    ? value
    : defaultLoginBranding.backgroundType;

const normalizeBranding = (value: unknown): LoginBranding => {
  const source = isRecord(value) ? value : {};
  return {
    appName: pickString(source.appName, defaultLoginBranding.appName, 80),
    schoolName: pickString(source.schoolName, defaultLoginBranding.schoolName ?? '', 120),
    logoUrl: pickString(source.logoUrl, defaultLoginBranding.logoUrl ?? '', 2000),
    darkLogoUrl: pickString(source.darkLogoUrl, '', 2000),
    compactLogoUrl: pickString(source.compactLogoUrl, '', 2000),
    faviconUrl: pickString(source.faviconUrl, '', 2000),
    loginHeading: pickString(source.loginHeading, defaultLoginBranding.loginHeading, 120),
    loginSubtitle: pickString(source.loginSubtitle, defaultLoginBranding.loginSubtitle, 220),
    leftPanelTitle: pickString(source.leftPanelTitle, defaultLoginBranding.leftPanelTitle, 140),
    leftPanelDescription: pickString(source.leftPanelDescription, defaultLoginBranding.leftPanelDescription, 260),
    features: pickFeatures(source.features),
    securityNote: pickString(source.securityNote, defaultLoginBranding.securityNote, 180),
    footerText: pickString(source.footerText, defaultLoginBranding.footerText, 180),
    supportText: pickString(source.supportText, defaultLoginBranding.supportText, 180),
    forgotPasswordText: pickString(source.forgotPasswordText, defaultLoginBranding.forgotPasswordText, 80),
    loginButtonText: pickString(source.loginButtonText, defaultLoginBranding.loginButtonText, 80),
    primaryColor: pickColor(source.primaryColor, defaultLoginBranding.primaryColor),
    secondaryColor: pickColor(source.secondaryColor, defaultLoginBranding.secondaryColor),
    accentColor: pickColor(source.accentColor, defaultLoginBranding.accentColor),
    backgroundColor: pickColor(source.backgroundColor, defaultLoginBranding.backgroundColor),
    cardBackgroundColor: pickColor(source.cardBackgroundColor, defaultLoginBranding.cardBackgroundColor),
    textColor: pickColor(source.textColor, defaultLoginBranding.textColor),
    mutedTextColor: pickColor(source.mutedTextColor, defaultLoginBranding.mutedTextColor),
    borderColor: pickColor(source.borderColor, defaultLoginBranding.borderColor),
    buttonBackgroundColor: pickColor(
      source.buttonBackgroundColor,
      pickColor(source.primaryColor, defaultLoginBranding.buttonBackgroundColor ?? defaultLoginBranding.primaryColor),
    ),
    buttonTextColor: pickColor(source.buttonTextColor, defaultLoginBranding.buttonTextColor),
    linkColor: pickColor(source.linkColor, defaultLoginBranding.linkColor),
    focusRingColor: pickColor(source.focusRingColor, defaultLoginBranding.focusRingColor ?? defaultLoginBranding.primaryColor),
    errorColor: pickColor(source.errorColor, defaultLoginBranding.errorColor),
    successColor: pickColor(source.successColor, defaultLoginBranding.successColor ?? '#16a34a'),
    backgroundType: pickBackgroundType(source.backgroundType),
    backgroundImageUrl: pickString(source.backgroundImageUrl, '', 2000),
    gradientFrom: pickColor(source.gradientFrom, defaultLoginBranding.gradientFrom ?? defaultLoginBranding.backgroundColor),
    gradientTo: pickColor(source.gradientTo, defaultLoginBranding.gradientTo ?? defaultLoginBranding.cardBackgroundColor),
    borderRadius: pickString(source.borderRadius, defaultLoginBranding.borderRadius ?? '24px', 32),
    cardShadow: pickString(source.cardShadow, defaultLoginBranding.cardShadow ?? '', 140),
    logoSize: pickString(source.logoSize, defaultLoginBranding.logoSize ?? '56px', 32),
    illustrationUrl: pickString(source.illustrationUrl, '', 2000),
    leftPanelEnabled: pickBoolean(source.leftPanelEnabled, defaultLoginBranding.leftPanelEnabled ?? true),
  };
};

const schoolCodeFromHost = () => {
  if (typeof window === 'undefined') return undefined;
  const hostname = window.location.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname === '127.0.0.1') return undefined;
  const parts = hostname.split('.');
  if (parts.length < 3) return undefined;
  const subdomain = parts[0];
  if (['www', 'admin', 'app'].includes(subdomain)) return undefined;
  return /^[a-zA-Z0-9_-]{2,64}$/.test(subdomain) ? subdomain : undefined;
};

export const getLoginBranding = async (schoolCode?: string): Promise<LoginBranding> => {
  const effectiveSchoolCode = schoolCode?.trim() || schoolCodeFromHost();
  const search = new URLSearchParams();
  if (effectiveSchoolCode) search.set('schoolCode', effectiveSchoolCode);

  try {
    const res = await fetch(`/api/proxy/public/branding/login${search.toString() ? `?${search.toString()}` : ''}`, {
      cache: 'no-store',
    });
    if (!res.ok) return defaultLoginBranding;
    return normalizeBranding(await res.json());
  } catch {
    return defaultLoginBranding;
  }
};
