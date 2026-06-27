import '../../../../core/utils/network_image_url.dart';
import '../../domain/entities/staff_user.dart';

class StaffUserModel extends StaffUser {
  const StaffUserModel({
    required super.id,
    required super.email,
    required super.displayName,
    required super.role,
    required super.permissionCodes,
    super.schoolId,
    super.schoolName,
    super.photoUrl,
  });

  factory StaffUserModel.fromJson(Map<String, dynamic> json) {
    final nestedUser = json['user'] is Map<String, dynamic>
        ? json['user'] as Map<String, dynamic>
        : json;
    final teacherProfile = nestedUser['teacherProfile'] is Map<String, dynamic>
        ? nestedUser['teacherProfile'] as Map<String, dynamic>
        : nestedUser['employeeProfile'] is Map<String, dynamic>
        ? nestedUser['employeeProfile'] as Map<String, dynamic>
        : null;
    final school = nestedUser['school'] is Map<String, dynamic>
        ? nestedUser['school'] as Map<String, dynamic>
        : null;
    final permissions =
        nestedUser['permissionCodes'] ?? nestedUser['permissions'];
    final role = (nestedUser['role'] ?? nestedUser['roleName'])?.toString();
    final name = (nestedUser['displayName'] ?? nestedUser['name'])?.toString();

    final resolvedName = name?.trim().isNotEmpty == true
        ? name!.trim()
        : teacherProfile != null
        ? '${teacherProfile['firstName'] ?? ''} ${teacherProfile['lastName'] ?? ''}'
              .trim()
        : (nestedUser['email'] ?? '').toString();

    return StaffUserModel(
      id: (nestedUser['id'] ?? '').toString(),
      email: (nestedUser['email'] ?? '').toString(),
      displayName: resolvedName,
      role: role,
      permissionCodes: {
        if (permissions is Iterable)
          for (final code in permissions) code.toString(),
      },
      schoolId: (nestedUser['schoolId'] ?? school?['id'])?.toString(),
      schoolName: school?['name']?.toString(),
      photoUrl: normalizeNetworkImageUrl(
        teacherProfile?['photoUrl']?.toString(),
      ),
    );
  }
}
