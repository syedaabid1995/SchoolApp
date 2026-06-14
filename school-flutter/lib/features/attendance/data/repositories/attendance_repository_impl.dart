import '../../../../core/network/error_handler.dart';
import '../../../../core/network/failures.dart';
import '../../../../core/storage/hive_cache_service.dart';
import '../../../../core/sync/mutation_queue_service.dart';
import '../../domain/entities/attendance_summary.dart';
import '../../domain/repositories/attendance_repository.dart';
import '../datasources/attendance_remote_datasource.dart';
import '../models/attendance_summary_model.dart';

class AttendanceRepositoryImpl implements AttendanceRepository {
  const AttendanceRepositoryImpl(
    this._remote, {
    HiveCacheService? cache,
    MutationQueueService? mutationQueue,
  }) : _cache = cache,
       _mutationQueue = mutationQueue;

  static const _summaryCacheKey = 'attendance.summary';
  static const _historyCacheKey = 'attendance.teacher.history';
  static const _studentOptionsCacheKey = 'attendance.student.options';
  static const _studentSheetCachePrefix = 'attendance.student.sheet.';

  final AttendanceRemoteDatasource _remote;
  final HiveCacheService? _cache;
  final MutationQueueService? _mutationQueue;

  @override
  Future<AttendanceSummary> getSummary({DateTime? date}) async {
    try {
      final summary = await _remote.getSummary(date: date);
      await _cache?.writeCached(_summaryCacheKey, summary.toJson());
      return summary;
    } catch (error) {
      final cached = _cache?.read<Map<dynamic, dynamic>>(_summaryCacheKey);
      if (cached != null) {
        return AttendanceSummaryModel.fromJson(
          cached.map((key, value) => MapEntry(key.toString(), value)),
        );
      }
      throw ErrorHandler.toFailure(error);
    }
  }

  @override
  Future<List<TeacherAttendanceRecord>> getTeacherHistory({
    DateTime? fromDate,
    DateTime? toDate,
  }) async {
    try {
      final records = await _remote.getTeacherHistory(
        fromDate: fromDate,
        toDate: toDate,
      );
      await _cache?.writeCached(_historyCacheKey, [
        for (final record in records) record.toJson(),
      ]);
      return records;
    } catch (error) {
      final cached = _cache?.read<List<dynamic>>(_historyCacheKey);
      if (cached != null) {
        return [
          for (final item in cached)
            if (item is Map)
              TeacherAttendanceRecordModel.fromJson(
                item.map((key, value) => MapEntry(key.toString(), value)),
              ),
        ];
      }
      throw ErrorHandler.toFailure(error);
    }
  }

  @override
  Future<TeacherAttendanceRecord> markSelfAttendance({
    required String status,
    DateTime? date,
  }) async {
    try {
      return await _remote.markSelfAttendance(status: status, date: date);
    } catch (error) {
      final failure = ErrorHandler.toFailure(error);
      if (failure is NetworkFailure && _mutationQueue != null) {
        final record = TeacherAttendanceRecordModel(
          id: 'queued-${DateTime.now().microsecondsSinceEpoch}',
          date: date ?? DateTime.now(),
          status: status,
          overrideReason: 'Queued for sync',
        );
        await _mutationQueue.enqueue(
          type: 'attendance.self',
          payload: {
            'status': status,
            if (date != null) 'date': date.toIso8601String().split('T').first,
          },
        );
        return record;
      }
      throw failure;
    }
  }

  @override
  Future<StudentAttendanceOptions> getStudentAttendanceOptions() async {
    try {
      final options = await _remote.getStudentAttendanceOptions();
      await _cache?.writeCached(_studentOptionsCacheKey, {
        'academicYears': [
          for (final item in options.academicYears)
            {
              'id': item.id,
              'name': item.name,
              'isActive': item.isActive,
            },
        ],
        'classes': [
          for (final item in options.classes)
            {
              'id': item.id,
              'name': item.name,
              'academicYearId': item.academicYearId,
            },
        ],
        'sections': [
          for (final item in options.sections)
            {
              'id': item.id,
              'name': item.name,
              'classId': item.classId,
            },
        ],
      });
      return options;
    } catch (error) {
      final cached = _cache?.read<Map<dynamic, dynamic>>(_studentOptionsCacheKey);
      if (cached != null) {
        return StudentAttendanceOptionsModel.fromJson(
          cached.map((key, value) => MapEntry(key.toString(), value)),
        );
      }
      throw ErrorHandler.toFailure(error);
    }
  }

  @override
  Future<StudentAttendanceSheet> loadStudentAttendance(
    StudentAttendanceQuery query,
  ) async {
    final cacheKey = _studentSheetCacheKey(query);
    try {
      final sheet = await _remote.loadStudentAttendance(query);
      await _cache?.writeCached(cacheKey, {
        'date': sheet.date.toIso8601String().split('T').first,
        'holiday': sheet.holiday == null
            ? null
            : {'id': sheet.holiday!.id, 'reason': sheet.holiday!.reason},
        'students': [
          for (final student in sheet.students)
            {
              'id': student.id,
              'fullName': student.fullName,
              'admissionNo': student.admissionNo,
              'rollNo': student.rollNo,
              'status': student.status,
              'note': student.note,
              'attendanceId': student.attendanceId,
            },
        ],
      });
      return sheet;
    } catch (error) {
      final cached = _cache?.read<Map<dynamic, dynamic>>(cacheKey);
      if (cached != null) {
        return StudentAttendanceSheetModel.fromJson(
          cached.map((key, value) => MapEntry(key.toString(), value)),
        );
      }
      throw ErrorHandler.toFailure(error);
    }
  }

  @override
  Future<void> saveStudentAttendance(
    StudentAttendanceSaveRequest request,
  ) async {
    try {
      await _remote.saveStudentAttendance(request);
    } catch (error) {
      throw ErrorHandler.toFailure(error);
    }
  }

  String _studentSheetCacheKey(StudentAttendanceQuery query) {
    final date = query.date.toIso8601String().split('T').first;
    return '$_studentSheetCachePrefix${query.academicSessionId}.${query.classId}.${query.sectionId}.$date';
  }
}
