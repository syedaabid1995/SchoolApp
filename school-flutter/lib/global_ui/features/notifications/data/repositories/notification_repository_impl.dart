import '../../../../core/network/error_handler.dart';
import '../../../../core/storage/hive_cache_service.dart';
import '../../domain/entities/staff_notification.dart';
import '../../domain/repositories/notification_repository.dart';
import '../datasources/notification_remote_datasource.dart';

class NotificationRepositoryImpl implements NotificationRepository {
  const NotificationRepositoryImpl({
    required NotificationRemoteDatasource remote,
    required HiveCacheService cache,
  }) : _remote = remote,
       _cache = cache;

  static const _readIdsKey = 'notifications.readIds';
  static const _itemsKey = 'notifications.items';

  final NotificationRemoteDatasource _remote;
  final HiveCacheService _cache;

  @override
  Future<NotificationCenterState> getNotificationCenter() async {
    try {
      final readIds = _readIds();
      final items = await _remote.getSummary(readIds: readIds);
      await _cache.writeCached(
        _itemsKey,
        items
            .map(
              (item) => {
                'id': item.id,
                'title': item.title,
                'message': item.message,
                'type': item.type,
                'href': item.href,
                'isRead': item.isRead,
              },
            )
            .toList(),
      );
      return NotificationCenterState(items: items);
    } catch (error) {
      final cached = _cache.read<List<dynamic>>(_itemsKey);
      if (cached != null) {
        return NotificationCenterState(items: _itemsFromCache(cached));
      }
      throw ErrorHandler.toFailure(error);
    }
  }

  @override
  Future<void> markAsRead(String id) async {
    final readIds = _readIds()..add(id);
    await _cache.write(_readIdsKey, readIds.toList());
  }

  @override
  Future<void> markAllAsRead() async {
    final center = await getNotificationCenter();
    await _cache.write(
      _readIdsKey,
      center.items.map((item) => item.id).toList(),
    );
  }

  Set<String> _readIds() {
    final value = _cache.read<List<dynamic>>(_readIdsKey) ?? const [];
    return value.map((item) => item.toString()).toSet();
  }

  List<StaffNotification> _itemsFromCache(List<dynamic> values) => [
    for (final item in values)
      if (item is Map)
        StaffNotification(
          id: item['id']?.toString() ?? '',
          title: item['title']?.toString() ?? '',
          type: item['type']?.toString() ?? 'notice',
          isRead: item['isRead'] == true,
          message: item['message']?.toString(),
          href: item['href']?.toString(),
        ),
  ];
}
