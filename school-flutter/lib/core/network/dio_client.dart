import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';

import '../constants/app_config.dart';
import '../storage/secure_token_storage.dart';
import 'auth_interceptor.dart';
import 'logging_interceptor.dart';

final loggerProvider = Provider<Logger>((ref) => Logger());

final rawDioProvider = Provider<Dio>((ref) {
  return Dio(
    BaseOptions(
      baseUrl: AppConfig.apiBaseUrl,
      connectTimeout: AppConfig.connectTimeout,
      receiveTimeout: AppConfig.receiveTimeout,
      headers: {'Accept': 'application/json'},
    ),
  );
});

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      baseUrl: AppConfig.apiBaseUrl,
      connectTimeout: AppConfig.connectTimeout,
      receiveTimeout: AppConfig.receiveTimeout,
      headers: {'Accept': 'application/json'},
    ),
  );
  dio.interceptors.addAll([
    AuthInterceptor(
      tokenStorage: ref.watch(secureTokenStorageProvider),
      refreshClient: ref.watch(rawDioProvider),
    ),
    StaffLoggingInterceptor(ref.watch(loggerProvider)),
  ]);
  return dio;
});
