import 'package:equatable/equatable.dart';

import '../../../attendance/domain/entities/attendance_summary.dart';
import '../../../auth/domain/entities/staff_user.dart';
import '../../../classes/domain/entities/class_assignment.dart';
import '../../../exams/domain/entities/exam.dart';
import '../../../homework/domain/entities/homework.dart';
import '../../../leave/domain/entities/leave_entities.dart';
import '../../../notices/domain/entities/notice.dart';
import '../../../notifications/domain/entities/staff_notification.dart';
import '../../../timetable/domain/entities/timetable_entry.dart';

class DashboardCard extends Equatable {
  const DashboardCard({
    required this.title,
    required this.value,
    required this.permissionCode,
    this.subtitle,
  });

  final String title;
  final String value;
  final String? subtitle;
  final String permissionCode;

  @override
  List<Object?> get props => [title, value, subtitle, permissionCode];
}

class DashboardSnapshot extends Equatable {
  const DashboardSnapshot({
    required this.user,
    required this.cards,
    required this.attendanceSummary,
    required this.todayTimetable,
    required this.notifications,
    this.leaveHome,
    this.noticeBoard,
    this.classAssignments,
    this.recentHomework = const [],
    this.examHome,
    this.markTasks = const [],
  });

  final StaffUser user;
  final List<DashboardCard> cards;
  final AttendanceSummary? attendanceSummary;
  final TeacherTimetable? todayTimetable;
  final NotificationCenterState? notifications;
  final LeaveHomeData? leaveHome;
  final NoticeBoardState? noticeBoard;
  final ClassAssignments? classAssignments;
  final List<Homework> recentHomework;
  final ExamHomeData? examHome;
  final List<ExamPaper> markTasks;

  @override
  List<Object?> get props => [
    user,
    cards,
    attendanceSummary,
    todayTimetable,
    notifications,
    leaveHome,
    noticeBoard,
    classAssignments,
    recentHomework,
    examHome,
    markTasks,
  ];
}
