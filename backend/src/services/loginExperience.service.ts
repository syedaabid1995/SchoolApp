import { prisma } from '../config/db';

export const LOGIN_EXPERIENCE_KEY = 'login.experience';

export type LoginTypeId = 'admin' | 'staff' | 'teacher' | 'student' | 'parent';
export type LoginAuthMode = 'password' | 'otp';

export type LoginExperienceTheme = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  panelColor: string;
  textColor: string;
  mutedTextColor: string;
  borderColor: string;
  buttonBackgroundColor: string;
  buttonTextColor: string;
  linkColor: string;
  errorColor: string;
  successColor: string;
};

export type LoginTypeConfig = {
  id: LoginTypeId;
  label: string;
  description: string;
  enabled: boolean;
  authMode: LoginAuthMode;
  requiresSchoolId: boolean;
  schoolIdOptional?: boolean;
  unavailableMessage?: string;
};

export type LoginExperience = {
  brandName: string;
  appName: string;
  consoleName: string;
  headline: string;
  subtitle: string;
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
  supportUrl: string;
  logoUrl: string;
  backgroundImageUrl: string;
  illustrationUrl: string;
  backgroundType: 'solid' | 'gradient' | 'image' | 'pattern';
  leftPanelEnabled: boolean;
  theme: LoginExperienceTheme;
  loginTypes: LoginTypeConfig[];
};

export const defaultLoginExperience: LoginExperience = {
  brandName: 'SchoolApp',
  appName: 'School Management System',
  consoleName: 'Admin Console',
  headline: 'Choose your login type',
  subtitle: 'Select your access role to continue to the right sign in method.',
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
  supportUrl: 'https://techstageit.com/#contact',
  logoUrl: '',
  backgroundImageUrl: '',
  illustrationUrl: '',
  backgroundType: 'gradient',
  leftPanelEnabled: true,
  theme: {
    primaryColor: '#0f172a',
    secondaryColor: '#0f172a',
    accentColor: '#0ea5e9',
    backgroundColor: '#eef4f8',
    panelColor: '#ffffff',
    textColor: '#0f172a',
    mutedTextColor: '#64748b',
    borderColor: '#e2e8f0',
    buttonBackgroundColor: '#2563eb',
    buttonTextColor: '#ffffff',
    linkColor: '#2563eb',
    errorColor: '#dc2626',
    successColor: '#16a34a',
  },
  loginTypes: [
    {
      id: 'admin',
      label: 'Admin',
      description: 'Platform and school administration access',
      enabled: true,
      authMode: 'password',
      requiresSchoolId: false,
      schoolIdOptional: true,
    },
    {
      id: 'staff',
      label: 'Staff',
      description: 'Office, accountant, librarian, and staff access',
      enabled: true,
      authMode: 'password',
      requiresSchoolId: true,
    },
    {
      id: 'teacher',
      label: 'Teacher',
      description: 'Classroom, timetable, attendance, and exam access',
      enabled: true,
      authMode: 'password',
      requiresSchoolId: true,
    },
    {
      id: 'student',
      label: 'Student',
      description: 'Student access',
      enabled: false,
      authMode: 'password',
      requiresSchoolId: true,
      unavailableMessage: 'Student login is not enabled yet.',
    },
    {
      id: 'parent',
      label: 'Parents',
      description: 'Parent portal access using mobile OTP or password',
      enabled: true,
      authMode: 'otp',
      requiresSchoolId: false,
    },
  ],
};

const LOGIN_TYPE_ORDER: LoginTypeId[] = ['admin', 'staff', 'teacher', 'student', 'parent'];
const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const pickString = (value: unknown, fallback: string, maxLength = 200) => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
};

const pickColor = (value: unknown, fallback: string) => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return HEX_PATTERN.test(trimmed) ? trimmed : fallback;
};

const firstHexFromCss = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const match = value.match(/#[0-9a-fA-F]{6}/);
  return match?.[0] ?? null;
};

const pickBoolean = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);

const pickAuthMode = (value: unknown, fallback: LoginAuthMode): LoginAuthMode =>
  value === 'otp' || value === 'password' ? value : fallback;

const pickStringArray = (value: unknown, fallback: string[]) => {
  if (!Array.isArray(value)) return fallback;
  const next = value.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean).slice(0, 8);
  return next.length ? next : fallback;
};

const pickBackgroundType = (value: unknown, fallback: LoginExperience['backgroundType']) =>
  value === 'solid' || value === 'gradient' || value === 'image' || value === 'pattern' ? value : fallback;

export const normalizeLoginExperience = (value: unknown): LoginExperience => {
  const source = isRecord(value) ? value : {};
  const themeSource = isRecord(source.theme) ? source.theme : {};

  const savedTypes = Array.isArray(source.loginTypes)
    ? source.loginTypes.filter(isRecord)
    : [];

  const loginTypes = LOGIN_TYPE_ORDER.map((id) => {
    const fallback = defaultLoginExperience.loginTypes.find((item) => item.id === id)!;
    const saved = savedTypes.find((item) => item.id === id);

    return {
      id,
      label: pickString(saved?.label, fallback.label, 40),
      description: pickString(saved?.description, fallback.description, 140),
      enabled: pickBoolean(saved?.enabled, fallback.enabled),
      authMode: pickAuthMode(saved?.authMode, fallback.authMode),
      requiresSchoolId: pickBoolean(saved?.requiresSchoolId, fallback.requiresSchoolId),
      schoolIdOptional: pickBoolean(saved?.schoolIdOptional, Boolean(fallback.schoolIdOptional)),
      unavailableMessage: pickString(saved?.unavailableMessage, fallback.unavailableMessage ?? '', 140),
    };
  });

  return {
    brandName: pickString(source.brandName, defaultLoginExperience.brandName, 60),
    appName: pickString(source.appName, defaultLoginExperience.appName, 80),
    consoleName: pickString(source.consoleName, defaultLoginExperience.consoleName, 60),
    headline: pickString(source.headline, defaultLoginExperience.headline, 90),
    subtitle: pickString(source.subtitle, defaultLoginExperience.subtitle, 160),
    loginHeading: pickString(source.loginHeading, defaultLoginExperience.loginHeading, 120),
    loginSubtitle: pickString(source.loginSubtitle, defaultLoginExperience.loginSubtitle, 220),
    leftPanelTitle: pickString(source.leftPanelTitle, defaultLoginExperience.leftPanelTitle, 140),
    leftPanelDescription: pickString(source.leftPanelDescription, defaultLoginExperience.leftPanelDescription, 260),
    features: pickStringArray(source.features, defaultLoginExperience.features),
    securityNote: pickString(source.securityNote, defaultLoginExperience.securityNote, 180),
    footerText: pickString(source.footerText, defaultLoginExperience.footerText, 180),
    supportText: pickString(source.supportText, defaultLoginExperience.supportText, 180),
    forgotPasswordText: pickString(source.forgotPasswordText, defaultLoginExperience.forgotPasswordText, 80),
    loginButtonText: pickString(source.loginButtonText, defaultLoginExperience.loginButtonText, 80),
    supportUrl: pickString(source.supportUrl, defaultLoginExperience.supportUrl, 500),
    logoUrl: pickString(source.logoUrl, defaultLoginExperience.logoUrl, 2000),
    backgroundImageUrl: pickString(source.backgroundImageUrl, defaultLoginExperience.backgroundImageUrl, 2000),
    illustrationUrl: pickString(source.illustrationUrl, defaultLoginExperience.illustrationUrl, 2000),
    backgroundType: pickBackgroundType(source.backgroundType, defaultLoginExperience.backgroundType),
    leftPanelEnabled: pickBoolean(source.leftPanelEnabled, defaultLoginExperience.leftPanelEnabled),
    theme: {
      primaryColor: pickColor(themeSource.primaryColor, defaultLoginExperience.theme.primaryColor),
      secondaryColor: pickColor(themeSource.secondaryColor, defaultLoginExperience.theme.secondaryColor),
      accentColor: pickColor(themeSource.accentColor, defaultLoginExperience.theme.accentColor),
      backgroundColor: pickColor(themeSource.backgroundColor, defaultLoginExperience.theme.backgroundColor),
      panelColor: pickColor(themeSource.panelColor, defaultLoginExperience.theme.panelColor),
      textColor: pickColor(themeSource.textColor, defaultLoginExperience.theme.textColor),
      mutedTextColor: pickColor(themeSource.mutedTextColor, defaultLoginExperience.theme.mutedTextColor),
      borderColor: pickColor(themeSource.borderColor, defaultLoginExperience.theme.borderColor),
      buttonBackgroundColor: pickColor(themeSource.buttonBackgroundColor, defaultLoginExperience.theme.buttonBackgroundColor),
      buttonTextColor: pickColor(themeSource.buttonTextColor, defaultLoginExperience.theme.buttonTextColor),
      linkColor: pickColor(themeSource.linkColor, defaultLoginExperience.theme.linkColor),
      errorColor: pickColor(themeSource.errorColor, defaultLoginExperience.theme.errorColor),
      successColor: pickColor(themeSource.successColor, defaultLoginExperience.theme.successColor),
    },
    loginTypes,
  };
};

export const getStoredLoginExperience = async () => {
  const entry = await prisma.configEntry.findUnique({ where: { key: LOGIN_EXPERIENCE_KEY } });
  return normalizeLoginExperience(entry?.value);
};

export const getLoginExperienceForSchool = async (schoolId?: string) => {
  const experience = await getStoredLoginExperience();
  if (!schoolId || !/^[0-9a-fA-F-]{36}$/.test(schoolId)) {
    return experience;
  }

  const activeTheme = await prisma.theme.findFirst({
    where: { schoolId, status: 'PUBLISHED' },
    orderBy: { updatedAt: 'desc' },
  });

  if (!activeTheme || !isRecord(activeTheme.tokens)) {
    return experience;
  }

  const tokens = activeTheme.tokens;
  const primaryColor =
    firstHexFromCss(tokens.buttonBg) ||
    firstHexFromCss(tokens.navbarBg) ||
    firstHexFromCss(tokens.headerBg) ||
    experience.theme.primaryColor;
  const accentColor =
    firstHexFromCss(tokens.headerBg) ||
    firstHexFromCss(tokens.navbarBg) ||
    experience.theme.accentColor;
  const logoUrl = pickString(tokens.logoUrl, experience.logoUrl, 2000);

  return {
    ...experience,
    logoUrl,
    theme: {
      ...experience.theme,
      primaryColor,
      accentColor,
    },
  };
};
