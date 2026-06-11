class StaffOption {
  const StaffOption({required this.id, required this.name});

  final String id;
  final String name;

  factory StaffOption.fromJson(Map<String, dynamic> json) {
    return StaffOption(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
    );
  }
}

class StaffListResponse {
  const StaffListResponse({
    required this.items,
    required this.page,
    required this.limit,
    required this.total,
    required this.pages,
  });

  final List<StaffMember> items;
  final int page;
  final int limit;
  final int total;
  final int pages;

  factory StaffListResponse.fromJson(Map<String, dynamic> json) {
    return StaffListResponse(
      items: (json['items'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(StaffMember.fromJson)
          .toList(),
      page: json['page'] as int? ?? 1,
      limit: json['limit'] as int? ?? 20,
      total: json['total'] as int? ?? 0,
      pages: json['pages'] as int? ?? 1,
    );
  }
}

class StaffMember {
  const StaffMember({
    required this.id,
    required this.fullName,
    required this.email,
    required this.roleName,
    this.employeeNo,
    this.firstName,
    this.lastName,
    this.phone,
    this.gender,
    this.department,
    this.designation,
    this.dateOfBirth,
    this.dateOfJoining,
    this.isActive = true,
    this.currentAddress,
    this.qualifications,
    this.experience,
    this.basicSalary,
    this.payrollStatus,
    this.attendanceStatus,
    this.attendanceNote,
  });

  final String id;
  final String fullName;
  final String email;
  final String roleName;
  final String? employeeNo;
  final String? firstName;
  final String? lastName;
  final String? phone;
  final String? gender;
  final StaffOption? department;
  final StaffOption? designation;
  final DateTime? dateOfBirth;
  final DateTime? dateOfJoining;
  final bool isActive;
  final String? currentAddress;
  final String? qualifications;
  final String? experience;
  final double? basicSalary;
  final String? payrollStatus;
  final String? attendanceStatus;
  final String? attendanceNote;

  factory StaffMember.fromJson(Map<String, dynamic> json) {
    final user = json['user'] as Map<String, dynamic>? ?? const {};
    final payrollInfo =
        json['payrollInfo'] as Map<String, dynamic>? ??
        json['payroll'] as Map<String, dynamic>? ??
        const {};
    return StaffMember(
      id: json['id'] as String? ?? '',
      fullName:
          json['fullName'] as String? ??
          '${json['firstName'] ?? ''} ${json['lastName'] ?? ''}'.trim(),
      email: user['email'] as String? ?? json['email'] as String? ?? '',
      roleName:
          json['roleName'] as String? ??
          json['role'] as String? ??
          user['roles']?.toString() ??
          'STAFF',
      employeeNo: json['employeeNo'] as String? ?? json['staffNo'] as String?,
      firstName: json['firstName'] as String?,
      lastName: json['lastName'] as String?,
      phone: json['phone'] as String?,
      gender: json['gender'] as String?,
      department: _option(json['department']),
      designation: _option(json['designation']),
      dateOfBirth: DateTime.tryParse(json['dateOfBirth'] as String? ?? ''),
      dateOfJoining: DateTime.tryParse(json['dateOfJoining'] as String? ?? ''),
      isActive: json['isActive'] as bool? ?? true,
      currentAddress:
          json['currentAddress'] as String? ?? json['address'] as String?,
      qualifications: json['qualifications'] as String?,
      experience: json['experience'] as String?,
      basicSalary: (payrollInfo['basicSalary'] as num?)?.toDouble(),
      payrollStatus: json['status'] as String?,
      attendanceStatus: json['status'] as String?,
      attendanceNote: json['note'] as String?,
    );
  }

  static StaffOption? _option(Object? value) {
    if (value is Map<String, dynamic>) return StaffOption.fromJson(value);
    return null;
  }
}

class StaffPayload {
  const StaffPayload({
    required this.email,
    required this.roleName,
    required this.firstName,
    required this.lastName,
    this.password,
    this.employeeNo,
    this.departmentId,
    this.designationId,
    this.gender,
    this.dateOfBirth,
    this.dateOfJoining,
    this.phone,
    this.currentAddress,
    this.qualifications,
    this.experience,
    this.basicSalary,
    this.paymentMode,
    this.drivingLicense,
  });

  final String email;
  final String roleName;
  final String firstName;
  final String lastName;
  final String? password;
  final String? employeeNo;
  final String? departmentId;
  final String? designationId;
  final String? gender;
  final String? dateOfBirth;
  final String? dateOfJoining;
  final String? phone;
  final String? currentAddress;
  final String? qualifications;
  final String? experience;
  final double? basicSalary;
  final String? paymentMode;
  final String? drivingLicense;

  Map<String, dynamic> toJson({bool includePassword = true}) {
    return {
      'email': email,
      'roleName': roleName,
      'firstName': firstName,
      'lastName': lastName,
      if (includePassword && password != null && password!.isNotEmpty)
        'password': password,
      if (employeeNo != null && employeeNo!.isNotEmpty)
        'employeeNo': employeeNo,
      if (departmentId != null && departmentId!.isNotEmpty)
        'departmentId': departmentId,
      if (designationId != null && designationId!.isNotEmpty)
        'designationId': designationId,
      if (gender != null && gender!.isNotEmpty) 'gender': gender,
      if (dateOfBirth != null && dateOfBirth!.isNotEmpty)
        'dateOfBirth': dateOfBirth,
      if (dateOfJoining != null && dateOfJoining!.isNotEmpty)
        'dateOfJoining': dateOfJoining,
      if (phone != null && phone!.isNotEmpty) 'phone': phone,
      if (currentAddress != null && currentAddress!.isNotEmpty)
        'currentAddress': currentAddress,
      if (qualifications != null && qualifications!.isNotEmpty)
        'qualifications': qualifications,
      if (experience != null && experience!.isNotEmpty)
        'experience': experience,
      if (drivingLicense != null && drivingLicense!.isNotEmpty)
        'drivingLicense': drivingLicense,
      if (basicSalary != null ||
          (paymentMode != null && paymentMode!.isNotEmpty))
        'payrollInfo': {
          if (basicSalary != null) 'basicSalary': basicSalary,
          if (paymentMode != null && paymentMode!.isNotEmpty)
            'paymentMode': paymentMode,
        },
    };
  }
}

class StaffAttendanceDay {
  const StaffAttendanceDay({
    required this.date,
    required this.staff,
    this.holidayReason,
  });

  final String date;
  final List<StaffMember> staff;
  final String? holidayReason;

  factory StaffAttendanceDay.fromJson(Map<String, dynamic> json) {
    final holiday = json['holiday'] as Map<String, dynamic>?;
    return StaffAttendanceDay(
      date: json['date'] as String? ?? '',
      holidayReason: holiday?['reason'] as String?,
      staff: (json['staff'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(StaffMember.fromJson)
          .toList(),
    );
  }
}

class StaffPayrollRow {
  const StaffPayrollRow({required this.staff, required this.status});

  final StaffMember staff;
  final String status;

  factory StaffPayrollRow.fromJson(Map<String, dynamic> json) {
    final staffJson = json['staff'] as Map<String, dynamic>? ?? const {};
    return StaffPayrollRow(
      staff: StaffMember.fromJson(staffJson),
      status: json['status'] as String? ?? 'NOT_GENERATED',
    );
  }
}

class StaffDefaults {
  const StaffDefaults({required this.departments, required this.designations});

  final List<StaffOption> departments;
  final List<StaffOption> designations;

  factory StaffDefaults.fromJson(Map<String, dynamic> json) {
    return StaffDefaults(
      departments: (json['departments'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(StaffOption.fromJson)
          .toList(),
      designations: (json['designations'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(StaffOption.fromJson)
          .toList(),
    );
  }
}
