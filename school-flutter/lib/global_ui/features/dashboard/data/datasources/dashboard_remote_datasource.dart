import '../../../attendance/domain/repositories/attendance_repository.dart';
import '../../../auth/domain/entities/staff_user.dart';
import '../../../auth/domain/repositories/auth_repository.dart';
import '../../../classes/domain/repositories/class_assignment_repository.dart';
import '../../../exams/domain/repositories/exam_repository.dart';
import '../../../homework/domain/repositories/homework_repository.dart';
import '../../../leave/domain/repositories/leave_repository.dart';
import '../../../marks/domain/repositories/marks_repository.dart';
import '../../../notices/domain/repositories/notice_repository.dart';
import '../../../notifications/domain/repositories/notification_repository.dart';
import '../../../timetable/domain/repositories/timetable_repository.dart';

class DashboardRemoteDatasource {
  const DashboardRemoteDatasource({
    required AuthRepository authRepository,
    required AttendanceRepository attendanceRepository,
    required TimetableRepository timetableRepository,
    required NotificationRepository notificationRepository,
    required LeaveRepository leaveRepository,
    required NoticeRepository noticeRepository,
    required ClassAssignmentRepository classAssignmentRepository,
    required HomeworkRepository homeworkRepository,
    required ExamRepository examRepository,
    required MarksRepository marksRepository,
  }) : _authRepository = authRepository,
       _attendanceRepository = attendanceRepository,
       _timetableRepository = timetableRepository,
       _notificationRepository = notificationRepository,
       _leaveRepository = leaveRepository,
       _noticeRepository = noticeRepository,
       _classAssignmentRepository = classAssignmentRepository,
       _homeworkRepository = homeworkRepository,
       _examRepository = examRepository,
       _marksRepository = marksRepository;

  final AuthRepository _authRepository;
  final AttendanceRepository _attendanceRepository;
  final TimetableRepository _timetableRepository;
  final NotificationRepository _notificationRepository;
  final LeaveRepository _leaveRepository;
  final NoticeRepository _noticeRepository;
  final ClassAssignmentRepository _classAssignmentRepository;
  final HomeworkRepository _homeworkRepository;
  final ExamRepository _examRepository;
  final MarksRepository _marksRepository;

  Future<StaffUser> getCurrentUser() async {
    final session = await _authRepository.restoreSession();
    final user = session.user;
    if (user == null) {
      throw StateError('Authenticated staff session is required.');
    }
    return user;
  }

  AttendanceRepository get attendanceRepository => _attendanceRepository;
  TimetableRepository get timetableRepository => _timetableRepository;
  NotificationRepository get notificationRepository => _notificationRepository;
  LeaveRepository get leaveRepository => _leaveRepository;
  NoticeRepository get noticeRepository => _noticeRepository;
  ClassAssignmentRepository get classAssignmentRepository =>
      _classAssignmentRepository;
  HomeworkRepository get homeworkRepository => _homeworkRepository;
  ExamRepository get examRepository => _examRepository;
  MarksRepository get marksRepository => _marksRepository;
}
