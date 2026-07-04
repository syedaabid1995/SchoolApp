import crypto from 'crypto';
import { Readable } from 'stream';
import { prisma } from '../config/db';
import { logger } from '../config/logger';
import { HttpError } from '../middlewares/error.middleware';
import { getObjectForKey, uploadBuffer, storageKeyFromUrl } from './s3.service';
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

type ExistingFaceProfileForRegistration = {
  id: string;
  samples: Array<{ collectionId: string | null; rekognitionFaceId: string | null }>;
} | null;

const assertSampleCount = (count: number, min = 2) => {
  if (count < min) {
    throw new HttpError(400, min === 1 ? 'At least one face sample is required' : 'At least two face samples are required');
  }
  if (count > MAX_FACE_SAMPLES_PER_STUDENT) {
    throw new HttpError(400, `A student can have a maximum of ${MAX_FACE_SAMPLES_PER_STUDENT} face samples`);
  }
};

const objectBodyToBuffer = async (body: unknown) => {
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (typeof body === 'string') return Buffer.from(body);
  if (body instanceof Readable) {
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  if (body && typeof (body as { transformToByteArray?: () => Promise<Uint8Array> }).transformToByteArray === 'function') {
    return Buffer.from(await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray());
  }
  if (body && typeof (body as AsyncIterable<Uint8Array>)[Symbol.asyncIterator] === 'function') {
    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  throw new HttpError(422, 'Unable to read face image');
};

const uniqueImageRefs = (imageRefs: string[]) => [...new Set(imageRefs.map((item) => item.trim()).filter(Boolean))];

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

const persistIndexedFaceSamples = async (params: {
  schoolId: string;
  studentId: string;
  createdById: string;
  student: { classId: string | null; sectionId: string | null };
  indexedSamples: Array<{
    imageUrl: string;
    imageKey: string;
    collectionId: string;
    rekognitionFaceId: string;
  }>;
  existingProfile: ExistingFaceProfileForRegistration;
  replace: boolean;
}) =>
  prisma.$transaction(async (tx) => {
    if (params.existingProfile && params.replace) {
      await tx.faceSample.deleteMany({ where: { faceProfileId: params.existingProfile.id } });
    }

    const currentProfile = params.existingProfile
      ? await tx.faceProfile.update({
          where: { id: params.existingProfile.id },
          data: {
            status: 'APPROVED',
            createdById: params.createdById,
            approvedById: params.createdById,
            approvedAt: new Date(),
          },
        })
      : await tx.faceProfile.create({
          data: {
            schoolId: params.schoolId,
            studentId: params.studentId,
            status: 'APPROVED',
            createdById: params.createdById,
            approvedById: params.createdById,
            approvedAt: new Date(),
          },
        });

    await tx.faceSample.createMany({
      data: params.indexedSamples.map((sample) => ({
        faceProfileId: currentProfile.id,
        schoolId: params.schoolId,
        classId: params.student.classId,
        sectionId: params.student.sectionId,
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

export const registerStudentFaceImageRefs = async (params: {
  schoolId: string;
  studentId: string;
  createdById: string;
  imageRefs: string[];
  replace?: boolean;
}) => {
  const { schoolId, studentId, createdById } = params;
  const replace = params.replace ?? true;
  const imageRefs = uniqueImageRefs(params.imageRefs);
  assertSampleCount(imageRefs.length, 1);

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

  if (!replace && existingSamples.length + imageRefs.length > MAX_FACE_SAMPLES_PER_STUDENT) {
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
    for (const imageUrl of imageRefs) {
      const imageKey = storageKeyFromUrl(imageUrl);
      if (!imageKey) throw new HttpError(400, 'Face image must be uploaded before registration');

      const object = await getObjectForKey({ key: imageKey });
      if (object.contentType && !object.contentType.startsWith('image/')) {
        throw new HttpError(400, 'Only image uploads can be registered as face samples');
      }

      const image = await objectBodyToBuffer(object.body);
      const indexed = await indexRegisteredStudentFace({
        collectionId,
        studentId,
        image,
      });
      indexedSamples.push({
        imageUrl,
        imageKey,
        collectionId: indexed.collectionId,
        rekognitionFaceId: indexed.faceId,
      });
    }

    const profile = await persistIndexedFaceSamples({
      schoolId,
      studentId,
      createdById,
      student,
      indexedSamples,
      existingProfile,
      replace,
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
