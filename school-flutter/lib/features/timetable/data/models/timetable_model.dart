import '../../domain/entities/timetable_entry.dart';

class TeacherTimetableModel extends TeacherTimetable {
  const TeacherTimetableModel({
    required super.date,
    required super.dayOfWeek,
    required super.entries,
    super.versionName,
  });

  factory TeacherTimetableModel.fromJson(Map<String, dynamic> json) {
    final rows = json['periods'] is List ? json['periods'] as List : const [];
    final version = json['version'] is Map<String, dynamic>
        ? json['version'] as Map<String, dynamic>
        : null;
    return TeacherTimetableModel(
      date: DateTime.tryParse(json['date']?.toString() ?? '') ?? DateTime.now(),
      dayOfWeek: _toInt(json['dayOfWeek']),
      versionName: version?['name']?.toString(),
      entries: [
        for (final row in rows)
          if (row is Map<String, dynamic>) TimetableEntryModel.fromJson(row),
      ]..sort((a, b) => a.period.startTime.compareTo(b.period.startTime)),
    );
  }

  Map<String, dynamic> toJson() => {
    'date': date.toIso8601String(),
    'dayOfWeek': dayOfWeek,
    'version': {'name': versionName},
    'periods': [
      for (final entry in entries)
        if (entry is TimetableEntryModel) entry.toJson(),
    ],
  };
}

class TimetableEntryModel extends TimetableEntry {
  const TimetableEntryModel({
    required super.id,
    required super.timetableVersionId,
    required super.dayOfWeek,
    required super.className,
    required super.subjectName,
    required super.teacherName,
    required super.period,
    super.sectionName,
    super.classRoom,
    super.room,
  });

  factory TimetableEntryModel.fromJson(Map<String, dynamic> json) {
    final classData = json['class'] is Map<String, dynamic>
        ? json['class'] as Map<String, dynamic>
        : const <String, dynamic>{};
    final section = json['section'] is Map<String, dynamic>
        ? json['section'] as Map<String, dynamic>
        : null;
    final subject = json['subject'] is Map<String, dynamic>
        ? json['subject'] as Map<String, dynamic>
        : const <String, dynamic>{};
    final teacher = json['teacher'] is Map<String, dynamic>
        ? json['teacher'] as Map<String, dynamic>
        : const <String, dynamic>{};
    final period = json['period'] is Map<String, dynamic>
        ? json['period'] as Map<String, dynamic>
        : const <String, dynamic>{};
    final classRoom = json['classRoom'] is Map<String, dynamic>
        ? json['classRoom'] as Map<String, dynamic>
        : null;
    final firstName = teacher['firstName']?.toString() ?? '';
    final lastName = teacher['lastName']?.toString() ?? '';

    return TimetableEntryModel(
      id: json['id']?.toString() ?? '',
      timetableVersionId: json['timetableVersionId']?.toString(),
      dayOfWeek: _toInt(json['dayOfWeek']),
      className: classData['name']?.toString() ?? '',
      sectionName: section?['name']?.toString(),
      subjectName: subject['name']?.toString() ?? '',
      teacherName: '$firstName $lastName'.trim(),
      period: AttendancePeriod(
        id: period['id']?.toString() ?? '',
        name: period['name']?.toString() ?? '',
        type: period['type']?.toString() ?? 'CLASS_TIME',
        startTime: period['startTime']?.toString() ?? '',
        endTime: period['endTime']?.toString() ?? '',
      ),
      classRoom: classRoom == null
          ? null
          : ClassRoom(
              id: classRoom['id']?.toString() ?? '',
              roomNumber: classRoom['roomNumber']?.toString() ?? '',
              capacity: _nullableInt(classRoom['capacity']),
            ),
      room: json['room']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'timetableVersionId': timetableVersionId,
    'dayOfWeek': dayOfWeek,
    'class': {'name': className},
    'section': sectionName == null ? null : {'name': sectionName},
    'subject': {'name': subjectName},
    'teacher': {'firstName': teacherName},
    'period': {
      'id': period.id,
      'name': period.name,
      'type': period.type,
      'startTime': period.startTime,
      'endTime': period.endTime,
    },
    'classRoom': classRoom == null
        ? null
        : {
            'id': classRoom!.id,
            'roomNumber': classRoom!.roomNumber,
            'capacity': classRoom!.capacity,
          },
    'room': room,
  };
}

int _toInt(Object? value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value?.toString() ?? '') ?? 0;
}

int? _nullableInt(Object? value) {
  if (value == null) return null;
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value.toString());
}
