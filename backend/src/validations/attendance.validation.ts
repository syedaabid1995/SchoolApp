import { z } from 'zod';
import { isValidTime } from '../utils/attendance';

const timeSchema = z.string().refine(isValidTime, 'Invalid time format');

export const uuidParamsSchema = z.object({
  id: z.string().uuid(),
});

export const attendanceSessionParamsSchema = z.object({
  sessionId: z.string().uuid(),
});

export const attendanceRecordParamsSchema = z.object({
  id: z.string().uuid(),
});

export const attendancePeriodCreateSchema = z.object({
  name: z.string().min(1),
  startTime: timeSchema,
  endTime: timeSchema,
  lateThresholdMinutes: z.number().int().min(0).optional(),
  earlyThresholdMinutes: z.number().int().min(0).optional(),
  schoolId: z.string().uuid().optional(),
});

export const attendancePeriodUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  startTime: timeSchema.optional(),
  endTime: timeSchema.optional(),
  lateThresholdMinutes: z.number().int().min(0).optional(),
  earlyThresholdMinutes: z.number().int().min(0).optional(),
  schoolId: z.string().uuid().optional(),
});

const attendanceRecordSchema = z.object({
  studentId: z.string().uuid(),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY']),
  remarks: z.string().trim().max(500).optional(),
});

export const createAttendanceSessionSchema = z.object({
  schoolId: z.string().uuid().optional(),
  classId: z.string().uuid(),
  sectionId: z.string().uuid().optional(),
  date: z.coerce.date().optional(),
});

export const updateAttendanceSessionSchema = z.object({
  schoolId: z.string().uuid().optional(),
  records: z.array(attendanceRecordSchema).min(1).optional().default([]),
  submit: z.boolean().optional().default(false),
  unlock: z.boolean().optional().default(false),
  reason: z.string().trim().optional(),
});

export const lockAttendanceSessionSchema = z.object({
  schoolId: z.string().uuid().optional(),
  reason: z.string().trim().min(1),
});

export const attendanceSummaryQuerySchema = z.object({
  schoolId: z.string().uuid().optional(),
  date: z.coerce.date().optional(),
});

export const teacherSelfAttendanceSchema = z.object({
  schoolId: z.string().uuid().optional(),
  status: z.enum(['PRESENT', 'LEAVE']),
  date: z.coerce.date().optional(),
  teacherId: z.string().uuid().optional(),
  overrideReason: z.string().trim().optional(),
  leaveRequestId: z.string().uuid().optional(),
});

export const teacherSelfAttendanceListQuerySchema = z.object({
  schoolId: z.string().uuid().optional(),
  teacherId: z.string().uuid().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

export const startLegacyAttendanceSessionSchema = z.object({
  periodId: z.string().uuid(),
  date: z.coerce.date().optional(),
  deviceId: z.string().min(1),
  gpsLat: z.number().optional(),
  gpsLng: z.number().optional(),
  schoolId: z.string().uuid().optional(),
});

export const markLegacyAttendanceSchema = z.object({
  sessionId: z.string().uuid(),
  records: z
    .array(
      z.object({
        studentId: z.string().uuid(),
        confidence: z.number().min(0).max(1).optional(),
      }),
    )
    .min(1),
  deviceId: z.string().min(1),
  gpsLat: z.number().optional(),
  gpsLng: z.number().optional(),
  schoolId: z.string().uuid().optional(),
});

export const overrideLegacyAttendanceSchema = z.object({
  status: z.enum(['PRESENT', 'LATE', 'ABSENT', 'EXCUSED']),
  reason: z.string().min(1),
  schoolId: z.string().uuid().optional(),
});

export const listLegacyAttendanceSessionsQuerySchema = z.object({
  schoolId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  approvalStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
});

export const approveAttendanceSessionSchema = z.object({
  schoolId: z.string().uuid().optional(),
});

export const rejectAttendanceSessionSchema = z.object({
  reason: z.string().min(1),
  schoolId: z.string().uuid().optional(),
});
