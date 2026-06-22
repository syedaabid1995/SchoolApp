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
    AttendanceUnit? unit,
  });
  Future<SelfAttendanceOptions> getSelfAttendanceOptions({DateTime? date});
  Future<StudentAttendanceOptions> getStudentAttendanceOptions();
  Future<StudentAttendanceSheet> loadStudentAttendance(
    StudentAttendanceQuery query,
  );
  Future<void> saveStudentAttendance(StudentAttendanceSaveRequest request);
  Future<AttendanceConfiguration> getResolvedAttendanceConfig(
    AttendanceScopeQuery query,
  );
  Future<List<AttendanceUnit>> getAttendanceUnits(AttendanceScopeQuery query);
  Future<AttendanceSheet> getAttendanceSheet(AttendanceSheetQuery query);
  Future<AttendanceSheet> saveAttendanceSheet(
    AttendanceSheetSaveRequest request,
  );
  Future<AttendanceSheetSession> lockAttendanceSheet({
    required String sessionId,
    String? reason,
  });
  Future<AttendanceSheetSession> reopenAttendanceSheet({
    required String sessionId,
    String? reason,
  });
  Future<List<AttendanceConfiguration>> listAttendanceConfigurations({
    String? academicYearId,
    String? classId,
    String? sectionId,
    bool? active,
  });
}
