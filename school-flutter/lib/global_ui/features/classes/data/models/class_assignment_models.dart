import '../../domain/entities/class_assignment.dart';

class AssignedClassModel extends AssignedClass {
  const AssignedClassModel({
    required super.id,
    required super.name,
    super.academicYearId,
  });

  factory AssignedClassModel.fromJson(Map<String, dynamic> json) {
    return AssignedClassModel(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      academicYearId: json['academicYearId']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'academicYearId': academicYearId,
  };
}

class AssignedSectionModel extends AssignedSection {
  const AssignedSectionModel({
    required super.id,
    required super.name,
    required super.classId,
  });

  factory AssignedSectionModel.fromJson(Map<String, dynamic> json) {
    final classSections = json['classSections'] is List
        ? json['classSections'] as List
        : const [];
    final firstLink = classSections.isNotEmpty && classSections.first is Map
        ? classSections.first as Map
        : null;
    return AssignedSectionModel(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      classId:
          json['classId']?.toString() ??
          firstLink?['classId']?.toString() ??
          '',
    );
  }

  Map<String, dynamic> toJson() => {'id': id, 'name': name, 'classId': classId};
}

class AssignedSubjectModel extends AssignedSubject {
  const AssignedSubjectModel({
    required super.id,
    required super.name,
    super.classId,
    super.sectionId,
    super.teacherId,
    super.teacherName,
  });

  factory AssignedSubjectModel.fromJson(Map<String, dynamic> json) {
    final subject = json['subject'] is Map<String, dynamic>
        ? json['subject'] as Map<String, dynamic>
        : json;
    final teacher = json['teacher'] is Map<String, dynamic>
        ? json['teacher'] as Map<String, dynamic>
        : null;
    return AssignedSubjectModel(
      id: subject['id']?.toString() ?? '',
      name: subject['name']?.toString() ?? '',
      classId: json['classId']?.toString() ?? subject['classId']?.toString(),
      sectionId: json['sectionId']?.toString(),
      teacherId: json['teacherId']?.toString() ?? teacher?['id']?.toString(),
      teacherName: _teacherName(teacher),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'classId': classId,
    'sectionId': sectionId,
    'teacherId': teacherId,
    'teacherName': teacherName,
  };
}

String? _teacherName(Map<String, dynamic>? teacher) {
  if (teacher == null) return null;
  final first = teacher['firstName']?.toString().trim() ?? '';
  final last = teacher['lastName']?.toString().trim() ?? '';
  final fullName = '$first $last'.trim();
  if (fullName.isNotEmpty) return fullName;
  return teacher['employeeNo']?.toString();
}
