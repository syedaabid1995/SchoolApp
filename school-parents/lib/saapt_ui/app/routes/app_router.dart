import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/screens/force_change_password_screen.dart';
import '../../features/auth/presentation/screens/forgot_password_screen.dart';
import '../../features/auth/presentation/screens/login_screen.dart';
import '../../features/auth/presentation/screens/splash_screen.dart';
import '../../features/parent/presentation/providers/parent_providers.dart';
import '../../features/parent/presentation/screens/alerts_screen.dart';
import '../../features/parent/presentation/screens/attendance_screen.dart';
import '../../features/parent/presentation/screens/home_screen.dart';
import '../../features/parent/presentation/screens/homework_screen.dart';
import '../../features/parent/presentation/screens/leave_screen.dart';
import '../../features/parent/presentation/screens/profile_screen.dart';
import '../../features/parent/presentation/screens/reports_screen.dart';

class _RouterRefreshNotifier extends ChangeNotifier {
  void refresh() => notifyListeners();
}

final _routerRefreshProvider = Provider<_RouterRefreshNotifier>((ref) {
  final notifier = _RouterRefreshNotifier();
  ref.listen(parentAuthControllerProvider, (_, _) => notifier.refresh());
  ref.onDispose(notifier.dispose);
  return notifier;
});

final saaptRouterProvider = Provider<GoRouter>((ref) {
  final refresh = ref.watch(_routerRefreshProvider);
  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: refresh,
    redirect: (context, state) {
      final auth = ref.read(parentAuthControllerProvider);
      final session = auth.value;
      final authenticated = session?.isAuthenticated ?? false;
      final mustChangePassword = session?.mustChangePassword ?? false;
      final publicRoute =
          state.matchedLocation == '/login' ||
          state.matchedLocation == '/forgot-password' ||
          state.matchedLocation == '/splash';
      final changePasswordRoute = state.matchedLocation == '/change-password';
      if (auth.isLoading && !publicRoute) {
        return '/splash';
      }
      if (!auth.isLoading && !authenticated && !publicRoute) return '/login';
      if (!auth.isLoading &&
          !authenticated &&
          state.matchedLocation == '/splash') {
        return '/login';
      }
      if (authenticated && mustChangePassword && !changePasswordRoute) {
        return '/change-password';
      }
      if (authenticated && publicRoute) {
        return mustChangePassword ? '/change-password' : '/home';
      }
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, _) => const SaaptSplashScreen()),
      GoRoute(path: '/login', builder: (_, _) => const SaaptLoginScreen()),
      GoRoute(
        path: '/forgot-password',
        builder: (_, _) => const SaaptForgotPasswordScreen(),
      ),
      GoRoute(
        path: '/change-password',
        builder: (_, _) => const SaaptForceChangePasswordScreen(),
      ),
      GoRoute(
        path: '/profile',
        builder: (_, state) => ParentProfileScreen(
          initialChildId: state.uri.queryParameters['childId'],
          initialTabKey: state.uri.queryParameters['tab'],
        ),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => _SaaptShell(shell: shell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/home',
                builder: (_, _) => const ParentHomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/attendance',
                builder: (_, _) => const ParentAttendanceScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/leave',
                builder: (_, _) => const ParentLeaveScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/homework',
                builder: (_, _) => const ParentHomeworkScreen(),
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
                path: '/alerts',
                builder: (_, _) => const ParentAlertsScreen(),
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
            icon: Text('🏠', style: TextStyle(fontSize: 22)),
            selectedIcon: Text('🏠', style: TextStyle(fontSize: 24)),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Text('📅', style: TextStyle(fontSize: 22)),
            selectedIcon: Text('📅', style: TextStyle(fontSize: 24)),
            label: 'Attend',
          ),
          NavigationDestination(
            icon: Text('📝', style: TextStyle(fontSize: 22)),
            selectedIcon: Text('📝', style: TextStyle(fontSize: 24)),
            label: 'Leave',
          ),
          NavigationDestination(
            icon: Text('📚', style: TextStyle(fontSize: 22)),
            selectedIcon: Text('📚', style: TextStyle(fontSize: 24)),
            label: 'Homework',
          ),
          NavigationDestination(
            icon: Text('📊', style: TextStyle(fontSize: 22)),
            selectedIcon: Text('📊', style: TextStyle(fontSize: 24)),
            label: 'Reports',
          ),
          NavigationDestination(
            icon: Text('🔔', style: TextStyle(fontSize: 22)),
            selectedIcon: Text('🔔', style: TextStyle(fontSize: 24)),
            label: 'Alerts',
          ),
        ],
      ),
    );
  }
}
