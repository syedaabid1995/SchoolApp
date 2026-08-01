import '../entities/auth_session.dart';
import '../entities/staff_user.dart';

abstract class AuthRepository {
  Future<AuthSession> restoreSession();
  Future<AuthSession> login({
    required String identifier,
    required String password,
    String? schoolCode,
    bool rememberMe,
  });
  Future<List<SchoolLoginOption>> listAccessibleSchools();
  Future<AuthSession> switchSchool({required String schoolId});
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
  Future<void> requestPasswordResetOtp({required String email});
  Future<void> resetPasswordWithOtp({
    required String email,
    required String otp,
    required String newPassword,
    required String confirmPassword,
  });
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
    required String confirmPassword,
  });
  Future<StaffUser> updateProfile({
    required String firstName,
    required String lastName,
    required String email,
    String? phone,
  });
  Future<bool> getPushEnabled();
  Future<bool> updatePushEnabled(bool enabled);
}
