sealed class AppFailure implements Exception {
  const AppFailure(this.message, {this.statusCode, this.details});

  final String message;
  final int? statusCode;
  final Object? details;

  @override
  String toString() => message;
}

class ApiFailure extends AppFailure {
  const ApiFailure(super.message, {super.statusCode, super.details});
}

class NetworkFailure extends AppFailure {
  const NetworkFailure(super.message, {super.statusCode, super.details});
}

class ValidationFailure extends AppFailure {
  const ValidationFailure(super.message, {super.statusCode, super.details});
}

class UnauthorizedFailure extends AppFailure {
  const UnauthorizedFailure(super.message, {super.statusCode, super.details});
}
