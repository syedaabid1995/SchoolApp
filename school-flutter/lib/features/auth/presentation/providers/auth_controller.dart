import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/entities/auth_session.dart';
import 'auth_providers.dart';

final authControllerProvider =
    AsyncNotifierProvider<AuthController, AuthSession>(AuthController.new);

class AuthController extends AsyncNotifier<AuthSession> {
  @override
  Future<AuthSession> build() {
    return ref.watch(authRepositoryProvider).restoreSession();
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
  }

  Future<void> logout() async {
    state = const AsyncLoading();
    await ref.read(authRepositoryProvider).logout();
    state = const AsyncData(AuthSession.unauthenticated());
  }
}
