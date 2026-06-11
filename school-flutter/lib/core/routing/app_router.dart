import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/auth_controller.dart';
import '../../features/auth/presentation/forgot_password_screen.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/mfa_screen.dart';
import '../../features/dashboard/presentation/dashboard_screen.dart';
import '../../features/module/presentation/module_placeholder_screen.dart';
import '../../features/profile/presentation/profile_screen.dart';
import '../auth/auth_session.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authControllerProvider);

  return GoRouter(
    initialLocation: '/dashboard',
    redirect: (context, state) {
      final location = state.uri.path;
      final isAuthRoute =
          location == '/login' ||
          location == '/mfa' ||
          location == '/forgot-password';

      return switch (authState.status) {
        AuthStatus.checking => null,
        AuthStatus.unauthenticated => isAuthRoute ? null : '/login',
        AuthStatus.mfaRequired => location == '/mfa' ? null : '/mfa',
        AuthStatus.authenticated => isAuthRoute ? '/dashboard' : null,
      };
    },
    routes: [
      GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
      GoRoute(
        path: '/forgot-password',
        builder: (context, state) => const ForgotPasswordScreen(),
      ),
      GoRoute(path: '/mfa', builder: (context, state) => const MfaScreen()),
      GoRoute(
        path: '/dashboard',
        builder: (context, state) => const DashboardScreen(),
      ),
      GoRoute(
        path: '/profile',
        builder: (context, state) => const ProfileScreen(),
      ),
      GoRoute(
        path: '/module/:moduleKey',
        builder: (context, state) => ModulePlaceholderScreen(
          moduleKey: state.pathParameters['moduleKey'] ?? '',
        ),
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      appBar: AppBar(title: const Text('Not found')),
      body: const Center(child: Text('This screen is not available.')),
    ),
  );
});
