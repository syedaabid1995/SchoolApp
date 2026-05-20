import type { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { resolveSchoolId } from '../utils/tenant';
import { cacheKeys } from '../services/cache/cache.keys';
import { rememberCache, setCacheHeader } from '../services/cache/cache.service';
import { cacheTTL } from '../services/cache/cache.ttl';
import { invalidateThemeCache } from '../services/cache/cache.invalidation';
import { createAuditLog } from '../services/auditLog.service';
import {
  defaultLoginBranding,
  normalizeLoginBranding,
  type LoginBranding,
} from '../services/branding.service';
import {
  LOGIN_EXPERIENCE_KEY,
  getStoredLoginExperience,
} from '../services/loginExperience.service';

const createSchema = z.object({
  name: z.string().min(1),
  tokens: z.record(z.unknown()),
  schoolId: z.string().uuid().optional(),
});

const updateSchema = z.object({
  tokens: z.record(z.unknown()),
  schoolId: z.string().uuid().optional(),
});

const LOGIN_BRANDING_THEME_NAME = 'Login Branding';

const safeUrlSchema = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => {
    if (!value) return true;
    try {
      const parsed = new URL(value);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }, 'URL must use http or https.');

const expandHex = (value: string) => {
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase();
  }
  return trimmed.toLowerCase();
};

const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Enter a valid hex color.')
  .transform(expandHex);

const loginBrandingSchema = z.object({
  appName: z.string().trim().min(1).max(80),
  schoolName: z.string().trim().max(120).optional(),
  logoUrl: safeUrlSchema.optional().default(''),
  darkLogoUrl: safeUrlSchema.optional().default(''),
  compactLogoUrl: safeUrlSchema.optional().default(''),
  faviconUrl: safeUrlSchema.optional().default(''),
  loginHeading: z.string().trim().min(1).max(120),
  loginSubtitle: z.string().trim().min(1).max(220),
  leftPanelTitle: z.string().trim().min(1).max(140),
  leftPanelDescription: z.string().trim().min(1).max(260),
  features: z.array(z.string().trim().min(1).max(90)).min(1).max(8),
  securityNote: z.string().trim().min(1).max(180),
  footerText: z.string().trim().min(1).max(180),
  supportText: z.string().trim().min(1).max(180),
  forgotPasswordText: z.string().trim().min(1).max(80).optional().default(defaultLoginBranding.forgotPasswordText),
  loginButtonText: z.string().trim().min(1).max(80).optional().default(defaultLoginBranding.loginButtonText),
  primaryColor: hexColorSchema,
  secondaryColor: hexColorSchema,
  accentColor: hexColorSchema,
  backgroundColor: hexColorSchema,
  cardBackgroundColor: hexColorSchema,
  textColor: hexColorSchema,
  mutedTextColor: hexColorSchema,
  borderColor: hexColorSchema,
  buttonBackgroundColor: hexColorSchema,
  buttonTextColor: hexColorSchema,
  linkColor: hexColorSchema,
  focusRingColor: hexColorSchema.optional(),
  errorColor: hexColorSchema,
  successColor: hexColorSchema.optional(),
  backgroundType: z.enum(['solid', 'gradient', 'image', 'pattern']).optional().default('gradient'),
  backgroundImageUrl: safeUrlSchema.optional().default(''),
  gradientFrom: hexColorSchema.optional(),
  gradientTo: hexColorSchema.optional(),
  illustrationUrl: safeUrlSchema.optional().default(''),
  borderRadius: z.string().trim().max(32).optional().default(defaultLoginBranding.borderRadius ?? '24px'),
  cardShadow: z.string().trim().max(140).optional().default(defaultLoginBranding.cardShadow ?? ''),
  logoSize: z.string().trim().max(32).optional().default(defaultLoginBranding.logoSize ?? '56px'),
  leftPanelEnabled: z.boolean().optional().default(true),
});

const getBrandingSchoolId = (req: Request) => {
  const requested = req.query.schoolId as string | undefined;
  if (req.auth?.role === 'SUPER_ADMIN' && (!requested || requested === 'platform')) {
    return null;
  }
  return resolveSchoolId(req, requested);
};

const brandingToThemeTokens = (branding: LoginBranding): Record<string, unknown> => ({
  appName: branding.appName,
  schoolName: branding.schoolName ?? '',
  loginLogoUrl: branding.logoUrl ?? '',
  logoUrl: branding.logoUrl ?? '',
  darkLogoUrl: branding.darkLogoUrl ?? '',
  compactLogoUrl: branding.compactLogoUrl ?? '',
  faviconUrl: branding.faviconUrl ?? '',
  loginHeading: branding.loginHeading,
  loginSubtitle: branding.loginSubtitle,
  leftPanelTitle: branding.leftPanelTitle,
  leftPanelDescription: branding.leftPanelDescription,
  features: branding.features,
  securityNote: branding.securityNote,
  footerText: branding.footerText,
  supportText: branding.supportText,
  forgotPasswordText: branding.forgotPasswordText,
  loginButtonText: branding.loginButtonText,
  loginPrimaryColor: branding.primaryColor,
  loginSecondaryColor: branding.secondaryColor,
  loginAccentColor: branding.accentColor,
  loginBackgroundColor: branding.backgroundColor,
  loginCardBackgroundColor: branding.cardBackgroundColor,
  loginTextColor: branding.textColor,
  loginMutedTextColor: branding.mutedTextColor,
  loginBorderColor: branding.borderColor,
  loginButtonColor: branding.buttonBackgroundColor ?? branding.primaryColor,
  loginButtonTextColor: branding.buttonTextColor,
  loginLinkColor: branding.linkColor,
  loginFocusRingColor: branding.focusRingColor ?? branding.primaryColor,
  loginErrorColor: branding.errorColor,
  loginSuccessColor: branding.successColor ?? '#16a34a',
  loginBackgroundType: branding.backgroundType ?? 'gradient',
  loginBackgroundImageUrl: branding.backgroundImageUrl ?? '',
  loginGradientFrom: branding.gradientFrom ?? branding.backgroundColor,
  loginGradientTo: branding.gradientTo ?? branding.cardBackgroundColor,
  loginIllustrationUrl: branding.illustrationUrl ?? '',
  loginBorderRadius: branding.borderRadius ?? '24px',
  loginCardShadow: branding.cardShadow ?? '',
  loginLogoSize: branding.logoSize ?? '56px',
  leftPanelEnabled: branding.leftPanelEnabled ?? true,
});

const brandingToConfigValue = async (branding: LoginBranding) => {
  const current = await getStoredLoginExperience();
  return {
    ...current,
    brandName: branding.schoolName || branding.appName,
    appName: branding.appName,
    schoolName: branding.schoolName ?? '',
    logoUrl: branding.logoUrl ?? '',
    darkLogoUrl: branding.darkLogoUrl ?? '',
    compactLogoUrl: branding.compactLogoUrl ?? '',
    faviconUrl: branding.faviconUrl ?? '',
    loginHeading: branding.loginHeading,
    loginSubtitle: branding.loginSubtitle,
    leftPanelTitle: branding.leftPanelTitle,
    leftPanelDescription: branding.leftPanelDescription,
    features: branding.features,
    securityNote: branding.securityNote,
    footerText: branding.footerText,
    supportText: branding.supportText,
    forgotPasswordText: branding.forgotPasswordText,
    loginButtonText: branding.loginButtonText,
    backgroundImageUrl: branding.backgroundImageUrl ?? '',
    illustrationUrl: branding.illustrationUrl ?? '',
    backgroundType: branding.backgroundType ?? 'gradient',
    leftPanelEnabled: branding.leftPanelEnabled ?? true,
    backgroundColor: branding.backgroundColor,
    cardBackgroundColor: branding.cardBackgroundColor,
    buttonBackgroundColor: branding.buttonBackgroundColor ?? branding.primaryColor,
    buttonTextColor: branding.buttonTextColor,
    linkColor: branding.linkColor,
    gradientFrom: branding.gradientFrom,
    gradientTo: branding.gradientTo,
    borderRadius: branding.borderRadius,
    cardShadow: branding.cardShadow,
    logoSize: branding.logoSize,
    theme: {
      primaryColor: branding.primaryColor,
      secondaryColor: branding.secondaryColor,
      accentColor: branding.accentColor,
      backgroundColor: branding.backgroundColor,
      panelColor: branding.cardBackgroundColor,
      textColor: branding.textColor,
      mutedTextColor: branding.mutedTextColor,
      borderColor: branding.borderColor,
      buttonBackgroundColor: branding.buttonBackgroundColor ?? branding.primaryColor,
      buttonTextColor: branding.buttonTextColor,
      linkColor: branding.linkColor,
      errorColor: branding.errorColor,
      successColor: branding.successColor ?? '#16a34a',
    },
  };
};

const auditLoginBranding = async (req: Request, action: string, schoolId: string | null, fields: string[]) => {
  if (!req.auth?.userId) return;
  await createAuditLog({
    schoolId,
    actorId: req.auth.userId,
    actorRole: req.auth.role ?? 'UNKNOWN',
    entityType: 'LOGIN_BRANDING',
    entityId: schoolId ?? 'platform',
    action,
    afterState: { fields } as Prisma.InputJsonValue,
  });
};

const findLoginBrandingTheme = (schoolId: string, status?: 'DRAFT' | 'PUBLISHED' | 'ROLLED_BACK') =>
  prisma.theme.findFirst({
    where: { schoolId, name: LOGIN_BRANDING_THEME_NAME, ...(status ? { status } : {}) },
    orderBy: { updatedAt: 'desc' },
  });

const findEditableLoginBrandingTheme = async (schoolId: string) =>
  (await findLoginBrandingTheme(schoolId, 'DRAFT')) ??
  (await findLoginBrandingTheme(schoolId, 'PUBLISHED')) ??
  (await findLoginBrandingTheme(schoolId));

const saveLoginBrandingDraft = async (schoolId: string, branding: LoginBranding) => {
  const tokens = brandingToThemeTokens(branding);
  const existingDraft = await findLoginBrandingTheme(schoolId, 'DRAFT');
  if (existingDraft) {
    return prisma.theme.update({
      where: { id: existingDraft.id },
      data: { tokens: tokens as Prisma.InputJsonValue },
    });
  }

  const latest = await prisma.theme.findFirst({
    where: { schoolId, name: LOGIN_BRANDING_THEME_NAME },
    orderBy: { version: 'desc' },
  });

  return prisma.theme.create({
    data: {
      schoolId,
      name: LOGIN_BRANDING_THEME_NAME,
      version: (latest?.version ?? 0) + 1,
      status: 'DRAFT',
      tokens: tokens as Prisma.InputJsonValue,
    },
  });
};

const getSchoolLoginBranding = async (schoolId: string) => {
  const [school, theme] = await Promise.all([
    prisma.school.findUnique({ where: { id: schoolId }, select: { id: true, name: true } }),
    findEditableLoginBrandingTheme(schoolId),
  ]);

  if (!school) throw new HttpError(404, 'School not found');

  return normalizeLoginBranding({}, {
    schoolName: school.name,
    themeTokens: theme?.tokens && typeof theme.tokens === 'object' && !Array.isArray(theme.tokens)
      ? theme.tokens as Record<string, unknown>
      : undefined,
  });
};

export const createTheme = async (req: Request, res: Response) => {
  const payload = createSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  const latest = await prisma.theme.findFirst({
    where: { schoolId, name: payload.name },
    orderBy: { version: 'desc' },
  });

  const version = latest ? latest.version + 1 : 1;

  const theme = await prisma.theme.create({
    data: {
      schoolId,
      name: payload.name,
      tokens: payload.tokens as Prisma.InputJsonValue,
      version,
      status: 'DRAFT',
    },
  });
  await invalidateThemeCache(schoolId);

  res.status(201).json(theme);
};

export const updateThemeTokens = async (req: Request, res: Response) => {
  const payload = updateSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));
  const { id } = req.params;

  const theme = await prisma.theme.findFirst({
    where: { id, schoolId },
  });

  if (!theme) {
    throw new HttpError(404, 'Theme not found');
  }

  const updated = await prisma.theme.update({
    where: { id },
    data: { tokens: payload.tokens as Prisma.InputJsonValue },
  });
  await invalidateThemeCache(schoolId);

  res.status(200).json(updated);
};

export const publishTheme = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.body.schoolId ?? (req.query.schoolId as string | undefined));
  const { id } = req.params;

  const theme = await prisma.theme.findFirst({
    where: { id, schoolId },
  });

  if (!theme) {
    throw new HttpError(404, 'Theme not found');
  }

  await prisma.themeHistory.create({
    data: {
      themeId: theme.id,
      snapshot: { tokens: theme.tokens, status: theme.status, version: theme.version } as Prisma.InputJsonValue,
    },
  });

  const updated = await prisma.theme.update({
    where: { id },
    data: { status: 'PUBLISHED' },
  });
  await invalidateThemeCache(schoolId);

  res.status(200).json(updated);
};

export const rollbackTheme = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.body.schoolId ?? (req.query.schoolId as string | undefined));
  const { id } = req.params;

  const theme = await prisma.theme.findFirst({
    where: { id, schoolId },
  });

  if (!theme) {
    throw new HttpError(404, 'Theme not found');
  }

  const latestSnapshot = await prisma.themeHistory.findFirst({
    where: { themeId: id },
    orderBy: { createdAt: 'desc' },
  });

  if (!latestSnapshot) {
    throw new HttpError(409, 'No theme history to rollback');
  }

  const snapshot = latestSnapshot.snapshot as { tokens?: unknown };

  const updated = await prisma.theme.update({
    where: { id },
    data: {
      tokens: (snapshot.tokens ?? theme.tokens) as Prisma.InputJsonValue,
      status: 'ROLLED_BACK',
    },
  });
  await invalidateThemeCache(schoolId);

  res.status(200).json(updated);
};

export const listThemes = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);

  const { value: themes, status } = await rememberCache(
    cacheKeys.themesList(schoolId),
    cacheTTL.SCHOOLS,
    () =>
      prisma.theme.findMany({
        where: { schoolId },
        orderBy: [{ name: 'asc' }, { version: 'desc' }],
      }),
  );
  setCacheHeader(res, status);

  res.status(200).json(themes);
};

export const getActiveTheme = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);

  const { value: theme, status } = await rememberCache(
    cacheKeys.themesActive(schoolId),
    cacheTTL.SCHOOLS,
    () =>
      prisma.theme.findFirst({
        where: { schoolId, status: 'PUBLISHED' },
        orderBy: { updatedAt: 'desc' },
      }),
  );

  if (!theme) {
    throw new HttpError(404, 'Active theme not found');
  }

  setCacheHeader(res, status);
  res.status(200).json(theme);
};

export const getLoginBrandingSettings = async (req: Request, res: Response) => {
  const schoolId = getBrandingSchoolId(req);
  if (!schoolId) {
    const entry = await prisma.configEntry.findUnique({ where: { key: LOGIN_EXPERIENCE_KEY } });
    return res.status(200).json(normalizeLoginBranding(entry?.value));
  }

  const branding = await getSchoolLoginBranding(schoolId);
  return res.status(200).json(branding);
};

export const updateLoginBrandingSettings = async (req: Request, res: Response) => {
  const schoolId = getBrandingSchoolId(req);
  const branding = loginBrandingSchema.parse(req.body) as LoginBranding;

  if (!schoolId) {
    const configValue = await brandingToConfigValue(branding);
    const entry = await prisma.configEntry.upsert({
      where: { key: LOGIN_EXPERIENCE_KEY },
      update: {
        value: configValue as unknown as Prisma.InputJsonValue,
        version: { increment: 1 },
      },
      create: {
        key: LOGIN_EXPERIENCE_KEY,
        value: configValue as unknown as Prisma.InputJsonValue,
      },
    });
    await auditLoginBranding(req, 'LOGIN_BRANDING_UPDATED', null, Object.keys(req.body ?? {}));
    return res.status(200).json(normalizeLoginBranding(entry.value));
  }

  await saveLoginBrandingDraft(schoolId, branding);

  await invalidateThemeCache(schoolId);
  await auditLoginBranding(req, 'LOGIN_BRANDING_UPDATED', schoolId, Object.keys(req.body ?? {}));
  return res.status(200).json(await getSchoolLoginBranding(schoolId));
};

export const publishLoginBranding = async (req: Request, res: Response) => {
  const schoolId = getBrandingSchoolId(req);
  if (!schoolId) {
    await auditLoginBranding(req, 'LOGIN_BRANDING_PUBLISHED', null, []);
    const entry = await prisma.configEntry.findUnique({ where: { key: LOGIN_EXPERIENCE_KEY } });
    return res.status(200).json(normalizeLoginBranding(entry?.value));
  }

  const theme = await findLoginBrandingTheme(schoolId, 'DRAFT') ?? await findLoginBrandingTheme(schoolId);
  if (!theme) throw new HttpError(404, 'Login branding draft not found');

  const published = await findLoginBrandingTheme(schoolId, 'PUBLISHED');
  await prisma.themeHistory.create({
    data: {
      themeId: theme.id,
      snapshot: {
        tokens: published?.tokens ?? theme.tokens,
        status: published?.status ?? theme.status,
        version: published?.version ?? theme.version,
      } as Prisma.InputJsonValue,
    },
  });

  await prisma.theme.update({
    where: { id: theme.id },
    data: { status: 'PUBLISHED' },
  });

  await invalidateThemeCache(schoolId);
  await auditLoginBranding(req, 'LOGIN_BRANDING_PUBLISHED', schoolId, []);
  return res.status(200).json(await getSchoolLoginBranding(schoolId));
};

export const rollbackLoginBranding = async (req: Request, res: Response) => {
  const schoolId = getBrandingSchoolId(req);
  if (!schoolId) {
    throw new HttpError(409, 'Platform branding history is not available');
  }

  const theme = await findLoginBrandingTheme(schoolId);
  if (!theme) throw new HttpError(404, 'Login branding theme not found');

  const latestSnapshot = await prisma.themeHistory.findFirst({
    where: { themeId: theme.id },
    orderBy: { createdAt: 'desc' },
  });
  if (!latestSnapshot) throw new HttpError(409, 'No login branding history to rollback');

  const snapshot = latestSnapshot.snapshot as { tokens?: unknown };
  const tokens = snapshot.tokens && typeof snapshot.tokens === 'object' && !Array.isArray(snapshot.tokens)
    ? snapshot.tokens as Prisma.InputJsonValue
    : theme.tokens;

  await prisma.theme.update({
    where: { id: theme.id },
    data: { tokens, status: 'PUBLISHED' },
  });

  await invalidateThemeCache(schoolId);
  await auditLoginBranding(req, 'LOGIN_BRANDING_ROLLED_BACK', schoolId, []);
  return res.status(200).json(await getSchoolLoginBranding(schoolId));
};

export const resetLoginBranding = async (req: Request, res: Response) => {
  const schoolId = getBrandingSchoolId(req);
  const branding = defaultLoginBranding;

  if (!schoolId) {
    const configValue = await brandingToConfigValue(branding);
    const entry = await prisma.configEntry.upsert({
      where: { key: LOGIN_EXPERIENCE_KEY },
      update: {
        value: configValue as unknown as Prisma.InputJsonValue,
        version: { increment: 1 },
      },
      create: {
        key: LOGIN_EXPERIENCE_KEY,
        value: configValue as unknown as Prisma.InputJsonValue,
      },
    });
    await auditLoginBranding(req, 'LOGIN_BRANDING_RESET', null, Object.keys(branding));
    return res.status(200).json(normalizeLoginBranding(entry.value));
  }

  await saveLoginBrandingDraft(schoolId, branding);

  await invalidateThemeCache(schoolId);
  await auditLoginBranding(req, 'LOGIN_BRANDING_RESET', schoolId, Object.keys(branding));
  return res.status(200).json(await getSchoolLoginBranding(schoolId));
};
