import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';

export type FaceSampleInput = {
  imageUrl: string;
  embedding: number[];
};

export const createFaceEnrollment = async (params: {
  schoolId: string;
  studentId: string;
  createdById: string;
  samples: FaceSampleInput[];
}) => {
  const { schoolId, studentId, createdById, samples } = params;

  if (samples.length < 2) {
    throw new HttpError(400, 'At least two face samples are required');
  }

  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
    select: { id: true },
  });

  if (!student) {
    throw new HttpError(404, 'Student not found');
  }

  const existing = await prisma.faceProfile.findUnique({
    where: { studentId },
    select: { id: true },
  });

  if (existing) {
    throw new HttpError(409, 'Face enrollment already exists; use re-enroll');
  }

  return prisma.faceProfile.create({
    data: {
      schoolId,
      studentId,
      status: 'PENDING',
      createdById,
      samples: {
        create: samples.map((sample) => ({
          imageUrl: sample.imageUrl,
          embedding: sample.embedding,
        })),
      },
    },
    include: { samples: true },
  });
};

export const reEnrollFace = async (params: {
  schoolId: string;
  studentId: string;
  createdById: string;
  samples: FaceSampleInput[];
}) => {
  const { schoolId, studentId, createdById, samples } = params;

  if (samples.length < 2) {
    throw new HttpError(400, 'At least two face samples are required');
  }

  const profile = await prisma.faceProfile.findFirst({
    where: { studentId, schoolId },
    select: { id: true },
  });

  if (!profile) {
    throw new HttpError(404, 'Face enrollment not found');
  }

  return prisma.$transaction(async (tx) => {
    await tx.faceSample.deleteMany({ where: { faceProfileId: profile.id } });

    return tx.faceProfile.update({
      where: { id: profile.id },
      data: {
        status: 'PENDING',
        createdById,
        approvedById: null,
        approvedAt: null,
        samples: {
          create: samples.map((sample) => ({
            imageUrl: sample.imageUrl,
            embedding: sample.embedding,
          })),
        },
      },
      include: { samples: true },
    });
  });
};

export const approveFaceEnrollment = async (params: {
  schoolId: string;
  faceProfileId: string;
  approvedById: string;
}) => {
  const { schoolId, faceProfileId, approvedById } = params;

  const profile = await prisma.faceProfile.findFirst({
    where: { id: faceProfileId, schoolId },
    select: { id: true, status: true },
  });

  if (!profile) {
    throw new HttpError(404, 'Face enrollment not found');
  }

  return prisma.faceProfile.update({
    where: { id: faceProfileId },
    data: {
      status: 'APPROVED',
      approvedById,
      approvedAt: new Date(),
    },
    include: { samples: true },
  });
};

export const rejectFaceEnrollment = async (params: {
  schoolId: string;
  faceProfileId: string;
  approvedById: string;
  reason?: string | null;
}) => {
  const { schoolId, faceProfileId, approvedById } = params;

  const profile = await prisma.faceProfile.findFirst({
    where: { id: faceProfileId, schoolId },
    select: { id: true },
  });

  if (!profile) {
    throw new HttpError(404, 'Face enrollment not found');
  }

  return prisma.faceProfile.update({
    where: { id: faceProfileId },
    data: {
      status: 'REJECTED',
      approvedById,
      approvedAt: new Date(),
    },
    include: { samples: true },
  });
};
