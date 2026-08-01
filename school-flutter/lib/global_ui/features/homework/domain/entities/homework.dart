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
    this.attachmentUrl,
    this.attachmentName,
    this.evaluationDate,
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
  final String? attachmentUrl;
  final String? attachmentName;
  final DateTime? evaluationDate;
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
    attachmentUrl,
    attachmentName,
    evaluationDate,
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
    this.attachmentUrl,
    this.attachmentName,
  });

  final String classId;
  final String sectionId;
  final String subjectId;
  final DateTime homeworkDate;
  final DateTime submissionDate;
  final num marks;
  final String description;
  final String? attachmentUrl;
  final String? attachmentName;

  @override
  List<Object?> get props => [
    classId,
    sectionId,
    subjectId,
    homeworkDate,
    submissionDate,
    marks,
    description,
    attachmentUrl,
    attachmentName,
  ];
}

class HomeworkAttachment extends Equatable {
  const HomeworkAttachment({required this.url, required this.filename});

  final String url;
  final String filename;

  @override
  List<Object?> get props => [url, filename];
}

enum HomeworkQualityStatus { good, notGood }

enum HomeworkCompletionStatus { completed, notCompleted }

class HomeworkEvaluation extends Equatable {
  const HomeworkEvaluation({
    required this.id,
    required this.studentId,
    required this.qualityStatus,
    required this.completionStatus,
    required this.evaluationDate,
    this.marks,
    this.comments,
  });

  final String id;
  final String studentId;
  final num? marks;
  final String? comments;
  final HomeworkQualityStatus qualityStatus;
  final HomeworkCompletionStatus completionStatus;
  final DateTime evaluationDate;

  @override
  List<Object?> get props => [
    id,
    studentId,
    marks,
    comments,
    qualityStatus,
    completionStatus,
    evaluationDate,
  ];
}

class HomeworkEvaluationStudent extends Equatable {
  const HomeworkEvaluationStudent({
    required this.id,
    required this.admissionNo,
    required this.fullName,
    this.rollNo,
  });

  final String id;
  final String admissionNo;
  final String fullName;
  final String? rollNo;

  @override
  List<Object?> get props => [id, admissionNo, fullName, rollNo];
}

class HomeworkEvaluationRow extends Equatable {
  const HomeworkEvaluationRow({required this.student, this.evaluation});

  final HomeworkEvaluationStudent student;
  final HomeworkEvaluation? evaluation;

  @override
  List<Object?> get props => [student, evaluation];
}

class HomeworkEvaluationDetail extends Equatable {
  const HomeworkEvaluationDetail({required this.homework, required this.rows});

  final Homework homework;
  final List<HomeworkEvaluationRow> rows;

  @override
  List<Object?> get props => [homework, rows];
}

class HomeworkEvaluationDraftRow extends Equatable {
  const HomeworkEvaluationDraftRow({
    required this.studentId,
    required this.qualityStatus,
    required this.completionStatus,
    this.marks,
    this.comments,
  });

  final String studentId;
  final num? marks;
  final String? comments;
  final HomeworkQualityStatus qualityStatus;
  final HomeworkCompletionStatus completionStatus;

  @override
  List<Object?> get props => [
    studentId,
    marks,
    comments,
    qualityStatus,
    completionStatus,
  ];
}
