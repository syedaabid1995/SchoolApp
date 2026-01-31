import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';

export type RecognitionInput = {
  schoolId: string;
  embedding: number[];
  threshold?: number;
  enforceLiveness?: boolean;
  liveness?: {
    blinkDetected?: boolean;
    motionDetected?: boolean;
    spoofDetected?: boolean;
  };
};

export type RecognitionResult = {
  matched: boolean;
  studentId: string | null;
  faceProfileId: string | null;
  confidence: number | null;
  suspicious: boolean;
};

const cosineSimilarity = (a: number[], b: number[]) => {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

const normalizeEmbedding = (embedding: number[]) => {
  const norm = Math.sqrt(embedding.reduce((sum, value) => sum + value * value, 0));
  if (norm === 0) return embedding;
  return embedding.map((value) => value / norm);
};

export const recognizeFace = async (input: RecognitionInput): Promise<RecognitionResult> => {
  const threshold = input.threshold ?? 0.8;

  if (input.enforceLiveness && input.liveness) {
    if (input.liveness.spoofDetected) {
      throw new HttpError(422, 'Liveness check failed');
    }
  }

  const faceSamples = await prisma.faceSample.findMany({
    where: {
      faceProfile: {
        schoolId: input.schoolId,
        status: 'APPROVED',
      },
    },
    select: {
      embedding: true,
      faceProfileId: true,
      faceProfile: { select: { studentId: true } },
    },
  });

  if (!faceSamples.length) {
    return {
      matched: false,
      studentId: null,
      faceProfileId: null,
      confidence: null,
      suspicious: Boolean(input.liveness?.spoofDetected),
    };
  }

  const inputEmbedding = normalizeEmbedding(input.embedding);

  let best = {
    confidence: 0,
    faceProfileId: null as string | null,
    studentId: null as string | null,
  };

  for (const sample of faceSamples) {
    const stored = Array.isArray(sample.embedding) ? (sample.embedding as number[]) : [];
    const storedEmbedding = normalizeEmbedding(stored);
    const confidence = cosineSimilarity(inputEmbedding, storedEmbedding);

    if (confidence > best.confidence) {
      best = {
        confidence,
        faceProfileId: sample.faceProfileId,
        studentId: sample.faceProfile.studentId,
      };
    }
  }

  const matched = best.confidence >= threshold;

  return {
    matched,
    studentId: matched ? best.studentId : null,
    faceProfileId: matched ? best.faceProfileId : null,
    confidence: matched ? Number(best.confidence.toFixed(4)) : null,
    suspicious: Boolean(input.liveness?.spoofDetected),
  };
};
