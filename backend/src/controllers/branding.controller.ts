import type { Request, Response } from 'express';
import { z } from 'zod';
import { getLoginBranding } from '../services/branding.service';

const querySchema = z.object({
  schoolCode: z.string().trim().regex(/^[a-zA-Z0-9_-]{2,64}$/).optional(),
});

export const getPublicLoginBranding = async (req: Request, res: Response) => {
  const parsed = querySchema.safeParse(req.query);
  const branding = await getLoginBranding({
    schoolCode: parsed.success ? parsed.data.schoolCode : undefined,
    host: req.headers['x-forwarded-host']?.toString() ?? req.headers.host,
  });

  res.status(200).json(branding);
};
