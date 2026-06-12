import '../../core/auth/auth_session.dart';

class MobileDashboardData {
  const MobileDashboardData({
    required this.selfAttendance,
    required this.attendanceSummary,
    required this.teacherTimetable,
    required this.exams,
    required this.user,
  });

  final List<SelfAttendanceRecord> selfAttendance;
  final AttendanceSummary? attendanceSummary;
  final TeacherTimetable? teacherTimetable;
  final List<ExamSummary> exams;
  final AuthUser user;

  int get assignedClassCount =>
      user.employeeProfile?.classAssignments.length ?? 0;
  int get assignedSubjectCount =>
      user.employeeProfile?.subjectAssignments.length ?? 0;
}

class SelfAttendanceRecord {
  const SelfAttendanceRecord({
    required this.id,
    required this.date,
    required this.status,
  });

  final String id;
  final DateTime? date;
  final String status;

  factory SelfAttendanceRecord.fromJson(Map<String, dynamic> json) {
    return SelfAttendanceRecord(
      id: json['id'] as String? ?? '',
      date: DateTime.tryParse(json['date'] as String? ?? ''),
      status: json['status'] as String? ?? 'UNMARKED',
    );
  }
}

class AttendanceSummary {
  const AttendanceSummary({
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

  factory AttendanceSummary.fromJson(Map<String, dynamic> json) {
    final totals = json['totals'] as Map<String, dynamic>? ?? const {};
    return AttendanceSummary(
      sessions: totals['sessions'] as int? ?? 0,
      records: totals['records'] as int? ?? 0,
      present: totals['present'] as int? ?? 0,
      absent: totals['absent'] as int? ?? 0,
      late: totals['late'] as int? ?? 0,
      halfDay: totals['halfDay'] as int? ?? 0,
    );
  }
}

class TeacherTimetable {
  const TeacherTimetable({required this.date, required this.periods});

  final String date;
  final List<TimetablePeriodItem> periods;

  factory TeacherTimetable.fromJson(Map<String, dynamic> json) {
    return TeacherTimetable(
      date: json['date'] as String? ?? '',
      periods: (json['periods'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(TimetablePeriodItem.fromJson)
          .toList(),
    );
  }
}

class TimetablePeriodItem {
  const TimetablePeriodItem({
    required this.id,
    required this.className,
    required this.sectionName,
    required this.subjectName,
    required this.periodName,
    this.startTime,
    this.endTime,
    this.room,
  });

  final String id;
  final String className;
  final String sectionName;
  final String subjectName;
  final String periodName;
  final String? startTime;
  final String? endTime;
  final String? room;

  factory TimetablePeriodItem.fromJson(Map<String, dynamic> json) {
    final classJson = json['class'] as Map<String, dynamic>? ?? const {};
    final sectionJson = json['section'] as Map<String, dynamic>?;
    final subjectJson = json['subject'] as Map<String, dynamic>? ?? const {};
    final periodJson = json['period'] as Map<String, dynamic>? ?? const {};
    return TimetablePeriodItem(
      id: json['id'] as String? ?? '',
      className: classJson['name'] as String? ?? '',
      sectionName: sectionJson?['name'] as String? ?? 'N/A',
      subjectName: subjectJson['name'] as String? ?? '',
      periodName: periodJson['name'] as String? ?? '',
      startTime: periodJson['startTime'] as String?,
      endTime: periodJson['endTime'] as String?,
      room: json['room'] as String?,
    );
  }
}

class ExamSummary {
  const ExamSummary({
    required this.id,
    required this.name,
    required this.type,
    required this.status,
    this.scheduledAt,
  });

  final String id;
  final String name;
  final String type;
  final String status;
  final DateTime? scheduledAt;

  factory ExamSummary.fromJson(Map<String, dynamic> json) {
    return ExamSummary(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? 'Exam',
      type: json['type'] as String? ?? '',
      status: json['status'] as String? ?? '',
      scheduledAt: DateTime.tryParse(json['scheduledAt'] as String? ?? ''),
    );
  }
}

class AttendanceOptions {
  const AttendanceOptions({
    required this.academicYears,
    required this.classes,
    required this.sections,
  });

  final List<AttendanceOptionItem> academicYears;
  final List<AttendanceOptionItem> classes;
  final List<AttendanceSectionItem> sections;

  factory AttendanceOptions.fromJson(Map<String, dynamic> json) {
    return AttendanceOptions(
      academicYears: (json['academicYears'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(AttendanceOptionItem.fromJson)
          .toList(),
      classes: (json['classes'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(AttendanceOptionItem.fromJson)
          .toList(),
      sections: (json['sections'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(AttendanceSectionItem.fromJson)
          .toList(),
    );
  }
}

class AttendanceOptionItem {
  const AttendanceOptionItem({required this.id, required this.name});

  final String id;
  final String name;

  factory AttendanceOptionItem.fromJson(Map<String, dynamic> json) {
    return AttendanceOptionItem(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
    );
  }
}

class AttendanceSectionItem {
  const AttendanceSectionItem({
    required this.id,
    required this.name,
    this.classId,
    this.classSectionClassIds = const [],
  });

  final String id;
  final String name;
  final String? classId;
  final List<String> classSectionClassIds;

  bool belongsToClass(String cId) {
    return classId == cId || classSectionClassIds.contains(cId);
  }

  factory AttendanceSectionItem.fromJson(Map<String, dynamic> json) {
    final classSections =
        (json['classSections'] as List<dynamic>? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map((cs) => cs['classId'] as String? ?? '')
            .where((id) => id.isNotEmpty)
            .toList();
    return AttendanceSectionItem(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      classId: json['classId'] as String?,
      classSectionClassIds: classSections,
    );
  }
}

class AttendanceCriteria {
  const AttendanceCriteria({
    required this.academicSessionId,
    required this.classId,
    required this.sectionId,
    required this.date,
  });

  final String academicSessionId;
  final String classId;
  final String sectionId;
  final String date;

  @override
  bool operator ==(Object other) =>
      other is AttendanceCriteria &&
      other.academicSessionId == academicSessionId &&
      other.classId == classId &&
      other.sectionId == sectionId &&
      other.date == date;

  @override
  int get hashCode =>
      Object.hash(academicSessionId, classId, sectionId, date);
}

class AttendanceLoadResult {
  const AttendanceLoadResult({required this.date, required this.students});

  final String date;
  final List<AttendanceStudentRecord> students;

  factory AttendanceLoadResult.fromJson(Map<String, dynamic> json) {
    return AttendanceLoadResult(
      date: json['date'] as String? ?? '',
      students: (json['students'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(AttendanceStudentRecord.fromJson)
          .toList(),
    );
  }
}

class AttendanceStudentRecord {
  AttendanceStudentRecord({
    required this.id,
    required this.fullName,
    required this.admissionNo,
    required this.status,
    this.rollNo,
    this.note,
    this.attendanceId,
  });

  final String id;
  final String fullName;
  final String admissionNo;
  final String? rollNo;
  String status;
  String? note;
  final String? attendanceId;

  factory AttendanceStudentRecord.fromJson(Map<String, dynamic> json) {
    return AttendanceStudentRecord(
      id: json['id'] as String? ?? '',
      fullName:
          json['fullName'] as String? ??
          '${json['firstName'] ?? ''} ${json['lastName'] ?? ''}'.trim(),
      admissionNo: json['admissionNo'] as String? ?? '',
      rollNo: json['rollNo'] as String?,
      status: json['status'] as String? ?? 'PRESENT',
      note: json['note'] as String?,
      attendanceId: json['attendanceId'] as String?,
    );
  }
}

class AssignedStudent {
  const AssignedStudent({
    required this.id,
    required this.fullName,
    required this.admissionNo,
    this.rollNo,
    this.className,
    this.sectionName,
  });

  final String id;
  final String fullName;
  final String admissionNo;
  final String? rollNo;
  final String? className;
  final String? sectionName;

  factory AssignedStudent.fromJson(Map<String, dynamic> json) {
    final classJson = json['class'] as Map<String, dynamic>?;
    final sectionJson = json['section'] as Map<String, dynamic>?;
    return AssignedStudent(
      id: json['id'] as String? ?? '',
      fullName: json['fullName'] as String? ?? 'Student',
      admissionNo: json['admissionNo'] as String? ?? '',
      rollNo: json['rollNo'] as String?,
      className: classJson?['name'] as String?,
      sectionName: sectionJson?['name'] as String?,
    );
  }
}

// Backend custom day scheme: 1=Sat, 2=Sun, 3=Mon, 4=Tue, 5=Wed, 6=Thu, 7=Fri
const _kDayOptions = [
  (1, 'saturday', 'Saturday'),
  (2, 'sunday', 'Sunday'),
  (3, 'monday', 'Monday'),
  (4, 'tuesday', 'Tuesday'),
  (5, 'wednesday', 'Wednesday'),
  (6, 'thursday', 'Thursday'),
  (7, 'friday', 'Friday'),
];

class MyTimetableData {
  const MyTimetableData({
    required this.periods,
    required this.routines,
    required this.weekendDayValues,
    this.activeAcademicYearId,
  });

  final List<MyTimePeriod> periods;
  final List<MyRoutine> routines;
  final Set<int> weekendDayValues;
  final String? activeAcademicYearId;

  MyRoutine? routineAt(int dayOfWeek, String timePeriodId) {
    for (final r in routines) {
      if (r.dayOfWeek == dayOfWeek && r.timePeriodId == timePeriodId) return r;
    }
    return null;
  }

  factory MyTimetableData.fromJson(Map<String, dynamic> json) {
    final weekendsJson =
        (json['weekends'] as List<dynamic>? ?? const [])
            .whereType<Map<String, dynamic>>()
            .toList();

    final weekendIds = <String>{};
    for (final w in weekendsJson) {
      if (w['isWeekend'] == true) {
        weekendIds.add((w['id'] as String? ?? '').toLowerCase());
        weekendIds.add((w['name'] as String? ?? '').toLowerCase());
      }
    }
    // If nothing configured, default Friday is weekend
    if (weekendsJson.isEmpty) weekendIds.add('friday');

    final weekendDayValues = <int>{};
    for (final (value, id, label) in _kDayOptions) {
      if (weekendIds.contains(id) || weekendIds.contains(label.toLowerCase())) {
        weekendDayValues.add(value);
      }
    }

    return MyTimetableData(
      periods: (json['periods'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(MyTimePeriod.fromJson)
          .toList(),
      routines: (json['routines'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(MyRoutine.fromJson)
          .toList(),
      weekendDayValues: weekendDayValues,
      activeAcademicYearId: json['activeAcademicYearId'] as String?,
    );
  }
}

class MyTimePeriod {
  const MyTimePeriod({
    required this.id,
    required this.name,
    required this.startTime,
    required this.endTime,
    required this.type,
  });

  final String id;
  final String name;
  final String startTime;
  final String endTime;
  final String type;

  factory MyTimePeriod.fromJson(Map<String, dynamic> json) {
    return MyTimePeriod(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      startTime: json['startTime'] as String? ?? '',
      endTime: json['endTime'] as String? ?? '',
      type: json['type'] as String? ?? 'CLASS',
    );
  }
}

class MyRoutine {
  const MyRoutine({
    required this.id,
    required this.dayOfWeek,
    required this.timePeriodId,
    required this.classId,
    required this.sectionId,
    required this.subjectName,
    required this.className,
    required this.sectionName,
    this.roomNumber,
  });

  final String id;
  final int dayOfWeek;
  final String timePeriodId;
  final String classId;
  final String sectionId;
  final String subjectName;
  final String className;
  final String sectionName;
  final String? roomNumber;

  factory MyRoutine.fromJson(Map<String, dynamic> json) {
    final subject = json['subject'] as Map<String, dynamic>? ?? const {};
    final cls = json['class'] as Map<String, dynamic>? ?? const {};
    final section = json['section'] as Map<String, dynamic>?;
    final timePeriod = json['timePeriod'] as Map<String, dynamic>? ?? const {};
    final room = json['classRoom'] as Map<String, dynamic>?;
    return MyRoutine(
      id: json['id'] as String? ?? '',
      dayOfWeek: json['dayOfWeek'] as int? ?? 1,
      timePeriodId: timePeriod['id'] as String? ?? '',
      classId: json['classId'] as String? ?? '',
      sectionId: json['sectionId'] as String? ?? '',
      subjectName: subject['name'] as String? ?? '',
      className: cls['name'] as String? ?? '',
      sectionName: section?['name'] as String? ?? '',
      roomNumber: room?['roomNumber'] as String?,
    );
  }
}

class AssignedExamPaper {
  const AssignedExamPaper({
    required this.id,
    required this.examName,
    required this.subjectName,
    required this.className,
    required this.sectionName,
    required this.maxMarks,
    required this.markCount,
    required this.status,
    this.scheduledAt,
  });

  final String id;
  final String examName;
  final String subjectName;
  final String className;
  final String sectionName;
  final double maxMarks;
  final int markCount;
  final String status;
  final DateTime? scheduledAt;

  factory AssignedExamPaper.fromJson(Map<String, dynamic> json) {
    final examJson = json['exam'] as Map<String, dynamic>? ?? const {};
    final subjectJson = json['subject'] as Map<String, dynamic>? ?? const {};
    final classJson =
        json['class'] as Map<String, dynamic>? ??
        examJson['class'] as Map<String, dynamic>? ??
        const {};
    final sectionJson = examJson['section'] as Map<String, dynamic>?;
    final countJson = json['_count'] as Map<String, dynamic>? ?? const {};
    return AssignedExamPaper(
      id: json['id'] as String? ?? '',
      examName: examJson['name'] as String? ?? 'Exam',
      subjectName: subjectJson['name'] as String? ?? 'Subject',
      className: classJson['name'] as String? ?? 'Class',
      sectionName: sectionJson?['name'] as String? ?? 'N/A',
      maxMarks: (json['maxMarks'] as num?)?.toDouble() ?? 0,
      markCount: countJson['marks'] as int? ?? 0,
      status: examJson['status'] as String? ?? '',
      scheduledAt: DateTime.tryParse(json['scheduledAt'] as String? ?? ''),
    );
  }
}
