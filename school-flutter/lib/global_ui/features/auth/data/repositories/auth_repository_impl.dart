import '../../../../core/network/error_handler.dart';
import '../../../../core/storage/secure_token_storage.dart';
import '../../domain/entities/auth_session.dart';
import '../../domain/entities/staff_user.dart';
import '../../domain/repositories/auth_repository.dart';
import '../datasources/auth_remote_datasource.dart';

class AuthRepositoryImpl implements AuthRepository {
  const AuthRepositoryImpl({
    required AuthRemoteDataSource remoteDataSource,
    required SecureTokenStorage tokenStorage,
  }) : _remoteDataSource = remoteDataSource,
       _tokenStorage = tokenStorage;

  final AuthRemoteDataSource _remoteDataSource;
  final SecureTokenStorage _tokenStorage;

  @override
  Future<AuthSession> restoreSession() async {
    final token = await _tokenStorage.readAccessToken();
    if (token == null || token.isEmpty) {
      return const AuthSession.unauthenticated();
    }
    try {
      final user = await _remoteDataSource.getMe();
      return AuthSession.authenticated(user);
    } catch (_) {
      await _tokenStorage.clear();
      return const AuthSession.unauthenticated();
    }
  }

  @override
  Future<AuthSession> login({
    required String identifier,
    required String password,
    String? schoolCode,
    bool rememberMe = false,
  }) async {
    try {
      final response = await _remoteDataSource.login(
        identifier: identifier,
        password: password,
        schoolCode: schoolCode,
        rememberMe: rememberMe,
      );
      if (response.challengeId != null || response.schoolSelectionRequired) {
        return response.toSession();
      }
      final accessToken = response.accessToken;
      final refreshToken = response.refreshToken;
      final user = response.user;
      if (accessToken == null || refreshToken == null || user == null) {
        throw const AuthFailure(
          'Login response did not include a mobile session.',
        );
      }
      await _tokenStorage.saveTokens(
        accessToken: accessToken,
        refreshToken: refreshToken,
      );
      return AuthSession.authenticated(user);
    } catch (error) {
      throw ErrorHandler.fromDio(error);
    }
  }

  @override
  Future<AuthSession> verifyMfa({
    required String challengeId,
    required String code,
    bool rememberMe = false,
  }) async {
    try {
      final response = await _remoteDataSource.verifyMfa(
        challengeId: challengeId,
        code: code,
        rememberMe: rememberMe,
      );
      final accessToken = response.accessToken;
      final refreshToken = response.refreshToken;
      final user = response.user;
      if (accessToken == null || refreshToken == null || user == null) {
        throw const AuthFailure(
          'Verification response did not include a mobile session.',
        );
      }
      await _tokenStorage.saveTokens(
        accessToken: accessToken,
        refreshToken: refreshToken,
      );
      return AuthSession.authenticated(user);
    } catch (error) {
      throw ErrorHandler.fromDio(error);
    }
  }

  @override
  Future<void> logout() async {
    try {
      await _remoteDataSource.logout();
    } finally {
      await _tokenStorage.clear();
    }
  }

  @override
  Future<void> requestPasswordReset({
    required String email,
    String? schoolCode,
  }) {
    return _remoteDataSource.requestPasswordReset(
      email: email,
      schoolCode: schoolCode,
    );
  }

  @override
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
    required String confirmPassword,
  }) {
    return _remoteDataSource.changePassword(
      currentPassword: currentPassword,
      newPassword: newPassword,
      confirmPassword: confirmPassword,
    );
  }

  @override
  Future<StaffUser> updateProfile({
    required String firstName,
    required String lastName,
    required String email,
    String? phone,
  }) async {
    try {
      return await _remoteDataSource.updateProfile(
        firstName: firstName,
        lastName: lastName,
        email: email,
        phone: phone,
      );
    } catch (error) {
      throw ErrorHandler.fromDio(error);
    }
  }

  @override
  Future<bool> getPushEnabled() async {
    try {
      return await _remoteDataSource.getPushEnabled();
    } catch (error) {
      throw ErrorHandler.fromDio(error);
    }
  }

  @override
  Future<bool> updatePushEnabled(bool enabled) async {
    try {
      return await _remoteDataSource.updatePushEnabled(enabled);
    } catch (error) {
      throw ErrorHandler.fromDio(error);
    }
  }
}

class AuthFailure implements Exception {
  const AuthFailure(this.message);

  final String message;

  @override
  String toString() => message;
}
