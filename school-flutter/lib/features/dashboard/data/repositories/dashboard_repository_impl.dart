import '../../../../core/network/error_handler.dart';
import '../../../../core/permissions/permission_checker.dart';
import '../../../../core/permissions/permission_codes.dart';
import '../../domain/entities/dashboard_snapshot.dart';
import '../../domain/repositories/dashboard_repository.dart';
import '../datasources/dashboard_remote_datasource.dart';

class DashboardRepositoryImpl implements DashboardRepository {
  const DashboardRepositoryImpl(this._remote);

  final DashboardRemoteDatasource _remote;

  @override
  Future<DashboardSnapshot> getDashboard() async {
    try {
      final user = await _remote.getCurrentUser();
      final checker = PermissionChecker(user.permissionCodes);
      final attendanceFuture = checker.canAccessRoute('/attendance')
          ? _remote.attendanceRepository.getSummary()
          : Future.value(null);
      final timetableFuture = checker.canAccessRoute('/timetable')
          ? _remote.timetableRepository.getTeacherTimetable()
          : Future.value(null);
      final notificationsFuture = _getNotificationsOrNull();
      final leaveFuture = checker.canAccessRoute('/leave')
          ? _getLeaveOrNull()
          : Future.value(null);
      final noticesFuture = _getNoticesOrNull();
      final classesFuture = checker.canAccessRoute('/classes')
          ? _getClassesOrNull()
          : Future.value(null);
      final homeworkFuture = checker.canAccessRoute('/homework')
          ? _getHomeworkOrNull()
          : Future.value(null);
      final examsFuture = checker.canAccessRoute('/exams')
          ? _getExamsOrNull()
          : Future.value(null);
      final marksFuture = checker.canAccessRoute('/marks')
          ? _getMarksOrNull()
          : Future.value(null);

      final results = await Future.wait<Object?>([
        attendanceFuture,
        timetableFuture,
        notificationsFuture,
        leaveFuture,
        noticesFuture,
        classesFuture,
        homeworkFuture,
        examsFuture,
        marksFuture,
      ]);
      final attendance = results[0] as dynamic;
      final timetable = results[1] as dynamic;
      final notifications = results[2] as dynamic;
      final leave = results[3] as dynamic;
      final notices = results[4] as dynamic;
      final classes = results[5] as dynamic;
      final homework = results[6] as dynamic;
      final exams = results[7] as dynamic;
      final marks = results[8] as dynamic;

      return DashboardSnapshot(
        user: user,
        attendanceSummary: attendance,
        todayTimetable: timetable,
        notifications: notifications,
        leaveHome: leave,
        noticeBoard: notices,
        classAssignments: classes,
        recentHomework: homework ?? const [],
        examHome: exams,
        markTasks: marks ?? const [],
        cards: [
          if (timetable != null)
            DashboardCard(
              title: 'Today timetable',
              value: timetable.entries.length.toString(),
              subtitle: 'Scheduled teaching slots',
              permissionCode: PermissionCodes.timetableView,
            ),
          if (attendance != null)
            DashboardCard(
              title: 'Today attendance',
              value: attendance.totals.present.toString(),
              subtitle: '${attendance.totals.records} records tracked',
              permissionCode: PermissionCodes.attendanceView,
            ),
          if (leave != null)
            DashboardCard(
              title: 'Pending leave',
              value: leave.pendingCount.toString(),
              subtitle: 'Requests awaiting review',
              permissionCode: PermissionCodes.leaveApplyView,
            ),
          if (notices != null)
            DashboardCard(
              title: 'Unread notices',
              value: notices.unreadCount.toString(),
              subtitle: 'School announcements',
              permissionCode: PermissionCodes.notificationsView,
            ),
          if (classes != null)
            DashboardCard(
              title: 'Assigned classes',
              value: classes.classes.length.toString(),
              subtitle: '${classes.subjects.length} subject links',
              permissionCode: PermissionCodes.dashboardOverview,
            ),
          if (homework != null)
            DashboardCard(
              title: 'Recent homework',
              value: homework.length.toString(),
              subtitle: 'Latest assigned work',
              permissionCode: PermissionCodes.homeworkView,
            ),
          if (exams != null)
            DashboardCard(
              title: 'Upcoming exams',
              value: exams.upcoming.length.toString(),
              subtitle: 'Scheduled academic assessments',
              permissionCode: PermissionCodes.academicsExams,
            ),
          if (marks != null)
            DashboardCard(
              title: 'Pending mark entries',
              value: marks
                  .where((paper) => paper.marksCount == 0)
                  .length
                  .toString(),
              subtitle: 'Assigned mark-entry tasks',
              permissionCode: PermissionCodes.academicsMarks,
            ),
          if (exams?.todayDuties.isNotEmpty == true)
            DashboardCard(
              title: 'Today invigilation',
              value: exams.todayDuties.length.toString(),
              subtitle: 'Exam duty assignments',
              permissionCode: PermissionCodes.examInvigilatorView,
            ),
          if (checker.canAccessRoute('/fees'))
            const DashboardCard(
              title: 'Fee metrics',
              value: 'Open',
              subtitle: 'Collections and revenue summaries',
              permissionCode: PermissionCodes.feesView,
            ),
          if (checker.canAccessRoute('/reports'))
            const DashboardCard(
              title: 'Reports',
              value: 'Open',
              subtitle: 'Operational and academic reporting',
              permissionCode: PermissionCodes.reportsView,
            ),
          if (checker.canAccessRoute('/hr'))
            const DashboardCard(
              title: 'Staff overview',
              value: 'Open',
              subtitle: 'Staff records and attendance',
              permissionCode: PermissionCodes.staffView,
            ),
          if (notifications != null)
            DashboardCard(
              title: 'Unread alerts',
              value: notifications.unreadCount.toString(),
              subtitle: 'Operational notifications',
              permissionCode: PermissionCodes.notificationsView,
            ),
        ],
      );
    } catch (error) {
      throw ErrorHandler.toFailure(error);
    }
  }

  Future<dynamic> _getNotificationsOrNull() async {
    try {
      return await _remote.notificationRepository.getNotificationCenter();
    } catch (_) {
      return null;
    }
  }

  Future<dynamic> _getLeaveOrNull() async {
    try {
      return await _remote.leaveRepository.getHomeData();
    } catch (_) {
      return null;
    }
  }

  Future<dynamic> _getNoticesOrNull() async {
    try {
      return await _remote.noticeRepository.getNoticeBoard();
    } catch (_) {
      return null;
    }
  }

  Future<dynamic> _getClassesOrNull() async {
    try {
      return await _remote.classAssignmentRepository.getAssignments();
    } catch (_) {
      return null;
    }
  }

  Future<dynamic> _getHomeworkOrNull() async {
    try {
      return await _remote.homeworkRepository.list();
    } catch (_) {
      return null;
    }
  }

  Future<dynamic> _getExamsOrNull() async {
    try {
      return await _remote.examRepository.getHomeData();
    } catch (_) {
      return null;
    }
  }

  Future<dynamic> _getMarksOrNull() async {
    try {
      return await _remote.marksRepository.listTasks();
    } catch (_) {
      return null;
    }
  }
}
