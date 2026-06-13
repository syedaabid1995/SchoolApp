import '../../../exams/domain/entities/exam.dart';
import '../entities/marks.dart';

abstract class MarksRepository {
  Future<List<ExamPaper>> listTasks({
    String? examId,
    String? classId,
    String? sectionId,
    String? subjectId,
  });
  Future<List<AssignedStudent>> listStudents({
    String? classId,
    String? sectionId,
  });
  Future<List<MarkRecord>> listMarks(String examPaperId);
  Future<MarksUploadResult> submitMarks(MarksDraft draft);
  Future<MarksSummary> getSummary(ExamPaper paper);
}
