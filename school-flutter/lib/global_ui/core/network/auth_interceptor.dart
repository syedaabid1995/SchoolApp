import 'package:dio/dio.dart';

import '../constants/api_endpoints.dart';
import '../constants/app_config.dart';
import '../storage/secure_token_storage.dart';

class AuthInterceptor extends Interceptor {
  AuthInterceptor({
    required SecureTokenStorage tokenStorage,
    required Dio refreshClient,
    Future<void> Function()? onSessionExpired,
  }) : _tokenStorage = tokenStorage,
       _refreshClient = refreshClient,
       _onSessionExpired = onSessionExpired;

  final SecureTokenStorage _tokenStorage;
  final Dio _refreshClient;
  final Future<void> Function()? _onSessionExpired;

  bool _isRefreshing = false;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    options.headers['x-client-platform'] = AppConfig.clientPlatform;
    final token = await _tokenStorage.readAccessToken();
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    } else if (!_isPublicAuthPath(options.path)) {
      await _notifySessionExpired();
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final statusCode = err.response?.statusCode;
    final path = err.requestOptions.path;
    final shouldRefresh =
        statusCode == 401 &&
        path != ApiEndpoints.login &&
        path != ApiEndpoints.refresh;
    if (!shouldRefresh || _isRefreshing) {
      handler.next(err);
      return;
    }

    _isRefreshing = true;
    try {
      final refreshToken = await _tokenStorage.readRefreshToken();
      if (refreshToken == null || refreshToken.isEmpty) {
        await _notifySessionExpired();
        handler.next(err);
        return;
      }

      final response = await _refreshClient.post<Map<String, dynamic>>(
        ApiEndpoints.refresh,
        data: {'refreshToken': refreshToken},
        options: Options(
          headers: {'x-client-platform': AppConfig.clientPlatform},
        ),
      );
      final data = response.data ?? const <String, dynamic>{};
      final nextAccessToken = data['accessToken'] as String?;
      final nextRefreshToken = data['refreshToken'] as String?;
      if (nextAccessToken == null || nextRefreshToken == null) {
        handler.next(err);
        return;
      }
      await _tokenStorage.saveTokens(
        accessToken: nextAccessToken,
        refreshToken: nextRefreshToken,
      );

      final retryOptions = err.requestOptions;
      retryOptions.headers['Authorization'] = 'Bearer $nextAccessToken';
      final retryResponse = await _refreshClient.fetch<dynamic>(retryOptions);
      handler.resolve(retryResponse);
    } catch (_) {
      await _tokenStorage.clear();
      await _notifySessionExpired();
      handler.next(err);
    } finally {
      _isRefreshing = false;
    }
  }

  Future<void> _notifySessionExpired() async {
    try {
      await _onSessionExpired?.call();
    } catch (_) {
      // Session navigation is best-effort and must not block the request.
    }
  }

  bool _isPublicAuthPath(String path) {
    final uriPath = Uri.tryParse(path)?.path ?? path;
    return uriPath.endsWith(ApiEndpoints.login) ||
        uriPath.endsWith(ApiEndpoints.refresh) ||
        uriPath.endsWith(ApiEndpoints.forgotPassword) ||
        uriPath.endsWith(ApiEndpoints.forgotPasswordOtp) ||
        uriPath.endsWith(ApiEndpoints.resetPasswordOtp) ||
        uriPath.endsWith(ApiEndpoints.verifyTwoFactor) ||
        uriPath.endsWith(ApiEndpoints.resendTwoFactor);
  }
}
