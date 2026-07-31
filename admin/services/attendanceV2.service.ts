import { api } from '../lib/api';

export type AttendanceMode = 'DAILY' | 'TWICE_DAILY' | 'PERIOD_WISE';
export type AttendanceConfigurationScope = 'SCHOOL' | 'ACADEMIC_YEAR' | 'CLASS' | 'SECTION';
export type AttendanceUnitType = 'DAY' | 'SLOT' | 'PERIOD' | 'TIMETABLE_ENTRY';
export type AttendanceSlotType = 'MORNING' | 'AFTERNOON';
export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';
export type AttendanceReportStatus = AttendanceStatus | 'UNMARKED' | 'HOLIDAY';

export type AttendanceConfiguration = {
  id: string;
  schoolId: string;
  academicYearId?: string | null;
  classId?: string | null;
  sectionId?: string | null;
  scope: AttendanceConfigurationScope;
  mode: AttendanceMode;
  effectiveFrom: string;
  effectiveTo?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  academicYear?: { id: string; name: string } | null;
  class?: { id: string; name: string } | null;
  section?: { id: string; name: string } | null;
};

export type ResolvedAttendanceUnit = {
  unitType: AttendanceUnitType;
  label: string;
  slotId?: string | null;
  slotType?: AttendanceSlotType | null;
  periodId?: string | null;
  timetableEntryId?: string | null;
  subjectId?: string | null;
  teacherId?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  source: 'DAY' | 'SLOT' | 'TIMETABLE_ENTRY' | 'PERIOD_FALLBACK';
};

export type AttendanceResolutionParams = {
  schoolId?: string;
  academicYearId: string;
  classId: string;
  sectionId?: string;
  date: string;
};

export type AttendanceUnitParams = AttendanceResolutionParams & {
  unitType: AttendanceUnitType;
  slotId?: string | null;
  slotType?: AttendanceSlotType | null;
  periodId?: string | null;
  timetableEntryId?: string | null;
};

export type AttendanceResolution = {
  id: string | null;
  mode: AttendanceMode;
  source: AttendanceConfigurationScope | 'DEFAULT';
  configuration: AttendanceConfiguration | null;
  units?: ResolvedAttendanceUnit[];
};

export type AttendanceSheet = {
  configuration: AttendanceResolution;
  unit: ResolvedAttendanceUnit;
  session: {
    id: string;
    status: 'OPEN' | 'CLOSED';
    approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
    lockedAt?: string | null;
    lockedById?: string | null;
    lockReason?: string | null;
    date: string;
    mode: AttendanceMode;
    unitType: AttendanceUnitType;
    slotId?: string | null;
    periodId?: string | null;
    timetableEntryId?: string | null;
  } | null;
  rows: Array<{
    student: {
      id: string;
      admissionNo: string;
      rollNo?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      fullName?: string | null;
    };
    recordId: string | null;
    status: AttendanceStatus | null;
    confidence?: number | null;
    capturedAt?: string | null;
    deviceId?: string | null;
    manualOverrideReason?: string | null;
  }>;
};

export type StudentAttendanceReport = {
  academicYear: { id: string; name: string; startDate: string; endDate: string; isActive: boolean };
  class: { id: string; name: string };
  section?: { id: string; name: string } | null;
  student: {
    id: string;
    admissionNo: string;
    rollNo?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    fullName?: string | null;
    name: string;
  };
  mode: AttendanceMode;
  startDate: string;
  endDate: string;
  columns: Array<{
    key: string;
    label: string;
    unitType: AttendanceUnitType;
    startTime?: string | null;
    endTime?: string | null;
  }>;
  rows: Array<{
    date: string;
    day: string;
    cells: Record<string, {
      status: AttendanceReportStatus;
      note?: string | null;
      sessionId?: string | null;
      recordId?: string | null;
      subject?: string | null;
      unitLabel?: string | null;
    }>;
  }>;
  summary: {
    total: number;
    present: number;
    late: number;
    absent: number;
    excused: number;
    holiday: number;
    unmarked: number;
    percentage: number;
  };
};

export type AttendanceConfigurationInput = {
  schoolId?: string;
  academicYearId?: string | null;
  classId?: string | null;
  sectionId?: string | null;
  scope: AttendanceConfigurationScope;
  mode: AttendanceMode;
  effectiveFrom: string;
  effectiveTo?: string | null;
  isActive?: boolean;
};

export type AttendanceConfigurationBulkApplyInput = {
  schoolId?: string;
  scope: 'SCHOOL' | 'ACADEMIC_YEAR';
  mode: AttendanceMode;
  academicYearId: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  replaceExisting?: boolean;
};

const cleanParams = <T extends Record<string, any>>(params: T): T => {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ) as T;
};

export const resolveAttendanceConfiguration = async (params: AttendanceResolutionParams) => {
  const { data } = await api.get<AttendanceResolution>('/attendance/config/resolve', { params: cleanParams(params) });
  return data;
};

export const resolveAttendanceUnits = async (params: AttendanceResolutionParams) => {
  const { data } = await api.get<{ configuration: AttendanceResolution; units: ResolvedAttendanceUnit[] }>('/attendance/units', { params: cleanParams(params) });
  return data;
};

export const loadAttendanceSheet = async (params: AttendanceUnitParams) => {
  const { data } = await api.get<AttendanceSheet>('/attendance/sheet', { params: cleanParams(params) });
  return data;
};

export const getStudentAttendanceReportView = async (params: Omit<AttendanceResolutionParams, 'date'> & { studentId: string }) => {
  const { data } = await api.get<StudentAttendanceReport>('/attendance/student-report', { params: cleanParams(params) });
  return data;
};

export const saveAttendanceSheet = async (payload: AttendanceUnitParams & {
  records: Array<{ studentId: string; status: AttendanceStatus; manualOverrideReason?: string }>;
}) => {
  const { data } = await api.put<AttendanceSheet>('/attendance/sheet', cleanParams(payload));
  return data;
};

export const lockAttendanceSheet = async (id: string, payload?: { schoolId?: string; reason?: string }) => {
  const { data } = await api.post(`/attendance/sheet/${id}/lock`, payload ?? {});
  return data;
};

export const reopenAttendanceSheet = async (id: string, payload?: { schoolId?: string; reason?: string }) => {
  const { data } = await api.post(`/attendance/sheet/${id}/reopen`, payload ?? {});
  return data;
};

export const listAttendanceConfigurations = async (params?: { schoolId?: string }) => {
  const { data } = await api.get<AttendanceConfiguration[]>('/attendance/configurations', { params });
  return data;
};

export const createAttendanceConfiguration = async (payload: AttendanceConfigurationInput) => {
  const { data } = await api.post<AttendanceConfiguration>('/attendance/configurations', payload);
  return data;
};

export const bulkApplyAttendanceConfigurations = async (payload: AttendanceConfigurationBulkApplyInput) => {
  const { data } = await api.post<{ count: number; items: AttendanceConfiguration[] }>('/attendance/configurations/bulk-apply', payload);
  return data;
};

export const updateAttendanceConfiguration = async (id: string, payload: Partial<AttendanceConfigurationInput>) => {
  const { data } = await api.patch<AttendanceConfiguration>(`/attendance/configurations/${id}`, payload);
  return data;
};

export const deactivateAttendanceConfiguration = async (id: string, payload?: { schoolId?: string }) => {
  const { data } = await api.patch<AttendanceConfiguration>(`/attendance/configurations/${id}/deactivate`, payload ?? {});
  return data;
};
