export type AttendanceSource =
  | 'session-attendance'
  | 'period-attendance'
  | 'staff-attendance';

export type StudentAttendanceReadSource = Exclude<AttendanceSource, 'staff-attendance'>;

export type CanonicalAttendanceUnit = {
  mode: 'DAILY' | 'TWICE_DAILY' | 'PERIOD_WISE' | null;
  unitType: 'DAY' | 'SLOT' | 'PERIOD' | 'TIMETABLE_ENTRY' | null;
  slotId: string | null;
  periodId: string | null;
  timetableEntryId: string | null;
};

export type AttendanceStatus =
  | 'PRESENT'
  | 'ABSENT'
  | 'LATE'
  | 'HALF_DAY'
  | 'EXCUSED'
  | 'HOLIDAY'
  | 'LEAVE'
  | 'LOP'
  | 'CASUAL_LEAVE'
  | 'UNMARKED';

export type StudentDailyAttendance = {
  source: StudentAttendanceReadSource;
  sourceId: string;
  schoolId: string;
  studentId: string;
  classId: string | null;
  sectionId: string | null;
  academicSessionId: string | null;
  date: string;
  status: AttendanceStatus;
  note: string | null;
  sessionId: string | null;
  periodId: string | null;
  timetableEntryId: string | null;
  unit?: CanonicalAttendanceUnit;
};

export type StudentAttendanceSummary = {
  schoolId: string;
  source: StudentAttendanceReadSource | 'combined';
  fromDate: string;
  toDate: string;
  totalRecords: number;
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  excused: number;
  holiday: number;
  unmarked: number;
  byStudent: Array<{
    studentId: string;
    totalRecords: number;
    present: number;
    absent: number;
    late: number;
    halfDay: number;
    excused: number;
    holiday: number;
    unmarked: number;
    percentage: number;
  }>;
  records: StudentDailyAttendance[];
};

export type StudentAttendanceSessionOverview = {
  id: string;
  schoolId: string;
  date: Date;
  status: string;
  classId: string;
  className: string;
  sectionId: string | null;
  sectionName: string;
  lockedAt: Date | null;
  lockReason: string | null;
  recordCount: number;
  records: StudentDailyAttendance[];
};

export type StudentAttendanceSessionOverviewParams = {
  schoolId: string;
  date?: Date | string;
  classId?: string | string[];
  sectionId?: string | null;
  classSectionPairs?: Array<{ classId: string; sectionId: string | null }>;
};

export type TeacherDailyAttendance = {
  source: 'staff-attendance';
  sourceId: string;
  schoolId: string;
  teacherId: string;
  date: string;
  status: AttendanceStatus;
  note: string | null;
  unitKey?: string | null;
  unitType?: 'DAY' | 'SLOT' | 'PERIOD' | 'TIMETABLE_ENTRY' | null;
  slotType?: string | null;
  periodId?: string | null;
  periodName?: string | null;
};

export type TeacherAttendanceSummary = {
  schoolId: string;
  source: 'staff-attendance';
  fromDate: string;
  toDate: string;
  totalRecords: number;
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  leave: number;
  holiday: number;
  records: TeacherDailyAttendance[];
};

export type AttendanceAnalyticsSummary = {
  schoolId: string;
  source: StudentAttendanceReadSource | 'combined';
  fromDate: string;
  toDate: string;
  totalRecords: number;
  presentLikeRecords: number;
  absentRecords: number;
  attendanceRate: number;
  records: StudentDailyAttendance[];
};

export type TimetableSlot = {
  source: 'timetable-entry';
  sourceId: string;
  schoolId: string;
  academicYearId: string | null;
  timetableVersionId: string | null;
  classId: string;
  sectionId: string | null;
  periodId: string;
  dayOfWeek: number;
  subjectId: string;
  teacherId: string;
  room: string | null;
  startTime: string | null;
  endTime: string | null;
};

export type StudentAttendanceReadParams = {
  schoolId: string;
  studentId?: string;
  classId?: string;
  sectionId?: string | null;
  academicSessionId?: string;
  date?: Date | string;
  fromDate?: Date | string;
  toDate?: Date | string;
};

export type TeacherAttendanceReadParams = {
  schoolId: string;
  teacherId?: string;
  fromDate?: Date | string;
  toDate?: Date | string;
};

export type TimetableReadParams = {
  schoolId: string;
  academicYearId?: string;
  timetableVersionId?: string;
  teacherId?: string;
  classId?: string;
  sectionId?: string | null;
  dayOfWeek?: number;
  date?: Date | string;
};

export type StudentAttendanceAdapter = {
  readonly source: StudentAttendanceReadSource;
  getStudentAttendance(params: StudentAttendanceReadParams): Promise<StudentDailyAttendance[]>;
};

export type TeacherAttendanceAdapter = {
  readonly source: 'staff-attendance';
  getTeacherAttendance(params: TeacherAttendanceReadParams): Promise<TeacherDailyAttendance[]>;
};
