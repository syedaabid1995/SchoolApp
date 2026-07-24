import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/screens/login_screen.dart';
import '../../features/auth/presentation/screens/splash_screen.dart';
import '../../features/parent/presentation/providers/parent_providers.dart';
import '../../features/parent/presentation/screens/alerts_screen.dart';
import '../../features/parent/presentation/screens/attendance_screen.dart';
import '../../features/parent/presentation/screens/home_screen.dart';
import '../../features/parent/presentation/screens/leave_screen.dart';

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
            icon: Text('🏠', style: TextStyle(fontSize: 26)),
            selectedIcon: Text('🏠', style: TextStyle(fontSize: 30)),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Text('📅', style: TextStyle(fontSize: 26)),
            selectedIcon: Text('📅', style: TextStyle(fontSize: 30)),
            label: 'Attend',
          ),
          NavigationDestination(
            icon: Text('📝', style: TextStyle(fontSize: 26)),
            selectedIcon: Text('📝', style: TextStyle(fontSize: 30)),
            label: 'Leave',
          ),
          NavigationDestination(
            icon: Text('🔔', style: TextStyle(fontSize: 26)),
            selectedIcon: Text('🔔', style: TextStyle(fontSize: 30)),
            label: 'Alerts',
          ),
        ],
      ),
    );
  }
}
