import 'package:equatable/equatable.dart';

class AssignedClass extends Equatable {
  const AssignedClass({
    required this.id,
    required this.name,
    this.academicYearId,
  });

  final String id;
  final String name;
  final String? academicYearId;

  @override
  List<Object?> get props => [id, name, academicYearId];
}

class AssignedSection extends Equatable {
  const AssignedSection({
    required this.id,
    required this.name,
    required this.classId,
  });

  final String id;
  final String name;
  final String classId;

  @override
  List<Object?> get props => [id, name, classId];
}

class AssignedSubject extends Equatable {
  const AssignedSubject({
    required this.id,
    required this.name,
    this.classId,
    this.sectionId,
    this.teacherId,
    this.teacherName,
  });

  final String id;
  final String name;
  final String? classId;
  final String? sectionId;
  final String? teacherId;
  final String? teacherName;

  @override
  List<Object?> get props => [
    id,
    name,
    classId,
    sectionId,
    teacherId,
    teacherName,
  ];
}

class ClassAssignments extends Equatable {
  const ClassAssignments({
    required this.classes,
    required this.sections,
    required this.subjects,
  });

  final List<AssignedClass> classes;
  final List<AssignedSection> sections;
  final List<AssignedSubject> subjects;

  List<AssignedSection> sectionsForClass(String? classId) {
    if (classId == null || classId.isEmpty) return sections;
    return sections.where((section) => section.classId == classId).toList();
  }

  List<AssignedSubject> subjectsForClass(String? classId, {String? sectionId}) {
    if (classId == null || classId.isEmpty) return subjects;
    return subjects
        .where(
          (subject) =>
              (subject.classId == null || subject.classId == classId) &&
              (sectionId == null ||
                  sectionId.isEmpty ||
                  subject.sectionId == null ||
                  subject.sectionId == sectionId),
        )
        .toList();
  }

  int uniqueSubjectCountForClass(String? classId) {
    return subjectsForClass(classId).map((subject) => subject.id).toSet().length;
  }

  @override
  List<Object?> get props => [classes, sections, subjects];
}
