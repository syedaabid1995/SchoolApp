import '../../../../core/network/error_handler.dart';
import '../../../auth/domain/entities/staff_user.dart';
import '../../../auth/domain/repositories/auth_repository.dart';
import '../../domain/repositories/profile_repository.dart';

class ProfileRepositoryImpl implements ProfileRepository {
  const ProfileRepositoryImpl(this._authRepository);

  final AuthRepository _authRepository;

  @override
  Future<StaffUser> getProfile() async {
    try {
      final session = await _authRepository.restoreSession();
      final user = session.user;
      if (user == null) {
        throw StateError('Authenticated staff session is required.');
      }
      return user;
    } catch (error) {
      throw ErrorHandler.toFailure(error);
    }
  }

  @override
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
    required String confirmPassword,
  }) {
    return _authRepository.changePassword(
      currentPassword: currentPassword,
      newPassword: newPassword,
      confirmPassword: confirmPassword,
    );
  }

  @override
  Future<void> logout() => _authRepository.logout();
}
