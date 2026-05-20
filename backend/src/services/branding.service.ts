import { prisma } from '../config/db';
import { resolveSchoolSubdomainFromHost, schoolIdentifierWhere } from '../utils/schoolDomain';
import { LOGIN_EXPERIENCE_KEY } from './loginExperience.service';

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
const SCHOOL_CODE_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const pickString = (value: unknown, fallback = '', maxLength = 500) => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : fallback;
};

const pickColor = (value: unknown, fallback: string) => {
  const next = pickString(value, '', 32);
  return HEX_PATTERN.test(next) ? next : fallback;
};

const pickBoolean = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);

const pickStringArray = (value: unknown, fallback: string[]) => {
  if (!Array.isArray(value)) return fallback;
  const next = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 8);
  return next.length ? next : fallback;
};

const pickBackgroundType = (value: unknown, fallback: LoginBranding['backgroundType']) =>
  value === 'solid' || value === 'gradient' || value === 'image' || value === 'pattern' ? value : fallback;

const firstHexFromCss = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  return value.match(/#[0-9a-fA-F]{6}/)?.[0] ?? null;
};

export const normalizeLoginBranding = (
  source: unknown,
  params: {
    schoolName?: string | null;
    themeTokens?: Record<string, unknown>;
  } = {},
): LoginBranding => {
  const data = isRecord(source) ? source : {};
  const theme = isRecord(data.theme) ? data.theme : {};
  const tokens = params.themeTokens ?? {};
  const schoolName = params.schoolName ?? pickString(tokens.schoolName, pickString(data.schoolName, defaultLoginBranding.schoolName));

  const primaryColor = pickColor(
    tokens.loginPrimaryColor ?? tokens.primaryColor ?? tokens.buttonBg ?? theme.primaryColor,
    defaultLoginBranding.primaryColor,
  );
  const secondaryColor = pickColor(tokens.loginSecondaryColor ?? tokens.secondaryColor ?? tokens.navbarBg ?? theme.secondaryColor, defaultLoginBranding.secondaryColor);
  const accentColor = pickColor(tokens.loginAccentColor ?? tokens.accentColor ?? tokens.headerBg ?? theme.accentColor, defaultLoginBranding.accentColor);
  const buttonBackgroundColor = pickColor(tokens.loginButtonColor ?? tokens.buttonBg ?? theme.buttonBackgroundColor ?? data.buttonBackgroundColor, primaryColor);

  return {
    appName: pickString(tokens.appName ?? data.appName ?? data.brandName, defaultLoginBranding.appName, 80),
    schoolName: schoolName ?? undefined,
    logoUrl: pickString(tokens.loginLogoUrl ?? tokens.logoUrl ?? data.logoUrl, defaultLoginBranding.logoUrl ?? '', 2000),
    darkLogoUrl: pickString(tokens.darkLogoUrl ?? data.darkLogoUrl, '', 2000),
    compactLogoUrl: pickString(tokens.compactLogoUrl ?? data.compactLogoUrl, '', 2000),
    faviconUrl: pickString(tokens.faviconUrl ?? data.faviconUrl, '', 2000),
    loginHeading: pickString(tokens.loginHeading ?? data.loginHeading ?? data.headline, defaultLoginBranding.loginHeading, 120),
    loginSubtitle: pickString(tokens.loginSubtitle ?? data.loginSubtitle ?? data.subtitle, defaultLoginBranding.loginSubtitle, 220),
    leftPanelTitle: pickString(tokens.leftPanelTitle ?? data.leftPanelTitle, defaultLoginBranding.leftPanelTitle, 140),
    leftPanelDescription: pickString(tokens.leftPanelDescription ?? data.leftPanelDescription, defaultLoginBranding.leftPanelDescription, 260),
    features: pickStringArray(tokens.features ?? data.features, defaultLoginBranding.features),
    securityNote: pickString(tokens.securityNote ?? data.securityNote, defaultLoginBranding.securityNote, 180),
    footerText: pickString(tokens.footerText ?? data.footerText, defaultLoginBranding.footerText, 180),
    supportText: pickString(tokens.supportText ?? data.supportText, defaultLoginBranding.supportText, 180),
    forgotPasswordText: pickString(tokens.forgotPasswordText ?? data.forgotPasswordText, defaultLoginBranding.forgotPasswordText, 80),
    loginButtonText: pickString(tokens.loginButtonText ?? data.loginButtonText, defaultLoginBranding.loginButtonText, 80),
    primaryColor,
    secondaryColor,
    accentColor,
    backgroundColor: pickColor(tokens.loginBackgroundColor ?? data.backgroundColor ?? tokens.backgroundColor ?? theme.backgroundColor, defaultLoginBranding.backgroundColor),
    cardBackgroundColor: pickColor(tokens.loginCardBackgroundColor ?? tokens.cardBackgroundColor ?? theme.panelColor, defaultLoginBranding.cardBackgroundColor),
    textColor: pickColor(tokens.loginTextColor ?? tokens.textColor ?? theme.textColor, defaultLoginBranding.textColor),
    mutedTextColor: pickColor(tokens.loginMutedTextColor ?? tokens.mutedTextColor ?? theme.mutedTextColor, defaultLoginBranding.mutedTextColor),
    borderColor: pickColor(tokens.loginBorderColor ?? tokens.borderColor ?? theme.borderColor, defaultLoginBranding.borderColor),
    buttonBackgroundColor,
    buttonTextColor: pickColor(tokens.loginButtonTextColor ?? tokens.buttonText ?? theme.buttonTextColor ?? data.buttonTextColor, defaultLoginBranding.buttonTextColor),
    linkColor: pickColor(tokens.loginLinkColor ?? tokens.linkColor ?? theme.linkColor ?? data.linkColor, primaryColor),
    focusRingColor: pickColor(tokens.loginFocusRingColor ?? tokens.focusRingColor, primaryColor),
    errorColor: pickColor(tokens.loginErrorColor ?? tokens.errorColor ?? theme.errorColor, defaultLoginBranding.errorColor),
    successColor: pickColor(tokens.loginSuccessColor ?? tokens.successColor ?? theme.successColor, defaultLoginBranding.successColor ?? '#16a34a'),
    backgroundType: pickBackgroundType(tokens.loginBackgroundType ?? tokens.backgroundType ?? data.backgroundType, defaultLoginBranding.backgroundType),
    backgroundImageUrl: pickString(tokens.loginBackgroundImageUrl ?? tokens.backgroundImageUrl ?? data.backgroundImageUrl, '', 2000),
    gradientFrom: pickColor(tokens.loginGradientFrom ?? data.gradientFrom ?? firstHexFromCss(tokens.navbarBg), defaultLoginBranding.gradientFrom ?? defaultLoginBranding.backgroundColor),
    gradientTo: pickColor(tokens.loginGradientTo ?? data.gradientTo ?? firstHexFromCss(tokens.headerBg), defaultLoginBranding.gradientTo ?? defaultLoginBranding.cardBackgroundColor),
    borderRadius: pickString(tokens.loginBorderRadius ?? data.borderRadius ?? tokens.borderRadius, defaultLoginBranding.borderRadius, 32),
    cardShadow: pickString(tokens.loginCardShadow ?? data.cardShadow ?? tokens.cardShadow, defaultLoginBranding.cardShadow, 140),
    logoSize: pickString(tokens.loginLogoSize ?? data.logoSize ?? tokens.logoSize, defaultLoginBranding.logoSize, 32),
    illustrationUrl: pickString(tokens.loginIllustrationUrl ?? data.illustrationUrl ?? tokens.illustrationUrl, '', 2000),
    leftPanelEnabled: pickBoolean(tokens.leftPanelEnabled ?? data.leftPanelEnabled, defaultLoginBranding.leftPanelEnabled ?? true),
  };
};

export const getLoginBranding = async (params: { schoolCode?: string; host?: string | null }) => {
  const requestedCode = params.schoolCode?.trim() || resolveSchoolSubdomainFromHost(params.host) || undefined;
  const validCode = requestedCode && SCHOOL_CODE_PATTERN.test(requestedCode) ? requestedCode : undefined;

  const [config, school] = await Promise.all([
    prisma.configEntry.findUnique({ where: { key: LOGIN_EXPERIENCE_KEY } }),
    validCode
      ? prisma.school.findFirst({
          where: schoolIdentifierWhere(validCode),
          select: { id: true, name: true, code: true, subdomain: true, domainUrl: true },
        })
      : Promise.resolve(null),
  ]);

  const activeTheme = school
    ? await prisma.theme.findFirst({
        where: { schoolId: school.id, status: 'PUBLISHED' },
        orderBy: { updatedAt: 'desc' },
        select: { tokens: true },
      })
    : null;

  return normalizeLoginBranding(config?.value, {
    schoolName: school?.name,
    themeTokens: isRecord(activeTheme?.tokens) ? activeTheme.tokens : undefined,
  });
};
