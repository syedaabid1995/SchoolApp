import 'package:equatable/equatable.dart';

class StaffNotification extends Equatable {
  const StaffNotification({
    required this.id,
    required this.title,
    required this.type,
    required this.isRead,
    this.message,
    this.href,
  });

  final String id;
  final String title;
  final String? message;
  final String type;
  final String? href;
  final bool isRead;

  StaffNotification markRead() {
    return StaffNotification(
      id: id,
      title: title,
      type: type,
      isRead: true,
      message: message,
      href: href,
    );
  }

  @override
  List<Object?> get props => [id, title, message, type, href, isRead];
}

class NotificationCenterState extends Equatable {
  const NotificationCenterState({required this.items});

  final List<StaffNotification> items;

  int get unreadCount => items.where((item) => !item.isRead).length;

  @override
  List<Object?> get props => [items];
}
