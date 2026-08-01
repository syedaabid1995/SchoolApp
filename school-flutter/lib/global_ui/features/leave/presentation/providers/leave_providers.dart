import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/dio_client.dart';
import '../../../../core/storage/hive_cache_service.dart';
import '../../../../core/sync/mutation_queue_service.dart';
import '../../../../core/sync/sync_manager.dart';
import '../../../auth/domain/entities/auth_session.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../data/datasources/leave_remote_datasource.dart';
import '../../data/repositories/leave_repository_impl.dart';
import '../../domain/entities/leave_entities.dart';
import '../../domain/repositories/leave_repository.dart';

final leaveRemoteDatasourceProvider = Provider<LeaveRemoteDatasource>((ref) {
  return LeaveRemoteDatasource(ref.watch(dioProvider));
});

final leaveRepositoryProvider = Provider<LeaveRepository>((ref) {
  return LeaveRepositoryImpl(
    remote: ref.watch(leaveRemoteDatasourceProvider),
    cache: ref.watch(hiveCacheServiceProvider),
    mutationQueue: ref.watch(mutationQueueServiceProvider),
  );
});

final leaveHomeProvider = FutureProvider.autoDispose<LeaveHomeData>((ref) {
  return ref.watch(leaveRepositoryProvider).getHomeData();
});

final leaveAccessibleSchoolsProvider =
    FutureProvider.autoDispose<List<SchoolLoginOption>>((ref) {
      return ref.watch(authRepositoryProvider).listAccessibleSchools();
    });

final leaveApplicationDetailProvider = FutureProvider.autoDispose
    .family<LeaveApplication, String>((ref, id) {
      return ref.watch(leaveRepositoryProvider).getApplication(id);
    });

final leaveRequestControllerProvider =
    AsyncNotifierProvider<LeaveRequestController, LeaveApplication?>(
      LeaveRequestController.new,
    );

class LeaveRequestController extends AsyncNotifier<LeaveApplication?> {
  @override
  Future<LeaveApplication?> build() async => null;

  Future<void> submit({
    required String leaveTypeId,
    required DateTime fromDate,
    required DateTime toDate,
    required String reason,
  }) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref
          .read(leaveRepositoryProvider)
          .submitApplication(
            leaveTypeId: leaveTypeId,
            fromDate: fromDate,
            toDate: toDate,
            reason: reason,
          ),
    );
    ref.invalidate(leaveHomeProvider);
    await _refreshSyncBadge();
  }

  Future<void> cancel(String id) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      await ref.read(leaveRepositoryProvider).cancelApplication(id);
      return null;
    });
    ref.invalidate(leaveHomeProvider);
    await _refreshSyncBadge();
  }

  Future<void> _refreshSyncBadge() async {
    try {
      await ref.read(syncManagerProvider.notifier).refreshPendingCount();
    } catch (_) {
      // Pending badges are best-effort and must not fail leave actions.
    }
  }
}
