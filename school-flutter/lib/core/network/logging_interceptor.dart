import 'package:dio/dio.dart';
import 'package:logger/logger.dart';

class StaffLoggingInterceptor extends Interceptor {
  StaffLoggingInterceptor(this._logger);

  final Logger _logger;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    _logger.d('${options.method} ${options.uri.path}');
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    _logger.w(
      '${err.requestOptions.method} ${err.requestOptions.uri.path} failed',
      error: err.message,
    );
    handler.next(err);
  }
}
