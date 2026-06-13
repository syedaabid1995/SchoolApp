import 'package:equatable/equatable.dart';

class AttendancePeriod extends Equatable {
  const AttendancePeriod({
    required this.id,
    required this.name,
    required this.type,
    required this.startTime,
    required this.endTime,
  });

  final String id;
  final String name;
  final String type;
  final String startTime;
  final String endTime;

  @override
  List<Object?> get props => [id, name, type, startTime, endTime];
}

class ClassRoom extends Equatable {
  const ClassRoom({required this.id, required this.roomNumber, this.capacity});

  final String id;
  final String roomNumber;
  final int? capacity;

  @override
  List<Object?> get props => [id, roomNumber, capacity];
}

class TimetableEntry extends Equatable {
  const TimetableEntry({
    required this.id,
    required this.timetableVersionId,
    required this.dayOfWeek,
    required this.className,
    required this.subjectName,
    required this.teacherName,
    required this.period,
    this.sectionName,
    this.classRoom,
    this.room,
  });

  final String id;
  final String? timetableVersionId;
  final int dayOfWeek;
  final String className;
  final String? sectionName;
  final String subjectName;
  final String teacherName;
  final AttendancePeriod period;
  final ClassRoom? classRoom;
  final String? room;

  @override
  List<Object?> get props => [
    id,
    timetableVersionId,
    dayOfWeek,
    className,
    sectionName,
    subjectName,
    teacherName,
    period,
    classRoom,
    room,
  ];
}

class TeacherTimetable extends Equatable {
  const TeacherTimetable({
    required this.date,
    required this.dayOfWeek,
    required this.entries,
    this.versionName,
  });

  final DateTime date;
  final int dayOfWeek;
  final String? versionName;
  final List<TimetableEntry> entries;

  @override
  List<Object?> get props => [date, dayOfWeek, versionName, entries];
}
