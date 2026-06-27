import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../attendance/presentation/providers/attendance_providers.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../../classes/presentation/providers/class_assignment_providers.dart';
import '../../../exams/presentation/providers/exam_providers.dart';
import '../../../homework/presentation/providers/homework_providers.dart';
import '../../../leave/presentation/providers/leave_providers.dart';
import '../../../marks/presentation/providers/marks_providers.dart';
import '../../../notices/presentation/providers/notice_providers.dart';
import '../../../notifications/presentation/providers/notification_providers.dart';
import '../../../timetable/presentation/providers/timetable_providers.dart';
import '../../data/datasources/dashboard_remote_datasource.dart';
import '../../data/repositories/dashboard_repository_impl.dart';
import '../../domain/entities/dashboard_snapshot.dart';
import '../../domain/repositories/dashboard_repository.dart';

final dashboardRemoteDatasourceProvider = Provider<DashboardRemoteDatasource>((
  ref,
) {
  return DashboardRemoteDatasource(
    authRepository: ref.watch(authRepositoryProvider),
    attendanceRepository: ref.watch(attendanceRepositoryProvider),
    timetableRepository: ref.watch(timetableRepositoryProvider),
    notificationRepository: ref.watch(notificationRepositoryProvider),
    leaveRepository: ref.watch(leaveRepositoryProvider),
    noticeRepository: ref.watch(noticeRepositoryProvider),
    classAssignmentRepository: ref.watch(classAssignmentRepositoryProvider),
    homeworkRepository: ref.watch(homeworkRepositoryProvider),
    examRepository: ref.watch(examRepositoryProvider),
    marksRepository: ref.watch(marksRepositoryProvider),
  );
});

final dashboardRepositoryProvider = Provider<DashboardRepository>((ref) {
  return DashboardRepositoryImpl(ref.watch(dashboardRemoteDatasourceProvider));
});

final dashboardProvider = FutureProvider.autoDispose<DashboardSnapshot>((ref) {
  return ref.watch(dashboardRepositoryProvider).getDashboard();
});
