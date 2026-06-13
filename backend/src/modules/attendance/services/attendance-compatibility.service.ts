import type { StudentAttendanceStatus } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../config/db';

type PrismaLike = typeof defaultPrisma;
type AttendanceCompatibilityExecutor = Pick<PrismaLike, 'studentAttendanceSession' | 'studentAttendanceRecord'>;

export type LegacyAttendanceCompatibilityRecord = {
  studentId: string;
  status: StudentAttendanceStatus;
  note?: string | null;
};

export type LegacyAttendanceCompatibilityParams = {
  schoolId: string;
  academicSessionId: string;
  classId: string;
  sectionId: string;
  attendanceDate: Date | string;
  actorId: string;
  records: LegacyAttendanceCompatibilityRecord[];
};

export type AttendanceCompatibilitySessionKey = {
  schoolId: string;
  academicSessionId: string;
  classId: string;
  sectionId: string;
  attendanceDate: Date;
};

export type AttendanceCompatibilityResult = {
  sessionKey: AttendanceCompatibilitySessionKey;
  session: {
    id: string;
    schoolId: string;
    classId: string;
    sectionId: string | null;
    date: Date;
  };
  records: Array<{
    id: string;
    sessionId: string;
    studentId: string;
    status: StudentAttendanceStatus;
    remarks: string | null;
  }>;
  createdSession: boolean;
  createdRecords: number;
  updatedRecords: number;
  saved: number;
};

const toDateOnly = (value: Date | string) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

export class AttendanceCompatibilityService {
  constructor(private readonly db: PrismaLike = defaultPrisma) {}

  resolveSessionKey(params: Omit<LegacyAttendanceCompatibilityParams, 'actorId' | 'records'>): AttendanceCompatibilitySessionKey {
    return {
      schoolId: params.schoolId,
      academicSessionId: params.academicSessionId,
      classId: params.classId,
      sectionId: params.sectionId,
      attendanceDate: toDateOnly(params.attendanceDate),
    };
  }

  async writeStudentAttendance(params: LegacyAttendanceCompatibilityParams): Promise<AttendanceCompatibilityResult> {
    return this.db.$transaction((tx) => this.writeStudentAttendanceWithExecutor(tx as AttendanceCompatibilityExecutor, params));
  }

  async writeStudentAttendanceWithExecutor(
    tx: AttendanceCompatibilityExecutor,
    params: LegacyAttendanceCompatibilityParams,
  ): Promise<AttendanceCompatibilityResult> {
    const sessionKey = this.resolveSessionKey(params);
    const studentIds = [...new Set(params.records.map((record) => record.studentId))];

    let createdSession = false;
    let session = await tx.studentAttendanceSession.findFirst({
      where: {
        schoolId: sessionKey.schoolId,
        classId: sessionKey.classId,
        sectionId: sessionKey.sectionId,
        date: sessionKey.attendanceDate,
      },
    });

    if (!session) {
      session = await tx.studentAttendanceSession.create({
        data: {
          schoolId: sessionKey.schoolId,
          classId: sessionKey.classId,
          sectionId: sessionKey.sectionId,
          date: sessionKey.attendanceDate,
          createdById: params.actorId,
          status: 'DRAFT',
        },
      });
      createdSession = true;
    }

    const existingRecords = studentIds.length
      ? await tx.studentAttendanceRecord.findMany({
          where: {
            sessionId: session.id,
            studentId: { in: studentIds },
          },
          select: { studentId: true },
        })
      : [];
    const existingStudentIds = new Set(existingRecords.map((record) => record.studentId));
    const writtenRecords = [];
    let createdRecords = 0;
    let updatedRecords = 0;

    for (const record of params.records) {
      const existed = existingStudentIds.has(record.studentId);
      const written = await tx.studentAttendanceRecord.upsert({
        where: {
          sessionId_studentId: {
            sessionId: session.id,
            studentId: record.studentId,
          },
        },
        create: {
          sessionId: session.id,
          studentId: record.studentId,
          status: record.status,
          remarks: record.note ?? null,
        },
        update: {
          status: record.status,
          remarks: record.note ?? null,
        },
      });

      writtenRecords.push(written);
      if (existed) {
        updatedRecords += 1;
      } else {
        createdRecords += 1;
        existingStudentIds.add(record.studentId);
      }
    }

    return {
      sessionKey,
      session: {
        id: session.id,
        schoolId: session.schoolId,
        classId: session.classId,
        sectionId: session.sectionId,
        date: session.date,
      },
      records: writtenRecords.map((record) => ({
        id: record.id,
        sessionId: record.sessionId,
        studentId: record.studentId,
        status: record.status,
        remarks: record.remarks,
      })),
      createdSession,
      createdRecords,
      updatedRecords,
      saved: params.records.length,
    };
  }
}

export const attendanceCompatibilityService = new AttendanceCompatibilityService();
