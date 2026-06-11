import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_session.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/secure_token_store.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(
    dio: ref.watch(dioProvider),
    tokenStore: ref.watch(secureTokenStoreProvider),
  );
});

class LoginRequest {
  const LoginRequest({
    required this.schoolCode,
    required this.identifier,
    required this.password,
    required this.loginType,
    required this.rememberMe,
  });

  final String schoolCode;
  final String identifier;
  final String password;
  final String loginType;
  final bool rememberMe;

  Map<String, dynamic> toJson() {
    final trimmedIdentifier = identifier.trim();
    final isEmail = trimmedIdentifier.contains('@');
    return {
      'schoolCode': schoolCode.trim(),
      if (isEmail)
        'email': trimmedIdentifier
      else
        'username': trimmedIdentifier,
      'password': password,
      'loginType': loginType,
      'rememberMe': rememberMe,
    };
  }
}

sealed class LoginResult {
  const LoginResult();
}

class LoginSuccess extends LoginResult {
  const LoginSuccess(this.session);
  final AuthSession session;
}

class LoginMfaRequired extends LoginResult {
  const LoginMfaRequired(this.challenge);
  final MfaChallenge challenge;
}

class AuthRepository {
  const AuthRepository({required Dio dio, required TokenStore tokenStore})
    : _dio = dio,
      _tokenStore = tokenStore;

  final Dio _dio;
  final TokenStore _tokenStore;

  Future<AuthSession?> restoreSession() async {
    final session = await _tokenStore.readSession();
    if (session == null) return null;
    return hydrateSession(session);
  }

  Future<AuthSession> hydrateSession(AuthSession session) async {
    final response = await _dio.get<Map<String, dynamic>>('/users/me');
    final currentUser = AuthUser.fromJson(response.data ?? const {});
    final hydrated = session.copyWith(user: session.user.merge(currentUser));
    await _tokenStore.writeSession(hydrated);
    return hydrated;
  }

  Future<LoginResult> login(LoginRequest request) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/auth/login',
      data: request.toJson(),
    );
    final data = response.data ?? const {};

    if (data['mfaRequired'] == true) {
      return LoginMfaRequired(
        MfaChallenge(
          challengeId: data['challengeId'] as String? ?? '',
          method: data['mfaMethod'] as String? ?? 'email',
          message: data['message'] as String? ?? 'Verification required.',
          rememberMe: request.rememberMe,
        ),
      );
    }

    final issuedSession = AuthSession.fromJson(data);
    await _tokenStore.writeSession(issuedSession);
    final session = await hydrateSession(issuedSession);
    return LoginSuccess(session);
  }

  Future<AuthSession> verifyMfa(MfaChallenge challenge, String code) async {
    final isTotp = challenge.method == 'totp';
    final response = await _dio.post<Map<String, dynamic>>(
      isTotp ? '/auth/totp/verify-login' : '/auth/verify-2fa',
      data: {
        'challengeId': challenge.challengeId,
        isTotp ? 'code' : 'otp': code,
        'rememberMe': challenge.rememberMe,
      },
    );

    final issuedSession = AuthSession.fromJson(response.data ?? const {});
    await _tokenStore.writeSession(issuedSession);
    final session = await hydrateSession(issuedSession);
    return session;
  }

  Future<void> forgotPassword({
    required String schoolCode,
    required String email,
    required String loginType,
  }) {
    return _dio.post<void>(
      '/auth/forgot-password',
      data: {
        'schoolCode': schoolCode.trim(),
        'email': email.trim(),
        'loginType': loginType,
      },
    );
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
    required String confirmPassword,
  }) {
    return _dio.post<void>(
      '/auth/change-password',
      data: {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
        'confirmPassword': confirmPassword,
      },
    );
  }

  Future<void> logout() async {
    final refreshToken = await _tokenStore.readRefreshToken();
    try {
      await _dio.post<void>(
        '/auth/logout',
        options: refreshToken == null
            ? null
            : Options(headers: {'Cookie': 'refresh_token=$refreshToken'}),
      );
    } catch (_) {
      // Local logout must still complete when the revoke request fails.
    } finally {
      await _tokenStore.clear();
    }
  }
}
