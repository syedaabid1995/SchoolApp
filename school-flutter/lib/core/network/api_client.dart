import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_session.dart';
import '../constants/app_config.dart';
import '../storage/secure_token_store.dart';

final dioProvider = Provider<Dio>((ref) {
  final tokenStore = ref.watch(secureTokenStoreProvider);
  final dio = Dio(
    BaseOptions(
      baseUrl: AppConfig.apiBaseUrl,
      connectTimeout: const Duration(seconds: 20),
      receiveTimeout: const Duration(seconds: 30),
      headers: const {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-client-platform': AppConfig.mobileClientHeader,
      },
    ),
  );

  dio.interceptors.add(
    QueuedInterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await tokenStore.readAccessToken();
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        final statusCode = error.response?.statusCode;
        final isRefreshRequest = error.requestOptions.path.endsWith(
          '/auth/refresh',
        );
        if (statusCode != 401 || isRefreshRequest) {
          handler.next(error);
          return;
        }

        final refreshed = await _refreshTokens(dio, tokenStore);
        if (!refreshed) {
          await tokenStore.clear();
          handler.next(error);
          return;
        }

        final token = await tokenStore.readAccessToken();
        final retryOptions = error.requestOptions;
        retryOptions.headers['Authorization'] = 'Bearer $token';
        try {
          handler.resolve(await dio.fetch<dynamic>(retryOptions));
        } on DioException catch (retryError) {
          handler.next(retryError);
        }
      },
    ),
  );

  return dio;
});

Future<bool> _refreshTokens(Dio dio, TokenStore tokenStore) async {
  final session = await tokenStore.readSession();
  if (session == null || session.refreshToken.isEmpty) return false;

  try {
    final response = await dio.post<Map<String, dynamic>>(
      '/auth/refresh',
      data: {'refreshToken': session.refreshToken},
      options: Options(headers: {'Authorization': null}),
    );
    final data = response.data;
    if (data == null ||
        data['accessToken'] == null ||
        data['refreshToken'] == null) {
      return false;
    }

    await tokenStore.writeSession(
      AuthSession(
        accessToken: data['accessToken'] as String,
        refreshToken: data['refreshToken'] as String,
        refreshTokenExpiresAt:
            DateTime.tryParse(data['refreshTokenExpiresAt'] as String? ?? '') ??
            session.refreshTokenExpiresAt,
        user: session.user,
        mustChangePassword: session.mustChangePassword,
        subscriptionRestricted: session.subscriptionRestricted,
      ),
    );
    return true;
  } catch (_) {
    return false;
  }
}
