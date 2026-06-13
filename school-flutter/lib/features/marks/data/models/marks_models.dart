import '../../../exams/data/models/exam_models.dart';
import '../../../exams/domain/entities/exam.dart';
import '../../domain/entities/marks.dart';

class AssignedStudentModel extends AssignedStudent {
  const AssignedStudentModel({
    required super.id,
    required super.fullName,
    super.admissionNo,
    super.rollNo,
    super.classId,
    super.sectionId,
    super.className,
    super.sectionName,
    super.photoUrl,
  });

  factory AssignedStudentModel.fromJson(Map<String, dynamic> json) {
    final cls = _map(json['class']);
    final section = _map(json['section']);
    return AssignedStudentModel(
      id: json['id']?.toString() ?? '',
      fullName: json['fullName']?.toString() ?? '',
      admissionNo: json['admissionNo']?.toString(),
      rollNo: json['rollNo']?.toString(),
      classId: json['classId']?.toString() ?? cls?['id']?.toString(),
      sectionId: json['sectionId']?.toString() ?? section?['id']?.toString(),
      className: cls?['name']?.toString(),
      sectionName: section?['name']?.toString(),
      photoUrl: json['photoUrl']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'fullName': fullName,
    'admissionNo': admissionNo,
    'rollNo': rollNo,
    'classId': classId,
    'sectionId': sectionId,
    'photoUrl': photoUrl,
    'class': className == null ? null : {'id': classId, 'name': className},
    'section': sectionName == null
        ? null
        : {'id': sectionId, 'name': sectionName},
  };
}

class MarkRecordModel extends MarkRecord {
  const MarkRecordModel({
    required super.id,
    required super.studentId,
    required super.marks,
    required super.status,
    super.grade,
    super.moderated,
  });

  factory MarkRecordModel.fromJson(Map<String, dynamic> json) {
    return MarkRecordModel(
      id: json['id']?.toString() ?? '',
      studentId: json['studentId']?.toString() ?? '',
      marks: _num(json['marks']),
      grade: json['grade']?.toString(),
      status: json['status']?.toString() ?? 'DRAFT',
      moderated: json['moderated'] == true,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'studentId': studentId,
    'marks': marks,
    'grade': grade,
    'status': status,
    'moderated': moderated,
  };
}

class MarksUploadResultModel extends MarksUploadResult {
  const MarksUploadResultModel({required super.results});

  factory MarksUploadResultModel.fromJson(Map<String, dynamic> json) {
    final rows = json['results'] is List ? json['results'] as List : const [];
    return MarksUploadResultModel(
      results: [
        for (final row in rows)
          if (row is Map) UploadedMarkResultModel.fromJson(_stringMap(row)),
      ],
    );
  }
}

class UploadedMarkResultModel extends UploadedMarkResult {
  const UploadedMarkResultModel({required super.studentId, super.grade});

  factory UploadedMarkResultModel.fromJson(Map<String, dynamic> json) {
    return UploadedMarkResultModel(
      studentId: json['studentId']?.toString() ?? '',
      grade: json['grade']?.toString(),
    );
  }
}

class MarksSummaryModel extends MarksSummary {
  const MarksSummaryModel({required super.paper, required super.records});

  factory MarksSummaryModel.fromPaperAndRecords({
    required ExamPaper paper,
    required List<MarkRecord> records,
  }) {
    return MarksSummaryModel(paper: paper, records: records);
  }
}

Map<String, dynamic> marksDraftPayload(MarksDraft draft) => {
  'examPaperId': draft.examPaperId,
  'status': draft.status,
  'entries': [
    for (final entry in draft.entries)
      {'studentId': entry.studentId, 'marks': entry.marks},
  ],
};

ExamPaperModel examPaperFromCache(Map value) => ExamPaperModel.fromJson(
  value.map((key, value) => MapEntry(key.toString(), value)),
);

Map<String, dynamic>? _map(Object? value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return _stringMap(value);
  return null;
}

Map<String, dynamic> _stringMap(Map value) =>
    value.map((key, value) => MapEntry(key.toString(), value));

num _num(Object? value) {
  if (value is num) return value;
  return num.tryParse(value?.toString() ?? '') ?? 0;
}
