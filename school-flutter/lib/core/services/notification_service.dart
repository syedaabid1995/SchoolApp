import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/routes/app_routes.dart';
import '../storage/hive_cache_service.dart';

final notificationServiceProvider = Provider<NotificationService>((ref) {
  return NotificationService(
    messaging: FirebaseMessaging.instance,
    localNotifications: FlutterLocalNotificationsPlugin(),
    cache: ref.watch(hiveCacheServiceProvider),
  );
});

class NotificationService {
  NotificationService({
    required FirebaseMessaging messaging,
    required FlutterLocalNotificationsPlugin localNotifications,
    required HiveCacheService cache,
  }) : _messaging = messaging,
       _localNotifications = localNotifications,
       _cache = cache;

  final FirebaseMessaging _messaging;
  final FlutterLocalNotificationsPlugin _localNotifications;
  final HiveCacheService _cache;

  Future<void> initialize() async {
    await _messaging.requestPermission();
    const android = AndroidInitializationSettings('@mipmap/ic_launcher');
    const darwin = DarwinInitializationSettings();
    const settings = InitializationSettings(
      android: android,
      iOS: darwin,
      macOS: darwin,
    );
    await _localNotifications.initialize(
      settings: settings,
      onDidReceiveNotificationResponse: (response) {
        final route = routeFromPayload(response.payload);
        if (route != null) {
          _cache.write('notifications.pendingRoute', route);
        }
      },
    );

    FirebaseMessaging.onMessage.listen((message) {
      final notification = message.notification;
      if (notification != null) {
        _cache.write(
          'notification:${message.messageId ?? DateTime.now().microsecondsSinceEpoch}',
          {
            'title': notification.title,
            'body': notification.body,
            'category': message.data['category'],
            'route': routeFromData(message.data),
            'receivedAt': DateTime.now().toIso8601String(),
          },
        );
      }
    });

    FirebaseMessaging.onMessageOpenedApp.listen((message) {
      final route = routeFromData(message.data);
      if (route != null) {
        _cache.write('notifications.pendingRoute', route);
      }
    });
  }

  static String? routeFromData(Map<String, dynamic> data) {
    final route = data['route']?.toString();
    if (route != null && _allowedRoutes.contains(route)) return route;

    final module = data['module']?.toString().toLowerCase();
    return switch (module) {
      'attendance' => AppRoutes.attendance,
      'timetable' => AppRoutes.timetable,
      'leave' => AppRoutes.leave,
      'homework' => AppRoutes.homework,
      'exams' => AppRoutes.exams,
      'marks' => AppRoutes.marks,
      'notices' => AppRoutes.notices,
      'notifications' => AppRoutes.notifications,
      _ => null,
    };
  }

  static String? routeFromPayload(String? payload) {
    if (payload == null || payload.trim().isEmpty) return null;
    if (_allowedRoutes.contains(payload)) return payload;
    return null;
  }

  static const _allowedRoutes = {
    AppRoutes.dashboard,
    AppRoutes.attendance,
    AppRoutes.timetable,
    AppRoutes.notifications,
    AppRoutes.notices,
    AppRoutes.leave,
    AppRoutes.homework,
    AppRoutes.classes,
    AppRoutes.exams,
    AppRoutes.marks,
    AppRoutes.profile,
    AppRoutes.settings,
  };
}
