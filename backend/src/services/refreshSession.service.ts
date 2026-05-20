import type { Request } from 'express';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { hashToken } from '../utils/token';

const firstHeaderValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const compact = (value?: string | null) => {
  const next = value?.trim();
  return next || undefined;
};

export const getCookieValue = (req: Request, name: string) => {
  const cookieHeader = firstHeaderValue(req.headers.cookie);
  if (!cookieHeader) return undefined;

  const value = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);

  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const getRequestIpAddress = (req: Request) => {
  const forwardedFor = firstHeaderValue(req.headers['x-forwarded-for']);
  const realIp = firstHeaderValue(req.headers['x-real-ip']);
  return compact(forwardedFor?.split(',')[0]) || compact(realIp) || compact(req.ip) || compact(req.socket.remoteAddress);
};

const getRequestUserAgent = (req: Request) =>
  compact(firstHeaderValue(req.headers['x-original-user-agent'])) ||
  compact(firstHeaderValue(req.headers['user-agent']));

const detectDeviceName = (userAgent?: string) => {
  if (!userAgent) return undefined;
  const lower = userAgent.toLowerCase();
  if (lower.includes('ipad') || lower.includes('tablet')) return 'Tablet browser';
  if (lower.includes('iphone') || lower.includes('android') || lower.includes('mobile')) return 'Mobile browser';
  if (lower.includes('windows')) return 'Windows desktop';
  if (lower.includes('macintosh') || lower.includes('mac os')) return 'Mac desktop';
  if (lower.includes('linux')) return 'Linux desktop';
  return undefined;
};

export const createRefreshSession = async (params: {
  req: Request;
  userId: string;
  schoolId: string | null;
  refreshToken: string;
  expiresAt: Date;
}) => {
  const userAgent = getRequestUserAgent(params.req);

  await prisma.refreshSession.create({
    data: {
      userId: params.userId,
      schoolId: params.schoolId,
      tokenHash: hashToken(params.refreshToken),
      ipAddress: getRequestIpAddress(params.req),
      userAgent,
      deviceName: detectDeviceName(userAgent),
      expiresAt: params.expiresAt,
    },
  });
};

export const validateRefreshSession = async (params: {
  refreshToken: string;
  userId: string;
  schoolId: string | null;
}) => {
  const now = new Date();
  const session = await prisma.refreshSession.findUnique({
    where: { tokenHash: hashToken(params.refreshToken) },
    select: {
      id: true,
      userId: true,
      schoolId: true,
      expiresAt: true,
      revokedAt: true,
    },
  });

  if (!session) {
    await revokeAllRefreshSessionsForUser(params.userId);
    throw new HttpError(401, 'Invalid refresh token');
  }

  if (session.revokedAt) {
    await revokeAllRefreshSessionsForUser(session.userId);
    throw new HttpError(401, 'Invalid refresh token');
  }

  if (session.userId !== params.userId || (session.schoolId ?? null) !== params.schoolId) {
    await revokeAllRefreshSessionsForUser(session.userId);
    throw new HttpError(401, 'Invalid refresh token');
  }

  if (session.expiresAt <= now) {
    throw new HttpError(401, 'Invalid refresh token');
  }

  await prisma.refreshSession.update({
    where: { id: session.id },
    data: { lastUsedAt: now },
  });

  return session;
};

export const revokeRefreshSession = async (refreshToken: string) => {
  const now = new Date();
  const session = await prisma.refreshSession.findUnique({
    where: { tokenHash: hashToken(refreshToken) },
    select: {
      id: true,
      userId: true,
      schoolId: true,
      revokedAt: true,
    },
  });

  if (!session) return null;

  if (!session.revokedAt) {
    await prisma.refreshSession.update({
      where: { id: session.id },
      data: {
        revokedAt: now,
        lastUsedAt: now,
      },
    });
  }

  return session;
};

export const revokeRefreshSessionById = async (sessionId: string) => {
  const now = new Date();
  await prisma.refreshSession.update({
    where: { id: sessionId },
    data: {
      revokedAt: now,
      lastUsedAt: now,
    },
  });
};

export const rotateRefreshSession = async (params: {
  req: Request;
  previousSessionId: string;
  userId: string;
  schoolId: string | null;
  refreshToken: string;
  expiresAt: Date;
}) => {
  const now = new Date();
  const userAgent = getRequestUserAgent(params.req);

  await prisma.$transaction([
    prisma.refreshSession.update({
      where: { id: params.previousSessionId },
      data: {
        revokedAt: now,
        lastUsedAt: now,
      },
    }),
    prisma.refreshSession.create({
      data: {
        userId: params.userId,
        schoolId: params.schoolId,
        tokenHash: hashToken(params.refreshToken),
        ipAddress: getRequestIpAddress(params.req),
        userAgent,
        deviceName: detectDeviceName(userAgent),
        expiresAt: params.expiresAt,
      },
    }),
  ]);
};

export const revokeAllRefreshSessionsForUser = async (userId: string) => {
  const now = new Date();
  await prisma.refreshSession.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt: now,
      lastUsedAt: now,
    },
  });
};
