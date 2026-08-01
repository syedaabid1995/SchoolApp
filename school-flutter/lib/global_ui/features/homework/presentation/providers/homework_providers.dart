import 'package:equatable/equatable.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/dio_client.dart';
import '../../../../core/storage/hive_cache_service.dart';
import '../../../../core/sync/mutation_queue_service.dart';
import '../../../../core/sync/sync_manager.dart';
import '../../data/datasources/homework_remote_datasource.dart';
import '../../data/repositories/homework_repository_impl.dart';
import '../../domain/entities/homework.dart';
import '../../domain/repositories/homework_repository.dart';

class HomeworkFilter extends Equatable {
  const HomeworkFilter({
    this.classId,
    this.sectionId,
    this.subjectId,
    this.homeworkDate,
  });

  final String? classId;
  final String? sectionId;
  final String? subjectId;
  final DateTime? homeworkDate;

  @override
  List<Object?> get props => [classId, sectionId, subjectId, homeworkDate];
}

final homeworkRemoteDatasourceProvider = Provider<HomeworkRemoteDatasource>((
  ref,
) {
  return HomeworkRemoteDatasource(ref.watch(dioProvider));
});

final homeworkRepositoryProvider = Provider<HomeworkRepository>((ref) {
  return HomeworkRepositoryImpl(
    remote: ref.watch(homeworkRemoteDatasourceProvider),
    cache: ref.watch(hiveCacheServiceProvider),
    mutationQueue: ref.watch(mutationQueueServiceProvider),
  );
});

final homeworkListProvider = FutureProvider.autoDispose
    .family<List<Homework>, HomeworkFilter>((ref, filter) {
      return ref
          .watch(homeworkRepositoryProvider)
          .list(
            classId: filter.classId,
            sectionId: filter.sectionId,
            subjectId: filter.subjectId,
            homeworkDate: filter.homeworkDate,
          );
    });

final homeworkEvaluationProvider = FutureProvider.autoDispose
    .family<HomeworkEvaluationDetail, String>((ref, id) {
      return ref.watch(homeworkRepositoryProvider).getEvaluation(id);
    });

final homeworkNotificationHistoryProvider = FutureProvider.autoDispose
    .family<List<HomeworkNotificationHistoryRow>, String>((ref, id) {
      return ref.watch(homeworkRepositoryProvider).getNotificationHistory(id);
    });

final homeworkMutationProvider =
    AsyncNotifierProvider<HomeworkMutationController, Homework?>(
      HomeworkMutationController.new,
    );

class HomeworkMutationController extends AsyncNotifier<Homework?> {
  @override
  Future<Homework?> build() async => null;

  Future<void> create(HomeworkDraft draft) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(homeworkRepositoryProvider).create(draft),
    );
    await _refreshSyncBadge();
  }

  Future<void> saveUpdate(String id, HomeworkDraft draft) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(homeworkRepositoryProvider).update(id, draft),
    );
    await _refreshSyncBadge();
  }

  Future<void> delete(String id) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      await ref.read(homeworkRepositoryProvider).delete(id);
      return null;
    });
    await _refreshSyncBadge();
  }

  Future<HomeworkAttachment> uploadAttachment({
    required String path,
    required String filename,
  }) {
    return ref
        .read(homeworkRepositoryProvider)
        .uploadAttachment(path: path, filename: filename);
  }

  Future<HomeworkEvaluationDetail> saveEvaluation({
    required String id,
    required DateTime evaluationDate,
    required List<HomeworkEvaluationDraftRow> evaluations,
  }) {
    return ref
        .read(homeworkRepositoryProvider)
        .saveEvaluation(
          id: id,
          evaluationDate: evaluationDate,
          evaluations: evaluations,
        );
  }

  Future<void> _refreshSyncBadge() async {
    try {
      await ref.read(syncManagerProvider.notifier).refreshPendingCount();
    } catch (_) {
      // Pending badges are best-effort and must not fail homework actions.
    }
  }
}
