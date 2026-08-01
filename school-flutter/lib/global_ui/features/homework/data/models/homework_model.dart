import '../../domain/entities/homework.dart';

class HomeworkModel extends Homework {
  const HomeworkModel({
    required super.id,
    required super.classId,
    required super.sectionId,
    required super.subjectId,
    required super.homeworkDate,
    required super.submissionDate,
    required super.marks,
    required super.description,
    super.attachmentUrl,
    super.attachmentName,
    super.evaluationDate,
    super.className,
    super.sectionName,
    super.subjectName,
    super.evaluationCount,
  });

  factory HomeworkModel.fromJson(Map<String, dynamic> json) {
    final cls = json['class'] is Map<String, dynamic>
        ? json['class'] as Map<String, dynamic>
        : const <String, dynamic>{};
    final section = json['section'] is Map<String, dynamic>
        ? json['section'] as Map<String, dynamic>
        : const <String, dynamic>{};
    final subject = json['subject'] is Map<String, dynamic>
        ? json['subject'] as Map<String, dynamic>
        : const <String, dynamic>{};
    final count = json['_count'] is Map<String, dynamic>
        ? json['_count'] as Map<String, dynamic>
        : const <String, dynamic>{};
    return HomeworkModel(
      id: json['id']?.toString() ?? '',
      classId: json['classId']?.toString() ?? cls['id']?.toString() ?? '',
      sectionId:
          json['sectionId']?.toString() ?? section['id']?.toString() ?? '',
      subjectId:
          json['subjectId']?.toString() ?? subject['id']?.toString() ?? '',
      className: cls['name']?.toString(),
      sectionName: section['name']?.toString(),
      subjectName: subject['name']?.toString(),
      homeworkDate: _toDate(json['homeworkDate']),
      submissionDate: _toDate(json['submissionDate']),
      marks: _toNum(json['marks']),
      description: json['description']?.toString() ?? '',
      attachmentUrl: json['attachmentUrl']?.toString(),
      attachmentName: json['attachmentName']?.toString(),
      evaluationDate: _toNullableDate(json['evaluationDate']),
      evaluationCount: _toInt(count['evaluations']),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'classId': classId,
    'sectionId': sectionId,
    'subjectId': subjectId,
    'class': {'id': classId, 'name': className},
    'section': {'id': sectionId, 'name': sectionName},
    'subject': {'id': subjectId, 'name': subjectName},
    'homeworkDate': homeworkDate.toIso8601String(),
    'submissionDate': submissionDate.toIso8601String(),
    'marks': marks,
    'description': description,
    'attachmentUrl': attachmentUrl,
    'attachmentName': attachmentName,
    'evaluationDate': evaluationDate?.toIso8601String(),
    '_count': {'evaluations': evaluationCount},
  };
}

class HomeworkAttachmentModel extends HomeworkAttachment {
  const HomeworkAttachmentModel({required super.url, required super.filename});

  factory HomeworkAttachmentModel.fromJson(Map<String, dynamic> json) {
    return HomeworkAttachmentModel(
      url: json['url']?.toString() ?? '',
      filename: json['filename']?.toString() ?? '',
    );
  }
}

class HomeworkEvaluationModel extends HomeworkEvaluation {
  const HomeworkEvaluationModel({
    required super.id,
    required super.studentId,
    required super.qualityStatus,
    required super.completionStatus,
    required super.evaluationDate,
    super.marks,
    super.comments,
  });

  factory HomeworkEvaluationModel.fromJson(Map<String, dynamic> json) {
    return HomeworkEvaluationModel(
      id: json['id']?.toString() ?? '',
      studentId: json['studentId']?.toString() ?? '',
      marks: json['marks'] == null ? null : _toNum(json['marks']),
      comments: json['comments']?.toString(),
      qualityStatus: _qualityStatus(json['qualityStatus']),
      completionStatus: _completionStatus(json['completionStatus']),
      evaluationDate: _toDate(json['evaluationDate']),
    );
  }
}

class HomeworkEvaluationStudentModel extends HomeworkEvaluationStudent {
  const HomeworkEvaluationStudentModel({
    required super.id,
    required super.admissionNo,
    required super.fullName,
    super.rollNo,
  });

  factory HomeworkEvaluationStudentModel.fromJson(Map<String, dynamic> json) {
    return HomeworkEvaluationStudentModel(
      id: json['id']?.toString() ?? '',
      admissionNo: json['admissionNo']?.toString() ?? '',
      fullName: json['fullName']?.toString() ?? '',
      rollNo: json['rollNo']?.toString(),
    );
  }
}

class HomeworkEvaluationRowModel extends HomeworkEvaluationRow {
  const HomeworkEvaluationRowModel({required super.student, super.evaluation});

  factory HomeworkEvaluationRowModel.fromJson(Map<String, dynamic> json) {
    final student = json['student'] is Map<String, dynamic>
        ? json['student'] as Map<String, dynamic>
        : const <String, dynamic>{};
    final evaluation = json['evaluation'] is Map<String, dynamic>
        ? json['evaluation'] as Map<String, dynamic>
        : null;
    return HomeworkEvaluationRowModel(
      student: HomeworkEvaluationStudentModel.fromJson(student),
      evaluation: evaluation == null
          ? null
          : HomeworkEvaluationModel.fromJson(evaluation),
    );
  }
}

class HomeworkEvaluationDetailModel extends HomeworkEvaluationDetail {
  const HomeworkEvaluationDetailModel({
    required super.homework,
    required super.rows,
  });

  factory HomeworkEvaluationDetailModel.fromJson(Map<String, dynamic> json) {
    final homework = json['homework'] is Map<String, dynamic>
        ? json['homework'] as Map<String, dynamic>
        : const <String, dynamic>{};
    final rows = json['rows'] is List ? json['rows'] as List : const [];
    return HomeworkEvaluationDetailModel(
      homework: HomeworkModel.fromJson(homework),
      rows: [
        for (final row in rows)
          if (row is Map<String, dynamic>)
            HomeworkEvaluationRowModel.fromJson(row),
      ],
    );
  }
}

DateTime _toDate(Object? value) =>
    DateTime.tryParse(value?.toString() ?? '') ??
    DateTime.fromMillisecondsSinceEpoch(0, isUtc: true);

DateTime? _toNullableDate(Object? value) {
  if (value == null) return null;
  return DateTime.tryParse(value.toString());
}

num _toNum(Object? value) {
  if (value is num) return value;
  return num.tryParse(value?.toString() ?? '') ?? 0;
}

int _toInt(Object? value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value?.toString() ?? '') ?? 0;
}

HomeworkQualityStatus _qualityStatus(Object? value) {
  return value?.toString() == 'NOT_GOOD'
      ? HomeworkQualityStatus.notGood
      : HomeworkQualityStatus.good;
}

HomeworkCompletionStatus _completionStatus(Object? value) {
  return value?.toString() == 'NOT_COMPLETED'
      ? HomeworkCompletionStatus.notCompleted
      : HomeworkCompletionStatus.completed;
}

String qualityStatusValue(HomeworkQualityStatus status) =>
    status == HomeworkQualityStatus.notGood ? 'NOT_GOOD' : 'GOOD';

String completionStatusValue(HomeworkCompletionStatus status) =>
    status == HomeworkCompletionStatus.notCompleted
    ? 'NOT_COMPLETED'
    : 'COMPLETED';
