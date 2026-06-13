import type { TimetableSlot } from '../models/timetable-read-model';

type LegacyRoutineOptions = {
  includeTeacher?: boolean;
  includeSubjectDetails?: boolean;
  includeRoomCapacity?: boolean;
};

export const toLegacyClassRoutineRow = (slot: TimetableSlot, options: LegacyRoutineOptions = {}) => ({
  id: slot.sourceId,
  schoolId: slot.schoolId,
  classId: slot.classId,
  sectionId: slot.sectionId,
  timePeriodId: slot.periodId,
  dayOfWeek: slot.dayOfWeek,
  subjectId: slot.subjectId,
  teacherId: slot.teacherId,
  classRoomId: slot.roomId,
  createdAt: slot.createdAt,
  updatedAt: slot.updatedAt,
  class: { id: slot.classId, name: slot.className ?? '' },
  section: slot.sectionId ? { id: slot.sectionId, name: slot.sectionName ?? '' } : null,
  timePeriod: {
    id: slot.periodId,
    name: slot.periodName ?? '',
    startTime: slot.startTime,
    endTime: slot.endTime,
    type: slot.periodType,
  },
  subject: {
    id: slot.subjectId,
    name: slot.subjectName,
    ...(options.includeSubjectDetails ? { code: slot.subjectCode, type: slot.subjectType } : {}),
  },
  ...(options.includeTeacher
    ? {
        teacher: {
          id: slot.teacherId,
          firstName: slot.teacherFirstName ?? '',
          lastName: slot.teacherLastName ?? '',
          employeeNo: slot.teacherEmployeeNo,
        },
      }
    : {}),
  classRoom: slot.roomId
    ? {
        id: slot.roomId,
        roomNumber: slot.roomName ?? '',
        ...(options.includeRoomCapacity ? { capacity: slot.roomCapacity } : {}),
      }
    : null,
});

export const toModernTimetableEntryRow = (slot: TimetableSlot) => ({
  id: slot.sourceId,
  schoolId: slot.schoolId,
  timetableVersionId: slot.timetableVersionId,
  academicYearId: slot.academicYearId,
  classId: slot.classId,
  sectionId: slot.sectionId,
  attendancePeriodId: slot.periodId,
  dayOfWeek: slot.dayOfWeek,
  subjectId: slot.subjectId,
  teacherId: slot.teacherId,
  classRoomId: slot.roomId,
  room: slot.roomName,
  isActive: slot.isActive,
  createdAt: slot.createdAt,
  updatedAt: slot.updatedAt,
  class: { id: slot.classId, name: slot.className ?? '' },
  section: slot.sectionId ? { id: slot.sectionId, name: slot.sectionName ?? '' } : null,
  subject: { id: slot.subjectId, name: slot.subjectName },
  teacher: {
    id: slot.teacherId,
    firstName: slot.teacherFirstName ?? '',
    lastName: slot.teacherLastName ?? '',
  },
  period: {
    id: slot.periodId,
    name: slot.periodName ?? '',
    type: slot.periodType,
    startTime: slot.startTime,
    endTime: slot.endTime,
  },
  classRoom: slot.roomId
    ? {
        id: slot.roomId,
        roomNumber: slot.roomName ?? '',
        capacity: slot.roomCapacity,
      }
    : null,
});
