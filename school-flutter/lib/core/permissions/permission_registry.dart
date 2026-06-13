import 'package:equatable/equatable.dart';
import 'package:flutter/material.dart';

import 'permission.dart';
import 'permission_codes.dart';
import 'permission_group.dart';

class StaffModuleDefinition extends Equatable {
  const StaffModuleDefinition({
    required this.id,
    required this.displayName,
    required this.route,
    required this.icon,
    required this.activeIcon,
    this.requiredPermissions = const [],
    this.requireAll = false,
  });

  final String id;
  final String displayName;
  final String route;
  final IconData icon;
  final IconData activeIcon;
  final List<String> requiredPermissions;
  final bool requireAll;

  @override
  List<Object?> get props => [
    id,
    displayName,
    route,
    icon,
    activeIcon,
    requiredPermissions,
    requireAll,
  ];
}

class PermissionActionIds {
  const PermissionActionIds._();

  static const markAttendance = 'attendance.mark';
  static const editAttendance = 'attendance.edit';
  static const generateTimetable = 'timetable.generate';
  static const publishTimetable = 'timetable.publish';
  static const approveLeave = 'leave.approve';
  static const createHomework = 'homework.create';
  static const editHomework = 'homework.edit';
  static const deleteHomework = 'homework.delete';
  static const enterMarks = 'marks.enter';
  static const updateMarks = 'marks.update';
  static const publishMarks = 'marks.publish';
  static const requestLeave = 'leave.request';
  static const cancelLeave = 'leave.cancel';
  static const deleteRecord = 'record.delete';
}

class PermissionRegistry {
  const PermissionRegistry._();

  static const modules = <StaffModuleDefinition>[
    StaffModuleDefinition(
      id: 'dashboard',
      displayName: 'Dashboard',
      route: '/dashboard',
      icon: Icons.dashboard_outlined,
      activeIcon: Icons.dashboard,
    ),
    StaffModuleDefinition(
      id: 'attendance',
      displayName: 'Attendance',
      route: '/attendance',
      icon: Icons.fact_check_outlined,
      activeIcon: Icons.fact_check,
      requiredPermissions: [
        PermissionCodes.attendanceView,
        PermissionCodes.attendanceReport,
        PermissionCodes.staffAttendanceView,
      ],
    ),
    StaffModuleDefinition(
      id: 'timetable',
      displayName: 'Timetable',
      route: '/timetable',
      icon: Icons.calendar_month_outlined,
      activeIcon: Icons.calendar_month,
      requiredPermissions: [
        PermissionCodes.timetableView,
        PermissionCodes.academicRoutineView,
        PermissionCodes.dashboardOverview,
      ],
    ),
    StaffModuleDefinition(
      id: 'fees',
      displayName: 'Fees',
      route: '/fees',
      icon: Icons.payments_outlined,
      activeIcon: Icons.payments,
      requiredPermissions: [
        PermissionCodes.feesView,
        PermissionCodes.feesCollect,
        PermissionCodes.feesCollectionView,
        PermissionCodes.feesReport,
        PermissionCodes.reportsFeesView,
      ],
    ),
    StaffModuleDefinition(
      id: 'reports',
      displayName: 'Reports',
      route: '/reports',
      icon: Icons.bar_chart_outlined,
      activeIcon: Icons.bar_chart,
      requiredPermissions: [
        PermissionCodes.reportsView,
        PermissionCodes.reportsAttendanceView,
        PermissionCodes.reportsFeesView,
        PermissionCodes.reportsPayrollView,
      ],
    ),
    StaffModuleDefinition(
      id: 'leave',
      displayName: 'Leave',
      route: '/leave',
      icon: Icons.event_available_outlined,
      activeIcon: Icons.event_available,
      requiredPermissions: [
        PermissionCodes.leaveApplyView,
        PermissionCodes.leaveBalanceView,
      ],
    ),
    StaffModuleDefinition(
      id: 'homework',
      displayName: 'Homework',
      route: '/homework',
      icon: Icons.assignment_outlined,
      activeIcon: Icons.assignment,
      requiredPermissions: [PermissionCodes.homeworkView],
    ),
    StaffModuleDefinition(
      id: 'classes',
      displayName: 'Classes',
      route: '/classes',
      icon: Icons.class_outlined,
      activeIcon: Icons.class_,
      requiredPermissions: [
        PermissionCodes.timetableView,
        PermissionCodes.attendanceView,
        PermissionCodes.homeworkView,
        PermissionCodes.dashboardOverview,
      ],
    ),
    StaffModuleDefinition(
      id: 'notices',
      displayName: 'Notices',
      route: '/notices',
      icon: Icons.campaign_outlined,
      activeIcon: Icons.campaign,
    ),
    StaffModuleDefinition(
      id: 'exams',
      displayName: 'Exams',
      route: '/exams',
      icon: Icons.school_outlined,
      activeIcon: Icons.school,
      requiredPermissions: [
        PermissionCodes.academicsExams,
        PermissionCodes.examInvigilatorView,
      ],
    ),
    StaffModuleDefinition(
      id: 'marks',
      displayName: 'Marks',
      route: '/marks',
      icon: Icons.grading_outlined,
      activeIcon: Icons.grading,
      requiredPermissions: [PermissionCodes.academicsMarks],
    ),
    StaffModuleDefinition(
      id: 'library',
      displayName: 'Library',
      route: '/library',
      icon: Icons.local_library_outlined,
      activeIcon: Icons.local_library,
      requiredPermissions: [PermissionCodes.libraryView],
    ),
    StaffModuleDefinition(
      id: 'transport',
      displayName: 'Transport',
      route: '/transport',
      icon: Icons.directions_bus_outlined,
      activeIcon: Icons.directions_bus,
      requiredPermissions: [PermissionCodes.transportView],
    ),
    StaffModuleDefinition(
      id: 'payroll',
      displayName: 'Payroll',
      route: '/payroll',
      icon: Icons.account_balance_wallet_outlined,
      activeIcon: Icons.account_balance_wallet,
      requiredPermissions: [
        PermissionCodes.payrollView,
        PermissionCodes.payrollReport,
      ],
    ),
    StaffModuleDefinition(
      id: 'hr',
      displayName: 'HR',
      route: '/hr',
      icon: Icons.groups_outlined,
      activeIcon: Icons.groups,
      requiredPermissions: [
        PermissionCodes.staffView,
        PermissionCodes.staffAttendanceView,
      ],
    ),
    StaffModuleDefinition(
      id: 'notifications',
      displayName: 'Notifications',
      route: '/notifications',
      icon: Icons.notifications_outlined,
      activeIcon: Icons.notifications,
    ),
    StaffModuleDefinition(
      id: 'profile',
      displayName: 'Profile',
      route: '/profile',
      icon: Icons.person_outline,
      activeIcon: Icons.person,
    ),
    StaffModuleDefinition(
      id: 'settings',
      displayName: 'Settings',
      route: '/settings',
      icon: Icons.settings_outlined,
      activeIcon: Icons.settings,
    ),
  ];

  static const actions = <String, PermissionAction>{
    PermissionActionIds.markAttendance: PermissionAction(
      id: PermissionActionIds.markAttendance,
      label: 'Mark Attendance',
      requiredPermissions: [
        PermissionCodes.attendanceCreate,
        PermissionCodes.staffAttendanceCreate,
      ],
    ),
    PermissionActionIds.editAttendance: PermissionAction(
      id: PermissionActionIds.editAttendance,
      label: 'Edit Attendance',
      requiredPermissions: [
        PermissionCodes.attendanceEdit,
        PermissionCodes.staffAttendanceEdit,
      ],
    ),
    PermissionActionIds.generateTimetable: PermissionAction(
      id: PermissionActionIds.generateTimetable,
      label: 'Generate Timetable',
      requiredPermissions: [PermissionCodes.academicRoutineCreate],
    ),
    PermissionActionIds.publishTimetable: PermissionAction(
      id: PermissionActionIds.publishTimetable,
      label: 'Publish Timetable',
      requiredPermissions: [PermissionCodes.academicRoutineEdit],
    ),
    PermissionActionIds.approveLeave: PermissionAction(
      id: PermissionActionIds.approveLeave,
      label: 'Approve Leave',
      requiredPermissions: ['leave.approve.edit', 'leave.approve.delete'],
    ),
    PermissionActionIds.createHomework: PermissionAction(
      id: PermissionActionIds.createHomework,
      label: 'Create Homework',
      requiredPermissions: [
        PermissionCodes.homeworkCreate,
        PermissionCodes.homeworkView,
      ],
    ),
    PermissionActionIds.editHomework: PermissionAction(
      id: PermissionActionIds.editHomework,
      label: 'Edit Homework',
      requiredPermissions: [
        PermissionCodes.homeworkEdit,
        PermissionCodes.homeworkView,
      ],
    ),
    PermissionActionIds.deleteHomework: PermissionAction(
      id: PermissionActionIds.deleteHomework,
      label: 'Delete Homework',
      requiredPermissions: [
        PermissionCodes.homeworkDelete,
        PermissionCodes.homeworkView,
      ],
    ),
    PermissionActionIds.enterMarks: PermissionAction(
      id: PermissionActionIds.enterMarks,
      label: 'Enter Marks',
      requiredPermissions: [PermissionCodes.marksCreate],
    ),
    PermissionActionIds.updateMarks: PermissionAction(
      id: PermissionActionIds.updateMarks,
      label: 'Update Marks',
      requiredPermissions: [PermissionCodes.marksUpdate],
    ),
    PermissionActionIds.publishMarks: PermissionAction(
      id: PermissionActionIds.publishMarks,
      label: 'Publish Marks',
      requiredPermissions: [PermissionCodes.marksPublish],
    ),
    PermissionActionIds.requestLeave: PermissionAction(
      id: PermissionActionIds.requestLeave,
      label: 'Request Leave',
      requiredPermissions: [PermissionCodes.leaveApplyCreate],
    ),
    PermissionActionIds.cancelLeave: PermissionAction(
      id: PermissionActionIds.cancelLeave,
      label: 'Cancel Leave',
      requiredPermissions: [PermissionCodes.leaveApplyDelete],
    ),
    PermissionActionIds.deleteRecord: PermissionAction(
      id: PermissionActionIds.deleteRecord,
      label: 'Delete Record',
      requiredPermissions: [
        PermissionCodes.studentDelete,
        PermissionCodes.staffDelete,
        PermissionCodes.academicRoutineDelete,
      ],
    ),
  };

  static const groups = <PermissionGroup>[
    PermissionGroup(
      id: 'attendance',
      label: 'Attendance',
      permissions: [
        Permission(code: PermissionCodes.attendanceView, label: 'View'),
        Permission(code: PermissionCodes.attendanceCreate, label: 'Create'),
        Permission(code: PermissionCodes.attendanceEdit, label: 'Edit'),
        Permission(code: PermissionCodes.attendanceReport, label: 'Reports'),
      ],
    ),
    PermissionGroup(
      id: 'leave',
      label: 'Leave',
      permissions: [
        Permission(code: PermissionCodes.leaveApplyView, label: 'View leave'),
        Permission(
          code: PermissionCodes.leaveApplyCreate,
          label: 'Request leave',
        ),
        Permission(
          code: PermissionCodes.leaveApplyDelete,
          label: 'Cancel leave',
        ),
        Permission(
          code: PermissionCodes.leaveBalanceView,
          label: 'View balances',
        ),
      ],
    ),
    PermissionGroup(
      id: 'academics',
      label: 'Academics',
      permissions: [
        Permission(code: PermissionCodes.academicsExams, label: 'View exams'),
        Permission(code: PermissionCodes.academicsMarks, label: 'Manage marks'),
        Permission(
          code: PermissionCodes.examInvigilatorView,
          label: 'View exam duties',
        ),
      ],
    ),
    PermissionGroup(
      id: 'finance',
      label: 'Finance',
      permissions: [
        Permission(code: PermissionCodes.feesView, label: 'View fees'),
        Permission(code: PermissionCodes.feesCollect, label: 'Collect fees'),
        Permission(code: PermissionCodes.payrollView, label: 'View payroll'),
      ],
    ),
  ];

  static StaffModuleDefinition? moduleForRoute(String route) {
    final matches = modules.where(
      (module) => route == module.route || route.startsWith('${module.route}/'),
    );
    if (matches.isEmpty) return null;
    return matches.reduce(
      (current, next) =>
          next.route.length > current.route.length ? next : current,
    );
  }

  static PermissionAction? actionForId(String actionId) => actions[actionId];
}
