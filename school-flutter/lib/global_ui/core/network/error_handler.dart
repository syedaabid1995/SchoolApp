import 'package:dio/dio.dart';

import 'api_exception.dart';
import 'failures.dart';

class ErrorHandler {
  const ErrorHandler._();

  static ApiException fromDio(Object error) {
    if (error is ApiException) return error;
    if (error is DioException) {
      final data = error.response?.data;
      String message = error.message ?? 'Network request failed.';
      Object? errors;
      if (data is Map<String, dynamic>) {
        message = (data['message'] ?? data['error'] ?? message).toString();
        errors = data['errors'];
      }
      return ApiException(
        message: message,
        statusCode: error.response?.statusCode,
        errors: errors,
      );
    }
    return ApiException(message: error.toString());
  }

  static AppFailure toFailure(Object error) {
    final exception = fromDio(error);
    if (exception.statusCode == 401) {
      return UnauthorizedFailure(
        exception.message,
        statusCode: exception.statusCode,
        details: exception.errors,
      );
    }
    if (exception.statusCode == 400 || exception.statusCode == 422) {
      return ValidationFailure(
        exception.message,
        statusCode: exception.statusCode,
        details: exception.errors,
      );
    }
    if (exception.statusCode == null) {
      return NetworkFailure(exception.message, details: exception.errors);
    }
    return ApiFailure(
      exception.message,
      statusCode: exception.statusCode,
      details: exception.errors,
    );
  }
}
