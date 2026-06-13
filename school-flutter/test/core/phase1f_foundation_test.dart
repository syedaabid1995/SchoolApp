import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';
import 'package:school_flutter/core/analytics/analytics_service.dart';
import 'package:school_flutter/core/cache/cache_invalidation_service.dart';
import 'package:school_flutter/core/errors/app_error_mapper.dart';
import 'package:school_flutter/core/network/failures.dart';
import 'package:school_flutter/core/pagination/paginated_state.dart';
import 'package:school_flutter/core/storage/hive_cache_service.dart';
import 'package:school_flutter/core/sync/mutation_queue_service.dart';
import 'package:school_flutter/core/sync/sync_models.dart';

void main() {
  late Directory hiveDir;

  setUpAll(() {
    hiveDir = Directory.systemTemp.createTempSync('staff_app_phase1f_');
    Hive.init(hiveDir.path);
  });

  tearDownAll(() async {
    await Hive.close();
    if (hiveDir.existsSync()) {
      hiveDir.deleteSync(recursive: true);
    }
  });

  group('SyncSnapshot', () {
    test('idle snapshot starts without pending operations', () {
      const snapshot = SyncSnapshot.idle();

      expect(snapshot.phase, SyncPhase.idle);
      expect(snapshot.pendingOperations, 0);
      expect(snapshot.hasPendingOperations, isFalse);
      expect(snapshot.lastSyncAt, isNull);
    });

    test('has pending operations when count is positive', () {
      const snapshot = SyncSnapshot(
        phase: SyncPhase.idle,
        pendingOperations: 2,
      );

      expect(snapshot.hasPendingOperations, isTrue);
    });

    test('copyWith updates phase and pending count', () {
      const snapshot = SyncSnapshot.idle();

      final next = snapshot.copyWith(
        phase: SyncPhase.syncing,
        pendingOperations: 3,
      );

      expect(next.phase, SyncPhase.syncing);
      expect(next.pendingOperations, 3);
    });

    test('copyWith applies sync timestamp', () {
      const snapshot = SyncSnapshot.idle();
      final syncedAt = DateTime.utc(2026, 1, 1);

      final next = snapshot.copyWith(
        phase: SyncPhase.success,
        lastSyncAt: syncedAt,
      );

      expect(next.phase, SyncPhase.success);
      expect(next.lastSyncAt, syncedAt);
    });
  });

  group('QueuedMutation', () {
    test('serializes and deserializes mutation payload', () {
      final mutation = QueuedMutation(
        id: 'queue-1',
        type: 'attendance.self',
        payload: const {'status': 'PRESENT'},
        createdAt: DateTime.utc(2026, 1, 1),
      );

      final restored = QueuedMutation.fromJson(mutation.toJson());

      expect(restored, mutation);
      expect(restored.payload['status'], 'PRESENT');
    });

    test('converts dynamic payload keys to strings', () {
      final mutation = QueuedMutation.fromJson({
        'id': 'queue-1',
        'type': 'leave.request',
        'payload': {1: 'one'},
        'createdAt': '2026-01-01T00:00:00.000Z',
      });

      expect(mutation.payload['1'], 'one');
    });

    test('falls back to epoch for invalid createdAt', () {
      final mutation = QueuedMutation.fromJson({
        'id': 'queue-1',
        'type': 'homework.create',
        'payload': const <String, dynamic>{},
        'createdAt': 'not-a-date',
      });

      expect(mutation.createdAt, DateTime.fromMillisecondsSinceEpoch(0));
    });

    test('increments attempts without mutating payload', () {
      final mutation = QueuedMutation(
        id: 'queue-1',
        type: 'marks.submit',
        payload: const {'examPaperId': 'paper-1'},
        createdAt: DateTime.utc(2026, 1, 1),
      );

      final retried = mutation.incrementAttempts();

      expect(retried.attempts, 1);
      expect(retried.payload, mutation.payload);
      expect(mutation.attempts, 0);
    });
  });

  group('AppErrorMapper', () {
    test('maps unauthorized failures to sign-in message', () {
      final error = AppErrorMapper.map(const UnauthorizedFailure('expired'));

      expect(error.code, 'unauthorized');
      expect(error.canRetry, isFalse);
      expect(error.message, contains('sign in'));
    });

    test('maps validation failures without retry', () {
      final error = AppErrorMapper.map(const ValidationFailure('Bad date'));

      expect(error.code, 'validation');
      expect(error.canRetry, isFalse);
      expect(error.message, 'Bad date');
    });

    test('maps network failures to offline message', () {
      final error = AppErrorMapper.map(const NetworkFailure('offline'));

      expect(error.code, 'network');
      expect(error.canRetry, isTrue);
      expect(error.message, contains('offline'));
    });

    test('maps 403 API failures to permission message', () {
      final error = AppErrorMapper.map(
        const ApiFailure('Forbidden', statusCode: 403),
      );

      expect(error.code, 'permission');
      expect(error.message, contains('permission'));
    });

    test('maps unknown errors to generic retryable message', () {
      final error = AppErrorMapper.map(StateError('boom'));

      expect(error.code, 'unknown');
      expect(error.canRetry, isTrue);
    });
  });

  group('InMemoryAnalyticsService', () {
    test('tracks custom events', () {
      final analytics = InMemoryAnalyticsService();

      analytics.trackEvent('sync_failed', properties: {'reason': 'network'});

      expect(analytics.events.single.name, 'sync_failed');
      expect(analytics.events.single.properties['reason'], 'network');
    });

    test('tracks screen opens without PII by default', () {
      final analytics = InMemoryAnalyticsService();

      analytics.trackScreen('Dashboard');

      expect(analytics.events.single.name, 'screen_opened');
      expect(analytics.events.single.properties['screen'], 'Dashboard');
    });

    test('exposes immutable event list', () {
      final analytics = InMemoryAnalyticsService()..trackEvent('module_opened');

      expect(
        () => analytics.events.add(
          AnalyticsEvent(name: 'x', createdAt: DateTime.now()),
        ),
        throwsUnsupportedError,
      );
    });
  });

  group('PaginatedState', () {
    test('initial state starts at first page', () {
      const state = PaginatedState<int>.initial(pageSize: 10);

      expect(state.items, isEmpty);
      expect(state.page, 1);
      expect(state.pageSize, 10);
      expect(state.hasMore, isTrue);
    });

    test('append advances page and keeps hasMore when page is full', () {
      const state = PaginatedState<int>.initial(pageSize: 2);

      final next = state.append([1, 2]);

      expect(next.items, [1, 2]);
      expect(next.page, 2);
      expect(next.hasMore, isTrue);
    });

    test('append marks end when returned page is short', () {
      const state = PaginatedState<int>.initial(pageSize: 3);

      final next = state.append([1]);

      expect(next.hasMore, isFalse);
    });

    test('loading keeps current pagination state', () {
      final state = const PaginatedState<int>.initial(
        pageSize: 2,
      ).append([1, 2]);

      final loading = state.loading();

      expect(loading.items, [1, 2]);
      expect(loading.page, 2);
      expect(loading.isLoading, isTrue);
    });
  });

  group('HiveCacheService', () {
    test('writeCached stores value and sync timestamp', () async {
      final box = await Hive.openBox<dynamic>('cache_one');
      final cache = HiveCacheService(box);

      await cache.writeCached('attendance.history', {'rows': 2});

      expect(cache.hasCachedValue('attendance.history'), isTrue);
      expect(cache.read<Map>('attendance.history')?['rows'], 2);
      expect(cache.lastSyncedAt('attendance.history'), isNotNull);

      await box.deleteFromDisk();
    });

    test('remove deletes cached value', () async {
      final box = await Hive.openBox<dynamic>('cache_two');
      final cache = HiveCacheService(box);

      await cache.write('notices', ['one']);
      await cache.remove('notices');

      expect(cache.hasCachedValue('notices'), isFalse);

      await box.deleteFromDisk();
    });

    test('clear removes all staff cache entries', () async {
      final box = await Hive.openBox<dynamic>('cache_three');
      final cache = HiveCacheService(box);

      await cache.write('a', 1);
      await cache.write('b', 2);
      await cache.clear();

      expect(cache.hasCachedValue('a'), isFalse);
      expect(cache.hasCachedValue('b'), isFalse);

      await box.deleteFromDisk();
    });

    test('lastSyncedAt returns null for missing metadata', () async {
      final box = await Hive.openBox<dynamic>('cache_four');
      final cache = HiveCacheService(box);

      expect(cache.lastSyncedAt('missing'), isNull);

      await box.deleteFromDisk();
    });
  });

  group('CacheInvalidationService', () {
    test('invalidates selected cache keys only', () async {
      final box = await Hive.openBox<dynamic>('cache_invalidation_one');
      final cache = HiveCacheService(box);
      final invalidation = CacheInvalidationService(cache);

      await cache.write('attendance', 1);
      await cache.write('timetable', 2);
      await invalidation.invalidateKeys(['attendance']);

      expect(cache.hasCachedValue('attendance'), isFalse);
      expect(cache.hasCachedValue('timetable'), isTrue);

      await box.deleteFromDisk();
    });

    test('invalidates all staff cache data', () async {
      final box = await Hive.openBox<dynamic>('cache_invalidation_two');
      final cache = HiveCacheService(box);
      final invalidation = CacheInvalidationService(cache);

      await cache.write('attendance', 1);
      await cache.write('timetable', 2);
      await invalidation.invalidateAllStaffData();

      expect(cache.hasCachedValue('attendance'), isFalse);
      expect(cache.hasCachedValue('timetable'), isFalse);

      await box.deleteFromDisk();
    });
  });

  group('MutationQueueService', () {
    test('enqueue stores pending mutation', () async {
      final box = await Hive.openBox<dynamic>('queue_one');
      final cache = HiveCacheService(box);
      final queue = MutationQueueService(cache: cache, dio: Dio());

      final mutation = await queue.enqueue(
        type: 'attendance.self',
        payload: const {'status': 'PRESENT'},
      );

      expect(queue.pending(), hasLength(1));
      expect(queue.pending().single.id, mutation.id);

      await box.deleteFromDisk();
    });

    test('clear removes pending mutations', () async {
      final box = await Hive.openBox<dynamic>('queue_two');
      final queue = MutationQueueService(
        cache: HiveCacheService(box),
        dio: Dio(),
      );

      await queue.enqueue(type: 'marks.submit', payload: const {});
      await queue.clear();

      expect(queue.pending(), isEmpty);

      await box.deleteFromDisk();
    });

    test('unknown mutation remains queued with incremented attempt', () async {
      final box = await Hive.openBox<dynamic>('queue_three');
      final queue = MutationQueueService(
        cache: HiveCacheService(box),
        dio: Dio(),
      );

      await queue.enqueue(type: 'unknown.operation', payload: const {});
      final processed = await queue.processPending();

      expect(processed, 0);
      expect(queue.pending().single.attempts, 1);

      await box.deleteFromDisk();
    });
  });
}
