import '../entities/homework.dart';

abstract class HomeworkRepository {
  Future<List<Homework>> list({String? classId, String? sectionId});
  Future<Homework> create(HomeworkDraft draft);
  Future<Homework> update(String id, HomeworkDraft draft);
  Future<void> delete(String id);
}
