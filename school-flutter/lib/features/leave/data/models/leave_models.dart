import '../../domain/entities/leave_entities.dart';

class LeaveTypeModel extends LeaveType {
  const LeaveTypeModel({
    required super.id,
    required super.name,
    required super.totalDays,
    super.isActive,
  });

  factory LeaveTypeModel.fromJson(Map<String, dynamic> json) {
    return LeaveTypeModel(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      totalDays: _toInt(json['totalDays']),
      isActive: json['isActive'] != false,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'totalDays': totalDays,
    'isActive': isActive,
  };
}

class LeaveBalanceModel extends LeaveBalance {
  const LeaveBalanceModel({
    required super.leaveType,
    required super.totalDays,
    required super.usedDays,
    required super.remainingDays,
    required super.extraTakenDays,
  });

  factory LeaveBalanceModel.fromJson(Map<String, dynamic> json) {
    final type = json['leaveType'] is Map<String, dynamic>
        ? json['leaveType'] as Map<String, dynamic>
        : const <String, dynamic>{};
    return LeaveBalanceModel(
      leaveType: LeaveTypeModel.fromJson(type),
      totalDays: _toInt(json['totalDays']),
      usedDays: _toInt(json['usedDays']),
      remainingDays: _toInt(json['remainingDays']),
      extraTakenDays: _toInt(json['extraTakenDays']),
    );
  }

  Map<String, dynamic> toJson() => {
    'leaveType':
        (leaveType as LeaveTypeModel?)?.toJson() ??
        {
          'id': leaveType.id,
          'name': leaveType.name,
          'totalDays': leaveType.totalDays,
          'isActive': leaveType.isActive,
        },
    'totalDays': totalDays,
    'usedDays': usedDays,
    'remainingDays': remainingDays,
    'extraTakenDays': extraTakenDays,
  };
}

class LeaveApplicationModel extends LeaveApplication {
  const LeaveApplicationModel({
    required super.id,
    required super.leaveTypeId,
    required super.fromDate,
    required super.toDate,
    required super.reason,
    required super.status,
    required super.durationDays,
    super.leaveType,
    super.appliedAt,
    super.reviewNote,
  });

  factory LeaveApplicationModel.fromJson(Map<String, dynamic> json) {
    final type = json['leaveType'] is Map<String, dynamic>
        ? json['leaveType'] as Map<String, dynamic>
        : null;
    return LeaveApplicationModel(
      id: json['id']?.toString() ?? '',
      leaveTypeId:
          json['leaveTypeId']?.toString() ?? type?['id']?.toString() ?? '',
      leaveType: type == null ? null : LeaveTypeModel.fromJson(type),
      fromDate: _toDate(json['fromDate']),
      toDate: _toDate(json['toDate']),
      appliedAt: _toNullableDate(json['appliedAt']),
      reason: json['reason']?.toString() ?? '',
      status: json['status']?.toString() ?? 'PENDING',
      durationDays: _toInt(json['durationDays'] ?? json['duration']),
      reviewNote: json['reviewNote']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'leaveTypeId': leaveTypeId,
    'leaveType': leaveType == null
        ? null
        : {
            'id': leaveType!.id,
            'name': leaveType!.name,
            'totalDays': leaveType!.totalDays,
            'isActive': leaveType!.isActive,
          },
    'fromDate': fromDate.toIso8601String(),
    'toDate': toDate.toIso8601String(),
    'appliedAt': appliedAt?.toIso8601String(),
    'reason': reason,
    'status': status,
    'durationDays': durationDays,
    'reviewNote': reviewNote,
  };
}

int _toInt(Object? value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value?.toString() ?? '') ?? 0;
}

DateTime _toDate(Object? value) =>
    DateTime.tryParse(value?.toString() ?? '') ??
    DateTime.fromMillisecondsSinceEpoch(0, isUtc: true);

DateTime? _toNullableDate(Object? value) {
  if (value == null) return null;
  return DateTime.tryParse(value.toString());
}
