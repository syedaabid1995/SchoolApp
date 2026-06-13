import 'package:intl/intl.dart';

import '../../../../core/network/error_handler.dart';
import '../../../../core/network/failures.dart';
import '../../../../core/storage/hive_cache_service.dart';
import '../../../../core/sync/mutation_queue_service.dart';
import '../../domain/entities/homework.dart';
import '../../domain/repositories/homework_repository.dart';
import '../datasources/homework_remote_datasource.dart';
import '../models/homework_model.dart';

class HomeworkRepositoryImpl implements HomeworkRepository {
  const HomeworkRepositoryImpl({
    required HomeworkRemoteDatasource remote,
    required HiveCacheService cache,
    MutationQueueService? mutationQueue,
  }) : _remote = remote,
       _cache = cache,
       _mutationQueue = mutationQueue;

  static const _cacheKey = 'homework.recent';

  final HomeworkRemoteDatasource _remote;
  final HiveCacheService _cache;
  final MutationQueueService? _mutationQueue;

  @override
  Future<List<Homework>> list({String? classId, String? sectionId}) async {
    try {
      final items = await _remote.list(classId: classId, sectionId: sectionId);
      await _cache.writeCached(
        _cacheKey,
        items.map((item) => item.toJson()).toList(),
      );
      return items;
    } catch (error) {
      final cached = _cache.read<List<dynamic>>(_cacheKey);
      if (cached != null) return _fromCache(cached);
      throw ErrorHandler.toFailure(error);
    }
  }

  @override
  Future<Homework> create(HomeworkDraft draft) async {
    try {
      return await _remote.create(draft);
    } catch (error) {
      final failure = ErrorHandler.toFailure(error);
      if (failure is NetworkFailure && _mutationQueue != null) {
        await _mutationQueue.enqueue(
          type: 'homework.create',
          payload: _payload(draft),
        );
        return _queuedHomework(draft);
      }
      throw failure;
    }
  }

  @override
  Future<Homework> update(String id, HomeworkDraft draft) async {
    try {
      return await _remote.update(id, draft);
    } catch (error) {
      final failure = ErrorHandler.toFailure(error);
      if (failure is NetworkFailure && _mutationQueue != null) {
        await _mutationQueue.enqueue(
          type: 'homework.update',
          payload: {'id': id, ..._payload(draft)},
        );
        return _queuedHomework(draft, id: id);
      }
      throw failure;
    }
  }

  @override
  Future<void> delete(String id) async {
    try {
      await _remote.delete(id);
    } catch (error) {
      throw ErrorHandler.toFailure(error);
    }
  }

  List<Homework> _fromCache(List<dynamic> values) => [
    for (final item in values)
      if (item is Map)
        HomeworkModel.fromJson(
          item.map((key, value) => MapEntry(key.toString(), value)),
        ),
  ];

  Map<String, dynamic> _payload(HomeworkDraft draft) => {
    'classId': draft.classId,
    'sectionId': draft.sectionId,
    'subjectId': draft.subjectId,
    'homeworkDate': DateFormat('yyyy-MM-dd').format(draft.homeworkDate),
    'submissionDate': DateFormat('yyyy-MM-dd').format(draft.submissionDate),
    'marks': draft.marks,
    'description': draft.description,
  };

  Homework _queuedHomework(HomeworkDraft draft, {String? id}) {
    return Homework(
      id: id ?? 'queued-${DateTime.now().microsecondsSinceEpoch}',
      classId: draft.classId,
      sectionId: draft.sectionId,
      subjectId: draft.subjectId,
      homeworkDate: draft.homeworkDate,
      submissionDate: draft.submissionDate,
      marks: draft.marks,
      description: '${draft.description}\nQueued for sync',
    );
  }
}
