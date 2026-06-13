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
