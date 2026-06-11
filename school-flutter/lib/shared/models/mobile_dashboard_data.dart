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
