import 'package:dio/dio.dart';

import '../../../../core/constants/api_endpoints.dart';
import '../models/notice_model.dart';

class NoticeRemoteDatasource {
  const NoticeRemoteDatasource(this._dio);

  final Dio _dio;

  Future<List<NoticeModel>> getNotices({required Set<String> readIds}) async {
    final response = await _dio.get<Map<String, dynamic>>(
      ApiEndpoints.notificationSummary,
    );
    final items = response.data?['items'] is List
        ? response.data!['items'] as List
        : const [];
    return [
      for (final item in items)
        if (item is Map<String, dynamic>)
          NoticeModel.fromJson(
            item,
            isRead: readIds.contains(item['id']?.toString()),
          ),
    ];
  }
}
