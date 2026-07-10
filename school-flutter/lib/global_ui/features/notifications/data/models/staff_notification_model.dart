import '../../domain/entities/staff_notification.dart';

class StaffNotificationModel extends StaffNotification {
  const StaffNotificationModel({
    required super.id,
    required super.title,
    required super.type,
    required super.isRead,
    super.message,
    super.href,
  });

  factory StaffNotificationModel.fromJson(
    Map<String, dynamic> json, {
    required bool isRead,
  }) {
    final title =
        json['title']?.toString() ??
        json['subject']?.toString() ??
        json['templateName']?.toString() ??
        'Push notification';
    return StaffNotificationModel(
      id: json['id']?.toString() ?? '',
      title: title.trim().isEmpty ? 'Push notification' : title,
      message: json['message']?.toString(),
      type: json['type']?.toString() ?? 'info',
      href: json['href']?.toString(),
      isRead: isRead,
    );
  }
}
