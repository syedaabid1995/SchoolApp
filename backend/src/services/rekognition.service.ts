import crypto from 'crypto';
import {
  CreateCollectionCommand,
  DeleteFacesCommand,
  DescribeCollectionCommand,
  IndexFacesCommand,
  RekognitionClient,
  SearchFacesCommand,
  type FaceRecord,
  type FaceMatch,
} from '@aws-sdk/client-rekognition';
import { env } from '../config/env';
import { HttpError } from '../middlewares/error.middleware';
import { logger } from '../config/logger';

let rekognitionClient: RekognitionClient | null = null;

const getRekognitionClient = () => {
  if (rekognitionClient) return rekognitionClient;
  if (!env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY || !env.REKOGNITION_REGION) {
    throw new HttpError(503, 'AWS Rekognition credentials are not configured');
  }
  rekognitionClient = new RekognitionClient({
    region: env.REKOGNITION_REGION,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  });
  return rekognitionClient;
};

const collectionSegment = (value: string | null | undefined) =>
  (value || 'none').replace(/[^A-Za-z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'none';

export const buildClassSectionCollectionId = (params: {
  schoolId: string;
  classId: string;
  sectionId?: string | null;
}) => {
  const prefix = collectionSegment(env.REKOGNITION_COLLECTION_PREFIX);
  return [
    prefix,
    'school',
    collectionSegment(params.schoolId),
    'class',
    collectionSegment(params.classId),
    'section',
    collectionSegment(params.sectionId),
  ].join('-').slice(0, 255);
};

const isNotFound = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'name' in error &&
  (error as { name?: string }).name === 'ResourceNotFoundException';

export const ensureRekognitionCollection = async (collectionId: string) => {
  const client = getRekognitionClient();
  try {
    await client.send(new DescribeCollectionCommand({ CollectionId: collectionId }));
    return collectionId;
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }

  await client.send(new CreateCollectionCommand({ CollectionId: collectionId }));
  logger.info({ collectionId }, 'Created Rekognition collection for class-section attendance');
  return collectionId;
};

export const indexRegisteredStudentFace = async (params: {
  collectionId: string;
  studentId: string;
  image: Buffer;
}) => {
  await ensureRekognitionCollection(params.collectionId);
  const response = await getRekognitionClient().send(
    new IndexFacesCommand({
      CollectionId: params.collectionId,
      Image: { Bytes: params.image },
      ExternalImageId: params.studentId,
      MaxFaces: 1,
      QualityFilter: 'AUTO',
      DetectionAttributes: [],
    }),
  );

  logger.debug(
    {
      collectionId: params.collectionId,
      faceRecordCount: response.FaceRecords?.length ?? 0,
      unindexedFaceCount: response.UnindexedFaces?.length ?? 0,
    },
    'Rekognition student face index response',
  );

  const face = response.FaceRecords?.[0]?.Face;
  if (!face?.FaceId) {
    throw new HttpError(422, 'No usable face was detected in one of the registration images');
  }

  return {
    collectionId: params.collectionId,
    faceId: face.FaceId,
  };
};

export const indexAttendancePhotoFaces = async (params: {
  collectionId: string;
  image: Buffer;
  maxFaces?: number;
}) => {
  await ensureRekognitionCollection(params.collectionId);
  const externalImageId = `attendance-${crypto.randomUUID()}`;
  const response = await getRekognitionClient().send(
    new IndexFacesCommand({
      CollectionId: params.collectionId,
      Image: { Bytes: params.image },
      ExternalImageId: externalImageId,
      MaxFaces: params.maxFaces ?? 100,
      QualityFilter: 'AUTO',
      DetectionAttributes: [],
    }),
  );

  logger.debug(
    {
      collectionId: params.collectionId,
      faceRecordCount: response.FaceRecords?.length ?? 0,
      unindexedFaceCount: response.UnindexedFaces?.length ?? 0,
    },
    'Rekognition attendance photo index response',
  );

  return {
    externalImageId,
    faceRecords: response.FaceRecords ?? [],
    unindexedFaceCount: response.UnindexedFaces?.length ?? 0,
  };
};

export const searchFaceInCollection = async (params: {
  collectionId: string;
  faceId: string;
  threshold: number;
  maxFaces?: number;
}) => {
  const response = await getRekognitionClient().send(
    new SearchFacesCommand({
      CollectionId: params.collectionId,
      FaceId: params.faceId,
      FaceMatchThreshold: params.threshold,
      MaxFaces: params.maxFaces ?? 10,
    }),
  );

  logger.debug(
    {
      collectionId: params.collectionId,
      matchCount: response.FaceMatches?.length ?? 0,
    },
    'Rekognition attendance face search response',
  );

  return response.FaceMatches ?? [];
};

export const deleteFacesFromCollection = async (params: {
  collectionId: string;
  faceIds: string[];
}) => {
  const faceIds = [...new Set(params.faceIds.filter(Boolean))];
  if (!faceIds.length) return;
  await getRekognitionClient().send(
    new DeleteFacesCommand({
      CollectionId: params.collectionId,
      FaceIds: faceIds,
    }),
  );
};

export type RekognitionFaceRecord = FaceRecord;
export type RekognitionFaceMatch = FaceMatch;
