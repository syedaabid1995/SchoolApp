class ApiEndpoints {
  const ApiEndpoints._();

  static const login = '/auth/login';
  static const refresh = '/auth/refresh';
  static const logout = '/auth/logout';
  static const me = '/users/me';
  static const changePassword = '/auth/change-password';
  static const forgotPassword = '/auth/forgot-password';
  static const verifyTwoFactor = '/auth/verify-2fa';
  static const resendTwoFactor = '/auth/resend-2fa';
  static const teacherTimetable = '/academics/timetable/teacher';
  static const attendanceSummary = '/attendance/summary';
  static const teacherSelfAttendance = '/attendance/teacher/self';
  static const teacherSelfAttendanceOptions =
      '/attendance/teacher/self/options';
  static const attendanceConfigResolve = '/attendance/config/resolve';
  static const attendanceUnits = '/attendance/units';
  static const attendanceSheet = '/attendance/sheet';
  static const attendanceAiRecognize = '/attendance/ai/recognize';
  static const attendanceConfigurations = '/attendance/configurations';
  static const studentAttendance = '/students/attendance';
  static const studentAttendanceOptions = '/students/attendance/options';
  static const notificationSummary = '/notifications/summary';
  static const leaveBalancesMe = '/leave/balances/me';
  static const leaveTypes = '/leave/types';
  static const leaveApplications = '/leave/applications';
  static const homework = '/homework';
  static const assignedClasses = '/users/me/assigned-classes';
  static const assignedStudents = '/users/me/assigned-students';
  static const myExamPapers = '/users/me/exam-papers';
  static const exams = '/exams';
  static const examMarks = '/exams/marks';
  static const uploadMarks = '/exams/marks/upload';
}
