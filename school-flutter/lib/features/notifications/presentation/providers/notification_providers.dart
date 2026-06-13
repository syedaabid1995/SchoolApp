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
