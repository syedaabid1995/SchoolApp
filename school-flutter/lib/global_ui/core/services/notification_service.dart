import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../../app/routes/app_routes.dart';
import '../constants/api_endpoints.dart';
import '../network/dio_client.dart';
import '../storage/hive_cache_service.dart';

final notificationServiceProvider = Provider<NotificationService>((ref) {
  return NotificationService(
    messaging: FirebaseMessaging.instance,
    localNotifications: FlutterLocalNotificationsPlugin(),
    cache: ref.watch(hiveCacheServiceProvider),
    dio: ref.watch(dioProvider),
  );
});

class NotificationService {
  NotificationService({
    required FirebaseMessaging messaging,
    required FlutterLocalNotificationsPlugin localNotifications,
    required HiveCacheService cache,
    required Dio dio,
  }) : _messaging = messaging,
       _localNotifications = localNotifications,
       _cache = cache,
       _dio = dio;

  final FirebaseMessaging _messaging;
  final FlutterLocalNotificationsPlugin _localNotifications;
  final HiveCacheService _cache;
  final Dio _dio;

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

    final token = await _messaging.getToken();
    if (token != null) {
      await _registerToken(token);
    }
    _messaging.onTokenRefresh.listen((token) {
      _registerToken(token);
    });

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

  Future<void> _registerToken(String token) async {
    final platform = switch (defaultTargetPlatform) {
      TargetPlatform.iOS || TargetPlatform.macOS => 'IOS',
      _ => 'ANDROID',
    };
    try {
      await _dio.post<Map<String, dynamic>>(
        ApiEndpoints.pushDevices,
        data: {
          'token': token,
          'platform': platform,
          'app': 'school-flutter',
        },
      );
    } catch (_) {
      _cache.write('notifications.pendingFcmToken', token);
    }
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
