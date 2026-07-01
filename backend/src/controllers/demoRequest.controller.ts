import crypto from 'crypto';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { sendConfiguredEmail } from '../services/email.service';

const DEMO_ACCESS_BASE_URL = 'https://app.akacemify.com';

const publicDemoRequestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().min(7).max(32).optional().or(z.literal('')),
  schoolName: z.string().trim().min(2).max(180),
  role: z.string().trim().max(80).optional().or(z.literal('')),
  studentCount: z.coerce.number().int().min(1).max(200000),
  staffCount: z.coerce.number().int().min(1).max(20000),
  preferredDate: z.string().datetime().optional().or(z.literal('')),
  message: z.string().trim().max(1000).optional().or(z.literal('')),
  selectedPlanId: z.string().uuid().optional().or(z.literal('')),
});

const listQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED']).optional(),
  search: z.string().trim().max(120).optional(),
});

export const listPublicPlansApi = async (_req: Request, res: Response) => {
  const plans = await prisma.subscriptionPlanDef.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { studentLimit: 'asc' },
    select: {
      id: true,
      name: true,
      priceCents: true,
      features: true,
      studentLimit: true,
      teacherLimit: true,
      trialDays: true,
    },
  });

  res.status(200).json({ items: plans });
};

export const createPublicDemoRequestApi = async (req: Request, res: Response) => {
  const payload = publicDemoRequestSchema.parse(req.body);
  const selectedPlan = payload.selectedPlanId
    ? await prisma.subscriptionPlanDef.findFirst({
        where: { id: payload.selectedPlanId, status: 'ACTIVE' },
        select: { id: true, name: true },
      })
    : null;

  if (payload.selectedPlanId && !selectedPlan) {
    throw new HttpError(400, 'Selected plan is not available');
  }

  const request = await prisma.demoRequest.create({
    data: {
      name: payload.name,
      email: payload.email.toLowerCase(),
      phone: payload.phone || null,
      schoolName: payload.schoolName,
      role: payload.role || null,
      studentCount: payload.studentCount,
      staffCount: payload.staffCount,
      preferredDate: payload.preferredDate ? new Date(payload.preferredDate) : null,
      message: payload.message || null,
      selectedPlanId: selectedPlan?.id ?? null,
      selectedPlanName: selectedPlan?.name ?? null,
    },
  });

  res.status(201).json({
    id: request.id,
    status: request.status,
    message: 'Demo request submitted successfully',
  });
};

export const listDemoRequestsApi = async (req: Request, res: Response) => {
  const query = listQuerySchema.parse(req.query);
  const search = query.search?.trim();

  const requests = await prisma.demoRequest.findMany({
    where: {
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { schoolName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: {
      selectedPlan: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  res.status(200).json({ items: requests });
};

export const approveDemoRequestApi = async (req: Request, res: Response) => {
  const { id } = req.params;
  const existing = await prisma.demoRequest.findUnique({ where: { id } });
  if (!existing) {
    throw new HttpError(404, 'Demo request not found');
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const token = crypto.randomBytes(32).toString('hex');
  const demoUrl = `${DEMO_ACCESS_BASE_URL}/?demoToken=${token}`;

  const emailStatus = await sendConfiguredEmail({
    to: existing.email,
    subject: 'Your Akademify demo access is ready',
    body: [
      `Hello ${existing.name},`,
      'Your Akademify demo request has been approved.',
      `Use this link within 24 hours: ${demoUrl}`,
      `This link expires at ${expiresAt.toISOString()}.`,
      'If you did not request this demo, you can ignore this email.',
    ].join('\n\n'),
    schoolId: null,
    safePayload: {
      purpose: 'DEMO_REQUEST_APPROVAL',
      demoRequestId: existing.id,
      expiresAt: expiresAt.toISOString(),
    },
  });

  const updated = await prisma.demoRequest.update({
    where: { id },
    data: {
      status: 'APPROVED',
      approvalToken: token,
      approvalTokenExpiresAt: expiresAt,
      approvedAt: now,
      approvedById: req.auth?.userId ?? null,
      emailDeliveryStatus: emailStatus,
    },
    include: {
      selectedPlan: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, email: true } },
    },
  });

  res.status(200).json(updated);
};
