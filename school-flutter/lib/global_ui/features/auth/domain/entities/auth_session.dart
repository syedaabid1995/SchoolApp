import 'package:equatable/equatable.dart';

import 'staff_user.dart';

enum AuthSessionStatus {
  unknown,
  unauthenticated,
  authenticated,
  mfaRequired,
  schoolSelectionRequired,
}

class SchoolLoginOption extends Equatable {
  const SchoolLoginOption({
    required this.id,
    required this.name,
    required this.code,
  });

  final String id;
  final String name;
  final String code;

  @override
  List<Object?> get props => [id, name, code];
}

class AuthSession extends Equatable {
  const AuthSession({
    required this.status,
    this.user,
    this.challengeId,
    this.mfaMethod,
    this.message,
    this.schoolOptions = const [],
  });

  const AuthSession.unknown() : this(status: AuthSessionStatus.unknown);
  const AuthSession.unauthenticated()
    : this(status: AuthSessionStatus.unauthenticated);
  const AuthSession.authenticated(StaffUser user)
    : this(status: AuthSessionStatus.authenticated, user: user);
  const AuthSession.mfaRequired({
    required String challengeId,
    String? method,
    String? message,
  }) : this(
         status: AuthSessionStatus.mfaRequired,
         challengeId: challengeId,
         mfaMethod: method,
         message: message,
       );
  const AuthSession.schoolSelectionRequired({
    required List<SchoolLoginOption> schools,
    String? message,
  }) : this(
         status: AuthSessionStatus.schoolSelectionRequired,
         schoolOptions: schools,
         message: message,
       );

  final AuthSessionStatus status;
  final StaffUser? user;
  final String? challengeId;
  final String? mfaMethod;
  final String? message;
  final List<SchoolLoginOption> schoolOptions;

  bool get isAuthenticated =>
      status == AuthSessionStatus.authenticated && user != null;
  bool get requiresSchoolSelection =>
      status == AuthSessionStatus.schoolSelectionRequired &&
      schoolOptions.isNotEmpty;

  @override
  List<Object?> get props => [
    status,
    user,
    challengeId,
    mfaMethod,
    message,
    schoolOptions,
  ];
}
