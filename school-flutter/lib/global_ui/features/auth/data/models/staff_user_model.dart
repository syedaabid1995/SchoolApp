import '../../../../core/utils/network_image_url.dart';
import '../../domain/entities/staff_user.dart';

Map<String, dynamic> _jsonMap(Object? value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) {
    return value.map((key, item) => MapEntry(key.toString(), item));
  }
  return const <String, dynamic>{};
}

class SchoolContactDetailModel extends SchoolContactDetail {
  const SchoolContactDetailModel({
    required super.id,
    required super.department,
    required super.name,
    required super.email,
    required super.contactNumber,
  });

  factory SchoolContactDetailModel.fromJson(Map<String, dynamic> json) {
    return SchoolContactDetailModel(
      id: json['id']?.toString() ?? '',
      department: json['department']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      contactNumber: json['contactNumber']?.toString() ?? '',
    );
  }
}

class SchoolProfileDetailsModel extends SchoolProfileDetails {
  const SchoolProfileDetailsModel({
    required super.id,
    required super.name,
    required super.code,
    required super.contacts,
    super.address,
    super.email,
    super.mobileNumber,
  });

  factory SchoolProfileDetailsModel.fromJson(Map<String, dynamic> json) {
    return SchoolProfileDetailsModel(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'School',
      code: json['code']?.toString() ?? '',
      address: json['address']?.toString(),
      email: json['email']?.toString(),
      mobileNumber: json['mobileNumber']?.toString(),
      contacts: (json['contacts'] as List? ?? const [])
          .map(_jsonMap)
          .where((item) => item.isNotEmpty)
          .map(SchoolContactDetailModel.fromJson)
          .toList(),
    );
  }
}

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
    super.schoolProfile,
    super.firstName,
    super.lastName,
    super.phone,
    super.mustChangePassword,
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
    final schoolProfile = _jsonMap(nestedUser['schoolProfile']);
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
      schoolName:
          schoolProfile['name']?.toString() ??
          nestedUser['schoolName']?.toString() ??
          school?['name']?.toString(),
      photoUrl: normalizeNetworkImageUrl(
        teacherProfile?['photoUrl']?.toString(),
      ),
      schoolProfile: schoolProfile.isNotEmpty
          ? SchoolProfileDetailsModel.fromJson(schoolProfile)
          : null,
      firstName: teacherProfile?['firstName']?.toString(),
      lastName: teacherProfile?['lastName']?.toString(),
      phone: teacherProfile?['phone']?.toString(),
      mustChangePassword: nestedUser['mustChangePassword'] == true,
    );
  }
}
