import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../analytics/analytics_service.dart';
import '../connectivity/connectivity_service.dart';
import '../storage/hive_cache_service.dart';
import 'mutation_queue_service.dart';
import 'sync_models.dart';

final syncManagerProvider = NotifierProvider<SyncManager, SyncSnapshot>(
  SyncManager.new,
);

class SyncManager extends Notifier<SyncSnapshot> {
  StreamSubscription<bool>? _connectivitySub;

  @override
  SyncSnapshot build() {
    final queue = ref.watch(mutationQueueServiceProvider);
    state = SyncSnapshot(
      phase: SyncPhase.idle,
      pendingOperations: queue.pending().length,
      lastSyncAt: _lastSyncAt(),
    );
    _connectivitySub = ref
        .watch(connectivityServiceProvider)
        .onlineChanges()
        .listen((online) {
          if (online) sync(reason: 'connectivity_recovered');
        });
    ref.onDispose(() => _connectivitySub?.cancel());
    return state;
  }

  Future<void> sync({String reason = 'manual'}) async {
    final queue = ref.read(mutationQueueServiceProvider);
    final analytics = ref.read(analyticsServiceProvider);
    state = state.copyWith(
      phase: SyncPhase.syncing,
      pendingOperations: queue.pending().length,
      message: 'Syncing',
    );
    try {
      await queue.processPending();
      final now = DateTime.now();
      await ref
          .read(hiveCacheServiceProvider)
          .write('sync.lastSyncAt', now.toIso8601String());
      state = SyncSnapshot(
        phase: SyncPhase.success,
        pendingOperations: queue.pending().length,
        lastSyncAt: now,
        message: 'Sync complete',
      );
      analytics.trackEvent('sync_completed', properties: {'reason': reason});
    } catch (error) {
      state = state.copyWith(
        phase: SyncPhase.failed,
        pendingOperations: queue.pending().length,
        message: 'Sync failed. It will retry when you are online.',
      );
      analytics.trackEvent('sync_failed', properties: {'reason': reason});
    }
  }

  Future<void> refreshPendingCount() async {
    state = state.copyWith(
      pendingOperations: ref
          .read(mutationQueueServiceProvider)
          .pending()
          .length,
    );
  }

  DateTime? _lastSyncAt() {
    final value = ref
        .read(hiveCacheServiceProvider)
        .read<String>('sync.lastSyncAt');
    return DateTime.tryParse(value ?? '');
  }
}
