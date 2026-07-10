import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/dio_client.dart';
import '../../../../core/storage/hive_cache_service.dart';
import '../../data/datasources/notification_remote_datasource.dart';
import '../../data/repositories/notification_repository_impl.dart';
import '../../domain/entities/staff_notification.dart';
import '../../domain/repositories/notification_repository.dart';

final notificationRemoteDatasourceProvider =
    Provider<NotificationRemoteDatasource>((ref) {
      return NotificationRemoteDatasource(ref.watch(dioProvider));
    });

final notificationRepositoryProvider = Provider<NotificationRepository>((ref) {
  return NotificationRepositoryImpl(
    remote: ref.watch(notificationRemoteDatasourceProvider),
    cache: ref.watch(hiveCacheServiceProvider),
  );
});

final notificationCenterProvider =
    AsyncNotifierProvider<
      NotificationCenterController,
      NotificationCenterState
    >(NotificationCenterController.new);

final pushNotificationCenterProvider =
    AsyncNotifierProvider<
      PushNotificationCenterController,
      NotificationCenterState
    >(PushNotificationCenterController.new);

class NotificationCenterController
    extends AsyncNotifier<NotificationCenterState> {
  @override
  Future<NotificationCenterState> build() {
    return ref.watch(notificationRepositoryProvider).getNotificationCenter();
  }

  Future<void> markAsRead(String id) async {
    await ref.read(notificationRepositoryProvider).markAsRead(id);
    state = await AsyncValue.guard(
      () => ref.read(notificationRepositoryProvider).getNotificationCenter(),
    );
  }

  Future<void> markAllAsRead() async {
    await ref.read(notificationRepositoryProvider).markAllAsRead();
    state = await AsyncValue.guard(
      () => ref.read(notificationRepositoryProvider).getNotificationCenter(),
    );
  }
}

class PushNotificationCenterController
    extends AsyncNotifier<NotificationCenterState> {
  static const _readIdsKey = 'pushNotifications.readIds';
  static const _itemsKey = 'pushNotifications.items';

  @override
  Future<NotificationCenterState> build() {
    return _load();
  }

  Future<void> markAsRead(String id) async {
    final readIds = _readIds()..add(id);
    await ref
        .read(hiveCacheServiceProvider)
        .write(_readIdsKey, readIds.toList());
    state = await AsyncValue.guard(_load);
  }

  Future<void> markAllAsRead() async {
    final center = await _load();
    await ref
        .read(hiveCacheServiceProvider)
        .write(_readIdsKey, center.items.map((item) => item.id).toList());
    state = await AsyncValue.guard(_load);
  }

  Future<NotificationCenterState> _load() async {
    final cache = ref.read(hiveCacheServiceProvider);
    try {
      final items = await ref
          .read(notificationRemoteDatasourceProvider)
          .getPushNotifications(readIds: _readIds());
      await cache.writeCached(
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
    } catch (_) {
      final cached = cache.read<List<dynamic>>(_itemsKey);
      if (cached != null) {
        return NotificationCenterState(items: _itemsFromCache(cached));
      }
      rethrow;
    }
  }

  Set<String> _readIds() {
    final value =
        ref.read(hiveCacheServiceProvider).read<List<dynamic>>(_readIdsKey) ??
        const [];
    return value.map((item) => item.toString()).toSet();
  }

  List<StaffNotification> _itemsFromCache(List<dynamic> values) => [
    for (final item in values)
      if (item is Map)
        StaffNotification(
          id: item['id']?.toString() ?? '',
          title: item['title']?.toString() ?? '',
          type: item['type']?.toString() ?? 'info',
          isRead:
              item['isRead'] == true ||
              _readIds().contains(item['id']?.toString()),
          message: item['message']?.toString(),
          href: item['href']?.toString(),
        ),
  ];
}
