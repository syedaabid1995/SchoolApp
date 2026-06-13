export type TimetableReadMode = 'modern' | 'combined';
export type TimetableSource = 'timetable-entry';

export type TimetableSlot = {
  schoolId: string;
  dayOfWeek: number;
  periodId: string | null;
  periodName: string | null;
  periodType: string | null;
  startTime: string | null;
  endTime: string | null;
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  subjectType: string | null;
  teacherId: string;
  teacherName: string;
  teacherEmployeeNo: string | null;
  classId: string;
  className: string | null;
  sectionId: string | null;
  sectionName: string | null;
  roomId: string | null;
  roomName: string | null;
  roomCapacity: number | null;
  isActive: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
  source: TimetableSource;
  sourceId: string;
  timetableVersionId: string | null;
  academicYearId: string | null;
  teacherFirstName: string | null;
  teacherLastName: string | null;
};

export type LegacyTimePeriod = {
  id: string;
  schoolId?: string;
  type: string;
  name: string;
  startTime: string;
  endTime: string;
  createdAt?: Date;
  updatedAt?: Date;
  _count?: {
    classRoutines: number;
  };
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
  isActive?: boolean;
};

export type LegacyTimePeriodReadParams = {
  schoolId: string;
  type?: string;
  includeRoutineCount?: boolean;
  selectPublicFieldsOnly?: boolean;
};

export type StudentTimetableReadParams = Omit<TimetableReadParams, 'teacherId'> & {
  studentId?: string;
};

export type TeacherTimetable = {
  schoolId: string;
  teacherId: string;
  mode: TimetableReadMode;
  slots: TimetableSlot[];
};

export type ClassTimetable = {
  schoolId: string;
  classId: string;
  sectionId: string | null;
  mode: TimetableReadMode;
  slots: TimetableSlot[];
};

export type ParentTimetable = {
  schoolId: string;
  studentId?: string;
  classId: string | null;
  sectionId: string | null;
  mode: TimetableReadMode;
  slots: TimetableSlot[];
};

export type DashboardTimetable = {
  schoolId: string;
  mode: TimetableReadMode;
  slots: TimetableSlot[];
};

export type TimetableAdapter = {
  readonly source: TimetableSource;
  getTimetable(params: TimetableReadParams): Promise<TimetableSlot[]>;
  getLegacyTimePeriods?(params: LegacyTimePeriodReadParams): Promise<LegacyTimePeriod[]>;
};
