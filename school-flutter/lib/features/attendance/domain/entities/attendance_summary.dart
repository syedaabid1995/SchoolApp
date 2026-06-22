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
    this.classIds = const [],
    this.isActive = false,
  });

  final String id;
  final String name;
  final String? academicYearId;
  final String? classId;
  final List<String> classIds;
  final bool isActive;

  @override
  List<Object?> get props => [
        id,
        name,
        academicYearId,
        classId,
        classIds,
        isActive,
      ];
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
    return sections
        .where(
          (section) =>
              section.classId == classId || section.classIds.contains(classId),
        )
        .toList();
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

enum AttendanceMode {
  daily('DAILY'),
  twiceDaily('TWICE_DAILY'),
  periodWise('PERIOD_WISE');

  const AttendanceMode(this.value);
  final String value;

  static AttendanceMode fromValue(String? value) {
    return AttendanceMode.values.firstWhere(
      (mode) => mode.value == value,
      orElse: () => AttendanceMode.daily,
    );
  }
}

enum AttendanceUnitType {
  day('DAY'),
  slot('SLOT'),
  period('PERIOD'),
  timetableEntry('TIMETABLE_ENTRY');

  const AttendanceUnitType(this.value);
  final String value;

  static AttendanceUnitType fromValue(String? value) {
    return AttendanceUnitType.values.firstWhere(
      (type) => type.value == value,
      orElse: () => AttendanceUnitType.day,
    );
  }
}

enum AttendanceSlotType {
  morning('MORNING'),
  afternoon('AFTERNOON');

  const AttendanceSlotType(this.value);
  final String value;

  static AttendanceSlotType? fromValue(String? value) {
    return AttendanceSlotType.values
        .where((type) => type.value == value)
        .firstOrNull;
  }
}

class AttendanceConfiguration extends Equatable {
  const AttendanceConfiguration({
    required this.id,
    required this.mode,
    required this.source,
    this.scope,
    this.academicYearId,
    this.classId,
    this.sectionId,
    this.effectiveFrom,
    this.effectiveTo,
    this.isActive = true,
  });

  final String? id;
  final AttendanceMode mode;
  final String source;
  final String? scope;
  final String? academicYearId;
  final String? classId;
  final String? sectionId;
  final DateTime? effectiveFrom;
  final DateTime? effectiveTo;
  final bool isActive;

  @override
  List<Object?> get props => [
    id,
    mode,
    source,
    scope,
    academicYearId,
    classId,
    sectionId,
    effectiveFrom,
    effectiveTo,
    isActive,
  ];
}

class AttendanceUnit extends Equatable {
  const AttendanceUnit({
    required this.unitType,
    required this.label,
    required this.source,
    this.slotId,
    this.slotType,
    this.periodId,
    this.timetableEntryId,
    this.subjectId,
    this.subjectName,
    this.teacherId,
    this.teacherName,
    this.startTime,
    this.endTime,
  });

  final AttendanceUnitType unitType;
  final String label;
  final String source;
  final String? slotId;
  final AttendanceSlotType? slotType;
  final String? periodId;
  final String? timetableEntryId;
  final String? subjectId;
  final String? subjectName;
  final String? teacherId;
  final String? teacherName;
  final String? startTime;
  final String? endTime;

  String get identityPart {
    return switch (unitType) {
      AttendanceUnitType.day => 'DAY',
      AttendanceUnitType.slot =>
        'SLOT:${slotType?.value ?? slotId ?? 'UNKNOWN'}',
      AttendanceUnitType.period => 'PERIOD:${periodId ?? 'UNKNOWN'}',
      AttendanceUnitType.timetableEntry =>
        'TIMETABLE_ENTRY:${timetableEntryId ?? 'UNKNOWN'}',
    };
  }

  @override
  List<Object?> get props => [
    unitType,
    label,
    source,
    slotId,
    slotType,
    periodId,
    timetableEntryId,
    subjectId,
    subjectName,
    teacherId,
    teacherName,
    startTime,
    endTime,
  ];
}

class AttendanceScopeQuery extends Equatable {
  const AttendanceScopeQuery({
    required this.academicYearId,
    required this.classId,
    required this.sectionId,
    required this.date,
  });

  final String academicYearId;
  final String classId;
  final String? sectionId;
  final DateTime date;

  String get dateKey => date.toIso8601String().split('T').first;

  @override
  List<Object?> get props => [academicYearId, classId, sectionId, date];
}

class AttendanceSheetQuery extends Equatable {
  const AttendanceSheetQuery({required this.scope, required this.unit});

  final AttendanceScopeQuery scope;
  final AttendanceUnit unit;

  String get offlineKey =>
      'attendance:school:${scope.academicYearId}:${scope.classId}:${scope.sectionId ?? 'none'}:${scope.dateKey}:${unit.identityPart}';

  @override
  List<Object?> get props => [scope, unit];
}

class AttendanceSheetSession extends Equatable {
  const AttendanceSheetSession({
    required this.id,
    required this.status,
    required this.approvalStatus,
    this.lockedAt,
    this.lockReason,
  });

  final String id;
  final String status;
  final String approvalStatus;
  final DateTime? lockedAt;
  final String? lockReason;

  bool get isLocked => status == 'CLOSED' || lockedAt != null;

  @override
  List<Object?> get props => [id, status, approvalStatus, lockedAt, lockReason];
}

class AttendanceStudentRecord extends Equatable {
  const AttendanceStudentRecord({
    required this.studentId,
    required this.fullName,
    required this.status,
    this.recordId,
    this.admissionNo,
    this.rollNo,
    this.manualOverrideReason,
  });

  final String studentId;
  final String fullName;
  final String status;
  final String? recordId;
  final String? admissionNo;
  final String? rollNo;
  final String? manualOverrideReason;

  AttendanceStudentRecord copyWith({
    String? status,
    String? manualOverrideReason,
  }) {
    return AttendanceStudentRecord(
      studentId: studentId,
      fullName: fullName,
      status: status ?? this.status,
      recordId: recordId,
      admissionNo: admissionNo,
      rollNo: rollNo,
      manualOverrideReason: manualOverrideReason ?? this.manualOverrideReason,
    );
  }

  @override
  List<Object?> get props => [
    studentId,
    fullName,
    status,
    recordId,
    admissionNo,
    rollNo,
    manualOverrideReason,
  ];
}

class AttendanceSheet extends Equatable {
  const AttendanceSheet({
    required this.configuration,
    required this.unit,
    required this.rows,
    this.session,
  });

  final AttendanceConfiguration configuration;
  final AttendanceUnit unit;
  final AttendanceSheetSession? session;
  final List<AttendanceStudentRecord> rows;

  bool get isLocked => session?.isLocked ?? false;

  @override
  List<Object?> get props => [configuration, unit, session, rows];
}

class AttendanceSheetSaveRequest extends Equatable {
  const AttendanceSheetSaveRequest({
    required this.query,
    required this.records,
    this.deviceId = 'mobile',
  });

  final AttendanceSheetQuery query;
  final List<AttendanceStudentRecord> records;
  final String deviceId;

  @override
  List<Object?> get props => [query, records, deviceId];
}
