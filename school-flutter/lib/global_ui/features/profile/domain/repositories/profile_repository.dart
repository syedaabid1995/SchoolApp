import '../../../auth/domain/entities/staff_user.dart';

abstract class ProfileRepository {
  Future<StaffUser> getProfile();
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
  Future<void> logout();
}
