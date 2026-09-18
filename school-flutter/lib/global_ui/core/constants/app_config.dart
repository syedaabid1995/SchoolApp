import 'package:flutter/foundation.dart';

class AppConfig {
  const AppConfig._();

  static const clientPlatform = 'school-mobile';
  static const appVersion = '1.0.0+2';

  /// Brand flavor: `saapt` | `akademifyy` (from `--dart-define` / flavor JSON).
  static const appBrandDefine = String.fromEnvironment(
    'APP_BRAND',
    defaultValue: '',
  );

  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api.saapttech.com/api/v1',
  );

  static const attendanceV2 = bool.fromEnvironment(
    'ATTENDANCE_V2',
    defaultValue: true,
  );

  static const connectTimeout = Duration(seconds: 20);
  static const receiveTimeout = Duration(seconds: 30);

  static AppBrand get brand {
    final fromDefine = brandForAppBrandDefine(appBrandDefine);
    if (fromDefine != null) return fromDefine;
    return brandForApiBaseUrl(apiBaseUrl);
  }

  static String get appName => '${brand.appName} Teacher';

  static String get logoAsset => brand.teacherLogoAsset;

  static String get notificationChannelDescription =>
      '$appName push notifications';

  @visibleForTesting
  static AppBrand? brandForAppBrandDefine(String value) {
    switch (value.trim().toLowerCase()) {
      case 'saapt':
        return AppBrand.saapt;
      case 'akademifyy':
        return AppBrand.akademifyy;
      default:
        return null;
    }
  }

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
  akademifyy(
    'Akademifyy',
    teacherLogoAsset: 'assets/branding/akademifyy_teacher_logo.png',
  ),
  saapt(
    'SAAPT',
    teacherLogoAsset: 'assets/branding/saapt_teacher_logo.png',
  );

  const AppBrand(this.appName, {required this.teacherLogoAsset});

  final String appName;
  final String teacherLogoAsset;
}
