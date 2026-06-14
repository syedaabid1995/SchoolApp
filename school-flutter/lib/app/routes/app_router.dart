import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/attendance/presentation/screens/attendance_home_screen.dart';
import '../../features/attendance/presentation/screens/student_attendance_screen.dart';
import '../../features/auth/presentation/providers/auth_controller.dart';
import '../../features/auth/presentation/screens/login_screen.dart';
import '../../features/auth/presentation/screens/splash_screen.dart';
import '../../features/classes/presentation/screens/assigned_classes_screen.dart';
import '../../features/dashboard/presentation/screens/dashboard_screen.dart';
import '../../features/exams/presentation/screens/exam_list_screen.dart';
import '../../features/homework/presentation/screens/homework_list_screen.dart';
import '../../features/leave/presentation/screens/leave_home_screen.dart';
import '../../features/marks/presentation/screens/marks_home_screen.dart';
import '../../features/notices/presentation/screens/notice_board_screen.dart';
import '../../features/notifications/presentation/screens/notifications_screen.dart';
import '../../features/profile/presentation/screens/profile_screen.dart';
import '../../features/settings/presentation/screens/settings_screen.dart';
import '../../features/settings/presentation/screens/diagnostics_screen.dart';
import '../../features/timetable/presentation/screens/today_timetable_screen.dart';
import '../../core/permissions/permission_checker.dart';
import '../../core/permissions/permission_registry.dart';
import '../../core/widgets/access_denied_screen.dart';
import '../../core/widgets/module_landing_screen.dart';
import 'app_routes.dart';
import 'route_permission_guard.dart';
import 'router_refresh_notifier.dart';

final routerRefreshNotifierProvider = Provider<RouterRefreshNotifier>((ref) {
  final notifier = RouterRefreshNotifier();
  ref.listen(authControllerProvider, (previous, next) => notifier.refresh());
  ref.onDispose(notifier.dispose);
  return notifier;
});

final appRouterProvider = Provider<GoRouter>((ref) {
  final refreshNotifier = ref.watch(routerRefreshNotifierProvider);

  return GoRouter(
    initialLocation: AppRoutes.splash,
    refreshListenable: refreshNotifier,
    redirect: (context, state) {
      final auth = ref.read(authControllerProvider);
      final location = state.matchedLocation;
      final isSplash = location == AppRoutes.splash;
      final isLogin = location == AppRoutes.login;
      final isAccessDenied = location == AppRoutes.accessDenied;

      if (auth.isLoading && !isLogin) return AppRoutes.splash;
      final session = auth.hasValue ? auth.value : null;
      final isAuthenticated = session?.isAuthenticated ?? false;

      if (!isAuthenticated && !isLogin && !isSplash) return AppRoutes.login;
      if (isAuthenticated && (isLogin || isSplash)) return AppRoutes.attendance;
      if (!auth.isLoading && !isAuthenticated && isSplash) {
        return AppRoutes.login;
      }
      if (isAuthenticated && !isAccessDenied) {
        final checker = PermissionChecker(
          session?.user?.permissionCodes ?? const {},
        );
        final decision = evaluateRoutePermission(
          checker: checker,
          location: location,
        );
        if (!decision.allowed) {
          return Uri(
            path: AppRoutes.accessDenied,
            queryParameters: {
              'permission': ?decision.missingPermission,
              'from': state.uri.toString(),
            },
          ).toString();
        }
      }
      return null;
    },
    routes: [
      GoRoute(
        path: AppRoutes.splash,
        pageBuilder: (context, state) =>
            const NoTransitionPage(child: SplashScreen()),
      ),
      GoRoute(
        path: AppRoutes.login,
        pageBuilder: (context, state) =>
            const NoTransitionPage(child: LoginScreen()),
      ),
      ShellRoute(
        builder: (context, state, child) => _StaffShell(child: child),
        routes: [
          GoRoute(
            path: AppRoutes.dashboard,
            builder: (context, state) => const DashboardScreen(),
          ),
          GoRoute(
            path: AppRoutes.attendance,
            builder: (context, state) => const TeacherAttendanceHomeScreen(),
          ),
          GoRoute(
            path: AppRoutes.studentAttendance,
            builder: (context, state) => const StudentAttendanceScreen(),
          ),
          GoRoute(
            path: AppRoutes.timetable,
            builder: (context, state) => const TodayTimetableScreen(),
          ),
          GoRoute(
            path: AppRoutes.notifications,
            builder: (context, state) => const NotificationsScreen(),
          ),
          GoRoute(
            path: AppRoutes.notices,
            builder: (context, state) => const NoticeBoardScreen(),
          ),
          GoRoute(
            path: AppRoutes.leave,
            builder: (context, state) => const LeaveHomeScreen(),
          ),
          GoRoute(
            path: AppRoutes.homework,
            builder: (context, state) => const HomeworkListScreen(),
          ),
          GoRoute(
            path: AppRoutes.classes,
            builder: (context, state) => const AssignedClassesScreen(),
          ),
          GoRoute(
            path: AppRoutes.exams,
            builder: (context, state) => const ExamListScreen(),
          ),
          GoRoute(
            path: AppRoutes.marks,
            builder: (context, state) => const MarksHomeScreen(),
          ),
          GoRoute(
            path: AppRoutes.profile,
            builder: (context, state) => const ProfileScreen(),
          ),
          GoRoute(
            path: AppRoutes.settings,
            builder: (context, state) => const SettingsScreen(),
          ),
          GoRoute(
            path: AppRoutes.diagnostics,
            builder: (context, state) => const DiagnosticsScreen(),
          ),
          GoRoute(
            path: AppRoutes.accessDenied,
            builder: (context, state) => AccessDeniedScreen(
              missingPermission: state.uri.queryParameters['permission'],
            ),
          ),
          for (final module in PermissionRegistry.modules.where(
            (module) => {
              AppRoutes.fees,
              AppRoutes.reports,
              AppRoutes.library,
              AppRoutes.transport,
              AppRoutes.payroll,
              AppRoutes.hr,
            }.contains(module.route),
          ))
            GoRoute(
              path: module.route,
              builder: (context, state) => ModuleLandingScreen(module: module),
            ),
        ],
      ),
    ],
  );
});

class _StaffShell extends StatelessWidget {
  const _StaffShell({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) => child;
}
