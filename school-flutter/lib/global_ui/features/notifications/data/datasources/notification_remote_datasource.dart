import 'package:dio/dio.dart';

import '../../../../core/constants/api_endpoints.dart';
import '../models/staff_notification_model.dart';

class NotificationRemoteDatasource {
  const NotificationRemoteDatasource(this._dio);

  final Dio _dio;

  Future<List<StaffNotificationModel>> getSummary({
    required Set<String> readIds,
  }) async {
    final response = await _dio.get<Map<String, dynamic>>(
      ApiEndpoints.notificationSummary,
    );
    final items = response.data?['items'] is List
        ? response.data!['items'] as List
        : const [];
    return [
      for (final item in items)
        if (item is Map<String, dynamic>)
          StaffNotificationModel.fromJson(
            item,
            isRead: readIds.contains(item['id']?.toString()),
          ),
    ];
  }

  Future<List<StaffNotificationModel>> getPushNotifications({
    required Set<String> readIds,
  }) async {
    final response = await _dio.get<Map<String, dynamic>>(
      ApiEndpoints.pushNotificationsMe,
    );
    final items = response.data?['items'] is List
        ? response.data!['items'] as List
        : const [];
    return [
      for (final item in items)
        if (item is Map)
          StaffNotificationModel.fromJson(
            item.map((key, value) => MapEntry(key.toString(), value)),
            isRead: readIds.contains(item['id']?.toString()),
          ),
    ];
  }
}
