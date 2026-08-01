import 'package:equatable/equatable.dart';

class SchoolContactDetail extends Equatable {
  const SchoolContactDetail({
    required this.id,
    required this.department,
    required this.name,
    required this.email,
    required this.contactNumber,
  });

  final String id;
  final String department;
  final String name;
  final String email;
  final String contactNumber;

  @override
  List<Object?> get props => [id, department, name, email, contactNumber];
}

class SchoolProfileDetails extends Equatable {
  const SchoolProfileDetails({
    required this.id,
    required this.name,
    required this.code,
    required this.contacts,
    this.address,
    this.email,
    this.mobileNumber,
  });

  final String id;
  final String name;
  final String code;
  final String? address;
  final String? email;
  final String? mobileNumber;
  final List<SchoolContactDetail> contacts;

  @override
  List<Object?> get props => [
    id,
    name,
    code,
    address,
    email,
    mobileNumber,
    contacts,
  ];
}

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
    this.schoolProfile,
    this.firstName,
    this.lastName,
    this.phone,
    this.mustChangePassword = false,
  });

  final String id;
  final String email;
  final String displayName;
  final String? role;
  final Set<String> permissionCodes;
  final String? schoolId;
  final String? schoolName;
  final String? photoUrl;
  final SchoolProfileDetails? schoolProfile;
  final String? firstName;
  final String? lastName;
  final String? phone;
  final bool mustChangePassword;

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
    schoolProfile,
    firstName,
    lastName,
    phone,
    mustChangePassword,
  ];
}
