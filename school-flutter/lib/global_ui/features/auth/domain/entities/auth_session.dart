import 'package:equatable/equatable.dart';

import 'staff_user.dart';

enum AuthSessionStatus { unknown, unauthenticated, authenticated, mfaRequired }

class AuthSession extends Equatable {
  const AuthSession({
    required this.status,
    this.user,
    this.challengeId,
    this.mfaMethod,
    this.message,
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

  final AuthSessionStatus status;
  final StaffUser? user;
  final String? challengeId;
  final String? mfaMethod;
  final String? message;

  bool get isAuthenticated =>
      status == AuthSessionStatus.authenticated && user != null;

  @override
  List<Object?> get props => [status, user, challengeId, mfaMethod, message];
}
