import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/attendance/presentation/screens/attendance_home_screen.dart';
import '../../features/auth/presentation/providers/auth_controller.dart';
import '../../features/auth/presentation/providers/current_permission_provider.dart';
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
import '../theme/app_breakpoints.dart';
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
      if (isAuthenticated && (isLogin || isSplash)) return AppRoutes.dashboard;
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

class _StaffShell extends ConsumerStatefulWidget {
  const _StaffShell({required this.child});

  final Widget child;

  @override
  ConsumerState<_StaffShell> createState() => _StaffShellState();
}

class _StaffShellState extends ConsumerState<_StaffShell> {
  bool _navVisible = true;
  double _lastOffset = 0;

  void _onScroll(ScrollNotification notification) {
    if (notification is ScrollUpdateNotification) {
      final delta = notification.scrollDelta ?? 0;
      final offset = notification.metrics.pixels;
      // scrolling down → hide, scrolling up or near top → show
      if (delta > 2 && offset > 80 && _navVisible) {
        setState(() => _navVisible = false);
      } else if (delta < -2 && !_navVisible) {
        setState(() => _navVisible = true);
      }
      _lastOffset = offset;
    }
    if (notification is ScrollEndNotification) {
      // Always show when scroll comes to rest near top
      if (notification.metrics.pixels < 80 && !_navVisible) {
        setState(() => _navVisible = true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final checker = ref.watch(currentPermissionCheckerProvider);
    final items = checker.visibleModules();
    final location = GoRouterState.of(context).matchedLocation;
    final index = items.indexWhere((item) => location.startsWith(item.route));
    final selectedIndex = index < 0 ? 0 : index;

    return LayoutBuilder(
      builder: (context, constraints) {
        final useRail = constraints.maxWidth >= AppBreakpoints.compact;
        if (items.isEmpty) return Scaffold(body: widget.child);

        if (useRail) {
          return Scaffold(
            body: Row(
              children: [
                SafeArea(
                  child: NavigationRail(
                    selectedIndex: selectedIndex,
                    extended: constraints.maxWidth >= AppBreakpoints.medium,
                    labelType: constraints.maxWidth >= AppBreakpoints.medium
                        ? NavigationRailLabelType.none
                        : NavigationRailLabelType.all,
                    onDestinationSelected: (nextIndex) =>
                        context.go(items[nextIndex].route),
                    destinations: [
                      for (final item in items)
                        NavigationRailDestination(
                          icon: Semantics(
                            label: item.displayName,
                            button: true,
                            child: Icon(item.icon),
                          ),
                          selectedIcon: Icon(item.activeIcon),
                          label: Text(item.displayName),
                        ),
                    ],
                  ),
                ),
                const VerticalDivider(width: 1),
                Expanded(child: widget.child),
              ],
            ),
          );
        }

        final visible = items.length > 5 ? items.sublist(0, 5) : items;

        return Scaffold(
          body: NotificationListener<ScrollNotification>(
            onNotification: (n) {
              _onScroll(n);
              return false;
            },
            child: widget.child,
          ),
          bottomNavigationBar: AnimatedSlide(
            offset: _navVisible ? Offset.zero : const Offset(0, 1.5),
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeInOut,
            child: AnimatedOpacity(
              opacity: _navVisible ? 1.0 : 0.0,
              duration: const Duration(milliseconds: 250),
              child: _FloatingNavBar(
                selectedIndex: selectedIndex,
                items: visible,
                onTap: (i) {
                  setState(() => _navVisible = true);
                  context.go(items[i].route);
                },
              ),
            ),
          ),
        );
      },
    );
  }
}

class _FloatingNavBar extends StatelessWidget {
  const _FloatingNavBar({
    required this.selectedIndex,
    required this.items,
    required this.onTap,
  });

  final int selectedIndex;
  final List<StaffModuleDefinition> items;
  final void Function(int) onTap;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        child: Container(
          height: 64,
          decoration: BoxDecoration(
            color: colorScheme.surface,
            borderRadius: BorderRadius.circular(32),
            boxShadow: [
              BoxShadow(
                color: colorScheme.shadow.withOpacity(0.12),
                blurRadius: 24,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Row(
            children: [
              for (int i = 0; i < items.length; i++)
                Expanded(
                  child: _NavItem(
                    icon: items[i].icon,
                    activeIcon: items[i].activeIcon,
                    label: items[i].displayName,
                    selected: selectedIndex == i,
                    onTap: () => onTap(i),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final IconData activeIcon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return Semantics(
      label: label,
      button: true,
      selected: selected,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeInOut,
          margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
          padding: const EdgeInsets.symmetric(horizontal: 8),
          decoration: selected
              ? BoxDecoration(
                  color: colorScheme.primaryContainer,
                  borderRadius: BorderRadius.circular(24),
                )
              : null,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                selected ? activeIcon : icon,
                size: 22,
                color: selected
                    ? colorScheme.onPrimaryContainer
                    : colorScheme.onSurface.withOpacity(0.50),
              ),
              const SizedBox(height: 2),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: textTheme.labelSmall?.copyWith(
                  fontSize: 10,
                  fontWeight:
                      selected ? FontWeight.w600 : FontWeight.w400,
                  color: selected
                      ? colorScheme.onPrimaryContainer
                      : colorScheme.onSurface.withOpacity(0.50),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
