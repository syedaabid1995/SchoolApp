import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/parent_app_config.dart';
import '../storage/parent_token_storage.dart';

final parentRawDioProvider = Provider<Dio>((ref) {
  return Dio(
    BaseOptions(
      baseUrl: ParentAppConfig.apiBaseUrl,
      connectTimeout: ParentAppConfig.connectTimeout,
      receiveTimeout: ParentAppConfig.receiveTimeout,
      headers: const {
        'Accept': 'application/json',
        'x-client-platform': ParentAppConfig.clientPlatform,
      },
    ),
  );
});

final parentDioProvider = Provider<Dio>((ref) {
  final storage = ref.watch(parentTokenStorageProvider);
  final refreshClient = ref.watch(parentRawDioProvider);
  final dio = Dio(
    BaseOptions(
      baseUrl: ParentAppConfig.apiBaseUrl,
      connectTimeout: ParentAppConfig.connectTimeout,
      receiveTimeout: ParentAppConfig.receiveTimeout,
      headers: const {
        'Accept': 'application/json',
        'x-client-platform': ParentAppConfig.clientPlatform,
      },
    ),
  );

  Future<String?>? refreshFuture;
  Future<String?> refreshSession() async {
    final refreshToken = await storage.readRefreshToken();
    if (refreshToken == null || refreshToken.isEmpty) {
      await storage.clear();
      return null;
    }

    final response = await refreshClient.post<Map<String, dynamic>>(
      '/auth/refresh',
      data: {'refreshToken': refreshToken},
      options: Options(
        headers: {
          'Accept': 'application/json',
          'x-client-platform': ParentAppConfig.clientPlatform,
        },
      ),
    );
    final data = response.data ?? const <String, dynamic>{};
    final nextAccessToken = data['accessToken'] as String?;
    final nextRefreshToken = data['refreshToken'] as String?;
    if (nextAccessToken == null || nextRefreshToken == null) {
      await storage.clear();
      return null;
    }

    await storage.saveTokens(
      accessToken: nextAccessToken,
      refreshToken: nextRefreshToken,
    );
    return nextAccessToken;
  }

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        options.headers['x-client-platform'] = ParentAppConfig.clientPlatform;
        final token = await storage.readAccessToken();
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        final statusCode = error.response?.statusCode;
        final path = error.requestOptions.path;
        final shouldRefresh =
            statusCode == 401 && !_isParentPublicAuthPath(path);
        if (!shouldRefresh) {
          handler.next(error);
          return;
        }

        try {
          refreshFuture ??= refreshSession().whenComplete(() {
            refreshFuture = null;
          });
          final nextAccessToken = await refreshFuture;

          if (nextAccessToken == null || nextAccessToken.isEmpty) {
            handler.next(error);
            return;
          }
          final retryOptions = error.requestOptions;
          retryOptions.headers['Authorization'] = 'Bearer $nextAccessToken';
          retryOptions.headers['x-client-platform'] =
              ParentAppConfig.clientPlatform;
          final retryResponse = await refreshClient.fetch<dynamic>(
            retryOptions,
          );
          handler.resolve(retryResponse);
        } catch (_) {
          await storage.clear();
          handler.next(error);
        }
      },
    ),
  );
  return dio;
});

bool _isParentPublicAuthPath(String path) {
  final uriPath = Uri.tryParse(path)?.path ?? path;
  return uriPath.endsWith('/auth/login') ||
      uriPath.endsWith('/auth/refresh') ||
      uriPath.endsWith('/auth/forgot-password/otp') ||
      uriPath.endsWith('/auth/reset-password/otp') ||
      uriPath.endsWith('/auth/verify-2fa');
}

String parentApiError(
  Object error, [
  String fallback = 'Something went wrong',
]) {
  if (error is DioException) {
    final data = error.response?.data;
    if (data is Map) {
      final message =
          data['message'] ??
          (data['error'] is Map ? (data['error'] as Map)['message'] : null);
      if (message != null && message.toString().trim().isNotEmpty) {
        return message.toString();
      }
    }
    if (error.message != null && error.message!.trim().isNotEmpty) {
      return error.message!;
    }
  }
  return fallback;
}
