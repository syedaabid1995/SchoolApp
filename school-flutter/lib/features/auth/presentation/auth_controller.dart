import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_session.dart';
import '../data/auth_repository.dart';

final authControllerProvider = NotifierProvider<AuthController, AuthState>(
  AuthController.new,
);

class AuthController extends Notifier<AuthState> {
  @override
  AuthState build() => const AuthState.checking();

  AuthRepository get _repository => ref.read(authRepositoryProvider);

  Future<void> restoreSession() async {
    final session = await _repository.restoreSession();
    if (session == null ||
        session.refreshTokenExpiresAt.isBefore(DateTime.now())) {
      state = const AuthState.unauthenticated();
      return;
    }

    state = AuthState(status: AuthStatus.authenticated, session: session);
  }

  Future<void> login(LoginRequest request) async {
    state = state.copyWith(status: AuthStatus.checking, errorMessage: null);
    try {
      final result = await _repository.login(request);
      switch (result) {
        case LoginSuccess(:final session):
          state = AuthState(status: AuthStatus.authenticated, session: session);
        case LoginMfaRequired(:final challenge):
          state = AuthState(
            status: AuthStatus.mfaRequired,
            challenge: challenge,
          );
      }
    } catch (error) {
      state = AuthState.unauthenticated(errorMessage: _messageFromError(error));
    }
  }

  Future<void> verifyMfa(String code) async {
    final challenge = state.challenge;
    if (challenge == null) return;

    state = state.copyWith(status: AuthStatus.checking, errorMessage: null);
    try {
      final session = await _repository.verifyMfa(challenge, code);
      state = AuthState(status: AuthStatus.authenticated, session: session);
    } catch (error) {
      state = AuthState(
        status: AuthStatus.mfaRequired,
        challenge: challenge,
        errorMessage: _messageFromError(error),
      );
    }
  }

  Future<void> logout() async {
    await _repository.logout();
    state = const AuthState.unauthenticated();
  }
}

String _messageFromError(Object error) {
  if (error is DioException) {
    final data = error.response?.data;
    if (data is Map<String, dynamic>) {
      final message = data['message'] ?? data['error'];
      if (message is String && message.isNotEmpty) return message;
    }
  }
  return 'Something went wrong. Please try again.';
}
