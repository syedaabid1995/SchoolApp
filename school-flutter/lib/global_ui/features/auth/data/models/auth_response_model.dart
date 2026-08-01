import '../../domain/entities/auth_session.dart';
import 'staff_user_model.dart';

class SchoolLoginOptionModel extends SchoolLoginOption {
  const SchoolLoginOptionModel({
    required super.id,
    required super.name,
    required super.code,
  });

  factory SchoolLoginOptionModel.fromJson(Map<String, dynamic> json) {
    return SchoolLoginOptionModel(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'School',
      code: json['code']?.toString() ?? '',
    );
  }
}

class AuthResponseModel {
  const AuthResponseModel({
    this.accessToken,
    this.refreshToken,
    this.user,
    this.challengeId,
    this.mfaMethod,
    this.message,
    this.schoolSelectionRequired = false,
    this.schoolOptions = const [],
  });

  final String? accessToken;
  final String? refreshToken;
  final StaffUserModel? user;
  final String? challengeId;
  final String? mfaMethod;
  final String? message;
  final bool schoolSelectionRequired;
  final List<SchoolLoginOptionModel> schoolOptions;

  factory AuthResponseModel.fromJson(Map<String, dynamic> json) {
    final schools = json['schools'] is List
        ? json['schools'] as List
        : json['schoolOptions'] is List
        ? json['schoolOptions'] as List
        : const [];
    return AuthResponseModel(
      accessToken: json['accessToken'] as String?,
      refreshToken: json['refreshToken'] as String?,
      user: json['user'] is Map<String, dynamic>
          ? StaffUserModel.fromJson(json['user'] as Map<String, dynamic>)
          : null,
      challengeId: (json['challengeId'] ?? json['mfaChallengeId'])?.toString(),
      mfaMethod: (json['method'] ?? json['mfaMethod'])?.toString(),
      message: json['message']?.toString(),
      schoolSelectionRequired: json['schoolSelectionRequired'] == true,
      schoolOptions: schools
          .whereType<Map>()
          .map(
            (school) =>
                school.map((key, value) => MapEntry(key.toString(), value)),
          )
          .map(SchoolLoginOptionModel.fromJson)
          .where((school) => school.code.trim().isNotEmpty)
          .toList(),
    );
  }

  AuthSession toSession() {
    if (schoolSelectionRequired && schoolOptions.isNotEmpty) {
      return AuthSession.schoolSelectionRequired(
        schools: schoolOptions,
        message: message,
      );
    }
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
