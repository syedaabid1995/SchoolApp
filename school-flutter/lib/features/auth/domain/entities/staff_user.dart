import 'package:equatable/equatable.dart';

class StaffUser extends Equatable {
  const StaffUser({
    required this.id,
    required this.email,
    required this.displayName,
    required this.role,
    required this.permissionCodes,
    this.schoolId,
    this.schoolName,
    this.photoUrl,
  });

  final String id;
  final String email;
  final String displayName;
  final String? role;
  final Set<String> permissionCodes;
  final String? schoolId;
  final String? schoolName;
  final String? photoUrl;

  @override
  List<Object?> get props => [
    id,
    email,
    displayName,
    role,
    permissionCodes,
    schoolId,
    schoolName,
    photoUrl,
  ];
}
