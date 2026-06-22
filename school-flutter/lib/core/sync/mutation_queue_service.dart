import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../constants/api_endpoints.dart';
import '../network/dio_client.dart';
import '../storage/hive_cache_service.dart';
import 'sync_models.dart';

final mutationQueueServiceProvider = Provider<MutationQueueService>((ref) {
  return MutationQueueService(
    cache: ref.watch(hiveCacheServiceProvider),
    dio: ref.watch(dioProvider),
  );
});

class MutationQueueService {
  MutationQueueService({required HiveCacheService cache, required Dio dio})
    : _cache = cache,
      _dio = dio;

  static const queueKey = 'sync.mutationQueue';

  final HiveCacheService _cache;
  final Dio _dio;

  List<QueuedMutation> pending() {
    final rows = _cache.read<List<dynamic>>(queueKey) ?? const [];
    return [
      for (final row in rows)
        if (row is Map)
          QueuedMutation.fromJson(
            row.map((key, value) => MapEntry(key.toString(), value)),
          ),
    ];
  }

  Future<QueuedMutation> enqueue({
    required String type,
    required Map<String, dynamic> payload,
    String? dedupeKey,
  }) async {
    final mutation = QueuedMutation(
      id: '${DateTime.now().microsecondsSinceEpoch}-$type',
      type: type,
      payload: {...payload, if (dedupeKey != null) 'dedupeKey': dedupeKey},
      createdAt: DateTime.now(),
    );
    final rows = pending();
    final next = dedupeKey == null
        ? rows
        : rows
              .where(
                (row) =>
                    row.type != type ||
                    row.payload['dedupeKey']?.toString() != dedupeKey,
              )
              .toList();
    await _write([...next, mutation]);
    return mutation;
  }

  Future<int> processPending() async {
    final remaining = <QueuedMutation>[];
    var processed = 0;
    for (final mutation in pending()) {
      try {
        await _execute(mutation);
        processed += 1;
      } catch (_) {
        remaining.add(mutation.incrementAttempts());
      }
    }
    await _write(remaining);
    return processed;
  }

  Future<void> clear() => _write(const []);

  Future<void> _write(List<QueuedMutation> values) {
    return _cache.write(queueKey, values.map((item) => item.toJson()).toList());
  }

  Future<void> _execute(QueuedMutation mutation) async {
    switch (mutation.type) {
      case 'attendance.self':
        await _dio.post(
          ApiEndpoints.teacherSelfAttendance,
          data: mutation.payload,
        );
      case 'leave.request':
        await _dio.post(ApiEndpoints.leaveApplications, data: mutation.payload);
      case 'homework.create':
        await _dio.post(ApiEndpoints.homework, data: mutation.payload);
      case 'homework.update':
        final id = mutation.payload['id']?.toString();
        if (id == null || id.isEmpty) throw StateError('Missing homework id');
        final payload = Map<String, dynamic>.from(mutation.payload)
          ..remove('id');
        await _dio.patch('${ApiEndpoints.homework}/$id', data: payload);
      case 'marks.submit':
        await _dio.post(ApiEndpoints.uploadMarks, data: mutation.payload);
      case 'attendance.sheet.save':
        final payload = Map<String, dynamic>.from(mutation.payload)
          ..remove('dedupeKey');
        await _dio.put(ApiEndpoints.attendanceSheet, data: payload);
      default:
        throw StateError('Unknown queued mutation type: ${mutation.type}');
    }
  }
}
