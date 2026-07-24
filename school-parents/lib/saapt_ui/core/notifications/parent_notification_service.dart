import 'dart:async';

import 'package:dio/dio.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/parent_api_client.dart';

final parentNotificationServiceProvider = Provider<ParentNotificationService>((
  ref,
) {
  return ParentNotificationService(
    messaging: FirebaseMessaging.instance,
    localNotifications: FlutterLocalNotificationsPlugin(),
    dio: ref.watch(parentDioProvider),
  );
});

class ParentNotificationService {
  ParentNotificationService({
    required FirebaseMessaging messaging,
    required FlutterLocalNotificationsPlugin localNotifications,
    required Dio dio,
  }) : _messaging = messaging,
       _localNotifications = localNotifications,
       _dio = dio;

  final FirebaseMessaging _messaging;
  final FlutterLocalNotificationsPlugin _localNotifications;
  final Dio _dio;
  bool _initialized = false;

  static const AndroidNotificationChannel _androidChannel =
      AndroidNotificationChannel(
        'akademifyy_parent_push',
        'Parent notifications',
        description: 'SAAPT Parent push notifications',
        importance: Importance.high,
      );

  Future<void> initialize() async {
    if (_initialized) return;
    _initialized = true;
    await _messaging.requestPermission(alert: true, badge: true, sound: true);
    const android = AndroidInitializationSettings('@mipmap/ic_launcher');
    const darwin = DarwinInitializationSettings();
    await _localNotifications.initialize(
      settings: const InitializationSettings(
        android: android,
        iOS: darwin,
        macOS: darwin,
      ),
    );
    await _localNotifications
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >()
        ?.createNotificationChannel(_androidChannel);

    FirebaseMessaging.onMessage.listen(_showForegroundNotification);
    _messaging.onTokenRefresh.listen((token) {
      unawaited(registerDeviceToken(token));
    });
  }

  Future<void> syncDeviceToken() async {
    await initialize();
    final token = await _messaging.getToken();
    if (token != null && token.isNotEmpty) {
      await registerDeviceToken(token);
    }
  }

  Future<void> registerDeviceToken(String token) async {
    final trimmedToken = token.trim();
    if (trimmedToken.length < 20) {
      debugPrint('Skipping short Firebase token registration.');
      return;
    }
    final platform = switch (defaultTargetPlatform) {
      TargetPlatform.iOS || TargetPlatform.macOS => 'IOS',
      _ => 'ANDROID',
    };
    try {
      await _dio.post<Map<String, dynamic>>(
        '/notifications/push/devices',
        data: {
          'token': trimmedToken,
          'platform': platform,
          'app': 'school-parents',
        },
      );
    } on DioException catch (error) {
      debugPrint(
        'Parent push token registration failed: '
        '${error.response?.statusCode} ${error.response?.data ?? error.message}',
      );
    } catch (error) {
      debugPrint('Parent push token registration failed: $error');
    }
  }

  Future<void> _showForegroundNotification(RemoteMessage message) async {
    final title =
        message.notification?.title ?? message.data['title']?.toString();
    final body = message.notification?.body ?? message.data['body']?.toString();
    if ((title == null || title.isEmpty) && (body == null || body.isEmpty)) {
      return;
    }
    const details = NotificationDetails(
      android: AndroidNotificationDetails(
        'akademifyy_parent_push',
        'Parent notifications',
        channelDescription: 'SAAPT Parent push notifications',
        importance: Importance.high,
        priority: Priority.high,
      ),
      iOS: DarwinNotificationDetails(
        presentAlert: true,
        presentBadge: true,
        presentSound: true,
      ),
    );
    await _localNotifications.show(
      id:
          (message.messageId ??
                  DateTime.now().microsecondsSinceEpoch.toString())
              .hashCode,
      title: title,
      body: body,
      notificationDetails: details,
    );
  }
}
