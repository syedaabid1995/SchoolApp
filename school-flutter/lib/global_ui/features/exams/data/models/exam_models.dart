import '../../domain/entities/exam.dart';

class ExamModel extends Exam {
  const ExamModel({
    required super.id,
    required super.name,
    required super.type,
    required super.status,
    super.academicYearId,
    super.classId,
    super.sectionId,
    super.className,
    super.sectionName,
    super.scheduledAt,
    super.resultPublishAt,
    super.papers,
  });

  factory ExamModel.fromJson(Map<String, dynamic> json) {
    final cls = _map(json['class']);
    final section = _map(json['section']);
    final papers = _list(json['papers']);
    return ExamModel(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      type: json['type']?.toString() ?? '',
      status: json['status']?.toString() ?? 'DRAFT',
      academicYearId: json['academicYearId']?.toString(),
      classId: json['classId']?.toString() ?? cls?['id']?.toString(),
      sectionId: json['sectionId']?.toString() ?? section?['id']?.toString(),
      className: cls?['name']?.toString(),
      sectionName: section?['name']?.toString(),
      scheduledAt: _date(json['scheduledAt']),
      resultPublishAt: _date(json['resultPublishAt']),
      papers: [
        for (final item in papers)
          if (item is Map) ExamPaperModel.fromJson(_stringMap(item)),
      ],
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'type': type,
    'status': status,
    'academicYearId': academicYearId,
    'classId': classId,
    'sectionId': sectionId,
    'scheduledAt': scheduledAt?.toIso8601String(),
    'resultPublishAt': resultPublishAt?.toIso8601String(),
    'class': className == null ? null : {'id': classId, 'name': className},
    'section': sectionName == null
        ? null
        : {'id': sectionId, 'name': sectionName},
    'papers': [
      for (final paper in papers)
        if (paper is ExamPaperModel) paper.toJson(),
    ],
  };
}

class ExamPaperModel extends ExamPaper {
  const ExamPaperModel({
    required super.id,
    required super.examId,
    required super.subjectId,
    required super.classId,
    required super.maxMarks,
    required super.passMarks,
    required super.weightage,
    super.subjectName,
    super.className,
    super.sectionName,
    super.examName,
    super.examStatus,
    super.examType,
    super.scheduledAt,
    super.resultPublishAt,
    super.marksCount,
  });

  factory ExamPaperModel.fromJson(Map<String, dynamic> json) {
    final subject = _map(json['subject']);
    final cls = _map(json['class']);
    final exam = _map(json['exam']);
    final examClass = _map(exam?['class']);
    final section = _map(exam?['section']);
    final count = _map(json['_count']);
    return ExamPaperModel(
      id: json['id']?.toString() ?? '',
      examId: json['examId']?.toString() ?? exam?['id']?.toString() ?? '',
      subjectId:
          json['subjectId']?.toString() ?? subject?['id']?.toString() ?? '',
      classId:
          json['classId']?.toString() ??
          cls?['id']?.toString() ??
          examClass?['id']?.toString() ??
          '',
      maxMarks: _num(json['maxMarks']),
      passMarks: _num(json['passMarks']),
      weightage: _num(json['weightage'], fallback: 1),
      subjectName: subject?['name']?.toString(),
      className: cls?['name']?.toString() ?? examClass?['name']?.toString(),
      sectionName: section?['name']?.toString(),
      examName: exam?['name']?.toString(),
      examStatus: exam?['status']?.toString(),
      examType: exam?['type']?.toString(),
      scheduledAt: _date(json['scheduledAt'] ?? exam?['scheduledAt']),
      resultPublishAt: _date(exam?['resultPublishAt']),
      marksCount: _int(count?['marks']),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'examId': examId,
    'subjectId': subjectId,
    'classId': classId,
    'maxMarks': maxMarks,
    'passMarks': passMarks,
    'weightage': weightage,
    'scheduledAt': scheduledAt?.toIso8601String(),
    'subject': subjectName == null
        ? null
        : {'id': subjectId, 'name': subjectName},
    'class': className == null ? null : {'id': classId, 'name': className},
    'exam': {
      'id': examId,
      'name': examName,
      'type': examType,
      'status': examStatus,
      'resultPublishAt': resultPublishAt?.toIso8601String(),
      'section': sectionName == null ? null : {'name': sectionName},
    },
    '_count': {'marks': marksCount},
  };
}

class ExamDutyModel extends ExamDuty {
  const ExamDutyModel({
    required super.id,
    required super.examId,
    required super.teacherId,
    required super.centerId,
    required super.roomId,
    super.examPaperId,
    super.examName,
    super.subjectName,
    super.centerName,
    super.roomName,
    super.teacherName,
    super.scheduledAt,
    super.assignedAt,
  });

  factory ExamDutyModel.fromJson(Map<String, dynamic> json) {
    final center = _map(json['center']);
    final room = _map(json['room']);
    final paper = _map(json['examPaper']);
    final subject = _map(paper?['subject']);
    final teacher = _map(json['teacher']);
    return ExamDutyModel(
      id: json['id']?.toString() ?? '',
      examId: json['examId']?.toString() ?? '',
      examPaperId: json['examPaperId']?.toString() ?? paper?['id']?.toString(),
      teacherId:
          json['teacherId']?.toString() ?? teacher?['id']?.toString() ?? '',
      centerId: json['centerId']?.toString() ?? center?['id']?.toString() ?? '',
      roomId: json['roomId']?.toString() ?? room?['id']?.toString() ?? '',
      examName: json['examName']?.toString(),
      subjectName: subject?['name']?.toString(),
      centerName: center?['name']?.toString(),
      roomName: room?['name']?.toString(),
      teacherName: _teacherName(teacher),
      scheduledAt: _date(paper?['scheduledAt']),
      assignedAt: _date(json['assignedAt']),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'examId': examId,
    'examPaperId': examPaperId,
    'teacherId': teacherId,
    'centerId': centerId,
    'roomId': roomId,
    'assignedAt': assignedAt?.toIso8601String(),
    'center': {'id': centerId, 'name': centerName},
    'room': {'id': roomId, 'name': roomName},
    'examPaper': {
      'id': examPaperId,
      'scheduledAt': scheduledAt?.toIso8601String(),
      'subject': {'name': subjectName},
    },
    'teacher': {'id': teacherId, 'firstName': teacherName},
  };
}

Map<String, dynamic>? _map(Object? value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return _stringMap(value);
  return null;
}

Map<String, dynamic> _stringMap(Map value) =>
    value.map((key, value) => MapEntry(key.toString(), value));

List _list(Object? value) => value is List ? value : const [];

DateTime? _date(Object? value) => DateTime.tryParse(value?.toString() ?? '');

int _int(Object? value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value?.toString() ?? '') ?? 0;
}

num _num(Object? value, {num fallback = 0}) {
  if (value is num) return value;
  return num.tryParse(value?.toString() ?? '') ?? fallback;
}

String? _teacherName(Map<String, dynamic>? teacher) {
  if (teacher == null) return null;
  final first = teacher['firstName']?.toString() ?? '';
  final last = teacher['lastName']?.toString() ?? '';
  final name = '$first $last'.trim();
  return name.isEmpty ? teacher['email']?.toString() : name;
}
