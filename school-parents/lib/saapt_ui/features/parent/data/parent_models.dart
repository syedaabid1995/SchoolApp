class ParentUser {
  const ParentUser({
    required this.id,
    required this.email,
    this.name,
    this.schoolId,
  });

  final String id;
  final String email;
  final String? name;
  final String? schoolId;

  factory ParentUser.fromJson(Map<String, dynamic> json) {
    return ParentUser(
      id: json['id']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      name: (json['name'] ?? json['displayName'])?.toString(),
      schoolId: json['schoolId']?.toString(),
    );
  }
}

class ParentSession {
  const ParentSession({
    required this.isAuthenticated,
    this.user,
    this.mfaChallengeId,
    this.mfaMessage,
  });

  const ParentSession.unauthenticated()
    : this(isAuthenticated: false, user: null);

  const ParentSession.authenticated(ParentUser user)
    : this(isAuthenticated: true, user: user);

  const ParentSession.mfaRequired({
    required String challengeId,
    String? message,
  }) : this(
         isAuthenticated: false,
         mfaChallengeId: challengeId,
         mfaMessage: message,
       );

  final bool isAuthenticated;
  final ParentUser? user;
  final String? mfaChallengeId;
  final String? mfaMessage;

  bool get requiresMfa => mfaChallengeId != null;
}

class ParentChild {
  const ParentChild({
    required this.id,
    required this.name,
    required this.classLabel,
    required this.schoolId,
    this.rollNo,
    this.schoolName,
  });

  final String id;
  final String name;
  final String classLabel;
  final String schoolId;
  final String? rollNo;
  final String? schoolName;

  factory ParentChild.fromJson(Map<String, dynamic> json) {
    return ParentChild(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Student',
      classLabel: json['classLabel']?.toString() ?? 'Class',
      schoolId: json['schoolId']?.toString() ?? '',
      rollNo: json['rollNo']?.toString(),
      schoolName: json['schoolName']?.toString(),
    );
  }
}

class ParentProfile {
  const ParentProfile({
    required this.name,
    required this.email,
    required this.children,
    this.phone,
    this.schoolName,
  });

  final String name;
  final String email;
  final String? phone;
  final String? schoolName;
  final List<ParentChild> children;

  factory ParentProfile.fromJson(Map<String, dynamic> json) {
    return ParentProfile(
      name: json['name']?.toString() ?? 'Parent',
      email: json['email']?.toString() ?? '',
      phone: json['phone']?.toString(),
      schoolName: json['schoolName']?.toString(),
      children: (json['children'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(ParentChild.fromJson)
          .toList(),
    );
  }
}

class ParentAttendanceDay {
  const ParentAttendanceDay({
    required this.date,
    required this.status,
    this.remark,
  });

  final DateTime date;
  final String status;
  final String? remark;

  factory ParentAttendanceDay.fromJson(Map<String, dynamic> json) {
    return ParentAttendanceDay(
      date: DateTime.tryParse(json['date']?.toString() ?? '') ?? DateTime.now(),
      status: json['status']?.toString() ?? 'Present',
      remark: json['remark']?.toString(),
    );
  }
}

class ParentAttendance {
  const ParentAttendance({
    required this.calendar,
    required this.presentDays,
    required this.absentDays,
    required this.selectedDate,
    required this.mode,
    required this.sessions,
  });

  final List<ParentAttendanceDay> calendar;
  final int presentDays;
  final int absentDays;
  final DateTime selectedDate;
  final String mode;
  final List<ParentAttendanceSession> sessions;

  int get presentSessions => sessions
      .where((session) => session.status.toLowerCase() == 'present')
      .length;

  int get absentSessions => sessions
      .where((session) => session.status.toLowerCase() == 'absent')
      .length;

  int get markedSessions => sessions
      .where((session) => session.status.toLowerCase() != 'unmarked')
      .length;

  int get selectedDayPercent => markedSessions == 0
      ? 0
      : ((presentSessions / markedSessions) * 100).round();

  int get totalDays => calendar.length;

  int get attendancePercent =>
      totalDays == 0 ? 0 : ((presentDays / totalDays) * 100).round();

  factory ParentAttendance.fromJson(Map<String, dynamic> json) {
    return ParentAttendance(
      calendar: (json['calendar'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(ParentAttendanceDay.fromJson)
          .toList(),
      presentDays: int.tryParse(json['presentDays']?.toString() ?? '') ?? 0,
      absentDays: int.tryParse(json['absentDays']?.toString() ?? '') ?? 0,
      selectedDate:
          DateTime.tryParse(json['selectedDate']?.toString() ?? '') ??
          DateTime.now(),
      mode: json['mode']?.toString() ?? 'DAILY',
      sessions: (json['sessions'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(ParentAttendanceSession.fromJson)
          .toList(),
    );
  }
}

class ParentAttendanceSession {
  const ParentAttendanceSession({
    required this.id,
    required this.unitType,
    required this.mode,
    required this.label,
    required this.status,
    required this.sequence,
    this.startTime,
    this.endTime,
    this.remark,
  });

  final String id;
  final String unitType;
  final String mode;
  final String label;
  final String status;
  final int sequence;
  final String? startTime;
  final String? endTime;
  final String? remark;

  factory ParentAttendanceSession.fromJson(Map<String, dynamic> json) {
    return ParentAttendanceSession(
      id: json['id']?.toString() ?? '',
      unitType: json['unitType']?.toString() ?? 'DAY',
      mode: json['mode']?.toString() ?? 'DAILY',
      label: json['label']?.toString() ?? 'Session',
      status: json['status']?.toString() ?? 'Unmarked',
      sequence: int.tryParse(json['sequence']?.toString() ?? '') ?? 0,
      startTime: json['startTime']?.toString(),
      endTime: json['endTime']?.toString(),
      remark: json['remark']?.toString(),
    );
  }
}

class ParentResult {
  const ParentResult({
    required this.examName,
    required this.totalMarks,
    required this.totalMaxMarks,
    this.percentage,
    this.resultStatus,
  });

  final String examName;
  final num totalMarks;
  final num totalMaxMarks;
  final int? percentage;
  final String? resultStatus;

  factory ParentResult.fromJson(Map<String, dynamic> json) {
    return ParentResult(
      examName: json['examName']?.toString() ?? 'Exam',
      totalMarks: num.tryParse(json['totalMarks']?.toString() ?? '') ?? 0,
      totalMaxMarks: num.tryParse(json['totalMaxMarks']?.toString() ?? '') ?? 0,
      percentage: int.tryParse(json['percentage']?.toString() ?? ''),
      resultStatus: json['resultStatus']?.toString(),
    );
  }
}

class ParentNotice {
  const ParentNotice({
    required this.id,
    required this.title,
    required this.summary,
    required this.date,
  });

  final String id;
  final String title;
  final String summary;
  final DateTime date;

  factory ParentNotice.fromJson(Map<String, dynamic> json) {
    return ParentNotice(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Notice',
      summary: json['summary']?.toString() ?? '',
      date: DateTime.tryParse(json['date']?.toString() ?? '') ?? DateTime.now(),
    );
  }
}

class ParentFeeSummary {
  const ParentFeeSummary({
    required this.total,
    required this.paid,
    required this.due,
  });

  final num total;
  final num paid;
  final num due;

  factory ParentFeeSummary.fromJson(Map<String, dynamic> json) {
    final summary = json['summary'] is Map<String, dynamic>
        ? json['summary'] as Map<String, dynamic>
        : const <String, dynamic>{};
    return ParentFeeSummary(
      total: num.tryParse(summary['total']?.toString() ?? '') ?? 0,
      paid: num.tryParse(summary['paid']?.toString() ?? '') ?? 0,
      due: num.tryParse(summary['due']?.toString() ?? '') ?? 0,
    );
  }
}
