import '../../../../core/network/error_handler.dart';
import '../../../../core/network/failures.dart';
import '../../../../core/storage/hive_cache_service.dart';
import '../../domain/entities/exam.dart';
import '../../domain/repositories/exam_repository.dart';
import '../datasources/exam_remote_datasource.dart';
import '../models/exam_models.dart';

class ExamRepositoryImpl implements ExamRepository {
  const ExamRepositoryImpl({
    required ExamRemoteDatasource remote,
    required HiveCacheService cache,
  }) : _remote = remote,
       _cache = cache;

  static const _examsCacheKey = 'exams.list';
  static const _papersCacheKey = 'exams.assignedPapers';
  static const _dutiesCacheKey = 'exams.myDuties';

  final ExamRemoteDatasource _remote;
  final HiveCacheService _cache;

  @override
  Future<ExamHomeData> getHomeData() async {
    final results = await Future.wait<Object>([
      listExams(),
      listAssignedPapers(),
      listMyDuties(),
    ]);
    return ExamHomeData(
      exams: results[0] as List<Exam>,
      assignedPapers: results[1] as List<ExamPaper>,
      duties: results[2] as List<ExamDuty>,
    );
  }

  @override
  Future<List<Exam>> listExams() async {
    try {
      final exams = await _remote.listExams();
      await _cache.writeCached(
        _examsCacheKey,
        exams.map((exam) => exam.toJson()).toList(),
      );
      return exams;
    } catch (error) {
      final cached = _cache.read<List<dynamic>>(_examsCacheKey);
      if (cached != null) return _examsFromCache(cached);
      throw ErrorHandler.toFailure(error);
    }
  }

  @override
  Future<Exam> getExam(String id) async {
    try {
      return await _remote.getExam(id);
    } catch (error) {
      throw ErrorHandler.toFailure(error);
    }
  }

  @override
  Future<List<ExamPaper>> listAssignedPapers({
    String? examId,
    String? classId,
    String? sectionId,
    String? subjectId,
  }) async {
    try {
      final papers = await _remote.listAssignedPapers(
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
          _papersCacheKey,
          papers.map((paper) => paper.toJson()).toList(),
        );
      }
      return papers;
    } catch (error) {
      if (examId == null &&
          classId == null &&
          sectionId == null &&
          subjectId == null) {
        final cached = _cache.read<List<dynamic>>(_papersCacheKey);
        if (cached != null) return _papersFromCache(cached);
      }
      final failure = ErrorHandler.toFailure(error);
      if (_isOptionalTeacherWorkflowGap(failure)) return const [];
      throw failure;
    }
  }

  @override
  Future<List<ExamDuty>> listMyDuties() async {
    try {
      final exams = await _remote.listExams();
      final teacherId = await _remote.getCurrentTeacherProfileId();
      if (teacherId == null || teacherId.isEmpty) return const [];
      final dutyGroups = await Future.wait([
        for (final exam in exams.where((exam) => exam.isActive))
          _remote.listInvigilators(exam.id),
      ]);
      final duties =
          dutyGroups
              .expand((items) => items)
              .where((duty) => duty.teacherId == teacherId)
              .toList()
            ..sort((a, b) {
              final left =
                  a.scheduledAt ?? DateTime.fromMillisecondsSinceEpoch(0);
              final right =
                  b.scheduledAt ?? DateTime.fromMillisecondsSinceEpoch(0);
              return left.compareTo(right);
            });
      await _cache.writeCached(
        _dutiesCacheKey,
        duties.whereType<ExamDutyModel>().map((duty) => duty.toJson()).toList(),
      );
      return duties;
    } catch (error) {
      final cached = _cache.read<List<dynamic>>(_dutiesCacheKey);
      if (cached != null) return _dutiesFromCache(cached);
      final failure = ErrorHandler.toFailure(error);
      if (_isOptionalTeacherWorkflowGap(failure)) return const [];
      throw failure;
    }
  }

  List<Exam> _examsFromCache(List<dynamic> values) => [
    for (final value in values)
      if (value is Map) ExamModel.fromJson(_stringMap(value)),
  ];

  List<ExamPaper> _papersFromCache(List<dynamic> values) => [
    for (final value in values)
      if (value is Map) ExamPaperModel.fromJson(_stringMap(value)),
  ];

  List<ExamDuty> _dutiesFromCache(List<dynamic> values) => [
    for (final value in values)
      if (value is Map) ExamDutyModel.fromJson(_stringMap(value)),
  ];

  Map<String, dynamic> _stringMap(Map value) =>
      value.map((key, value) => MapEntry(key.toString(), value));

  bool _isOptionalTeacherWorkflowGap(AppFailure failure) {
    if (failure is! ApiFailure ||
        (failure.statusCode != 403 && failure.statusCode != 404)) {
      return false;
    }
    final message = failure.message.toLowerCase();
    return message.contains('teacher profile') ||
        message.contains('employee profile') ||
        message.contains('assignment scope');
  }
}
