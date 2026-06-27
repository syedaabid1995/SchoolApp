import 'package:equatable/equatable.dart';

import '../../../attendance/domain/entities/attendance_summary.dart';
import '../../../classes/domain/entities/class_assignment.dart';
import '../../../exams/domain/entities/exam.dart';
import '../../../homework/domain/entities/homework.dart';
import '../../../marks/domain/entities/marks.dart';

class ClassAcademicOverview extends Equatable {
  const ClassAcademicOverview({
    required this.assignedClass,
    required this.sections,
    required this.subjects,
    required this.homework,
    required this.examPapers,
    required this.marks,
    this.attendanceSummary,
  });

  final AssignedClass assignedClass;
  final List<AssignedSection> sections;
  final List<AssignedSubject> subjects;
  final List<Homework> homework;
  final List<ExamPaper> examPapers;
  final List<MarkRecord> marks;
  final AttendanceSummary? attendanceSummary;

  int get homeworkCount => homework.length;
  int get pendingMarkTasks =>
      examPapers.where((paper) => paper.marksCount == 0).length;
  int get submittedMarks =>
      marks.where((mark) => mark.status.toUpperCase() != 'DRAFT').length;

  @override
  List<Object?> get props => [
    assignedClass,
    sections,
    subjects,
    homework,
    examPapers,
    marks,
    attendanceSummary,
  ];
}
