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
  });

  factory AssignedSubjectModel.fromJson(Map<String, dynamic> json) {
    final subject = json['subject'] is Map<String, dynamic>
        ? json['subject'] as Map<String, dynamic>
        : json;
    return AssignedSubjectModel(
      id: subject['id']?.toString() ?? '',
      name: subject['name']?.toString() ?? '',
      classId: subject['classId']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {'id': id, 'name': name, 'classId': classId};
}
