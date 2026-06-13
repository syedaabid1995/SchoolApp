import '../entities/exam.dart';

abstract class ExamRepository {
  Future<ExamHomeData> getHomeData();
  Future<List<Exam>> listExams();
  Future<Exam> getExam(String id);
  Future<List<ExamPaper>> listAssignedPapers({
    String? examId,
    String? classId,
    String? sectionId,
    String? subjectId,
  });
  Future<List<ExamDuty>> listMyDuties();
}
