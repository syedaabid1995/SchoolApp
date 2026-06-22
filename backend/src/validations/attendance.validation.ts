import { z } from 'zod';
import { isValidTime } from '../utils/attendance';

const timeSchema = z.string().refine(isValidTime, 'Invalid time format');
const timePeriodTypeSchema = z.enum(['CLASS_TIME', 'EXAM_TIME', 'BREAK']);

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
  type: timePeriodTypeSchema.optional(),
  name: z.string().min(1),
  startTime: timeSchema,
  endTime: timeSchema,
  lateThresholdMinutes: z.number().int().min(0).optional(),
  earlyThresholdMinutes: z.number().int().min(0).optional(),
  schoolId: z.string().uuid().optional(),
});

export const attendancePeriodUpdateSchema = z.object({
  type: timePeriodTypeSchema.optional(),
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

const attendanceSheetUnitBaseSchema = z.object({
  unitType: z.enum(['DAY', 'SLOT', 'PERIOD', 'TIMETABLE_ENTRY']),
  slotId: z.string().uuid().optional(),
  slotType: z.enum(['MORNING', 'AFTERNOON']).optional(),
  periodId: z.string().uuid().optional(),
  timetableEntryId: z.string().uuid().optional(),
});

const requireAttendanceUnitReference = (value: z.infer<typeof attendanceSheetUnitBaseSchema>, ctx: z.RefinementCtx) => {
  if (value.unitType === 'SLOT' && !value.slotId && !value.slotType) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['slotId'], message: 'slotId or slotType is required for SLOT attendance' });
  }
  if (value.unitType === 'PERIOD' && !value.periodId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['periodId'], message: 'periodId is required for PERIOD attendance' });
  }
  if (value.unitType === 'TIMETABLE_ENTRY' && !value.timetableEntryId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['timetableEntryId'],
      message: 'timetableEntryId is required for TIMETABLE_ENTRY attendance',
    });
  }
};

const attendanceSheetScopeSchema = z.object({
  schoolId: z.string().uuid().optional(),
  academicYearId: z.string().uuid(),
  classId: z.string().uuid(),
  sectionId: z.string().uuid().optional(),
  date: z.coerce.date(),
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

export const resolveAttendanceConfigQuerySchema = attendanceSheetScopeSchema;

export const attendanceUnitsQuerySchema = attendanceSheetScopeSchema;

export const attendanceSheetQuerySchema = attendanceSheetScopeSchema
  .merge(attendanceSheetUnitBaseSchema)
  .superRefine(requireAttendanceUnitReference);

const modernAttendanceRecordSchema = z.object({
  studentId: z.string().uuid(),
  status: z.enum(['PRESENT', 'LATE', 'ABSENT', 'EXCUSED']),
  confidence: z.number().min(0).max(1).optional(),
  manualOverrideReason: z.string().trim().max(500).optional(),
});

export const saveAttendanceSheetSchema = attendanceSheetScopeSchema
  .merge(attendanceSheetUnitBaseSchema)
  .extend({
    records: z.array(modernAttendanceRecordSchema).min(1),
    deviceId: z.string().trim().min(1).optional(),
    gpsLat: z.number().optional(),
    gpsLng: z.number().optional(),
  })
  .superRefine(requireAttendanceUnitReference);

export const attendanceSheetLockSchema = z.object({
  schoolId: z.string().uuid().optional(),
  reason: z.string().trim().min(1).optional(),
});

export const attendanceConfigurationListQuerySchema = z.object({
  schoolId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  active: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
});

export const attendanceConfigurationCreateSchema = z.object({
  schoolId: z.string().uuid().optional(),
  scope: z.enum(['SCHOOL', 'ACADEMIC_YEAR', 'CLASS', 'SECTION']),
  mode: z.enum(['DAILY', 'TWICE_DAILY', 'PERIOD_WISE']),
  academicYearId: z.string().uuid().optional().nullable(),
  classId: z.string().uuid().optional().nullable(),
  sectionId: z.string().uuid().optional().nullable(),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const attendanceConfigurationBulkApplySchema = z.object({
  schoolId: z.string().uuid().optional(),
  scope: z.enum(['SCHOOL', 'ACADEMIC_YEAR']),
  mode: z.enum(['DAILY', 'TWICE_DAILY', 'PERIOD_WISE']),
  academicYearId: z.string().uuid(),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional().nullable(),
  replaceExisting: z.boolean().optional().default(false),
});

export const attendanceConfigurationUpdateSchema = attendanceConfigurationCreateSchema.partial().extend({
  schoolId: z.string().uuid().optional(),
});

export const attendanceConfigurationDeactivateSchema = z.object({
  schoolId: z.string().uuid().optional(),
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
