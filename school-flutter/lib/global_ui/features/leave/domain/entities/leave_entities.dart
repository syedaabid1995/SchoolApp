import 'package:equatable/equatable.dart';

class LeaveType extends Equatable {
  const LeaveType({
    required this.id,
    required this.name,
    required this.totalDays,
    this.isActive = true,
  });

  final String id;
  final String name;
  final int totalDays;
  final bool isActive;

  @override
  List<Object?> get props => [id, name, totalDays, isActive];
}

class LeaveBalance extends Equatable {
  const LeaveBalance({
    required this.leaveType,
    required this.totalDays,
    required this.usedDays,
    required this.remainingDays,
    required this.extraTakenDays,
  });

  final LeaveType leaveType;
  final int totalDays;
  final int usedDays;
  final int remainingDays;
  final int extraTakenDays;

  @override
  List<Object?> get props => [
    leaveType,
    totalDays,
    usedDays,
    remainingDays,
    extraTakenDays,
  ];
}

class LeaveApplication extends Equatable {
  const LeaveApplication({
    required this.id,
    required this.leaveTypeId,
    required this.fromDate,
    required this.toDate,
    required this.reason,
    required this.status,
    required this.durationDays,
    this.leaveType,
    this.appliedAt,
    this.reviewNote,
  });

  final String id;
  final String leaveTypeId;
  final LeaveType? leaveType;
  final DateTime fromDate;
  final DateTime toDate;
  final DateTime? appliedAt;
  final String reason;
  final String status;
  final int durationDays;
  final String? reviewNote;

  bool get canCancel => status == 'PENDING';

  @override
  List<Object?> get props => [
    id,
    leaveTypeId,
    leaveType,
    fromDate,
    toDate,
    appliedAt,
    reason,
    status,
    durationDays,
    reviewNote,
  ];
}

class LeaveHomeData extends Equatable {
  const LeaveHomeData({
    required this.balances,
    required this.types,
    required this.applications,
  });

  final List<LeaveBalance> balances;
  final List<LeaveType> types;
  final List<LeaveApplication> applications;

  int get pendingCount =>
      applications.where((item) => item.status == 'PENDING').length;

  @override
  List<Object?> get props => [balances, types, applications];
}
