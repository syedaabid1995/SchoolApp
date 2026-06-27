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
    AttendanceUnit? unit,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      ApiEndpoints.teacherSelfAttendance,
      data: {
        'status': status,
        if (date != null) 'date': DateFormat('yyyy-MM-dd').format(date),
        if (unit != null) 'unitType': unit.unitType.value,
        if (unit?.slotType != null) 'slotType': unit!.slotType!.value,
        if (unit?.periodId != null) 'periodId': unit!.periodId,
      },
    );
    return TeacherAttendanceRecordModel.fromJson(
      response.data ?? const <String, dynamic>{},
    );
  }

  Future<SelfAttendanceOptionsModel> getSelfAttendanceOptions({
    DateTime? date,
  }) async {
    final response = await _dio.get<Map<String, dynamic>>(
      ApiEndpoints.teacherSelfAttendanceOptions,
      queryParameters: {
        if (date != null) 'fromDate': DateFormat('yyyy-MM-dd').format(date),
      },
    );
    return SelfAttendanceOptionsModel.fromJson(
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

  Future<AttendanceConfigurationModel> getResolvedAttendanceConfig(
    AttendanceScopeQuery query,
  ) async {
    final response = await _dio.get<Map<String, dynamic>>(
      ApiEndpoints.attendanceConfigResolve,
      queryParameters: attendanceScopeQueryParams(query),
    );
    return AttendanceConfigurationModel.fromJson(
      response.data ?? const <String, dynamic>{},
    );
  }

  Future<List<AttendanceUnitModel>> getAttendanceUnits(
    AttendanceScopeQuery query,
  ) async {
    final response = await _dio.get<Map<String, dynamic>>(
      ApiEndpoints.attendanceUnits,
      queryParameters: attendanceScopeQueryParams(query),
    );
    final units = response.data?['units'] is List
        ? response.data!['units'] as List
        : const [];
    return [
      for (final item in units)
        if (item is Map)
          AttendanceUnitModel.fromJson(item.cast<String, dynamic>()),
    ];
  }

  Future<AttendanceSheetModel> getAttendanceSheet(
    AttendanceSheetQuery query,
  ) async {
    final response = await _dio.get<Map<String, dynamic>>(
      ApiEndpoints.attendanceSheet,
      queryParameters: attendanceSheetQueryParams(query),
    );
    return AttendanceSheetModel.fromJson(
      response.data ?? const <String, dynamic>{},
    );
  }

  Future<AttendanceSheetModel> saveAttendanceSheet(
    AttendanceSheetSaveRequest request,
  ) async {
    final response = await _dio.put<Map<String, dynamic>>(
      ApiEndpoints.attendanceSheet,
      data: attendanceSheetSavePayload(request),
    );
    return AttendanceSheetModel.fromJson(
      response.data ?? const <String, dynamic>{},
    );
  }

  Future<AttendanceSheetSessionModel> lockAttendanceSheet({
    required String sessionId,
    String? reason,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '${ApiEndpoints.attendanceSheet}/$sessionId/lock',
      data: {if (reason != null && reason.trim().isNotEmpty) 'reason': reason},
    );
    return AttendanceSheetSessionModel.fromJson(
      response.data ?? const <String, dynamic>{},
    );
  }

  Future<AttendanceSheetSessionModel> reopenAttendanceSheet({
    required String sessionId,
    String? reason,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '${ApiEndpoints.attendanceSheet}/$sessionId/reopen',
      data: {if (reason != null && reason.trim().isNotEmpty) 'reason': reason},
    );
    return AttendanceSheetSessionModel.fromJson(
      response.data ?? const <String, dynamic>{},
    );
  }

  Future<List<AttendanceConfigurationModel>> listAttendanceConfigurations({
    String? academicYearId,
    String? classId,
    String? sectionId,
    bool? active,
  }) async {
    final response = await _dio.get<List<dynamic>>(
      ApiEndpoints.attendanceConfigurations,
      queryParameters: {
        if (academicYearId != null) 'academicYearId': academicYearId,
        if (classId != null) 'classId': classId,
        if (sectionId != null) 'sectionId': sectionId,
        if (active != null) 'active': active.toString(),
      },
    );
    return [
      for (final item in response.data ?? const [])
        if (item is Map)
          AttendanceConfigurationModel.fromJson(item.cast<String, dynamic>()),
    ];
  }
}
