import '../entities/homework.dart';

abstract class HomeworkRepository {
  Future<List<Homework>> list({
    String? classId,
    String? sectionId,
    String? subjectId,
    DateTime? homeworkDate,
  });
  Future<Homework> create(HomeworkDraft draft);
  Future<Homework> update(String id, HomeworkDraft draft);
  Future<void> delete(String id);
  Future<HomeworkAttachment> uploadAttachment({
    required String path,
    required String filename,
  });
  Future<HomeworkEvaluationDetail> getEvaluation(String id);
  Future<List<HomeworkNotificationHistoryRow>> getNotificationHistory(
    String id,
  );
  Future<HomeworkEvaluationDetail> saveEvaluation({
    required String id,
    required DateTime evaluationDate,
    required List<HomeworkEvaluationDraftRow> evaluations,
  });
}
