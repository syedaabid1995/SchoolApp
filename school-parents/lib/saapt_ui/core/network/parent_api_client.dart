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

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await storage.readAccessToken();
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401) {
          await storage.clear();
        }
        handler.next(error);
      },
    ),
  );
  return dio;
});

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
