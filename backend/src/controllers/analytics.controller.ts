import type { Request, Response } from 'express';
import { resolveSchoolId } from '../utils/tenant';
import {
  getAttendanceRate,
  getStudentCount,
  getTeacherActivity,
  getAcademicSummary,
} from '../services/analytics.service';

export const getAnalytics = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);

  const [attendanceRate, studentCount, teacherActivity, academicSummary] = await Promise.all([
    getAttendanceRate(schoolId),
    getStudentCount(schoolId),
    getTeacherActivity(schoolId),
    getAcademicSummary(schoolId),
  ]);

  res.status(200).json({
    attendanceRate,
    studentCount,
    teacherActivity,
    academicSummary,
  });
};
