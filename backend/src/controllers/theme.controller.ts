import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { resolveSchoolId } from '../utils/tenant';

const createSchema = z.object({
  name: z.string().min(1),
  tokens: z.record(z.unknown()),
  schoolId: z.string().uuid().optional(),
});

const updateSchema = z.object({
  tokens: z.record(z.unknown()),
  schoolId: z.string().uuid().optional(),
});

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
      tokens: payload.tokens,
      version,
      status: 'DRAFT',
    },
  });

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
    data: { tokens: payload.tokens },
  });

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
      snapshot: { tokens: theme.tokens, status: theme.status, version: theme.version },
    },
  });

  const updated = await prisma.theme.update({
    where: { id },
    data: { status: 'PUBLISHED' },
  });

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
      tokens: snapshot.tokens ?? theme.tokens,
      status: 'ROLLED_BACK',
    },
  });

  res.status(200).json(updated);
};

export const listThemes = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);

  const themes = await prisma.theme.findMany({
    where: { schoolId },
    orderBy: [{ name: 'asc' }, { version: 'desc' }],
  });

  res.status(200).json(themes);
};

export const getActiveTheme = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);

  const theme = await prisma.theme.findFirst({
    where: { schoolId, status: 'PUBLISHED' },
    orderBy: { updatedAt: 'desc' },
  });

  if (!theme) {
    throw new HttpError(404, 'Active theme not found');
  }

  res.status(200).json(theme);
};
