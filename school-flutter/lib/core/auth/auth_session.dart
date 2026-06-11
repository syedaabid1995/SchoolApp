enum AuthStatus { checking, unauthenticated, mfaRequired, authenticated }

class AuthSession {
  const AuthSession({
    required this.accessToken,
    required this.refreshToken,
    required this.refreshTokenExpiresAt,
    required this.user,
    this.mustChangePassword = false,
    this.subscriptionRestricted = false,
  });

  final String accessToken;
  final String refreshToken;
  final DateTime refreshTokenExpiresAt;
  final AuthUser user;
  final bool mustChangePassword;
  final bool subscriptionRestricted;

  factory AuthSession.fromJson(Map<String, dynamic> json) {
    return AuthSession(
      accessToken: json['accessToken'] as String? ?? '',
      refreshToken: json['refreshToken'] as String? ?? '',
      refreshTokenExpiresAt:
          DateTime.tryParse(json['refreshTokenExpiresAt'] as String? ?? '') ??
          DateTime.now(),
      mustChangePassword: json['mustChangePassword'] as bool? ?? false,
      subscriptionRestricted: json['subscriptionRestricted'] as bool? ?? false,
      user: AuthUser.fromJson(json['user'] as Map<String, dynamic>? ?? json),
    );
  }

  AuthSession copyWith({
    String? accessToken,
    String? refreshToken,
    DateTime? refreshTokenExpiresAt,
    AuthUser? user,
    bool? mustChangePassword,
    bool? subscriptionRestricted,
  }) {
    return AuthSession(
      accessToken: accessToken ?? this.accessToken,
      refreshToken: refreshToken ?? this.refreshToken,
      refreshTokenExpiresAt:
          refreshTokenExpiresAt ?? this.refreshTokenExpiresAt,
      user: user ?? this.user,
      mustChangePassword: mustChangePassword ?? this.mustChangePassword,
      subscriptionRestricted:
          subscriptionRestricted ?? this.subscriptionRestricted,
    );
  }

  Map<String, dynamic> toJson() => {
    'accessToken': accessToken,
    'refreshToken': refreshToken,
    'refreshTokenExpiresAt': refreshTokenExpiresAt.toIso8601String(),
    'mustChangePassword': mustChangePassword,
    'subscriptionRestricted': subscriptionRestricted,
    'user': user.toJson(),
  };
}

class AuthUser {
  const AuthUser({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    required this.schoolId,
    required this.permissions,
    this.school,
    this.employeeProfile,
  });

  final String id;
  final String name;
  final String email;
  final String? role;
  final String? schoolId;
  final List<String> permissions;
  final SchoolInfo? school;
  final EmployeeProfile? employeeProfile;

  String? get effectiveRole => employeeProfile?.roleName ?? role;

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    final permissions = json['permissions'] ?? json['permissionCodes'];
    final profile = json['employeeProfile'] ?? json['teacherProfile'];
    final displayName =
        json['displayName'] as String? ?? json['name'] as String?;

    return AuthUser(
      id: json['id'] as String? ?? '',
      name: displayName ?? json['email'] as String? ?? '',
      email: json['email'] as String? ?? '',
      role: json['role'] as String?,
      schoolId: json['schoolId'] as String?,
      permissions: (permissions as List<dynamic>? ?? const [])
          .whereType<String>()
          .toList(),
      school: json['school'] is Map<String, dynamic>
          ? SchoolInfo.fromJson(json['school'] as Map<String, dynamic>)
          : null,
      employeeProfile: profile is Map<String, dynamic>
          ? EmployeeProfile.fromJson(profile)
          : null,
    );
  }

  AuthUser merge(AuthUser other) {
    return AuthUser(
      id: other.id.isNotEmpty ? other.id : id,
      name: other.name.isNotEmpty ? other.name : name,
      email: other.email.isNotEmpty ? other.email : email,
      role: other.role ?? role,
      schoolId: other.schoolId ?? schoolId,
      permissions: other.permissions.isNotEmpty
          ? other.permissions
          : permissions,
      school: other.school ?? school,
      employeeProfile: other.employeeProfile ?? employeeProfile,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'email': email,
    'role': role,
    'schoolId': schoolId,
    'permissions': permissions,
    'school': school?.toJson(),
    'employeeProfile': employeeProfile?.toJson(),
  };
}

class SchoolInfo {
  const SchoolInfo({
    required this.id,
    required this.name,
    required this.code,
    this.status,
    this.domainUrl,
    this.subdomain,
    this.logoUrl,
  });

  final String id;
  final String name;
  final String code;
  final String? status;
  final String? domainUrl;
  final String? subdomain;
  final String? logoUrl;

  factory SchoolInfo.fromJson(Map<String, dynamic> json) {
    return SchoolInfo(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      code: json['code'] as String? ?? '',
      status: json['status'] as String?,
      domainUrl: json['domainUrl'] as String?,
      subdomain: json['subdomain'] as String?,
      logoUrl: json['logoUrl'] as String? ?? json['logo'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'code': code,
    'status': status,
    'domainUrl': domainUrl,
    'subdomain': subdomain,
    'logoUrl': logoUrl,
  };
}

class EmployeeProfile {
  const EmployeeProfile({
    required this.id,
    required this.firstName,
    required this.lastName,
    this.employeeNo,
    this.phone,
    this.address,
    this.roleName,
    this.photoUrl,
    this.isActive,
    this.departmentName,
    this.designationName,
    this.classAssignments = const [],
    this.subjectAssignments = const [],
  });

  final String id;
  final String firstName;
  final String lastName;
  final String? employeeNo;
  final String? phone;
  final String? address;
  final String? roleName;
  final String? photoUrl;
  final bool? isActive;
  final String? departmentName;
  final String? designationName;
  final List<ClassAssignment> classAssignments;
  final List<SubjectAssignment> subjectAssignments;

  String get displayName => '$firstName $lastName'.trim();

  factory EmployeeProfile.fromJson(Map<String, dynamic> json) {
    return EmployeeProfile(
      id: json['id'] as String? ?? '',
      firstName: json['firstName'] as String? ?? '',
      lastName: json['lastName'] as String? ?? '',
      employeeNo: json['employeeNo'] as String?,
      phone: json['phone'] as String?,
      address: json['address'] as String?,
      roleName: json['roleName'] as String?,
      photoUrl: json['photoUrl'] as String?,
      isActive: json['isActive'] as bool?,
      departmentName: json['department'] is Map<String, dynamic>
          ? (json['department'] as Map<String, dynamic>)['name'] as String?
          : null,
      designationName: json['designation'] is Map<String, dynamic>
          ? (json['designation'] as Map<String, dynamic>)['name'] as String?
          : null,
      classAssignments: (json['classAssignments'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(ClassAssignment.fromJson)
          .toList(),
      subjectAssignments:
          (json['subjectAssignments'] as List<dynamic>? ?? const [])
              .whereType<Map<String, dynamic>>()
              .map(SubjectAssignment.fromJson)
              .toList(),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'firstName': firstName,
    'lastName': lastName,
    'employeeNo': employeeNo,
    'phone': phone,
    'address': address,
    'roleName': roleName,
    'photoUrl': photoUrl,
    'isActive': isActive,
    'department': departmentName == null ? null : {'name': departmentName},
    'designation': designationName == null ? null : {'name': designationName},
    'classAssignments': classAssignments.map((item) => item.toJson()).toList(),
    'subjectAssignments': subjectAssignments
        .map((item) => item.toJson())
        .toList(),
  };
}

class ClassAssignment {
  const ClassAssignment({
    required this.id,
    required this.classId,
    required this.className,
    this.sectionId,
    this.sectionName,
  });

  final String id;
  final String classId;
  final String className;
  final String? sectionId;
  final String? sectionName;

  factory ClassAssignment.fromJson(Map<String, dynamic> json) {
    final classJson = json['class'] as Map<String, dynamic>?;
    final sectionJson = json['section'] as Map<String, dynamic>?;
    return ClassAssignment(
      id: json['id'] as String? ?? '',
      classId: classJson?['id'] as String? ?? json['classId'] as String? ?? '',
      className:
          classJson?['name'] as String? ?? json['className'] as String? ?? '',
      sectionId: sectionJson?['id'] as String? ?? json['sectionId'] as String?,
      sectionName:
          sectionJson?['name'] as String? ?? json['sectionName'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'class': {'id': classId, 'name': className},
    'section': sectionId == null
        ? null
        : {'id': sectionId, 'name': sectionName},
  };
}

class SubjectAssignment {
  const SubjectAssignment({
    required this.id,
    required this.subjectId,
    required this.subjectName,
    this.classId,
  });

  final String id;
  final String subjectId;
  final String subjectName;
  final String? classId;

  factory SubjectAssignment.fromJson(Map<String, dynamic> json) {
    final subjectJson = json['subject'] as Map<String, dynamic>?;
    return SubjectAssignment(
      id: json['id'] as String? ?? '',
      subjectId:
          subjectJson?['id'] as String? ?? json['subjectId'] as String? ?? '',
      subjectName:
          subjectJson?['name'] as String? ??
          json['subjectName'] as String? ??
          '',
      classId: subjectJson?['classId'] as String? ?? json['classId'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'subject': {'id': subjectId, 'name': subjectName, 'classId': classId},
  };
}

class MfaChallenge {
  const MfaChallenge({
    required this.challengeId,
    required this.method,
    required this.message,
    required this.rememberMe,
  });

  final String challengeId;
  final String method;
  final String message;
  final bool rememberMe;
}

class AuthState {
  const AuthState({
    required this.status,
    this.session,
    this.challenge,
    this.errorMessage,
  });

  const AuthState.checking() : this(status: AuthStatus.checking);

  const AuthState.unauthenticated({String? errorMessage})
    : this(status: AuthStatus.unauthenticated, errorMessage: errorMessage);

  final AuthStatus status;
  final AuthSession? session;
  final MfaChallenge? challenge;
  final String? errorMessage;

  AuthState copyWith({
    AuthStatus? status,
    AuthSession? session,
    MfaChallenge? challenge,
    String? errorMessage,
  }) {
    return AuthState(
      status: status ?? this.status,
      session: session ?? this.session,
      challenge: challenge ?? this.challenge,
      errorMessage: errorMessage,
    );
  }
}
