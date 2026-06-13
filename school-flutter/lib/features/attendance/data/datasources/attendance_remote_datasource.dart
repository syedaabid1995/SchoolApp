import 'package:dio/dio.dart';
import 'package:intl/intl.dart';

import '../../../../core/constants/api_endpoints.dart';
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
}
