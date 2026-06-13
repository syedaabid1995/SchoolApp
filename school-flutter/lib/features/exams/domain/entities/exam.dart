import 'package:equatable/equatable.dart';

class Exam extends Equatable {
  const Exam({
    required this.id,
    required this.name,
    required this.type,
    required this.status,
    this.academicYearId,
    this.classId,
    this.sectionId,
    this.className,
    this.sectionName,
    this.scheduledAt,
    this.resultPublishAt,
    this.papers = const [],
  });

  final String id;
  final String name;
  final String type;
  final String status;
  final String? academicYearId;
  final String? classId;
  final String? sectionId;
  final String? className;
  final String? sectionName;
  final DateTime? scheduledAt;
  final DateTime? resultPublishAt;
  final List<ExamPaper> papers;

  bool get isUpcoming {
    final scheduled = scheduledAt;
    return scheduled != null && scheduled.isAfter(DateTime.now());
  }

  bool get isCompleted => status.toUpperCase() == 'CLOSED';
  bool get isActive => !isCompleted;

  @override
  List<Object?> get props => [
    id,
    name,
    type,
    status,
    academicYearId,
    classId,
    sectionId,
    className,
    sectionName,
    scheduledAt,
    resultPublishAt,
    papers,
  ];
}

class ExamPaper extends Equatable {
  const ExamPaper({
    required this.id,
    required this.examId,
    required this.subjectId,
    required this.classId,
    required this.maxMarks,
    required this.passMarks,
    required this.weightage,
    this.subjectName,
    this.className,
    this.sectionName,
    this.examName,
    this.examStatus,
    this.examType,
    this.scheduledAt,
    this.resultPublishAt,
    this.marksCount = 0,
  });

  final String id;
  final String examId;
  final String subjectId;
  final String classId;
  final num maxMarks;
  final num passMarks;
  final num weightage;
  final String? subjectName;
  final String? className;
  final String? sectionName;
  final String? examName;
  final String? examStatus;
  final String? examType;
  final DateTime? scheduledAt;
  final DateTime? resultPublishAt;
  final int marksCount;

  @override
  List<Object?> get props => [
    id,
    examId,
    subjectId,
    classId,
    maxMarks,
    passMarks,
    weightage,
    subjectName,
    className,
    sectionName,
    examName,
    examStatus,
    examType,
    scheduledAt,
    resultPublishAt,
    marksCount,
  ];
}

class ExamDuty extends Equatable {
  const ExamDuty({
    required this.id,
    required this.examId,
    required this.teacherId,
    required this.centerId,
    required this.roomId,
    this.examPaperId,
    this.examName,
    this.subjectName,
    this.centerName,
    this.roomName,
    this.teacherName,
    this.scheduledAt,
    this.assignedAt,
  });

  final String id;
  final String examId;
  final String? examPaperId;
  final String teacherId;
  final String centerId;
  final String roomId;
  final String? examName;
  final String? subjectName;
  final String? centerName;
  final String? roomName;
  final String? teacherName;
  final DateTime? scheduledAt;
  final DateTime? assignedAt;

  @override
  List<Object?> get props => [
    id,
    examId,
    examPaperId,
    teacherId,
    centerId,
    roomId,
    examName,
    subjectName,
    centerName,
    roomName,
    teacherName,
    scheduledAt,
    assignedAt,
  ];
}

class ExamHomeData extends Equatable {
  const ExamHomeData({
    required this.exams,
    required this.assignedPapers,
    required this.duties,
  });

  final List<Exam> exams;
  final List<ExamPaper> assignedPapers;
  final List<ExamDuty> duties;

  List<Exam> get upcoming => exams.where((exam) => exam.isUpcoming).toList();
  List<Exam> get completed => exams.where((exam) => exam.isCompleted).toList();
  List<Exam> get active => exams.where((exam) => exam.isActive).toList();
  List<ExamDuty> get todayDuties {
    final now = DateTime.now();
    return duties
        .where(
          (duty) =>
              duty.scheduledAt?.year == now.year &&
              duty.scheduledAt?.month == now.month &&
              duty.scheduledAt?.day == now.day,
        )
        .toList();
  }

  @override
  List<Object?> get props => [exams, assignedPapers, duties];
}
