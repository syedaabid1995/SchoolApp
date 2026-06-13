import 'package:equatable/equatable.dart';

class Homework extends Equatable {
  const Homework({
    required this.id,
    required this.classId,
    required this.sectionId,
    required this.subjectId,
    required this.homeworkDate,
    required this.submissionDate,
    required this.marks,
    required this.description,
    this.className,
    this.sectionName,
    this.subjectName,
    this.evaluationCount = 0,
  });

  final String id;
  final String classId;
  final String sectionId;
  final String subjectId;
  final String? className;
  final String? sectionName;
  final String? subjectName;
  final DateTime homeworkDate;
  final DateTime submissionDate;
  final num marks;
  final String description;
  final int evaluationCount;

  @override
  List<Object?> get props => [
    id,
    classId,
    sectionId,
    subjectId,
    className,
    sectionName,
    subjectName,
    homeworkDate,
    submissionDate,
    marks,
    description,
    evaluationCount,
  ];
}

class HomeworkDraft extends Equatable {
  const HomeworkDraft({
    required this.classId,
    required this.sectionId,
    required this.subjectId,
    required this.homeworkDate,
    required this.submissionDate,
    required this.marks,
    required this.description,
  });

  final String classId;
  final String sectionId;
  final String subjectId;
  final DateTime homeworkDate;
  final DateTime submissionDate;
  final num marks;
  final String description;

  @override
  List<Object?> get props => [
    classId,
    sectionId,
    subjectId,
    homeworkDate,
    submissionDate,
    marks,
    description,
  ];
}
