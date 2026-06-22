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
    final classes = json['classes'] is List
        ? json['classes'] as List
        : const [];
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
    super.classIds,
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

  factory StudentAttendanceOptionModel.fromClassJson(
    Map<String, dynamic> json,
  ) {
    return StudentAttendanceOptionModel(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      academicYearId: json['academicYearId']?.toString(),
    );
  }

  factory StudentAttendanceOptionModel.fromSectionJson(
    Map<String, dynamic> json,
  ) {
    final mappedClassIds = _classSectionIds(json);
    return StudentAttendanceOptionModel(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      classId: json['classId']?.toString() ??
          (mappedClassIds.isEmpty ? null : mappedClassIds.first),
      classIds: mappedClassIds,
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
    final fallbackName = [
      firstName,
      lastName,
    ].where((part) => part.isNotEmpty).join(' ');
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

class AttendanceConfigurationModel extends AttendanceConfiguration {
  const AttendanceConfigurationModel({
    required super.id,
    required super.mode,
    required super.source,
    super.scope,
    super.academicYearId,
    super.classId,
    super.sectionId,
    super.effectiveFrom,
    super.effectiveTo,
    super.isActive,
  });

  factory AttendanceConfigurationModel.fromJson(Map<String, dynamic> json) {
    final config = json['configuration'] is Map
        ? _stringMap(json['configuration'] as Map)
        : json;
    return AttendanceConfigurationModel(
      id: json['id']?.toString() ?? config['id']?.toString(),
      mode: AttendanceMode.fromValue(
        json['mode']?.toString() ?? config['mode']?.toString(),
      ),
      source:
          json['source']?.toString() ??
          config['scope']?.toString() ??
          'DEFAULT',
      scope: config['scope']?.toString(),
      academicYearId: config['academicYearId']?.toString(),
      classId: config['classId']?.toString(),
      sectionId: config['sectionId']?.toString(),
      effectiveFrom: _toNullableDate(config['effectiveFrom']),
      effectiveTo: _toNullableDate(config['effectiveTo']),
      isActive: config['isActive'] != false,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'mode': mode.value,
    'source': source,
    'scope': scope,
    'academicYearId': academicYearId,
    'classId': classId,
    'sectionId': sectionId,
    'effectiveFrom': effectiveFrom?.toIso8601String(),
    'effectiveTo': effectiveTo?.toIso8601String(),
    'isActive': isActive,
  };
}

class AttendanceUnitModel extends AttendanceUnit {
  const AttendanceUnitModel({
    required super.unitType,
    required super.label,
    required super.source,
    super.slotId,
    super.slotType,
    super.periodId,
    super.timetableEntryId,
    super.subjectId,
    super.subjectName,
    super.teacherId,
    super.teacherName,
    super.startTime,
    super.endTime,
  });

  factory AttendanceUnitModel.fromJson(Map<String, dynamic> json) {
    return AttendanceUnitModel(
      unitType: AttendanceUnitType.fromValue(json['unitType']?.toString()),
      label: json['label']?.toString() ?? 'Day',
      source: json['source']?.toString() ?? 'DAY',
      slotId: json['slotId']?.toString(),
      slotType: AttendanceSlotType.fromValue(json['slotType']?.toString()),
      periodId: json['periodId']?.toString(),
      timetableEntryId: json['timetableEntryId']?.toString(),
      subjectId: json['subjectId']?.toString(),
      subjectName:
          json['subjectName']?.toString() ?? _extractName(json['subject']),
      teacherId: json['teacherId']?.toString(),
      teacherName:
          json['teacherName']?.toString() ??
          _extractTeacherName(json['teacher']),
      startTime: json['startTime']?.toString(),
      endTime: json['endTime']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => attendanceUnitPayload(this)
    ..addAll({
      'label': label,
      'source': source,
      'subjectId': subjectId,
      'subjectName': subjectName,
      'teacherId': teacherId,
      'teacherName': teacherName,
      'startTime': startTime,
      'endTime': endTime,
    });
}

class AttendanceSheetSessionModel extends AttendanceSheetSession {
  const AttendanceSheetSessionModel({
    required super.id,
    required super.status,
    required super.approvalStatus,
    super.lockedAt,
    super.lockReason,
  });

  factory AttendanceSheetSessionModel.fromJson(Map<String, dynamic> json) {
    return AttendanceSheetSessionModel(
      id: json['id']?.toString() ?? '',
      status: json['status']?.toString() ?? 'OPEN',
      approvalStatus: json['approvalStatus']?.toString() ?? 'PENDING',
      lockedAt: _toNullableDate(json['lockedAt']),
      lockReason: json['lockReason']?.toString(),
    );
  }
}

class AttendanceStudentRecordModel extends AttendanceStudentRecord {
  const AttendanceStudentRecordModel({
    required super.studentId,
    required super.fullName,
    required super.status,
    super.recordId,
    super.admissionNo,
    super.rollNo,
    super.manualOverrideReason,
  });

  factory AttendanceStudentRecordModel.fromJson(Map<String, dynamic> json) {
    final student = json['student'] is Map
        ? _stringMap(json['student'] as Map)
        : json;
    final firstName = student['firstName']?.toString() ?? '';
    final lastName = student['lastName']?.toString() ?? '';
    final fallbackName = [
      firstName,
      lastName,
    ].where((part) => part.isNotEmpty).join(' ');
    return AttendanceStudentRecordModel(
      studentId:
          student['id']?.toString() ?? json['studentId']?.toString() ?? '',
      fullName: student['fullName']?.toString() ?? fallbackName,
      admissionNo: student['admissionNo']?.toString(),
      rollNo: student['rollNo']?.toString(),
      recordId: json['recordId']?.toString(),
      status: json['status']?.toString() ?? 'PRESENT',
      manualOverrideReason: json['manualOverrideReason']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
    'studentId': studentId,
    'fullName': fullName,
    'admissionNo': admissionNo,
    'rollNo': rollNo,
    'recordId': recordId,
    'status': status,
    'manualOverrideReason': manualOverrideReason,
  };
}

class AttendanceSheetModel extends AttendanceSheet {
  const AttendanceSheetModel({
    required super.configuration,
    required super.unit,
    required super.rows,
    super.session,
  });

  factory AttendanceSheetModel.fromJson(Map<String, dynamic> json) {
    final rows = json['rows'] is List ? json['rows'] as List : const [];
    return AttendanceSheetModel(
      configuration: AttendanceConfigurationModel.fromJson(
        json['configuration'] is Map
            ? _stringMap(json['configuration'] as Map)
            : const <String, dynamic>{},
      ),
      unit: AttendanceUnitModel.fromJson(
        json['unit'] is Map
            ? _stringMap(json['unit'] as Map)
            : const <String, dynamic>{},
      ),
      session: json['session'] is Map
          ? AttendanceSheetSessionModel.fromJson(
              _stringMap(json['session'] as Map),
            )
          : null,
      rows: [
        for (final item in rows)
          if (item is Map)
            AttendanceStudentRecordModel.fromJson(_stringMap(item)),
      ],
    );
  }

  Map<String, dynamic> toJson() => {
    'configuration': (configuration is AttendanceConfigurationModel)
        ? (configuration as AttendanceConfigurationModel).toJson()
        : {
            'id': configuration.id,
            'mode': configuration.mode.value,
            'source': configuration.source,
          },
    'unit': (unit is AttendanceUnitModel)
        ? (unit as AttendanceUnitModel).toJson()
        : attendanceUnitPayload(unit),
    'session': session == null
        ? null
        : {
            'id': session!.id,
            'status': session!.status,
            'approvalStatus': session!.approvalStatus,
            'lockedAt': session!.lockedAt?.toIso8601String(),
            'lockReason': session!.lockReason,
          },
    'rows': [
      for (final row in rows)
        {
          'studentId': row.studentId,
          'fullName': row.fullName,
          'admissionNo': row.admissionNo,
          'rollNo': row.rollNo,
          'recordId': row.recordId,
          'status': row.status,
          'manualOverrideReason': row.manualOverrideReason,
        },
    ],
  };
}

Map<String, dynamic> studentAttendanceQueryParams(
  StudentAttendanceQuery query,
) => {
  'academicSessionId': query.academicSessionId,
  'classId': query.classId,
  'sectionId': query.sectionId,
  'date': _dateOnly(query.date),
};

Map<String, dynamic> attendanceScopeQueryParams(AttendanceScopeQuery query) => {
  'academicYearId': query.academicYearId,
  'classId': query.classId,
  if (query.sectionId != null && query.sectionId!.isNotEmpty)
    'sectionId': query.sectionId,
  'date': _dateOnly(query.date),
};

Map<String, dynamic> attendanceUnitPayload(AttendanceUnit unit) => {
  'unitType': unit.unitType.value,
  if (unit.slotId != null) 'slotId': unit.slotId,
  if (unit.slotType != null) 'slotType': unit.slotType!.value,
  if (unit.periodId != null) 'periodId': unit.periodId,
  if (unit.timetableEntryId != null) 'timetableEntryId': unit.timetableEntryId,
};

Map<String, dynamic> attendanceSheetQueryParams(AttendanceSheetQuery query) => {
  ...attendanceScopeQueryParams(query.scope),
  ...attendanceUnitPayload(query.unit),
};

Map<String, dynamic> attendanceSheetSavePayload(
  AttendanceSheetSaveRequest request,
) => {
  ...attendanceSheetQueryParams(request.query),
  'deviceId': request.deviceId,
  'records': [
    for (final record in request.records)
      {
        'studentId': record.studentId,
        'status': record.status,
        if (record.manualOverrideReason != null &&
            record.manualOverrideReason!.trim().isNotEmpty)
          'manualOverrideReason': record.manualOverrideReason,
      },
  ],
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

List<String> _classSectionIds(Map<String, dynamic> json) {
  final ids = <String>{};
  final directClassId = json['classId']?.toString();
  if (directClassId != null && directClassId.isNotEmpty) ids.add(directClassId);

  final classIds = json['classIds'];
  if (classIds is List) {
    for (final id in classIds) {
      final value = id?.toString();
      if (value != null && value.isNotEmpty) ids.add(value);
    }
  }

  final classSections = json['classSections'];
  if (classSections is List) {
    for (final item in classSections) {
      if (item is Map) {
        final value = item['classId']?.toString();
        if (value != null && value.isNotEmpty) ids.add(value);
      }
    }
  }

  return ids.toList(growable: false);
}

Map<String, dynamic> _stringMap(Map value) =>
    value.map((key, value) => MapEntry(key.toString(), value));

String? _extractName(Object? value) {
  if (value is Map) return value['name']?.toString();
  return null;
}

String? _extractTeacherName(Object? value) {
  if (value is! Map) return null;
  final firstName = value['firstName']?.toString() ?? '';
  final lastName = value['lastName']?.toString() ?? '';
  final name = [firstName, lastName].where((part) => part.isNotEmpty).join(' ');
  return name.isEmpty ? value['name']?.toString() : name;
}
