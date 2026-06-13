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
  const HomeworkFilter({this.classId, this.sectionId});

  final String? classId;
  final String? sectionId;

  @override
  List<Object?> get props => [classId, sectionId];
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
          .list(classId: filter.classId, sectionId: filter.sectionId);
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

  Future<void> _refreshSyncBadge() async {
    try {
      await ref.read(syncManagerProvider.notifier).refreshPendingCount();
    } catch (_) {
      // Pending badges are best-effort and must not fail homework actions.
    }
  }
}
