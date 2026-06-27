import '../../../../core/network/error_handler.dart';
import '../../../../core/network/failures.dart';
import '../../../../core/storage/hive_cache_service.dart';
import '../../../../core/sync/mutation_queue_service.dart';
import '../../../exams/data/models/exam_models.dart';
import '../../../exams/domain/entities/exam.dart';
import '../../domain/entities/marks.dart';
import '../../domain/repositories/marks_repository.dart';
import '../datasources/marks_remote_datasource.dart';
import '../models/marks_models.dart';

class MarksRepositoryImpl implements MarksRepository {
  const MarksRepositoryImpl({
    required MarksRemoteDatasource remote,
    required HiveCacheService cache,
    MutationQueueService? mutationQueue,
  }) : _remote = remote,
       _cache = cache,
       _mutationQueue = mutationQueue;

  static const _tasksCacheKey = 'marks.tasks';
  static const _studentsCacheKey = 'marks.students';
  static const _marksCachePrefix = 'marks.records.';

  final MarksRemoteDatasource _remote;
  final HiveCacheService _cache;
  final MutationQueueService? _mutationQueue;

  @override
  Future<List<ExamPaper>> listTasks({
    String? examId,
    String? classId,
    String? sectionId,
    String? subjectId,
  }) async {
    try {
      final tasks = await _remote.listTasks(
        examId: examId,
        classId: classId,
        sectionId: sectionId,
        subjectId: subjectId,
      );
      if (examId == null &&
          classId == null &&
          sectionId == null &&
          subjectId == null) {
        await _cache.writeCached(
          _tasksCacheKey,
          tasks.map((task) => task.toJson()).toList(),
        );
      }
      return tasks;
    } catch (error) {
      if (examId == null &&
          classId == null &&
          sectionId == null &&
          subjectId == null) {
        final cached = _cache.read<List<dynamic>>(_tasksCacheKey);
        if (cached != null) return _tasksFromCache(cached);
      }
      throw ErrorHandler.toFailure(error);
    }
  }

  @override
  Future<List<AssignedStudent>> listStudents({
    String? classId,
    String? sectionId,
  }) async {
    try {
      final students = await _remote.listStudents(
        classId: classId,
        sectionId: sectionId,
      );
      if (classId == null && sectionId == null) {
        await _cache.writeCached(
          _studentsCacheKey,
          students.map((student) => student.toJson()).toList(),
        );
      }
      return students;
    } catch (error) {
      if (classId == null && sectionId == null) {
        final cached = _cache.read<List<dynamic>>(_studentsCacheKey);
        if (cached != null) return _studentsFromCache(cached);
      }
      throw ErrorHandler.toFailure(error);
    }
  }

  @override
  Future<List<MarkRecord>> listMarks(String examPaperId) async {
    try {
      final marks = await _remote.listMarks(examPaperId);
      await _cache.writeCached(
        '$_marksCachePrefix$examPaperId',
        marks.map((mark) => mark.toJson()).toList(),
      );
      return marks;
    } catch (error) {
      final cached = _cache.read<List<dynamic>>(
        '$_marksCachePrefix$examPaperId',
      );
      if (cached != null) return _marksFromCache(cached);
      throw ErrorHandler.toFailure(error);
    }
  }

  @override
  Future<MarksUploadResult> submitMarks(MarksDraft draft) async {
    try {
      return await _remote.submitMarks(draft);
    } catch (error) {
      final failure = ErrorHandler.toFailure(error);
      if (failure is NetworkFailure && _mutationQueue != null) {
        await _mutationQueue.enqueue(
          type: 'marks.submit',
          payload: marksDraftPayload(draft),
        );
        return const MarksUploadResult(results: []);
      }
      throw failure;
    }
  }

  @override
  Future<MarksSummary> getSummary(ExamPaper paper) async {
    final records = await listMarks(paper.id);
    return MarksSummaryModel.fromPaperAndRecords(
      paper: paper,
      records: records,
    );
  }

  List<ExamPaper> _tasksFromCache(List<dynamic> values) => [
    for (final value in values)
      if (value is Map) ExamPaperModel.fromJson(_stringMap(value)),
  ];

  List<AssignedStudent> _studentsFromCache(List<dynamic> values) => [
    for (final value in values)
      if (value is Map) AssignedStudentModel.fromJson(_stringMap(value)),
  ];

  List<MarkRecord> _marksFromCache(List<dynamic> values) => [
    for (final value in values)
      if (value is Map) MarkRecordModel.fromJson(_stringMap(value)),
  ];

  Map<String, dynamic> _stringMap(Map value) =>
      value.map((key, value) => MapEntry(key.toString(), value));
}
