import 'package:equatable/equatable.dart';

class AttendanceTotals extends Equatable {
  const AttendanceTotals({
    required this.sessions,
    required this.records,
    required this.present,
    required this.absent,
    required this.late,
    required this.halfDay,
  });

  final int sessions;
  final int records;
  final int present;
  final int absent;
  final int late;
  final int halfDay;

  double get presentRate => records == 0 ? 0 : present / records;

  @override
  List<Object?> get props => [
    sessions,
    records,
    present,
    absent,
    late,
    halfDay,
  ];
}

class AttendanceSessionSummary extends Equatable {
  const AttendanceSessionSummary({
    required this.id,
    required this.date,
    required this.status,
    required this.classId,
    required this.className,
    required this.sectionId,
    required this.sectionName,
    required this.recordCount,
    this.lockedAt,
    this.lockReason,
  });

  final String id;
  final DateTime date;
  final String status;
  final String classId;
  final String? className;
  final String? sectionId;
  final String? sectionName;
  final int recordCount;
  final DateTime? lockedAt;
  final String? lockReason;

  @override
  List<Object?> get props => [
    id,
    date,
    status,
    classId,
    className,
    sectionId,
    sectionName,
    recordCount,
    lockedAt,
    lockReason,
  ];
}

class AttendanceSummary extends Equatable {
  const AttendanceSummary({required this.totals, required this.sessions});

  final AttendanceTotals totals;
  final List<AttendanceSessionSummary> sessions;

  @override
  List<Object?> get props => [totals, sessions];
}

class TeacherAttendanceRecord extends Equatable {
  const TeacherAttendanceRecord({
    required this.id,
    required this.date,
    required this.status,
    this.teacherId,
    this.overrideReason,
  });

  final String id;
  final DateTime date;
  final String status;
  final String? teacherId;
  final String? overrideReason;

  @override
  List<Object?> get props => [id, date, status, teacherId, overrideReason];
}
