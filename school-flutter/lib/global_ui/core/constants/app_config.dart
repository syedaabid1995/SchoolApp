class AppConfig {
  const AppConfig._();

  static const appName = 'Akademifyy Staff';
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
}
