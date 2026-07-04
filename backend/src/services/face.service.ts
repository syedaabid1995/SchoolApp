import crypto from 'crypto';
import { prisma } from '../config/db';
import { logger } from '../config/logger';
import { HttpError } from '../middlewares/error.middleware';
import { uploadBuffer, storageKeyFromUrl } from './s3.service';
import { buildRuntimeObjectKey } from './runtimeStorage.service';
import {
  buildClassSectionCollectionId,
  deleteFacesFromCollection,
  indexRegisteredStudentFace,
} from './rekognition.service';

export type FaceSampleInput = {
  imageUrl: string;
  embedding: number[];
};

export type FaceImageUpload = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
};

const MAX_FACE_SAMPLES_PER_STUDENT = 4;

const assertSampleCount = (count: number, min = 2) => {
  if (count < min) {
    throw new HttpError(400, min === 1 ? 'At least one face sample is required' : 'At least two face samples are required');
  }
  if (count > MAX_FACE_SAMPLES_PER_STUDENT) {
    throw new HttpError(400, `A student can have a maximum of ${MAX_FACE_SAMPLES_PER_STUDENT} face samples`);
  }
};

const deleteRekognitionFacesBestEffort = async (
  samples: Array<{ collectionId: string | null; rekognitionFaceId: string | null }>,
) => {
  const grouped = new Map<string, string[]>();
  for (const sample of samples) {
    if (!sample.collectionId || !sample.rekognitionFaceId) continue;
    grouped.set(sample.collectionId, [...(grouped.get(sample.collectionId) ?? []), sample.rekognitionFaceId]);
  }
  for (const [collectionId, faceIds] of grouped.entries()) {
    try {
      await deleteFacesFromCollection({ collectionId, faceIds });
    } catch (error) {
      logger.warn({ err: error, collectionId, faceCount: faceIds.length }, 'Failed to delete old Rekognition face samples');
    }
  }
};

export const createFaceEnrollment = async (params: {
  schoolId: string;
  studentId: string;
  createdById: string;
  samples: FaceSampleInput[];
}) => {
  const { schoolId, studentId, createdById, samples } = params;

  assertSampleCount(samples.length);

  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
    select: { id: true, classId: true, sectionId: true },
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
          imageKey: storageKeyFromUrl(sample.imageUrl),
          schoolId,
          classId: student.classId,
          sectionId: student.sectionId,
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

  assertSampleCount(samples.length);

  const profile = await prisma.faceProfile.findFirst({
    where: { studentId, schoolId },
    select: { id: true, student: { select: { classId: true, sectionId: true } } },
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
            imageKey: storageKeyFromUrl(sample.imageUrl),
            schoolId,
            classId: profile.student.classId,
            sectionId: profile.student.sectionId,
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

export const registerStudentFaceImages = async (params: {
  schoolId: string;
  studentId: string;
  createdById: string;
  files: FaceImageUpload[];
  replace?: boolean;
}) => {
  const { schoolId, studentId, createdById, files } = params;
  const replace = params.replace ?? true;
  assertSampleCount(files.length, 1);

  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId, status: 'ENROLLED' },
    select: { id: true, classId: true, sectionId: true },
  });

  if (!student) throw new HttpError(404, 'Student not found');
  if (!student.classId) throw new HttpError(400, 'Student must be assigned to a class before face registration');

  const existingProfile = await prisma.faceProfile.findUnique({
    where: { studentId },
    include: { samples: true },
  });
  const existingSamples = existingProfile?.samples ?? [];

  if (!replace && existingSamples.length + files.length > MAX_FACE_SAMPLES_PER_STUDENT) {
    throw new HttpError(400, `A student can have a maximum of ${MAX_FACE_SAMPLES_PER_STUDENT} face samples`);
  }

  const collectionId = buildClassSectionCollectionId({
    schoolId,
    classId: student.classId,
    sectionId: student.sectionId,
  });

  const indexedSamples: Array<{
    imageUrl: string;
    imageKey: string;
    collectionId: string;
    rekognitionFaceId: string;
  }> = [];

  try {
    for (const file of files) {
      const key = buildRuntimeObjectKey({
        schoolId,
        category: 'face-samples',
        filename: file.originalname,
        id: `${studentId}-${crypto.randomUUID()}`,
      });
      const uploaded = await uploadBuffer({
        key,
        body: file.buffer,
        contentType: file.mimetype,
      });
      const indexed = await indexRegisteredStudentFace({
        collectionId,
        studentId,
        image: file.buffer,
      });
      indexedSamples.push({
        imageUrl: uploaded.url,
        imageKey: uploaded.key,
        collectionId: indexed.collectionId,
        rekognitionFaceId: indexed.faceId,
      });
    }

    const profile = await prisma.$transaction(async (tx) => {
      if (existingProfile && replace) {
        await tx.faceSample.deleteMany({ where: { faceProfileId: existingProfile.id } });
      }

      const currentProfile = existingProfile
        ? await tx.faceProfile.update({
            where: { id: existingProfile.id },
            data: {
              status: 'APPROVED',
              createdById,
              approvedById: createdById,
              approvedAt: new Date(),
            },
          })
        : await tx.faceProfile.create({
            data: {
              schoolId,
              studentId,
              status: 'APPROVED',
              createdById,
              approvedById: createdById,
              approvedAt: new Date(),
            },
          });

      await tx.faceSample.createMany({
        data: indexedSamples.map((sample) => ({
          faceProfileId: currentProfile.id,
          schoolId,
          classId: student.classId,
          sectionId: student.sectionId,
          imageUrl: sample.imageUrl,
          imageKey: sample.imageKey,
          embedding: [],
          collectionId: sample.collectionId,
          rekognitionFaceId: sample.rekognitionFaceId,
        })),
      });

      return tx.faceProfile.findUniqueOrThrow({
        where: { id: currentProfile.id },
        include: { samples: true },
      });
    });

    if (replace) {
      await deleteRekognitionFacesBestEffort(existingSamples);
    }

    return profile;
  } catch (error) {
    await deleteRekognitionFacesBestEffort(indexedSamples);
    throw error;
  }
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
