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
  static const _attendanceV2ConfigCachePrefix = 'attendance.v2.config.';
  static const _attendanceV2UnitsCachePrefix = 'attendance.v2.units.';
  static const _attendanceV2SheetCachePrefix = 'attendance.v2.sheet.';

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
    AttendanceUnit? unit,
  }) async {
    try {
      return await _remote.markSelfAttendance(
        status: status,
        date: date,
        unit: unit,
      );
    } catch (error) {
      final failure = ErrorHandler.toFailure(error);
      if (failure is NetworkFailure && _mutationQueue != null) {
        final record = TeacherAttendanceRecordModel(
          id: 'queued-${DateTime.now().microsecondsSinceEpoch}',
          date: date ?? DateTime.now(),
          status: status,
          overrideReason: 'Queued for sync',
          unitType: unit?.unitType ?? AttendanceUnitType.day,
          slotType: unit?.slotType,
          periodId: unit?.periodId,
          periodName: unit?.label,
          unitKey: unit?.identityPart ?? 'DAY',
        );
        await _mutationQueue.enqueue(
          type: 'attendance.self',
          payload: {
            'status': status,
            if (date != null) 'date': date.toIso8601String().split('T').first,
            if (unit != null) 'unitType': unit.unitType.value,
            if (unit?.slotType != null) 'slotType': unit!.slotType!.value,
            if (unit?.periodId != null) 'periodId': unit!.periodId,
          },
        );
        return record;
      }
      throw failure;
    }
  }

  @override
  Future<SelfAttendanceOptions> getSelfAttendanceOptions({
    DateTime? date,
  }) async {
    try {
      return await _remote.getSelfAttendanceOptions(date: date);
    } catch (error) {
      throw ErrorHandler.toFailure(error);
    }
  }

  @override
  Future<StudentAttendanceOptions> getStudentAttendanceOptions() async {
    try {
      final options = await _remote.getStudentAttendanceOptions();
      await _cache?.writeCached(_studentOptionsCacheKey, {
        'academicYears': [
          for (final item in options.academicYears)
            {'id': item.id, 'name': item.name, 'isActive': item.isActive},
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
              'classIds': item.classIds,
            },
        ],
      });
      return options;
    } catch (error) {
      final cached = _cache?.read<Map<dynamic, dynamic>>(
        _studentOptionsCacheKey,
      );
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

  @override
  Future<AttendanceConfiguration> getResolvedAttendanceConfig(
    AttendanceScopeQuery query,
  ) async {
    final cacheKey = _attendanceV2ConfigCacheKey(query);
    try {
      final config = await _remote.getResolvedAttendanceConfig(query);
      await _cache?.writeCached(cacheKey, config.toJson());
      return config;
    } catch (error) {
      final cached = _cache?.read<Map<dynamic, dynamic>>(cacheKey);
      if (cached != null) {
        return AttendanceConfigurationModel.fromJson(
          cached.map((key, value) => MapEntry(key.toString(), value)),
        );
      }
      throw ErrorHandler.toFailure(error);
    }
  }

  @override
  Future<List<AttendanceUnit>> getAttendanceUnits(
    AttendanceScopeQuery query,
  ) async {
    final cacheKey = _attendanceV2UnitsCacheKey(query);
    try {
      final units = await _remote.getAttendanceUnits(query);
      await _cache?.writeCached(cacheKey, [
        for (final unit in units) unit.toJson(),
      ]);
      return units;
    } catch (error) {
      final cached = _cache?.read<List<dynamic>>(cacheKey);
      if (cached != null) {
        return [
          for (final item in cached)
            if (item is Map)
              AttendanceUnitModel.fromJson(
                item.map((key, value) => MapEntry(key.toString(), value)),
              ),
        ];
      }
      throw ErrorHandler.toFailure(error);
    }
  }

  @override
  Future<AttendanceSheet> getAttendanceSheet(AttendanceSheetQuery query) async {
    final cacheKey = _attendanceV2SheetCacheKey(query);
    try {
      final sheet = await _remote.getAttendanceSheet(query);
      await _cache?.writeCached(cacheKey, sheet.toJson());
      return sheet;
    } catch (error) {
      final cached = _cache?.read<Map<dynamic, dynamic>>(cacheKey);
      if (cached != null) {
        return AttendanceSheetModel.fromJson(
          cached.map((key, value) => MapEntry(key.toString(), value)),
        );
      }
      throw ErrorHandler.toFailure(error);
    }
  }

  @override
  Future<AttendanceSheet> saveAttendanceSheet(
    AttendanceSheetSaveRequest request,
  ) async {
    try {
      final sheet = await _remote.saveAttendanceSheet(request);
      await _cache?.writeCached(
        _attendanceV2SheetCacheKey(request.query),
        sheet.toJson(),
      );
      return sheet;
    } catch (error) {
      final failure = ErrorHandler.toFailure(error);
      if (failure is NetworkFailure && _mutationQueue != null) {
        await _mutationQueue.enqueue(
          type: 'attendance.sheet.save',
          payload: {
            'dedupeKey': request.query.offlineKey,
            ...attendanceSheetSavePayload(request),
          },
          dedupeKey: request.query.offlineKey,
        );
      }
      throw failure;
    }
  }

  @override
  Future<AiAttendanceRecognition> recognizeAiAttendance({
    required AttendanceSheetQuery query,
    required List<AttendancePhotoUpload> photos,
  }) async {
    try {
      return await _remote.recognizeAiAttendance(query: query, photos: photos);
    } catch (error) {
      throw ErrorHandler.toFailure(error);
    }
  }

  @override
  Future<AttendanceSheetSession> lockAttendanceSheet({
    required String sessionId,
    String? reason,
  }) async {
    try {
      return await _remote.lockAttendanceSheet(
        sessionId: sessionId,
        reason: reason,
      );
    } catch (error) {
      throw ErrorHandler.toFailure(error);
    }
  }

  @override
  Future<AttendanceSheetSession> reopenAttendanceSheet({
    required String sessionId,
    String? reason,
  }) async {
    try {
      return await _remote.reopenAttendanceSheet(
        sessionId: sessionId,
        reason: reason,
      );
    } catch (error) {
      throw ErrorHandler.toFailure(error);
    }
  }

  @override
  Future<List<AttendanceConfiguration>> listAttendanceConfigurations({
    String? academicYearId,
    String? classId,
    String? sectionId,
    bool? active,
  }) async {
    try {
      return await _remote.listAttendanceConfigurations(
        academicYearId: academicYearId,
        classId: classId,
        sectionId: sectionId,
        active: active,
      );
    } catch (error) {
      throw ErrorHandler.toFailure(error);
    }
  }

  String _attendanceV2ConfigCacheKey(AttendanceScopeQuery query) =>
      '$_attendanceV2ConfigCachePrefix${query.academicYearId}.${query.classId}.${query.sectionId ?? 'none'}.${query.dateKey}';

  String _attendanceV2UnitsCacheKey(AttendanceScopeQuery query) =>
      '$_attendanceV2UnitsCachePrefix${query.academicYearId}.${query.classId}.${query.sectionId ?? 'none'}.${query.dateKey}';

  String _attendanceV2SheetCacheKey(AttendanceSheetQuery query) =>
      '$_attendanceV2SheetCachePrefix${query.offlineKey}';
}
