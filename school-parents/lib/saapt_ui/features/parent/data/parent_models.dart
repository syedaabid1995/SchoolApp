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
    this.firstName,
    this.lastName,
    this.phone,
    this.schoolName,
  });

  final String name;
  final String email;
  final String? firstName;
  final String? lastName;
  final String? phone;
  final String? schoolName;
  final List<ParentChild> children;

  factory ParentProfile.fromJson(Map<String, dynamic> json) {
    return ParentProfile(
      name: json['name']?.toString() ?? 'Parent',
      email: json['email']?.toString() ?? '',
      firstName: json['firstName']?.toString(),
      lastName: json['lastName']?.toString(),
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

  int get leaveDays => calendar
      .where((entry) => entry.status.toLowerCase().contains('leave'))
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
    required this.examId,
    required this.examName,
    required this.totalMarks,
    required this.totalMaxMarks,
    required this.subjects,
    this.percentage,
    this.resultStatus,
    this.examType,
  });

  final String examId;
  final String examName;
  final num totalMarks;
  final num totalMaxMarks;
  final List<ParentResultSubject> subjects;
  final int? percentage;
  final String? resultStatus;
  final String? examType;

  factory ParentResult.fromJson(Map<String, dynamic> json) {
    return ParentResult(
      examId: (json['examId'] ?? json['id'])?.toString() ?? '',
      examName: (json['examName'] ?? json['name'])?.toString() ?? 'Exam',
      totalMarks: num.tryParse(json['totalMarks']?.toString() ?? '') ?? 0,
      totalMaxMarks: num.tryParse(json['totalMaxMarks']?.toString() ?? '') ?? 0,
      subjects: (json['subjects'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(ParentResultSubject.fromJson)
          .toList(),
      percentage: num.tryParse(json['percentage']?.toString() ?? '')?.round(),
      resultStatus: json['resultStatus']?.toString(),
      examType: json['examType']?.toString(),
    );
  }
}

class ParentResultSubject {
  const ParentResultSubject({
    required this.subjectId,
    required this.subjectName,
    required this.marks,
    required this.maxMarks,
    this.passMarks,
    this.grade,
  });

  final String subjectId;
  final String subjectName;
  final num marks;
  final num maxMarks;
  final num? passMarks;
  final String? grade;

  int get percentage => maxMarks == 0 ? 0 : ((marks / maxMarks) * 100).round();

  factory ParentResultSubject.fromJson(Map<String, dynamic> json) {
    return ParentResultSubject(
      subjectId: json['subjectId']?.toString() ?? '',
      subjectName: json['subjectName']?.toString() ?? 'Subject',
      marks: num.tryParse(json['marks']?.toString() ?? '') ?? 0,
      maxMarks: num.tryParse(json['maxMarks']?.toString() ?? '') ?? 0,
      passMarks: num.tryParse(json['passMarks']?.toString() ?? ''),
      grade: json['grade']?.toString(),
    );
  }
}

class ParentNotice {
  const ParentNotice({
    required this.id,
    required this.title,
    required this.summary,
    required this.date,
    this.type,
    this.status,
    this.details = const {},
  });

  final String id;
  final String title;
  final String summary;
  final DateTime date;
  final String? type;
  final String? status;
  final Map<String, dynamic> details;

  factory ParentNotice.fromJson(Map<String, dynamic> json) {
    return ParentNotice(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Notice',
      summary: json['summary']?.toString() ?? '',
      date: DateTime.tryParse(json['date']?.toString() ?? '') ?? DateTime.now(),
      type: json['type']?.toString(),
      status: json['status']?.toString(),
      details: json['details'] is Map<String, dynamic>
          ? json['details'] as Map<String, dynamic>
          : const {},
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

class ParentLeaveRequest {
  const ParentLeaveRequest({
    required this.id,
    required this.childId,
    required this.childName,
    required this.classLabel,
    required this.leaveType,
    required this.fromDate,
    required this.toDate,
    required this.requestedDays,
    required this.workingDays,
    required this.skippedDays,
    required this.reason,
    required this.status,
    required this.createdAt,
  });

  final String id;
  final String childId;
  final String childName;
  final String classLabel;
  final String leaveType;
  final DateTime fromDate;
  final DateTime toDate;
  final int requestedDays;
  final int workingDays;
  final List<ParentLeaveSkippedDay> skippedDays;
  final String reason;
  final String status;
  final DateTime createdAt;

  factory ParentLeaveRequest.fromJson(Map<String, dynamic> json) {
    return ParentLeaveRequest(
      id: json['id']?.toString() ?? '',
      childId: json['childId']?.toString() ?? '',
      childName: json['childName']?.toString() ?? 'Student',
      classLabel: json['classLabel']?.toString() ?? 'Class',
      leaveType: json['leaveType']?.toString() ?? 'Leave',
      fromDate:
          DateTime.tryParse(json['fromDate']?.toString() ?? '') ??
          DateTime.now(),
      toDate:
          DateTime.tryParse(json['toDate']?.toString() ?? '') ?? DateTime.now(),
      requestedDays: int.tryParse(json['requestedDays']?.toString() ?? '') ?? 0,
      workingDays: int.tryParse(json['workingDays']?.toString() ?? '') ?? 0,
      skippedDays: (json['skippedDays'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(ParentLeaveSkippedDay.fromJson)
          .toList(),
      reason: json['reason']?.toString() ?? '',
      status: json['status']?.toString() ?? 'PENDING',
      createdAt:
          DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
          DateTime.now(),
    );
  }
}

class ParentLeaveSkippedDay {
  const ParentLeaveSkippedDay({
    required this.date,
    required this.reason,
    required this.type,
  });

  final DateTime date;
  final String reason;
  final String type;

  factory ParentLeaveSkippedDay.fromJson(Map<String, dynamic> json) {
    return ParentLeaveSkippedDay(
      date: DateTime.tryParse(json['date']?.toString() ?? '') ?? DateTime.now(),
      reason: json['reason']?.toString() ?? 'Non-working day',
      type: json['type']?.toString() ?? 'HOLIDAY',
    );
  }
}

class ParentLeaveCenter {
  const ParentLeaveCenter({
    required this.items,
    required this.total,
    required this.currentMonth,
    required this.leaveTypes,
  });

  final List<ParentLeaveRequest> items;
  final int total;
  final String currentMonth;
  final List<String> leaveTypes;

  factory ParentLeaveCenter.fromJson(Map<String, dynamic> json) {
    return ParentLeaveCenter(
      items: (json['items'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(ParentLeaveRequest.fromJson)
          .toList(),
      total: int.tryParse(json['total']?.toString() ?? '') ?? 0,
      currentMonth: json['currentMonth']?.toString() ?? '',
      leaveTypes: (json['leaveTypes'] as List? ?? const [])
          .map((item) => item.toString())
          .where((item) => item.trim().isNotEmpty)
          .toList(),
    );
  }
}
