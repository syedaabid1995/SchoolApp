import 'package:flutter/foundation.dart';

class AppConfig {
  const AppConfig._();

  static const clientPlatform = 'school-mobile';

  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api.akademifyy.in/api/v1',
    // defaultValue: 'http://10.0.2.2:3000/api/v1',
  );

  static const attendanceV2 = bool.fromEnvironment(
    'ATTENDANCE_V2',
    defaultValue: true,
  );

  static const connectTimeout = Duration(seconds: 20);
  static const receiveTimeout = Duration(seconds: 30);

  static AppBrand get brand => brandForApiBaseUrl(apiBaseUrl);

  static String get appName => brand.appName;

  static String get notificationChannelDescription =>
      '$appName push notifications';

  @visibleForTesting
  static AppBrand brandForApiBaseUrl(String value) {
    final normalized = value.trim().toLowerCase();
    final uri = Uri.tryParse(normalized);
    final host = uri?.host.isNotEmpty == true ? uri!.host : normalized;

    if (_isSaaptHost(host) ||
        normalized.contains('saapttech.com') ||
        normalized.contains('saapptech.com')) {
      return AppBrand.saapt;
    }

    return AppBrand.akademifyy;
  }

  static bool _isSaaptHost(String host) {
    final normalizedHost = host.trim().toLowerCase();
    return normalizedHost == 'saapttech.com' ||
        normalizedHost.endsWith('.saapttech.com') ||
        normalizedHost == 'saapptech.com' ||
        normalizedHost.endsWith('.saapptech.com');
  }
}

enum AppBrand {
  akademifyy('Akademifyy'),
  saapt('SAAPT');

  const AppBrand(this.appName);

  final String appName;
}
