import 'package:dio/dio.dart';

import '../../../core/storage/parent_token_storage.dart';
import 'parent_models.dart';

class ParentRepository {
  const ParentRepository({
    required Dio dio,
    required ParentTokenStorage tokenStorage,
  }) : _dio = dio,
       _tokenStorage = tokenStorage;

  final Dio _dio;
  final ParentTokenStorage _tokenStorage;

  Future<ParentSession> restoreSession() async {
    final token = await _tokenStorage.readAccessToken();
    if (token == null || token.isEmpty) {
      return const ParentSession.unauthenticated();
    }
    try {
      final profile = await getProfile();
      return ParentSession.authenticated(
        ParentUser(
          id: '',
          email: profile.email,
          name: profile.name,
          schoolId: profile.children.firstOrNull?.schoolId,
        ),
      );
    } catch (_) {
      await _tokenStorage.clear();
      return const ParentSession.unauthenticated();
    }
  }

  Future<ParentSession> login({
    required String email,
    required String password,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/auth/login',
      data: {
        'email': email,
        'password': password,
        'loginType': 'parent',
        'rememberMe': true,
      },
    );
    final data = response.data ?? const <String, dynamic>{};
    final challengeId = (data['challengeId'] ?? data['mfaChallengeId'])
        ?.toString();
    if (challengeId != null && challengeId.isNotEmpty) {
      return ParentSession.mfaRequired(
        challengeId: challengeId,
        message: data['message']?.toString(),
      );
    }

    final accessToken = data['accessToken']?.toString();
    final refreshToken = data['refreshToken']?.toString();
    final userJson = data['user'] is Map<String, dynamic>
        ? data['user'] as Map<String, dynamic>
        : const <String, dynamic>{};
    if (accessToken == null || refreshToken == null || userJson.isEmpty) {
      throw Exception(
        'Login response did not include a parent mobile session.',
      );
    }
    await _tokenStorage.saveTokens(
      accessToken: accessToken,
      refreshToken: refreshToken,
    );
    return ParentSession.authenticated(ParentUser.fromJson(userJson));
  }

  Future<ParentSession> verifyMfa({
    required String challengeId,
    required String code,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/auth/verify-2fa',
      data: {'challengeId': challengeId, 'otp': code, 'rememberMe': true},
    );
    final data = response.data ?? const <String, dynamic>{};
    final accessToken = data['accessToken']?.toString();
    final refreshToken = data['refreshToken']?.toString();
    final userJson = data['user'] is Map<String, dynamic>
        ? data['user'] as Map<String, dynamic>
        : const <String, dynamic>{};
    if (accessToken == null || refreshToken == null || userJson.isEmpty) {
      throw Exception(
        'Verification response did not include a parent mobile session.',
      );
    }
    await _tokenStorage.saveTokens(
      accessToken: accessToken,
      refreshToken: refreshToken,
    );
    return ParentSession.authenticated(ParentUser.fromJson(userJson));
  }

  Future<void> logout() async {
    try {
      await _dio.post<void>('/auth/logout');
    } finally {
      await _tokenStorage.clear();
    }
  }

  Future<ParentProfile> getProfile() async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/parents/portal/profile',
    );
    return ParentProfile.fromJson(response.data ?? const <String, dynamic>{});
  }

  Future<List<ParentChild>> getChildren() async {
    final response = await _dio.get<List<dynamic>>('/parents/portal/children');
    return (response.data ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(ParentChild.fromJson)
        .toList();
  }

  Future<ParentAttendance> getAttendance({
    required String childId,
    required DateTime month,
  }) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/parents/portal/attendance',
      queryParameters: {
        'childId': childId,
        'month':
            '${month.year.toString().padLeft(4, '0')}-${month.month.toString().padLeft(2, '0')}',
      },
    );
    return ParentAttendance.fromJson(
      response.data ?? const <String, dynamic>{},
    );
  }

  Future<List<ParentResult>> getResults({required String childId}) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/parents/portal/results',
      queryParameters: {'childId': childId, 'limit': 20},
    );
    return (response.data?['items'] as List? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(ParentResult.fromJson)
        .toList();
  }

  Future<ParentFeeSummary> getFeeSummary({required String childId}) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/parents/portal/fees',
      queryParameters: {'childId': childId, 'limit': 20},
    );
    return ParentFeeSummary.fromJson(
      response.data ?? const <String, dynamic>{},
    );
  }

  Future<List<ParentNotice>> getNotices({String? childId}) async {
    final response = await _dio.get<List<dynamic>>(
      '/parents/portal/notices',
      queryParameters: {?childId: childId},
    );
    return (response.data ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(ParentNotice.fromJson)
        .toList();
  }
}
