import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../global_ui/app/routes/router_refresh_notifier.dart';
import '../../../global_ui/features/auth/presentation/providers/auth_controller.dart';
import '../../features/attendance/presentation/screens/my_attendance_screen.dart';
import '../../features/auth/presentation/screens/login_screen.dart';
import '../../features/auth/presentation/screens/splash_screen.dart';
import '../../features/notifications/presentation/screens/saapt_push_notifications_screen.dart';
import '../../features/profile/presentation/screens/profile_screen.dart';
import '../../features/reports/presentation/screens/reports_screen.dart';
import '../../features/students/presentation/screens/students_screen.dart';

final _routerRefreshProvider = Provider<RouterRefreshNotifier>((ref) {
  final notifier = RouterRefreshNotifier();
  ref.listen(authControllerProvider, (_, _) => notifier.refresh());
  ref.onDispose(notifier.dispose);
  return notifier;
});

final saaptRouterProvider = Provider<GoRouter>((ref) {
  final refresh = ref.watch(_routerRefreshProvider);
  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: refresh,
    redirect: (context, state) {
      final auth = ref.read(authControllerProvider);
      final authenticated = auth.value?.isAuthenticated ?? false;
      final publicRoute =
          state.matchedLocation == '/login' ||
          state.matchedLocation == '/splash';
      if (auth.isLoading && state.matchedLocation != '/splash') {
        return '/splash';
      }
      if (!auth.isLoading && !authenticated && !publicRoute) return '/login';
      if (!auth.isLoading &&
          !authenticated &&
          state.matchedLocation == '/splash') {
        return '/login';
      }
      if (authenticated && publicRoute) return '/home';
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, _) => const SaaptSplashScreen()),
      GoRoute(path: '/login', builder: (_, _) => const SaaptLoginScreen()),
      GoRoute(
        path: '/notifications',
        builder: (_, _) => const SaaptPushNotificationsScreen(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => _SaaptShell(shell: shell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/home',
                builder: (_, _) => const MyAttendanceScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/students',
                builder: (_, _) => const SaaptStudentsScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/reports',
                builder: (_, _) => const SaaptReportsScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/profile',
                builder: (_, _) => const SaaptProfileScreen(),
              ),
            ],
          ),
        ],
      ),
    ],
  );
});

class _SaaptShell extends StatelessWidget {
  const _SaaptShell({required this.shell});

  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: shell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: shell.currentIndex,
        onDestinationSelected: (index) =>
            shell.goBranch(index, initialLocation: index == shell.currentIndex),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Icon(Icons.groups_outlined),
            selectedIcon: Icon(Icons.groups),
            label: 'Students',
          ),
          NavigationDestination(
            icon: Icon(Icons.bar_chart_outlined),
            selectedIcon: Icon(Icons.bar_chart),
            label: 'Reports',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}
