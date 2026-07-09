import 'dart:async';

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

  static const _pendingTokenKey = 'notifications.pendingFcmToken';
  static const _androidChannel = AndroidNotificationChannel(
    'akademifyy_push',
    'Push notifications',
    description: 'Akademifyy push notifications',
    importance: Importance.high,
  );

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

    await _localNotifications
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >()
        ?.createNotificationChannel(_androidChannel);

    await syncDeviceToken();
    _messaging.onTokenRefresh.listen((token) {
      unawaited(_registerToken(token));
    });

    FirebaseMessaging.onMessage.listen((message) async {
      final notification = message.notification;
      if (notification != null) {
        await _cache.write(
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
      await _showForegroundNotification(message);
    });

    FirebaseMessaging.onMessageOpenedApp.listen((message) {
      final route = routeFromData(message.data);
      if (route != null) {
        _cache.write('notifications.pendingRoute', route);
      }
    });
  }

  Future<void> syncDeviceToken() async {
    final pendingToken = _cache.read<String>(_pendingTokenKey);
    if (pendingToken != null && pendingToken.isNotEmpty) {
      final registered = await _registerToken(pendingToken);
      if (!registered) return;
    }

    final token = await _messaging.getToken();
    if (token != null && token.isNotEmpty) {
      await _registerToken(token);
    }
  }

  Future<bool> _registerToken(String token) async {
    final platform = switch (defaultTargetPlatform) {
      TargetPlatform.iOS || TargetPlatform.macOS => 'IOS',
      _ => 'ANDROID',
    };
    try {
      await _dio.post<Map<String, dynamic>>(
        ApiEndpoints.pushDevices,
        data: {'token': token, 'platform': platform, 'app': 'school-flutter'},
      );
      await _cache.remove(_pendingTokenKey);
      return true;
    } catch (_) {
      await _cache.write(_pendingTokenKey, token);
      return false;
    }
  }

  Future<void> _showForegroundNotification(RemoteMessage message) async {
    final notification = message.notification;
    final title = notification?.title ?? message.data['title']?.toString();
    final body = notification?.body ?? message.data['body']?.toString();
    if ((title == null || title.isEmpty) && (body == null || body.isEmpty)) {
      return;
    }

    final details = NotificationDetails(
      android: AndroidNotificationDetails(
        _androidChannel.id,
        _androidChannel.name,
        channelDescription: _androidChannel.description,
        importance: Importance.high,
        priority: Priority.high,
      ),
      iOS: const DarwinNotificationDetails(
        presentAlert: true,
        presentBadge: true,
        presentSound: true,
      ),
    );

    await _localNotifications.show(
      id: message.messageId.hashCode,
      title: title,
      body: body,
      notificationDetails: details,
      payload: routeFromData(message.data),
    );
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
