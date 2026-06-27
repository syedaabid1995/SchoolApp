import '../entities/auth_session.dart';

abstract class AuthRepository {
  Future<AuthSession> restoreSession();
  Future<AuthSession> login({
    required String identifier,
    required String password,
    String? schoolCode,
    bool rememberMe,
  });
  Future<AuthSession> verifyMfa({
    required String challengeId,
    required String code,
    bool rememberMe,
  });
  Future<void> logout();
  Future<void> requestPasswordReset({
    required String email,
    String? schoolCode,
  });
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
    required String confirmPassword,
  });
}
