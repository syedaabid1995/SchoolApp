import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/auth_session_events.dart';
import '../../../../core/services/notification_service.dart';
import '../../domain/entities/auth_session.dart';
import 'auth_providers.dart';

final authControllerProvider =
    AsyncNotifierProvider<AuthController, AuthSession>(AuthController.new);

class AuthController extends AsyncNotifier<AuthSession> {
  @override
  Future<AuthSession> build() async {
    ref.listen<int>(authSessionExpiredProvider, (previous, next) {
      if (previous == next) return;
      state = const AsyncData(AuthSession.unauthenticated());
    });
    final session = await ref.watch(authRepositoryProvider).restoreSession();
    _syncPushIfAuthenticated(session);
    return session;
  }

  Future<void> login({
    required String identifier,
    required String password,
    String? schoolCode,
    bool rememberMe = false,
  }) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref
          .read(authRepositoryProvider)
          .login(
            identifier: identifier,
            password: password,
            schoolCode: schoolCode,
            rememberMe: rememberMe,
          ),
    );
    _syncPushIfAuthenticated(_currentSession());
  }

  Future<void> verifyMfa({
    required String challengeId,
    required String code,
    bool rememberMe = false,
  }) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref
          .read(authRepositoryProvider)
          .verifyMfa(
            challengeId: challengeId,
            code: code,
            rememberMe: rememberMe,
          ),
    );
    _syncPushIfAuthenticated(_currentSession());
  }

  Future<void> logout() async {
    state = const AsyncLoading();
    await ref.read(authRepositoryProvider).logout();
    state = const AsyncData(AuthSession.unauthenticated());
  }

  AuthSession? _currentSession() {
    final current = state;
    return current is AsyncData<AuthSession> ? current.value : null;
  }

  void _syncPushIfAuthenticated(AuthSession? session) {
    if (session?.isAuthenticated ?? false) {
      unawaited(ref.read(notificationServiceProvider).syncDeviceToken());
    }
  }
}
