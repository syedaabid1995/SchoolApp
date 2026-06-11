import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/auth/auth_session.dart';
import '../../core/network/api_client.dart';
import '../../features/auth/presentation/auth_controller.dart';
import '../models/mobile_dashboard_data.dart';

final mobileDataRepositoryProvider = Provider<MobileDataRepository>((ref) {
  return MobileDataRepository(ref.watch(dioProvider));
});

final mobileDashboardDataProvider = FutureProvider<MobileDashboardData>((
  ref,
) async {
  final session = ref.watch(authControllerProvider).session;
  if (session == null) throw StateError('Not authenticated');
  return ref
      .watch(mobileDataRepositoryProvider)
      .loadDashboardData(session.user);
});

final assignedStudentsProvider = FutureProvider<List<AssignedStudent>>((
  ref,
) async {
  return ref.watch(mobileDataRepositoryProvider).listAssignedStudents();
});

final assignedExamPapersProvider = FutureProvider<List<AssignedExamPaper>>((
  ref,
) async {
  return ref.watch(mobileDataRepositoryProvider).listAssignedExamPapers();
});

Map<String, dynamic> _queryParameters(Map<String, Object?> values) {
  return {
    for (final entry in values.entries)
      if (entry.value != null) entry.key: entry.value,
  };
}

class MobileDataRepository {
  const MobileDataRepository(this._dio);

  final Dio _dio;

  Future<MobileDashboardData> loadDashboardData(AuthUser user) async {
    final results = await Future.wait<Object?>([
      _safeList(() => listSelfAttendance()),
      _safe(() => getAttendanceSummary()),
      _safe(() => getTeacherTimetable()),
      _safeList(() => listExams()),
    ]);

    return MobileDashboardData(
      selfAttendance: results[0] as List<SelfAttendanceRecord>,
      attendanceSummary: results[1] as AttendanceSummary?,
      teacherTimetable: results[2] as TeacherTimetable?,
      exams: results[3] as List<ExamSummary>,
      user: user,
    );
  }

  Future<List<SelfAttendanceRecord>> listSelfAttendance() async {
    final now = DateTime.now();
    final from = DateFormat(
      'yyyy-MM-dd',
    ).format(DateTime(now.year, now.month, 1));
    final to = DateFormat('yyyy-MM-dd').format(now);
    final response = await _dio.get<List<dynamic>>(
      '/attendance/teacher/self',
      queryParameters: {'fromDate': from, 'toDate': to},
    );
    return (response.data ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(SelfAttendanceRecord.fromJson)
        .toList();
  }

  Future<void> markSelfPresent() async {
    await _dio.post<void>(
      '/attendance/teacher/self',
      data: {'status': 'PRESENT'},
    );
  }

  Future<AttendanceSummary> getAttendanceSummary() async {
    final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
    final response = await _dio.get<Map<String, dynamic>>(
      '/attendance/summary',
      queryParameters: {'date': today},
    );
    return AttendanceSummary.fromJson(response.data ?? const {});
  }

  Future<TeacherTimetable> getTeacherTimetable() async {
    final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
    final response = await _dio.get<Map<String, dynamic>>(
      '/academics/timetable/teacher',
      queryParameters: {'date': today},
    );
    return TeacherTimetable.fromJson(response.data ?? const {});
  }

  Future<List<ExamSummary>> listExams() async {
    final response = await _dio.get<List<dynamic>>('/exams');
    return (response.data ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(ExamSummary.fromJson)
        .toList();
  }

  Future<List<AssignedStudent>> listAssignedStudents({
    String? classId,
    String? sectionId,
  }) async {
    final response = await _dio.get<List<dynamic>>(
      '/users/me/assigned-students',
      queryParameters: _queryParameters({
        'classId': classId,
        'sectionId': sectionId,
      }),
    );
    return (response.data ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(AssignedStudent.fromJson)
        .toList();
  }

  Future<List<AssignedExamPaper>> listAssignedExamPapers({
    String? examId,
    String? classId,
    String? sectionId,
    String? subjectId,
  }) async {
    final response = await _dio.get<List<dynamic>>(
      '/users/me/exam-papers',
      queryParameters: _queryParameters({
        'examId': examId,
        'classId': classId,
        'sectionId': sectionId,
        'subjectId': subjectId,
      }),
    );
    return (response.data ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(AssignedExamPaper.fromJson)
        .toList();
  }

  Future<Map<String, dynamic>> createStudentAttendanceSession({
    required String classId,
    String? sectionId,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/attendance/sessions',
      data: _queryParameters({'classId': classId, 'sectionId': sectionId}),
    );
    return response.data ?? const {};
  }

  Future<void> submitStudentAttendance({
    required String sessionId,
    required List<Map<String, dynamic>> records,
    bool submit = false,
  }) async {
    await _dio.patch<void>(
      '/attendance/sessions/$sessionId',
      data: {'records': records, 'submit': submit},
    );
  }

  Future<void> submitMarks({
    required String examPaperId,
    required List<Map<String, dynamic>> entries,
    String status = 'SUBMITTED',
  }) async {
    await _dio.post<void>(
      '/exams/marks/upload',
      data: {'examPaperId': examPaperId, 'entries': entries, 'status': status},
    );
  }

  Future<T?> _safe<T>(Future<T> Function() load) async {
    try {
      return await load();
    } on DioException catch (error) {
      if (error.response?.statusCode == 403 ||
          error.response?.statusCode == 404 ||
          error.response?.statusCode == 503) {
        return null;
      }
      rethrow;
    }
  }

  Future<List<T>> _safeList<T>(Future<List<T>> Function() load) async {
    return await _safe(load) ?? const [];
  }
}
