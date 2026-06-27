import 'package:equatable/equatable.dart';

import '../../../exams/domain/entities/exam.dart';

class AssignedStudent extends Equatable {
  const AssignedStudent({
    required this.id,
    required this.fullName,
    this.admissionNo,
    this.rollNo,
    this.classId,
    this.sectionId,
    this.className,
    this.sectionName,
    this.photoUrl,
  });

  final String id;
  final String fullName;
  final String? admissionNo;
  final String? rollNo;
  final String? classId;
  final String? sectionId;
  final String? className;
  final String? sectionName;
  final String? photoUrl;

  @override
  List<Object?> get props => [
    id,
    fullName,
    admissionNo,
    rollNo,
    classId,
    sectionId,
    className,
    sectionName,
    photoUrl,
  ];
}

class MarkRecord extends Equatable {
  const MarkRecord({
    required this.id,
    required this.studentId,
    required this.marks,
    required this.status,
    this.grade,
    this.moderated = false,
  });

  final String id;
  final String studentId;
  final num marks;
  final String? grade;
  final String status;
  final bool moderated;

  @override
  List<Object?> get props => [id, studentId, marks, grade, status, moderated];
}

class MarkEntry extends Equatable {
  const MarkEntry({required this.studentId, required this.marks});

  final String studentId;
  final num marks;

  @override
  List<Object?> get props => [studentId, marks];
}

class MarksDraft extends Equatable {
  const MarksDraft({
    required this.examPaperId,
    required this.entries,
    this.status = 'DRAFT',
  });

  final String examPaperId;
  final List<MarkEntry> entries;
  final String status;

  List<String> validate(ExamPaper paper) {
    final errors = <String>[];
    final seen = <String>{};
    for (final entry in entries) {
      if (entry.studentId.isEmpty) errors.add('Student is required.');
      if (!seen.add(entry.studentId)) {
        errors.add('Duplicate student entry: ${entry.studentId}');
      }
      if (entry.marks < 0) errors.add('Marks cannot be negative.');
      if (entry.marks > paper.maxMarks) {
        errors.add('Marks exceed max marks for ${entry.studentId}.');
      }
    }
    return errors;
  }

  @override
  List<Object?> get props => [examPaperId, entries, status];
}

class MarksUploadResult extends Equatable {
  const MarksUploadResult({required this.results});

  final List<UploadedMarkResult> results;

  @override
  List<Object?> get props => [results];
}

class UploadedMarkResult extends Equatable {
  const UploadedMarkResult({required this.studentId, this.grade});

  final String studentId;
  final String? grade;

  @override
  List<Object?> get props => [studentId, grade];
}

class MarksSummary extends Equatable {
  const MarksSummary({required this.paper, required this.records});

  final ExamPaper paper;
  final List<MarkRecord> records;

  int get submittedCount =>
      records.where((record) => record.status.toUpperCase() != 'DRAFT').length;
  int get draftCount =>
      records.where((record) => record.status.toUpperCase() == 'DRAFT').length;
  num get averageMarks {
    if (records.isEmpty) return 0;
    return records.map((record) => record.marks).reduce((a, b) => a + b) /
        records.length;
  }

  @override
  List<Object?> get props => [paper, records];
}
