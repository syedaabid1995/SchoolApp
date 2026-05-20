import type { Request, Response } from 'express';
import { z } from 'zod';
import { HttpError } from '../middlewares/error.middleware';
import {
  getAuthSecuritySettings,
  normalizeAuthSecuritySettings,
  saveAuthSecuritySettings,
} from '../services/authSecurity.service';

const authSecuritySettingsSchema = z
  .object({
    twoStepEnabled: z.boolean(),
    emailOtpEnabled: z.boolean(),
    authenticatorAppEnabled: z.boolean(),
    requiredRoles: z.array(z.string().trim().min(1).max(50)).min(1).max(20).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.twoStepEnabled && !value.emailOtpEnabled && !value.authenticatorAppEnabled) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['twoStepEnabled'],
        message: 'Enable email verification or authenticator app before enabling two-step verification.',
      });
    }
  });

const ensureCanManageAuthSecurity = (req: Request) => {
  if (req.auth?.role !== 'SUPER_ADMIN') {
    throw new HttpError(403, 'Only super admin can update authentication security settings');
  }
};

export const getAuthSecuritySettingsApi = async (_req: Request, res: Response) => {
  const settings = await getAuthSecuritySettings();
  res.status(200).json(settings);
};

export const updateAuthSecuritySettingsApi = async (req: Request, res: Response) => {
  ensureCanManageAuthSecurity(req);

  const parsed = authSecuritySettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid authentication security settings');
  }

  const settings = await saveAuthSecuritySettings(normalizeAuthSecuritySettings(parsed.data));
  res.status(200).json(settings);
};
