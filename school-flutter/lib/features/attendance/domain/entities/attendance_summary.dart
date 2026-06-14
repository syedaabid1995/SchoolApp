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

class StudentAttendanceOption extends Equatable {
  const StudentAttendanceOption({
    required this.id,
    required this.name,
    this.academicYearId,
    this.classId,
    this.isActive = false,
  });

  final String id;
  final String name;
  final String? academicYearId;
  final String? classId;
  final bool isActive;

  @override
  List<Object?> get props => [id, name, academicYearId, classId, isActive];
}

class StudentAttendanceOptions extends Equatable {
  const StudentAttendanceOptions({
    required this.academicYears,
    required this.classes,
    required this.sections,
  });

  final List<StudentAttendanceOption> academicYears;
  final List<StudentAttendanceOption> classes;
  final List<StudentAttendanceOption> sections;

  List<StudentAttendanceOption> sectionsForClass(String? classId) {
    if (classId == null || classId.isEmpty) return const [];
    return sections.where((section) => section.classId == classId).toList();
  }

  @override
  List<Object?> get props => [academicYears, classes, sections];
}

class StudentAttendanceRow extends Equatable {
  const StudentAttendanceRow({
    required this.id,
    required this.fullName,
    required this.status,
    this.admissionNo,
    this.rollNo,
    this.note,
    this.attendanceId,
  });

  final String id;
  final String fullName;
  final String status;
  final String? admissionNo;
  final String? rollNo;
  final String? note;
  final String? attendanceId;

  StudentAttendanceRow copyWith({String? status, String? note}) {
    return StudentAttendanceRow(
      id: id,
      fullName: fullName,
      status: status ?? this.status,
      admissionNo: admissionNo,
      rollNo: rollNo,
      note: note ?? this.note,
      attendanceId: attendanceId,
    );
  }

  @override
  List<Object?> get props => [
    id,
    fullName,
    status,
    admissionNo,
    rollNo,
    note,
    attendanceId,
  ];
}

class StudentAttendanceSheet extends Equatable {
  const StudentAttendanceSheet({
    required this.date,
    required this.students,
    this.holiday,
  });

  final DateTime date;
  final List<StudentAttendanceRow> students;
  final StudentAttendanceHoliday? holiday;

  bool get isHoliday => holiday != null;

  @override
  List<Object?> get props => [date, students, holiday];
}

class StudentAttendanceHoliday extends Equatable {
  const StudentAttendanceHoliday({required this.id, this.reason});

  final String id;
  final String? reason;

  @override
  List<Object?> get props => [id, reason];
}

class StudentAttendanceQuery extends Equatable {
  const StudentAttendanceQuery({
    required this.academicSessionId,
    required this.classId,
    required this.sectionId,
    required this.date,
  });

  final String academicSessionId;
  final String classId;
  final String sectionId;
  final DateTime date;

  @override
  List<Object?> get props => [academicSessionId, classId, sectionId, date];
}

class StudentAttendanceSaveRequest extends Equatable {
  const StudentAttendanceSaveRequest({
    required this.query,
    required this.markHoliday,
    this.holidayReason,
    this.records = const [],
  });

  final StudentAttendanceQuery query;
  final bool markHoliday;
  final String? holidayReason;
  final List<StudentAttendanceRow> records;

  @override
  List<Object?> get props => [query, markHoliday, holidayReason, records];
}
