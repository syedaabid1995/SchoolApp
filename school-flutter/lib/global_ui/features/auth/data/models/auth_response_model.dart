import '../../domain/entities/auth_session.dart';
import 'staff_user_model.dart';

class AuthResponseModel {
  const AuthResponseModel({
    this.accessToken,
    this.refreshToken,
    this.user,
    this.challengeId,
    this.mfaMethod,
    this.message,
  });

  final String? accessToken;
  final String? refreshToken;
  final StaffUserModel? user;
  final String? challengeId;
  final String? mfaMethod;
  final String? message;

  factory AuthResponseModel.fromJson(Map<String, dynamic> json) {
    return AuthResponseModel(
      accessToken: json['accessToken'] as String?,
      refreshToken: json['refreshToken'] as String?,
      user: json['user'] is Map<String, dynamic>
          ? StaffUserModel.fromJson(json['user'] as Map<String, dynamic>)
          : null,
      challengeId: (json['challengeId'] ?? json['mfaChallengeId'])?.toString(),
      mfaMethod: (json['method'] ?? json['mfaMethod'])?.toString(),
      message: json['message']?.toString(),
    );
  }

  AuthSession toSession() {
    if (challengeId != null) {
      return AuthSession.mfaRequired(
        challengeId: challengeId!,
        method: mfaMethod,
        message: message,
      );
    }
    if (user != null) return AuthSession.authenticated(user!);
    return const AuthSession.unauthenticated();
  }
}
