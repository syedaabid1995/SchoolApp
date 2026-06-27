import 'package:dio/dio.dart';
import 'package:intl/intl.dart';

import '../../../../core/constants/api_endpoints.dart';
import '../models/leave_models.dart';

class LeaveRemoteDatasource {
  const LeaveRemoteDatasource(this._dio);

  final Dio _dio;

  Future<List<LeaveBalanceModel>> getBalances() async {
    final response = await _dio.get<Map<String, dynamic>>(
      ApiEndpoints.leaveBalancesMe,
    );
    final items = response.data?['items'] is List
        ? response.data!['items'] as List
        : const [];
    return [
      for (final item in items)
        if (item is Map<String, dynamic>) LeaveBalanceModel.fromJson(item),
    ];
  }

  Future<List<LeaveTypeModel>> getTypes() async {
    final response = await _dio.get<List<dynamic>>(ApiEndpoints.leaveTypes);
    return [
      for (final item in response.data ?? const [])
        if (item is Map<String, dynamic>) LeaveTypeModel.fromJson(item),
    ];
  }

  Future<List<LeaveApplicationModel>> getApplications({
    bool mine = true,
  }) async {
    final response = await _dio.get<List<dynamic>>(
      ApiEndpoints.leaveApplications,
      queryParameters: {'mine': mine},
    );
    return [
      for (final item in response.data ?? const [])
        if (item is Map<String, dynamic>) LeaveApplicationModel.fromJson(item),
    ];
  }

  Future<LeaveApplicationModel> getApplication(String id) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '${ApiEndpoints.leaveApplications}/$id',
      queryParameters: const {'mine': true},
    );
    return LeaveApplicationModel.fromJson(response.data ?? const {});
  }

  Future<LeaveApplicationModel> submitApplication({
    required String leaveTypeId,
    required DateTime fromDate,
    required DateTime toDate,
    required String reason,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      ApiEndpoints.leaveApplications,
      data: FormData.fromMap({
        'leaveTypeId': leaveTypeId,
        'fromDate': DateFormat('yyyy-MM-dd').format(fromDate),
        'toDate': DateFormat('yyyy-MM-dd').format(toDate),
        'reason': reason,
      }),
    );
    return LeaveApplicationModel.fromJson(response.data ?? const {});
  }

  Future<void> cancelApplication(String id) async {
    await _dio.delete(
      '${ApiEndpoints.leaveApplications}/$id',
      queryParameters: const {'mine': true},
    );
  }
}
