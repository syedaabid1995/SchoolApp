import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/dio_client.dart';
import '../../../../core/storage/hive_cache_service.dart';
import '../../../../core/sync/mutation_queue_service.dart';
import '../../../../core/sync/sync_manager.dart';
import '../../data/datasources/attendance_remote_datasource.dart';
import '../../data/repositories/attendance_repository_impl.dart';
import '../../domain/entities/attendance_summary.dart';
import '../../domain/repositories/attendance_repository.dart';

final attendanceRemoteDatasourceProvider = Provider<AttendanceRemoteDatasource>(
  (ref) {
    return AttendanceRemoteDatasource(ref.watch(dioProvider));
  },
);

final attendanceRepositoryProvider = Provider<AttendanceRepository>((ref) {
  return AttendanceRepositoryImpl(
    ref.watch(attendanceRemoteDatasourceProvider),
    cache: ref.watch(hiveCacheServiceProvider),
    mutationQueue: ref.watch(mutationQueueServiceProvider),
  );
});

final attendanceSummaryProvider = FutureProvider.autoDispose<AttendanceSummary>(
  (ref) {
    return ref.watch(attendanceRepositoryProvider).getSummary();
  },
);

final teacherAttendanceHistoryProvider =
    FutureProvider.autoDispose<List<TeacherAttendanceRecord>>((ref) {
      final now = DateTime.now();
      return ref
          .watch(attendanceRepositoryProvider)
          .getTeacherHistory(
            fromDate: DateTime(now.year, now.month, 1),
            toDate: now,
          );
    });

final studentAttendanceOptionsProvider =
    FutureProvider.autoDispose<StudentAttendanceOptions>((ref) {
      return ref
          .watch(attendanceRepositoryProvider)
          .getStudentAttendanceOptions();
    });

final studentAttendanceSheetProvider = FutureProvider.autoDispose
    .family<StudentAttendanceSheet, StudentAttendanceQuery>((ref, query) {
      return ref
          .watch(attendanceRepositoryProvider)
          .loadStudentAttendance(query);
    });

final attendanceConfigProvider = FutureProvider.autoDispose
    .family<AttendanceConfiguration, AttendanceScopeQuery>((ref, query) {
      return ref
          .watch(attendanceRepositoryProvider)
          .getResolvedAttendanceConfig(query);
    });

final attendanceUnitsProvider = FutureProvider.autoDispose
    .family<List<AttendanceUnit>, AttendanceScopeQuery>((ref, query) {
      return ref.watch(attendanceRepositoryProvider).getAttendanceUnits(query);
    });

final attendanceSheetProvider = FutureProvider.autoDispose
    .family<AttendanceSheet, AttendanceSheetQuery>((ref, query) {
      return ref.watch(attendanceRepositoryProvider).getAttendanceSheet(query);
    });

final markSelfAttendanceProvider =
    AsyncNotifierProvider<
      MarkSelfAttendanceController,
      TeacherAttendanceRecord?
    >(MarkSelfAttendanceController.new);

class MarkSelfAttendanceController
    extends AsyncNotifier<TeacherAttendanceRecord?> {
  @override
  Future<TeacherAttendanceRecord?> build() async => null;

  Future<void> mark(String status) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref
          .read(attendanceRepositoryProvider)
          .markSelfAttendance(status: status),
    );
    ref.invalidate(attendanceSummaryProvider);
    ref.invalidate(teacherAttendanceHistoryProvider);
    try {
      await ref.read(syncManagerProvider.notifier).refreshPendingCount();
    } catch (_) {
      // Pending badges are best-effort and must not fail attendance actions.
    }
  }
}

final saveStudentAttendanceProvider =
    AsyncNotifierProvider<SaveStudentAttendanceController, void>(
      SaveStudentAttendanceController.new,
    );

class SaveStudentAttendanceController extends AsyncNotifier<void> {
  @override
  Future<void> build() async {}

  Future<void> save(StudentAttendanceSaveRequest request) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () =>
          ref.read(attendanceRepositoryProvider).saveStudentAttendance(request),
    );
    ref.invalidate(attendanceSummaryProvider);
    ref.invalidate(studentAttendanceSheetProvider(request.query));
  }
}

final saveAttendanceProvider =
    AsyncNotifierProvider<SaveAttendanceController, AttendanceSheet?>(
      SaveAttendanceController.new,
    );

class SaveAttendanceController extends AsyncNotifier<AttendanceSheet?> {
  @override
  Future<AttendanceSheet?> build() async => null;

  Future<void> save(AttendanceSheetSaveRequest request) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(attendanceRepositoryProvider).saveAttendanceSheet(request),
    );
    ref.invalidate(attendanceSummaryProvider);
    ref.invalidate(attendanceSheetProvider(request.query));
    try {
      await ref.read(syncManagerProvider.notifier).refreshPendingCount();
    } catch (_) {
      // Pending badges are best-effort and must not fail attendance actions.
    }
  }
}

final lockAttendanceSheetProvider =
    AsyncNotifierProvider<
      LockAttendanceSheetController,
      AttendanceSheetSession?
    >(LockAttendanceSheetController.new);

class LockAttendanceSheetController
    extends AsyncNotifier<AttendanceSheetSession?> {
  @override
  Future<AttendanceSheetSession?> build() async => null;

  Future<void> lock({
    required String sessionId,
    required AttendanceSheetQuery query,
    String? reason,
  }) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref
          .read(attendanceRepositoryProvider)
          .lockAttendanceSheet(sessionId: sessionId, reason: reason),
    );
    ref.invalidate(attendanceSheetProvider(query));
    ref.invalidate(attendanceSummaryProvider);
  }
}

final reopenAttendanceSheetProvider =
    AsyncNotifierProvider<
      ReopenAttendanceSheetController,
      AttendanceSheetSession?
    >(ReopenAttendanceSheetController.new);

class ReopenAttendanceSheetController
    extends AsyncNotifier<AttendanceSheetSession?> {
  @override
  Future<AttendanceSheetSession?> build() async => null;

  Future<void> reopen({
    required String sessionId,
    required AttendanceSheetQuery query,
    String? reason,
  }) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref
          .read(attendanceRepositoryProvider)
          .reopenAttendanceSheet(sessionId: sessionId, reason: reason),
    );
    ref.invalidate(attendanceSheetProvider(query));
    ref.invalidate(attendanceSummaryProvider);
  }
}
