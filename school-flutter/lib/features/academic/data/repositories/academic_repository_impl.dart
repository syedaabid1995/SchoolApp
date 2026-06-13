import '../../../attendance/domain/repositories/attendance_repository.dart';
import '../../../classes/domain/entities/class_assignment.dart';
import '../../../classes/domain/repositories/class_assignment_repository.dart';
import '../../../exams/domain/repositories/exam_repository.dart';
import '../../../homework/domain/repositories/homework_repository.dart';
import '../../../marks/domain/repositories/marks_repository.dart';
import '../../domain/entities/academic_overview.dart';
import '../../domain/repositories/academic_repository.dart';

class AcademicRepositoryImpl implements AcademicRepository {
  const AcademicRepositoryImpl({
    required ClassAssignmentRepository classAssignmentRepository,
    required HomeworkRepository homeworkRepository,
    required ExamRepository examRepository,
    required MarksRepository marksRepository,
    required AttendanceRepository attendanceRepository,
  }) : _classAssignmentRepository = classAssignmentRepository,
       _homeworkRepository = homeworkRepository,
       _examRepository = examRepository,
       _marksRepository = marksRepository,
       _attendanceRepository = attendanceRepository;

  final ClassAssignmentRepository _classAssignmentRepository;
  final HomeworkRepository _homeworkRepository;
  final ExamRepository _examRepository;
  final MarksRepository _marksRepository;
  final AttendanceRepository _attendanceRepository;

  @override
  Future<ClassAcademicOverview> getClassOverview(
    AssignedClass assignedClass,
  ) async {
    final assignments = await _classAssignmentRepository.getAssignments();
    final sections = assignments.sectionsForClass(assignedClass.id);
    final subjects = assignments.subjectsForClass(assignedClass.id);
    final firstSectionId = sections.isEmpty ? null : sections.first.id;

    final results = await Future.wait<Object?>([
      _homeworkRepository.list(classId: assignedClass.id),
      _examRepository.listAssignedPapers(classId: assignedClass.id),
      _loadMarksForClass(assignedClass.id, firstSectionId),
      _attendanceRepository.getSummary(),
    ]);

    return ClassAcademicOverview(
      assignedClass: assignedClass,
      sections: sections,
      subjects: subjects,
      homework: results[0] as dynamic,
      examPapers: results[1] as dynamic,
      marks: results[2] as dynamic,
      attendanceSummary: results[3] as dynamic,
    );
  }

  Future<Object> _loadMarksForClass(String classId, String? sectionId) async {
    final papers = await _examRepository.listAssignedPapers(
      classId: classId,
      sectionId: sectionId,
    );
    if (papers.isEmpty) return const [];
    final markGroups = await Future.wait([
      for (final paper in papers.take(5)) _marksRepository.listMarks(paper.id),
    ]);
    return markGroups.expand((records) => records).toList();
  }
}
