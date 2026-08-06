Map<String, dynamic> _jsonMap(Object? value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) {
    return value.map((key, item) => MapEntry(key.toString(), item));
  }
  return const <String, dynamic>{};
}

class ParentUser {
  const ParentUser({
    required this.id,
    required this.email,
    this.name,
    this.schoolId,
    this.mustChangePassword = false,
  });

  final String id;
  final String email;
  final String? name;
  final String? schoolId;
  final bool mustChangePassword;

  factory ParentUser.fromJson(Map<String, dynamic> json) {
    return ParentUser(
      id: json['id']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      name: (json['name'] ?? json['displayName'])?.toString(),
      schoolId: json['schoolId']?.toString(),
      mustChangePassword: json['mustChangePassword'] == true,
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
  bool get mustChangePassword => user?.mustChangePassword ?? false;
}

class ParentChild {
  const ParentChild({
    required this.id,
    required this.name,
    required this.classLabel,
    required this.schoolId,
    this.rollNo,
    this.schoolName,
    this.admissionNo,
    this.status,
    this.gender,
    this.photoUrl,
  });

  final String id;
  final String name;
  final String classLabel;
  final String schoolId;
  final String? rollNo;
  final String? schoolName;
  final String? admissionNo;
  final String? status;
  final String? gender;
  final String? photoUrl;

  factory ParentChild.fromJson(Map<String, dynamic> json) {
    return ParentChild(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Student',
      classLabel: json['classLabel']?.toString() ?? 'Class',
      schoolId: json['schoolId']?.toString() ?? '',
      rollNo: json['rollNo']?.toString() ?? json['admissionNo']?.toString(),
      schoolName: json['schoolName']?.toString(),
      admissionNo: json['admissionNo']?.toString(),
      status: json['status']?.toString(),
      gender: json['gender']?.toString(),
      photoUrl: json['photoUrl']?.toString(),
    );
  }
}

class ParentChildDetail {
  const ParentChildDetail({required this.child, required this.tabs});

  final ParentChild child;
  final Map<String, dynamic> tabs;

  factory ParentChildDetail.fromJson(Map<String, dynamic> json) {
    return ParentChildDetail(
      child: ParentChild.fromJson(_jsonMap(json['child'])),
      tabs: _jsonMap(json['tabs']),
    );
  }
}

class SchoolContactDetail {
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

  factory SchoolContactDetail.fromJson(Map<String, dynamic> json) {
    return SchoolContactDetail(
      id: json['id']?.toString() ?? '',
      department: json['department']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      contactNumber: json['contactNumber']?.toString() ?? '',
    );
  }
}

class SchoolProfileDetails {
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

  factory SchoolProfileDetails.fromJson(Map<String, dynamic> json) {
    return SchoolProfileDetails(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'School',
      code: json['code']?.toString() ?? '',
      address: json['address']?.toString(),
      email: json['email']?.toString(),
      mobileNumber: json['mobileNumber']?.toString(),
      contacts: (json['contacts'] as List? ?? const [])
          .map(_jsonMap)
          .where((item) => item.isNotEmpty)
          .map(SchoolContactDetail.fromJson)
          .toList(),
    );
  }
}

class ParentProfile {
  const ParentProfile({
    required this.name,
    required this.email,
    required this.children,
    required this.schoolProfiles,
    this.firstName,
    this.lastName,
    this.phone,
    this.schoolName,
    this.mustChangePassword = false,
  });

  final String name;
  final String email;
  final String? firstName;
  final String? lastName;
  final String? phone;
  final String? schoolName;
  final bool mustChangePassword;
  final List<ParentChild> children;
  final List<SchoolProfileDetails> schoolProfiles;

  factory ParentProfile.fromJson(Map<String, dynamic> json) {
    return ParentProfile(
      name: json['name']?.toString() ?? 'Parent',
      email: json['email']?.toString() ?? '',
      firstName: json['firstName']?.toString(),
      lastName: json['lastName']?.toString(),
      phone: json['phone']?.toString(),
      schoolName: json['schoolName']?.toString(),
      mustChangePassword: json['mustChangePassword'] == true,
      children: (json['children'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(ParentChild.fromJson)
          .toList(),
      schoolProfiles: (json['schoolProfiles'] as List? ?? const [])
          .map(_jsonMap)
          .where((item) => item.isNotEmpty)
          .map(SchoolProfileDetails.fromJson)
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
    this.overallGrade,
    this.classRank,
    this.sectionRank,
    this.classSize,
    this.sectionSize,
  });

  final String examId;
  final String examName;
  final num totalMarks;
  final num totalMaxMarks;
  final List<ParentResultSubject> subjects;
  final int? percentage;
  final String? resultStatus;
  final String? examType;
  final String? overallGrade;
  final int? classRank;
  final int? sectionRank;
  final int? classSize;
  final int? sectionSize;

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
      overallGrade: json['overallGrade']?.toString(),
      classRank: int.tryParse(json['classRank']?.toString() ?? ''),
      sectionRank: int.tryParse(json['sectionRank']?.toString() ?? ''),
      classSize: int.tryParse(json['classSize']?.toString() ?? ''),
      sectionSize: int.tryParse(json['sectionSize']?.toString() ?? ''),
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

class ParentHomework {
  const ParentHomework({
    required this.id,
    required this.classId,
    required this.sectionId,
    required this.subjectId,
    required this.homeworkDate,
    required this.submissionDate,
    required this.marks,
    required this.description,
    this.className,
    this.sectionName,
    this.subjectName,
    this.attachmentUrl,
    this.attachmentName,
  });

  final String id;
  final String classId;
  final String sectionId;
  final String subjectId;
  final DateTime homeworkDate;
  final DateTime submissionDate;
  final num marks;
  final String description;
  final String? className;
  final String? sectionName;
  final String? subjectName;
  final String? attachmentUrl;
  final String? attachmentName;

  bool get hasAttachment =>
      attachmentUrl != null && attachmentUrl!.trim().isNotEmpty;

  factory ParentHomework.fromJson(Map<String, dynamic> json) {
    final classJson = _jsonMap(json['class']);
    final sectionJson = _jsonMap(json['section']);
    final subjectJson = _jsonMap(json['subject']);
    return ParentHomework(
      id: json['id']?.toString() ?? '',
      classId: json['classId']?.toString() ?? classJson['id']?.toString() ?? '',
      sectionId:
          json['sectionId']?.toString() ?? sectionJson['id']?.toString() ?? '',
      subjectId:
          json['subjectId']?.toString() ?? subjectJson['id']?.toString() ?? '',
      homeworkDate:
          DateTime.tryParse(json['homeworkDate']?.toString() ?? '') ??
          DateTime.now(),
      submissionDate:
          DateTime.tryParse(json['submissionDate']?.toString() ?? '') ??
          DateTime.now(),
      marks: num.tryParse(json['marks']?.toString() ?? '') ?? 0,
      description: json['description']?.toString() ?? '',
      className: classJson['name']?.toString(),
      sectionName: sectionJson['name']?.toString(),
      subjectName: subjectJson['name']?.toString(),
      attachmentUrl: json['attachmentUrl']?.toString(),
      attachmentName: json['attachmentName']?.toString(),
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

class ParentFeeInvoiceItem {
  const ParentFeeInvoiceItem({
    required this.id,
    required this.title,
    required this.invoiceNumber,
    required this.allotted,
    required this.paid,
    required this.due,
    required this.status,
    this.feeType,
    this.feeMonth,
    this.dueDate,
  });

  final String id;
  final String title;
  final String invoiceNumber;
  final num allotted;
  final num paid;
  final num due;
  final String status;
  final String? feeType;
  final String? feeMonth;
  final String? dueDate;

  bool get canPay {
    final normalized = status.toUpperCase();
    return due > 0 && normalized != 'PAID' && normalized != 'CANCELLED';
  }

  factory ParentFeeInvoiceItem.fromJson(Map<String, dynamic> json) {
    final allotted =
        num.tryParse(json['amount']?.toString() ?? '') ??
        ((num.tryParse(json['totalAmount']?.toString() ?? '') ?? 0) -
            (num.tryParse(json['discountAmount']?.toString() ?? '') ?? 0));
    return ParentFeeInvoiceItem(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? 'School Fee',
      invoiceNumber: json['invoiceNumber']?.toString() ?? '',
      allotted: allotted,
      paid: num.tryParse(json['paidAmount']?.toString() ?? '') ?? 0,
      due: num.tryParse(json['dueAmount']?.toString() ?? '') ?? 0,
      status: json['status']?.toString() ?? 'ISSUED',
      feeType: json['feeType']?.toString(),
      feeMonth: json['feeMonth']?.toString(),
      dueDate: json['dueDate']?.toString(),
    );
  }
}

class ParentFeeBreakdown {
  const ParentFeeBreakdown({
    required this.summary,
    required this.items,
  });

  final ParentFeeSummary summary;
  final List<ParentFeeInvoiceItem> items;

  factory ParentFeeBreakdown.fromJson(Map<String, dynamic> json) {
    final items = (json['items'] as List? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(ParentFeeInvoiceItem.fromJson)
        .where((item) => item.id.isNotEmpty)
        .toList();
    return ParentFeeBreakdown(
      summary: ParentFeeSummary.fromJson(json),
      items: items,
    );
  }
}

class ParentFeeCheckoutLine {
  const ParentFeeCheckoutLine({
    required this.invoiceId,
    required this.title,
    required this.amount,
  });

  final String invoiceId;
  final String title;
  final num amount;
}

class ParentFeeCheckoutLink {
  const ParentFeeCheckoutLink({
    required this.paymentLinkId,
    required this.paymentUrl,
    required this.amountPaise,
    required this.currency,
    required this.description,
    required this.childName,
    this.prefillName,
    this.prefillEmail,
    this.prefillContact,
  });

  final String paymentLinkId;
  final String paymentUrl;
  final int amountPaise;
  final String currency;
  final String description;
  final String childName;
  final String? prefillName;
  final String? prefillEmail;
  final String? prefillContact;

  factory ParentFeeCheckoutLink.fromJson(Map<String, dynamic> json) {
    final paymentLink = _jsonMap(json['paymentLink']);
    final checkout = _jsonMap(json['checkout']);
    final child = _jsonMap(json['child']);
    final prefill = _jsonMap(checkout['prefill']);
    return ParentFeeCheckoutLink(
      paymentLinkId: paymentLink['id']?.toString() ?? '',
      paymentUrl: paymentLink['url']?.toString() ?? '',
      amountPaise:
          ((num.tryParse(checkout['amount']?.toString() ?? '') ?? 0) * 100)
              .round(),
      currency: checkout['currency']?.toString() ?? 'INR',
      description: checkout['description']?.toString() ?? 'Fee payment',
      childName: child['name']?.toString() ?? 'Student',
      prefillName: prefill['name']?.toString(),
      prefillEmail: prefill['email']?.toString(),
      prefillContact: prefill['contact']?.toString(),
    );
  }
}

class ParentFeePaymentLinkStatus {
  const ParentFeePaymentLinkStatus({
    required this.paid,
    required this.status,
    required this.message,
  });

  final bool paid;
  final String status;
  final String message;

  factory ParentFeePaymentLinkStatus.fromJson(Map<String, dynamic> json) {
    return ParentFeePaymentLinkStatus(
      paid: json['paid'] == true,
      status: json['status']?.toString() ?? 'processing',
      message: json['message']?.toString() ?? 'Payment is being processed.',
    );
  }
}

class ParentFeePaymentResult {
  const ParentFeePaymentResult({
    required this.message,
    required this.idempotent,
  });

  final String message;
  final bool idempotent;

  factory ParentFeePaymentResult.fromJson(Map<String, dynamic> json) {
    return ParentFeePaymentResult(
      message: json['message']?.toString() ?? 'Payment recorded.',
      idempotent: json['idempotent'] == true,
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
