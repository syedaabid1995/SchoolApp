import { Readable } from 'stream';
import { prisma } from '../config/db';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { HttpError } from '../middlewares/error.middleware';
import { buildRuntimeObjectKey } from './runtimeStorage.service';
import { getObjectForKey, uploadBuffer } from './s3.service';
import { ensureTeacherAssignedToClassSection, isAdminRole } from './attendanceP1.service';
import { getAttendanceSheet } from './attendanceSheet.service';
import {
  buildClassSectionCollectionId,
  deleteFacesFromCollection,
  indexAttendancePhotoFaces,
  searchFaceInCollection,
} from './rekognition.service';
import type { AttendanceSlotType, AttendanceUnitType } from '@prisma/client';

export type AttendanceAiPhotoInput = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  key?: string;
  url?: string;
};

type AttendanceAiScope = {
  schoolId: string;
  academicYearId: string;
  classId: string;
  sectionId?: string | null;
  date: Date | string;
  unitType: AttendanceUnitType;
  slotId?: string | null;
  slotType?: AttendanceSlotType | null;
  periodId?: string | null;
  timetableEntryId?: string | null;
};

type AttendanceAiActor = {
  actorId: string;
  actorRole: string;
};

const toStoredObjectBuffer = async (key: string) => {
  const object = await getObjectForKey({ key });
  const body = object.body;
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
  throw new HttpError(422, 'Unable to read attendance photo');
};

export const loadAttendancePhotosFromKeys = async (keys: string[]): Promise<AttendanceAiPhotoInput[]> => {
  const uniqueKeys = [...new Set(keys.map((key) => key.trim()).filter(Boolean))];
  if (!uniqueKeys.length) return [];
  return Promise.all(
    uniqueKeys.map(async (key) => ({
      key,
      originalname: key.split('/').pop() || 'attendance-photo',
      mimetype: 'image/jpeg',
      buffer: await toStoredObjectBuffer(key),
    })),
  );
};

export const storeAttendancePhotos = async (params: {
  schoolId: string;
  photos: AttendanceAiPhotoInput[];
}) => {
  const stored = [];
  for (const photo of params.photos) {
    if (photo.key && photo.url) {
      stored.push({
        key: photo.key,
        url: photo.url,
        contentType: photo.mimetype,
        size: photo.buffer.length,
      });
      continue;
    }

    const key = buildRuntimeObjectKey({
      schoolId: params.schoolId,
      category: 'attendance-photos',
      filename: photo.originalname,
    });
    const uploaded = await uploadBuffer({
      key,
      body: photo.buffer,
      contentType: photo.mimetype,
    });
    photo.key = uploaded.key;
    photo.url = uploaded.url;
    stored.push({
      key: uploaded.key,
      url: uploaded.url,
      contentType: photo.mimetype,
      size: photo.buffer.length,
    });
  }
  return stored;
};

type CandidateMatch = {
  studentId: string;
  confidence: number;
  photoKey?: string;
};

const setBest = (target: Map<string, CandidateMatch>, match: CandidateMatch) => {
  const existing = target.get(match.studentId);
  if (!existing || match.confidence > existing.confidence) {
    target.set(match.studentId, match);
  }
};

const roundConfidence = (value: number) => Number(value.toFixed(2));

export const recognizeAttendancePhotos = async (
  params: AttendanceAiScope &
    AttendanceAiActor & {
      photos: AttendanceAiPhotoInput[];
      autoPresentThreshold?: number;
      reviewThreshold?: number;
    },
) => {
  if (!params.photos.length) throw new HttpError(400, 'At least one attendance photo is required');

  if (!isAdminRole(params.actorRole)) {
    await ensureTeacherAssignedToClassSection({
      schoolId: params.schoolId,
      userId: params.actorId,
      classId: params.classId,
      sectionId: params.sectionId ?? undefined,
      date: params.date,
    });
  }

  const [sheet, storedPhotos] = await Promise.all([
    getAttendanceSheet(params),
    storeAttendancePhotos({ schoolId: params.schoolId, photos: params.photos }),
  ]);

  const students = sheet.rows.map((row: any) => row.student).filter(Boolean) as Array<{
    id: string;
    admissionNo?: string | null;
    rollNo?: string | null;
    fullName: string;
  }>;
  const studentById = new Map(students.map((student) => [student.id, student]));
  const validStudentIds = new Set(studentById.keys());
  const collectionId = buildClassSectionCollectionId({
    schoolId: params.schoolId,
    classId: params.classId,
    sectionId: params.sectionId ?? null,
  });

  const samples = await prisma.faceSample.findMany({
    where: {
      collectionId,
      rekognitionFaceId: { not: null },
      faceProfile: {
        schoolId: params.schoolId,
        status: 'APPROVED',
        student: {
          classId: params.classId,
          sectionId: params.sectionId ?? null,
          status: 'ENROLLED',
        },
      },
    },
    select: {
      rekognitionFaceId: true,
      faceProfile: {
        select: {
          studentId: true,
        },
      },
    },
  });

  const sampleByFaceId = new Map(
    samples
      .filter((sample) => sample.rekognitionFaceId && validStudentIds.has(sample.faceProfile.studentId))
      .map((sample) => [sample.rekognitionFaceId as string, sample.faceProfile.studentId]),
  );

  const autoPresentThreshold = params.autoPresentThreshold ?? env.REKOGNITION_AUTO_PRESENT_THRESHOLD;
  const reviewThreshold = params.reviewThreshold ?? env.REKOGNITION_REVIEW_THRESHOLD;
  if (reviewThreshold > autoPresentThreshold) {
    throw new HttpError(500, 'Rekognition review threshold cannot be higher than auto-present threshold');
  }

  const present = new Map<string, CandidateMatch>();
  const needsReview = new Map<string, CandidateMatch>();
  let detectedFaces = 0;
  let unindexedFaces = 0;
  let unmatchedFaces = 0;

  if (sampleByFaceId.size > 0) {
    for (const photo of params.photos) {
      const indexed = await indexAttendancePhotoFaces({
        collectionId,
        image: photo.buffer,
        maxFaces: 100,
      });
      const temporaryFaceIds = indexed.faceRecords
        .map((record) => record.Face?.FaceId)
        .filter((faceId): faceId is string => Boolean(faceId));
      const temporaryFaceIdSet = new Set(temporaryFaceIds);
      detectedFaces += temporaryFaceIds.length;
      unindexedFaces += indexed.unindexedFaceCount;

      try {
        for (const faceId of temporaryFaceIds) {
          const matches = await searchFaceInCollection({
            collectionId,
            faceId,
            threshold: reviewThreshold,
            maxFaces: 20,
          });
          const candidatesByStudent = new Map<string, CandidateMatch>();
          for (const match of matches) {
            const matchedFaceId = match.Face?.FaceId;
            if (!matchedFaceId || temporaryFaceIdSet.has(matchedFaceId)) continue;
            const studentId = sampleByFaceId.get(matchedFaceId);
            const confidence = match.Similarity ?? 0;
            if (!studentId || confidence < reviewThreshold) continue;
            setBest(candidatesByStudent, {
              studentId,
              confidence,
              photoKey: photo.key,
            });
          }

          const best = [...candidatesByStudent.values()].sort((a, b) => b.confidence - a.confidence)[0];
          if (!best) {
            unmatchedFaces += 1;
            continue;
          }

          if (best.confidence >= autoPresentThreshold) {
            setBest(present, best);
            needsReview.delete(best.studentId);
          } else if (!present.has(best.studentId)) {
            setBest(needsReview, best);
          }
        }
      } finally {
        try {
          await deleteFacesFromCollection({ collectionId, faceIds: temporaryFaceIds });
        } catch (error) {
          logger.warn({ err: error, collectionId, faceCount: temporaryFaceIds.length }, 'Failed to clean up temporary attendance faces');
        }
      }
    }
  }

  const records = students.map((student) => {
    const presentMatch = present.get(student.id);
    if (presentMatch) {
      return {
        studentId: student.id,
        fullName: student.fullName,
        admissionNo: student.admissionNo ?? null,
        rollNo: student.rollNo ?? null,
        status: 'PRESENT' as const,
        attendanceStatus: 'PRESENT' as const,
        confidence: roundConfidence(presentMatch.confidence),
        possibleMatches: [],
      };
    }

    const reviewMatch = needsReview.get(student.id);
    if (reviewMatch) {
      return {
        studentId: student.id,
        fullName: student.fullName,
        admissionNo: student.admissionNo ?? null,
        rollNo: student.rollNo ?? null,
        status: 'NEEDS_REVIEW' as const,
        attendanceStatus: 'ABSENT' as const,
        confidence: roundConfidence(reviewMatch.confidence),
        possibleMatches: [
          {
            studentId: student.id,
            fullName: student.fullName,
            confidence: roundConfidence(reviewMatch.confidence),
          },
        ],
      };
    }

    return {
      studentId: student.id,
      fullName: student.fullName,
      admissionNo: student.admissionNo ?? null,
      rollNo: student.rollNo ?? null,
      status: 'ABSENT' as const,
      attendanceStatus: 'ABSENT' as const,
      confidence: null,
      possibleMatches: [],
    };
  });

  const summary = {
    totalStudents: students.length,
    present: records.filter((record) => record.status === 'PRESENT').length,
    needsReview: records.filter((record) => record.status === 'NEEDS_REVIEW').length,
    absent: records.filter((record) => record.status === 'ABSENT').length,
    detectedFaces,
    unmatchedFaces,
    unindexedFaces,
    registeredFaceSamples: sampleByFaceId.size,
    photos: storedPhotos.length,
  };

  logger.info(
    {
      schoolId: params.schoolId,
      classId: params.classId,
      sectionId: params.sectionId ?? null,
      date: params.date,
      summary,
    },
    'AI attendance recognition completed',
  );

  return {
    thresholds: {
      autoPresent: autoPresentThreshold,
      review: reviewThreshold,
    },
    photos: storedPhotos,
    summary,
    records,
  };
};
