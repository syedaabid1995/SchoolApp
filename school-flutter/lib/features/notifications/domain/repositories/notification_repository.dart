import '../entities/staff_notification.dart';

abstract class NotificationRepository {
  Future<NotificationCenterState> getNotificationCenter();
  Future<void> markAsRead(String id);
  Future<void> markAllAsRead();
}
