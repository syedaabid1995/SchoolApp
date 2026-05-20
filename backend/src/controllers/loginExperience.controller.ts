import type { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import {
  LOGIN_EXPERIENCE_KEY,
  getLoginExperienceForSchool,
  getStoredLoginExperience,
  normalizeLoginExperience,
} from '../services/loginExperience.service';

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a valid hex color like #0f172a.');

const loginTypeSchema = z.object({
  id: z.enum(['admin', 'staff', 'teacher', 'student', 'parent']),
  label: z.string().trim().min(1, 'Label is required.').max(40),
  description: z.string().trim().min(1, 'Description is required.').max(140),
  enabled: z.boolean(),
  authMode: z.enum(['password', 'otp']),
  requiresSchoolId: z.boolean(),
  schoolIdOptional: z.boolean().optional(),
  unavailableMessage: z.string().trim().max(140).optional(),
});

const loginExperienceSchema = z.object({
  brandName: z.string().trim().min(1, 'Brand name is required.').max(60),
  appName: z.string().trim().min(1, 'App name is required.').max(80),
  consoleName: z.string().trim().min(1, 'Console name is required.').max(60),
  headline: z.string().trim().min(1, 'Headline is required.').max(90),
  subtitle: z.string().trim().min(1, 'Subtitle is required.').max(160),
  loginHeading: z.string().trim().min(1, 'Login heading is required.').max(120),
  loginSubtitle: z.string().trim().min(1, 'Login subtitle is required.').max(220),
  leftPanelTitle: z.string().trim().min(1, 'Left panel title is required.').max(140),
  leftPanelDescription: z.string().trim().min(1, 'Left panel description is required.').max(260),
  features: z.array(z.string().trim().min(1).max(80)).min(1).max(8),
  securityNote: z.string().trim().min(1).max(180),
  footerText: z.string().trim().min(1).max(180),
  supportText: z.string().trim().min(1).max(180),
  forgotPasswordText: z.string().trim().min(1).max(80),
  loginButtonText: z.string().trim().min(1).max(80),
  supportUrl: z.string().trim().url('Support URL must be a valid URL.').max(500),
  logoUrl: z.string().trim().max(2000),
  backgroundImageUrl: z.string().trim().max(2000),
  illustrationUrl: z.string().trim().max(2000),
  backgroundType: z.enum(['solid', 'gradient', 'image', 'pattern']),
  leftPanelEnabled: z.boolean(),
  theme: z.object({
    primaryColor: hexColorSchema,
    secondaryColor: hexColorSchema,
    accentColor: hexColorSchema,
    backgroundColor: hexColorSchema,
    panelColor: hexColorSchema,
    textColor: hexColorSchema,
    mutedTextColor: hexColorSchema,
    borderColor: hexColorSchema,
    buttonBackgroundColor: hexColorSchema,
    buttonTextColor: hexColorSchema,
    linkColor: hexColorSchema,
    errorColor: hexColorSchema,
    successColor: hexColorSchema,
  }),
  loginTypes: z.array(loginTypeSchema).length(5, 'All login types must be configured.'),
});

export const getPublicLoginExperience = async (req: Request, res: Response) => {
  const schoolId = typeof req.query.schoolId === 'string' ? req.query.schoolId : undefined;
  const experience = await getLoginExperienceForSchool(schoolId);
  res.status(200).json(experience);
};

export const getLoginExperienceSettings = async (_req: Request, res: Response) => {
  const experience = await getStoredLoginExperience();
  res.status(200).json(experience);
};

export const updateLoginExperienceSettings = async (req: Request, res: Response) => {
  if (req.auth?.role !== 'SUPER_ADMIN') {
    throw new HttpError(403, 'Only super admin can update login experience settings');
  }

  const payload = loginExperienceSchema.parse(req.body);
  const normalized = normalizeLoginExperience(payload);

  const entry = await prisma.configEntry.upsert({
    where: { key: LOGIN_EXPERIENCE_KEY },
    update: {
      value: normalized as unknown as Prisma.InputJsonValue,
      version: { increment: 1 },
    },
    create: {
      key: LOGIN_EXPERIENCE_KEY,
      value: normalized as unknown as Prisma.InputJsonValue,
    },
  });

  res.status(200).json(normalizeLoginExperience(entry.value));
};
