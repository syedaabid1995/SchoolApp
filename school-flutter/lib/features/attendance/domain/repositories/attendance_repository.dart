import '../entities/attendance_summary.dart';

abstract class AttendanceRepository {
  Future<AttendanceSummary> getSummary({DateTime? date});
  Future<List<TeacherAttendanceRecord>> getTeacherHistory({
    DateTime? fromDate,
    DateTime? toDate,
  });
  Future<TeacherAttendanceRecord> markSelfAttendance({
    required String status,
    DateTime? date,
  });
}
