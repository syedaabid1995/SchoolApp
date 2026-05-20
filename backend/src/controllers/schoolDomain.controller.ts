import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { resolveSchoolSubdomainFromHost, schoolIdentifierWhere } from '../utils/schoolDomain';

const querySchema = z.object({
  subdomain: z.string().trim().min(1).max(64).optional(),
});

export const resolvePublicSchoolDomain = async (req: Request, res: Response) => {
  const parsed = querySchema.safeParse(req.query);
  const host = req.headers['x-forwarded-host']?.toString() ?? req.headers.host;
  const subdomain = parsed.success && parsed.data.subdomain
    ? parsed.data.subdomain
    : req.schoolSubdomain ?? resolveSchoolSubdomainFromHost(host);

  if (!subdomain) {
    res.status(200).json({
      isMainDomain: true,
      subdomain: null,
      school: null,
    });
    return;
  }

  const school = await prisma.school.findFirst({
    where: {
      deletedAt: null,
      ...schoolIdentifierWhere(subdomain),
    },
    select: {
      id: true,
      name: true,
      code: true,
      subdomain: true,
      domainUrl: true,
    },
  });

  if (!school) {
    throw new HttpError(404, 'School domain not found');
  }

  res.status(200).json({
    isMainDomain: false,
    subdomain: school.subdomain ?? school.code,
    school,
  });
};
