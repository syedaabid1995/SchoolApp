import 'package:dio/dio.dart';

import '../network/failures.dart';

class UserFacingError {
  const UserFacingError({
    required this.message,
    required this.canRetry,
    this.code,
  });

  final String message;
  final bool canRetry;
  final String? code;
}

class AppErrorMapper {
  const AppErrorMapper._();

  static UserFacingError map(Object error) {
    if (error is UnauthorizedFailure) {
      return const UserFacingError(
        message: 'Your session has expired. Please sign in again.',
        canRetry: false,
        code: 'unauthorized',
      );
    }
    if (error is ValidationFailure) {
      return UserFacingError(
        message: error.message.isEmpty
            ? 'Please check the details and try again.'
            : error.message,
        canRetry: false,
        code: 'validation',
      );
    }
    if (error is NetworkFailure || error is DioException) {
      return const UserFacingError(
        message:
            'You appear to be offline. Showing saved data where available.',
        canRetry: true,
        code: 'network',
      );
    }
    if (error is ApiFailure) {
      return UserFacingError(
        message: error.statusCode == 403
            ? 'You do not have permission to perform this action.'
            : 'Something went wrong. Please try again.',
        canRetry: true,
        code: error.statusCode == 403 ? 'permission' : 'api',
      );
    }
    return const UserFacingError(
      message: 'Something went wrong. Please try again.',
      canRetry: true,
      code: 'unknown',
    );
  }
}
