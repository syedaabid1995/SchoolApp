import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/dio_client.dart';
import '../../../../core/storage/hive_cache_service.dart';
import '../../data/datasources/timetable_remote_datasource.dart';
import '../../data/repositories/timetable_repository_impl.dart';
import '../../domain/entities/timetable_entry.dart';
import '../../domain/repositories/timetable_repository.dart';

final timetableRemoteDatasourceProvider = Provider<TimetableRemoteDatasource>((
  ref,
) {
  return TimetableRemoteDatasource(ref.watch(dioProvider));
});

final timetableRepositoryProvider = Provider<TimetableRepository>((ref) {
  return TimetableRepositoryImpl(
    ref.watch(timetableRemoteDatasourceProvider),
    cache: ref.watch(hiveCacheServiceProvider),
  );
});

final todayTimetableProvider = FutureProvider.autoDispose<TeacherTimetable>((
  ref,
) {
  return ref.watch(timetableRepositoryProvider).getTeacherTimetable();
});

final weeklyTimetableProvider =
    FutureProvider.autoDispose<List<TeacherTimetable>>((ref) async {
      final today = DateTime.now();
      final start = today.subtract(Duration(days: (today.weekday + 1) % 7));
      final repository = ref.watch(timetableRepositoryProvider);
      return Future.wait([
        for (var offset = 0; offset < 7; offset++)
          repository.getTeacherTimetable(
            date: start.add(Duration(days: offset)),
          ),
      ]);
    });
