import 'package:dio/dio.dart';

import '../../../../core/constants/api_endpoints.dart';
import '../models/auth_response_model.dart';
import '../models/staff_user_model.dart';

class AuthRemoteDataSource {
  const AuthRemoteDataSource(this._dio);

  final Dio _dio;

  Future<AuthResponseModel> login({
    required String identifier,
    required String password,
    String? schoolCode,
    bool rememberMe = false,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      ApiEndpoints.login,
      data: {
        if (identifier.contains('@'))
          'email': identifier
        else
          'username': identifier,
        'password': password,
        if (schoolCode != null && schoolCode.trim().isNotEmpty)
          'schoolCode': schoolCode.trim(),
        'rememberMe': rememberMe,
      },
    );
    return AuthResponseModel.fromJson(
      response.data ?? const <String, dynamic>{},
    );
  }

  Future<AuthResponseModel> verifyMfa({
    required String challengeId,
    required String code,
    bool rememberMe = false,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      ApiEndpoints.verifyTwoFactor,
      data: {'challengeId': challengeId, 'otp': code, 'rememberMe': rememberMe},
    );
    return AuthResponseModel.fromJson(
      response.data ?? const <String, dynamic>{},
    );
  }

  Future<StaffUserModel> getMe() async {
    final response = await _dio.get<Map<String, dynamic>>(ApiEndpoints.me);
    return StaffUserModel.fromJson(response.data ?? const <String, dynamic>{});
  }

  Future<StaffUserModel> updateProfile({
    required String firstName,
    required String lastName,
    required String email,
    String? phone,
  }) async {
    final response = await _dio.patch<Map<String, dynamic>>(
      ApiEndpoints.me,
      data: {
        'firstName': firstName,
        'lastName': lastName,
        'email': email,
        'phone': phone,
      },
    );
    return StaffUserModel.fromJson(response.data ?? const <String, dynamic>{});
  }

  Future<void> logout() async {
    await _dio.post<void>(ApiEndpoints.logout);
  }

  Future<void> requestPasswordReset({
    required String email,
    String? schoolCode,
  }) async {
    await _dio.post<void>(
      ApiEndpoints.forgotPassword,
      data: {
        'email': email,
        if (schoolCode != null && schoolCode.trim().isNotEmpty)
          'schoolCode': schoolCode.trim(),
      },
    );
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
    required String confirmPassword,
  }) async {
    await _dio.post<void>(
      ApiEndpoints.changePassword,
      data: {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
        'confirmPassword': confirmPassword,
      },
    );
  }

  Future<bool> getPushEnabled() async {
    final response = await _dio.get<Map<String, dynamic>>(
      ApiEndpoints.pushPreferencesMe,
    );
    return response.data?['pushEnabled'] == true;
  }

  Future<bool> updatePushEnabled(bool enabled) async {
    final response = await _dio.patch<Map<String, dynamic>>(
      ApiEndpoints.pushPreferencesMe,
      data: {'pushEnabled': enabled},
    );
    return response.data?['pushEnabled'] == true;
  }
}
