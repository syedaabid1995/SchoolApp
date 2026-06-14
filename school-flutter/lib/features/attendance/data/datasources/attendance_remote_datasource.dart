import 'package:dio/dio.dart';
import 'package:intl/intl.dart';

import '../../../../core/constants/api_endpoints.dart';
import '../../domain/entities/attendance_summary.dart';
import '../models/attendance_summary_model.dart';

class AttendanceRemoteDatasource {
  const AttendanceRemoteDatasource(this._dio);

  final Dio _dio;

  Future<AttendanceSummaryModel> getSummary({DateTime? date}) async {
    final response = await _dio.get<Map<String, dynamic>>(
      ApiEndpoints.attendanceSummary,
      queryParameters: {
        if (date != null) 'date': DateFormat('yyyy-MM-dd').format(date),
      },
    );
    return AttendanceSummaryModel.fromJson(
      response.data ?? const <String, dynamic>{},
    );
  }

  Future<List<TeacherAttendanceRecordModel>> getTeacherHistory({
    DateTime? fromDate,
    DateTime? toDate,
  }) async {
    final response = await _dio.get<List<dynamic>>(
      ApiEndpoints.teacherSelfAttendance,
      queryParameters: {
        if (fromDate != null)
          'fromDate': DateFormat('yyyy-MM-dd').format(fromDate),
        if (toDate != null) 'toDate': DateFormat('yyyy-MM-dd').format(toDate),
      },
    );
    return [
      for (final item in response.data ?? const [])
        if (item is Map<String, dynamic>)
          TeacherAttendanceRecordModel.fromJson(item),
    ];
  }

  Future<TeacherAttendanceRecordModel> markSelfAttendance({
    required String status,
    DateTime? date,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      ApiEndpoints.teacherSelfAttendance,
      data: {
        'status': status,
        if (date != null) 'date': DateFormat('yyyy-MM-dd').format(date),
      },
    );
    return TeacherAttendanceRecordModel.fromJson(
      response.data ?? const <String, dynamic>{},
    );
  }

  Future<StudentAttendanceOptionsModel> getStudentAttendanceOptions() async {
    final response = await _dio.get<Map<String, dynamic>>(
      ApiEndpoints.studentAttendanceOptions,
    );
    return StudentAttendanceOptionsModel.fromJson(
      response.data ?? const <String, dynamic>{},
    );
  }

  Future<StudentAttendanceSheetModel> loadStudentAttendance(
    StudentAttendanceQuery query,
  ) async {
    final response = await _dio.get<Map<String, dynamic>>(
      ApiEndpoints.studentAttendance,
      queryParameters: studentAttendanceQueryParams(query),
    );
    return StudentAttendanceSheetModel.fromJson(
      response.data ?? const <String, dynamic>{},
    );
  }

  Future<void> saveStudentAttendance(
    StudentAttendanceSaveRequest request,
  ) async {
    await _dio.post<Map<String, dynamic>>(
      ApiEndpoints.studentAttendance,
      data: studentAttendanceSavePayload(request),
    );
  }
}
