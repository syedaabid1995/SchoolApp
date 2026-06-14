import '../../domain/entities/attendance_summary.dart';

class AttendanceSummaryModel extends AttendanceSummary {
  const AttendanceSummaryModel({
    required super.totals,
    required super.sessions,
  });

  factory AttendanceSummaryModel.fromJson(Map<String, dynamic> json) {
    final totals = json['totals'] is Map<String, dynamic>
        ? json['totals'] as Map<String, dynamic>
        : const <String, dynamic>{};
    final sessions = json['sessions'] is List
        ? json['sessions'] as List
        : const [];
    return AttendanceSummaryModel(
      totals: AttendanceTotals(
        sessions: _toInt(totals['sessions']),
        records: _toInt(totals['records']),
        present: _toInt(totals['present']),
        absent: _toInt(totals['absent']),
        late: _toInt(totals['late']),
        halfDay: _toInt(totals['halfDay']),
      ),
      sessions: [
        for (final item in sessions)
          if (item is Map<String, dynamic>)
            AttendanceSessionSummaryModel.fromJson(item),
      ],
    );
  }

  Map<String, dynamic> toJson() => {
    'totals': {
      'sessions': totals.sessions,
      'records': totals.records,
      'present': totals.present,
      'absent': totals.absent,
      'late': totals.late,
      'halfDay': totals.halfDay,
    },
    'sessions': [
      for (final session in sessions)
        {
          'id': session.id,
          'date': session.date.toIso8601String(),
          'status': session.status,
          'classId': session.classId,
          'className': session.className,
          'sectionId': session.sectionId,
          'sectionName': session.sectionName,
          'recordCount': session.recordCount,
          'lockedAt': session.lockedAt?.toIso8601String(),
          'lockReason': session.lockReason,
        },
    ],
  };
}

class AttendanceSessionSummaryModel extends AttendanceSessionSummary {
  const AttendanceSessionSummaryModel({
    required super.id,
    required super.date,
    required super.status,
    required super.classId,
    required super.className,
    required super.sectionId,
    required super.sectionName,
    required super.recordCount,
    super.lockedAt,
    super.lockReason,
  });

  factory AttendanceSessionSummaryModel.fromJson(Map<String, dynamic> json) {
    return AttendanceSessionSummaryModel(
      id: json['id']?.toString() ?? '',
      date: _toDate(json['date']),
      status: json['status']?.toString() ?? 'DRAFT',
      classId: json['classId']?.toString() ?? '',
      className: json['className']?.toString(),
      sectionId: json['sectionId']?.toString(),
      sectionName: json['sectionName']?.toString(),
      recordCount: _toInt(json['recordCount']),
      lockedAt: _toNullableDate(json['lockedAt']),
      lockReason: json['lockReason']?.toString(),
    );
  }
}

class TeacherAttendanceRecordModel extends TeacherAttendanceRecord {
  const TeacherAttendanceRecordModel({
    required super.id,
    required super.date,
    required super.status,
    super.teacherId,
    super.overrideReason,
  });

  factory TeacherAttendanceRecordModel.fromJson(Map<String, dynamic> json) {
    return TeacherAttendanceRecordModel(
      id: json['id']?.toString() ?? '',
      date: _toDate(json['date']),
      status: json['status']?.toString() ?? 'PRESENT',
      teacherId: json['teacherId']?.toString(),
      overrideReason: json['overrideReason']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'date': date.toIso8601String(),
    'status': status,
    'teacherId': teacherId,
    'overrideReason': overrideReason,
  };
}

class StudentAttendanceOptionsModel extends StudentAttendanceOptions {
  const StudentAttendanceOptionsModel({
    required super.academicYears,
    required super.classes,
    required super.sections,
  });

  factory StudentAttendanceOptionsModel.fromJson(Map<String, dynamic> json) {
    final years = json['academicYears'] is List
        ? json['academicYears'] as List
        : const [];
    final classes = json['classes'] is List ? json['classes'] as List : const [];
    final sections = json['sections'] is List
        ? json['sections'] as List
        : const [];

    return StudentAttendanceOptionsModel(
      academicYears: [
        for (final item in years)
          if (item is Map)
            StudentAttendanceOptionModel.fromAcademicYearJson(_stringMap(item)),
      ],
      classes: [
        for (final item in classes)
          if (item is Map)
            StudentAttendanceOptionModel.fromClassJson(_stringMap(item)),
      ],
      sections: [
        for (final item in sections)
          if (item is Map)
            StudentAttendanceOptionModel.fromSectionJson(_stringMap(item)),
      ],
    );
  }
}

class StudentAttendanceOptionModel extends StudentAttendanceOption {
  const StudentAttendanceOptionModel({
    required super.id,
    required super.name,
    super.academicYearId,
    super.classId,
    super.isActive,
  });

  factory StudentAttendanceOptionModel.fromAcademicYearJson(
    Map<String, dynamic> json,
  ) {
    return StudentAttendanceOptionModel(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      isActive: json['isActive'] == true,
    );
  }

  factory StudentAttendanceOptionModel.fromClassJson(Map<String, dynamic> json) {
    return StudentAttendanceOptionModel(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      academicYearId: json['academicYearId']?.toString(),
    );
  }

  factory StudentAttendanceOptionModel.fromSectionJson(
    Map<String, dynamic> json,
  ) {
    return StudentAttendanceOptionModel(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      classId:
          json['classId']?.toString() ?? _firstClassSectionId(json['classSections']),
    );
  }
}

class StudentAttendanceSheetModel extends StudentAttendanceSheet {
  const StudentAttendanceSheetModel({
    required super.date,
    required super.students,
    super.holiday,
  });

  factory StudentAttendanceSheetModel.fromJson(Map<String, dynamic> json) {
    final students = json['students'] is List
        ? json['students'] as List
        : const [];
    final holiday = json['holiday'] is Map<String, dynamic>
        ? json['holiday'] as Map<String, dynamic>
        : null;
    return StudentAttendanceSheetModel(
      date: _toDate(json['date']),
      holiday: holiday == null
          ? null
          : StudentAttendanceHolidayModel.fromJson(holiday),
      students: [
        for (final item in students)
          if (item is Map) StudentAttendanceRowModel.fromJson(_stringMap(item)),
      ],
    );
  }
}

class StudentAttendanceRowModel extends StudentAttendanceRow {
  const StudentAttendanceRowModel({
    required super.id,
    required super.fullName,
    required super.status,
    super.admissionNo,
    super.rollNo,
    super.note,
    super.attendanceId,
  });

  factory StudentAttendanceRowModel.fromJson(Map<String, dynamic> json) {
    final firstName = json['firstName']?.toString() ?? '';
    final lastName = json['lastName']?.toString() ?? '';
    final fallbackName = [firstName, lastName].where((part) => part.isNotEmpty).join(' ');
    return StudentAttendanceRowModel(
      id: json['id']?.toString() ?? '',
      fullName: json['fullName']?.toString() ?? fallbackName,
      admissionNo: json['admissionNo']?.toString(),
      rollNo: json['rollNo']?.toString(),
      status: json['status']?.toString() ?? 'PRESENT',
      note: json['note']?.toString(),
      attendanceId: json['attendanceId']?.toString(),
    );
  }
}

class StudentAttendanceHolidayModel extends StudentAttendanceHoliday {
  const StudentAttendanceHolidayModel({required super.id, super.reason});

  factory StudentAttendanceHolidayModel.fromJson(Map<String, dynamic> json) {
    return StudentAttendanceHolidayModel(
      id: json['id']?.toString() ?? '',
      reason: json['reason']?.toString(),
    );
  }
}

Map<String, dynamic> studentAttendanceQueryParams(
  StudentAttendanceQuery query,
) => {
  'academicSessionId': query.academicSessionId,
  'classId': query.classId,
  'sectionId': query.sectionId,
  'date': _dateOnly(query.date),
};

Map<String, dynamic> studentAttendanceSavePayload(
  StudentAttendanceSaveRequest request,
) => {
  ...studentAttendanceQueryParams(request.query),
  'markHoliday': request.markHoliday,
  if (request.holidayReason != null) 'holidayReason': request.holidayReason,
  'records': [
    for (final record in request.records)
      {
        'studentId': record.id,
        'status': record.status,
        if (record.note != null && record.note!.trim().isNotEmpty)
          'note': record.note,
      },
  ],
};

int _toInt(Object? value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value?.toString() ?? '') ?? 0;
}

DateTime _toDate(Object? value) {
  return DateTime.tryParse(value?.toString() ?? '') ??
      DateTime.fromMillisecondsSinceEpoch(0, isUtc: true);
}

DateTime? _toNullableDate(Object? value) {
  if (value == null) return null;
  return DateTime.tryParse(value.toString());
}

String _dateOnly(DateTime date) => date.toIso8601String().split('T').first;

String? _firstClassSectionId(Object? value) {
  if (value is! List || value.isEmpty) return null;
  final first = value.first;
  if (first is Map) return first['classId']?.toString();
  return null;
}

Map<String, dynamic> _stringMap(Map value) =>
    value.map((key, value) => MapEntry(key.toString(), value));
