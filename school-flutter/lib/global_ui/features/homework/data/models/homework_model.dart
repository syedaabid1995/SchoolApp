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
    '_count': {'evaluations': evaluationCount},
  };
}

DateTime _toDate(Object? value) =>
    DateTime.tryParse(value?.toString() ?? '') ??
    DateTime.fromMillisecondsSinceEpoch(0, isUtc: true);

num _toNum(Object? value) {
  if (value is num) return value;
  return num.tryParse(value?.toString() ?? '') ?? 0;
}

int _toInt(Object? value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value?.toString() ?? '') ?? 0;
}
