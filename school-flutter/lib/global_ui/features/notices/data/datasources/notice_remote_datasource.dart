import 'package:dio/dio.dart';

import '../../../../core/constants/api_endpoints.dart';
import '../models/notice_model.dart';

class NoticeRemoteDatasource {
  const NoticeRemoteDatasource(this._dio);

  final Dio _dio;

  Future<List<NoticeModel>> getNotices({required Set<String> readIds}) async {
    try {
      return _parseNoticeResponse(
        await _dio.get<Map<String, dynamic>>(
          ApiEndpoints.communicationNotices,
          queryParameters: const {'publishedOnly': 'true'},
        ),
        readIds,
      );
    } on DioException {
      // Older deployments may not expose communication notices to mobile users.
      // Fall back to the notification summary so existing alerts still render.
    }

    return _parseNoticeResponse(
      await _dio.get<Map<String, dynamic>>(ApiEndpoints.notificationSummary),
      readIds,
    );
  }

  List<NoticeModel> _parseNoticeResponse(
    Response<Map<String, dynamic>> response,
    Set<String> readIds,
  ) {
    final items = response.data?['items'] is List
        ? response.data!['items'] as List
        : const [];
    return [
      for (final item in items)
        if (item is Map)
          NoticeModel.fromJson(
            item.map((key, value) => MapEntry(key.toString(), value)),
            isRead: readIds.contains(item['id']?.toString()),
          ),
    ];
  }
}
