import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/parent_api_client.dart';

final parentNotificationServiceProvider = Provider<ParentNotificationService>((
  ref,
) {
  final service = ParentNotificationService(
    messaging: FirebaseMessaging.instance,
    localNotifications: FlutterLocalNotificationsPlugin(),
    dio: ref.watch(parentDioProvider),
  );
  ref.onDispose(service.dispose);
  return service;
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
  final _routeController = StreamController<String>.broadcast();
  bool _initialized = false;

  Stream<String> get routeStream => _routeController.stream;

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
      onDidReceiveNotificationResponse: _handleLocalNotificationTap,
    );
    await _localNotifications
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >()
        ?.createNotificationChannel(_androidChannel);

    FirebaseMessaging.onMessage.listen(_showForegroundNotification);
    FirebaseMessaging.onMessageOpenedApp.listen(_handleMessageOpened);
    _messaging.onTokenRefresh.listen((token) {
      unawaited(registerDeviceToken(token));
    });
    final initialMessage = await _messaging.getInitialMessage();
    if (initialMessage != null) {
      _handleMessageOpened(initialMessage);
    }
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
      payload: jsonEncode(message.data),
    );
  }

  void _handleMessageOpened(RemoteMessage message) {
    _emitRouteFromData(message.data);
  }

  void _handleLocalNotificationTap(NotificationResponse response) {
    final payload = response.payload;
    if (payload == null || payload.isEmpty) return;
    try {
      final decoded = jsonDecode(payload);
      if (decoded is Map) {
        _emitRouteFromData(
          decoded.map((key, value) => MapEntry(key.toString(), value)),
        );
      }
    } catch (_) {
      return;
    }
  }

  void _emitRouteFromData(Map<String, Object?> data) {
    final route = data['route']?.toString().trim();
    if (route != null && route.isNotEmpty) {
      _routeController.add(route);
      return;
    }

    final childId = data['childId']?.toString().trim();
    final tab = data['tab']?.toString().trim().toLowerCase();
    final module = data['module']?.toString().trim().toLowerCase();
    final category = data['category']?.toString().trim().toLowerCase();
    if (childId != null &&
        childId.isNotEmpty &&
        (tab == 'fees' ||
            module == 'fees' ||
            category == 'fee_reminder' ||
            category == 'payment')) {
      _routeController.add(
        '/profile?childId=${Uri.encodeComponent(childId)}&tab=fees',
      );
    }
  }

  void dispose() {
    _routeController.close();
  }
}
