import '../../../../core/network/error_handler.dart';
import '../../../../core/network/failures.dart';
import '../../../../core/storage/hive_cache_service.dart';
import '../../domain/entities/timetable_entry.dart';
import '../../domain/repositories/timetable_repository.dart';
import '../datasources/timetable_remote_datasource.dart';
import '../models/timetable_model.dart';

class TimetableRepositoryImpl implements TimetableRepository {
  const TimetableRepositoryImpl(this._remote, {HiveCacheService? cache})
    : _cache = cache;

  final TimetableRemoteDatasource _remote;
  final HiveCacheService? _cache;

  @override
  Future<TeacherTimetable> getTeacherTimetable({DateTime? date}) async {
    final cacheKey = 'timetable.teacher.${date?.toIso8601String() ?? 'today'}';
    try {
      final timetable = await _remote.getTeacherTimetable(date: date);
      await _cache?.writeCached(cacheKey, timetable.toJson());
      return timetable;
    } catch (error) {
      final cached = _cache?.read<Map<dynamic, dynamic>>(cacheKey);
      if (cached != null) {
        return TeacherTimetableModel.fromJson(
          cached.map((key, value) => MapEntry(key.toString(), value)),
        );
      }
      final failure = ErrorHandler.toFailure(error);
      if (_isMissingTeacherProfile(failure)) {
        final fallbackDate = date ?? DateTime.now();
        return TeacherTimetableModel(
          date: fallbackDate,
          dayOfWeek: fallbackDate.weekday,
          entries: const [],
        );
      }
      throw failure;
    }
  }

  bool _isMissingTeacherProfile(AppFailure failure) {
    return failure is ApiFailure &&
        failure.statusCode == 404 &&
        failure.message.toLowerCase().contains('teacher profile');
  }
}
