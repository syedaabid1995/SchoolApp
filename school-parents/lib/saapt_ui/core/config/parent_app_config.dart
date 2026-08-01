class ParentAppConfig {
  const ParentAppConfig._();

  static const appName = 'SAAPT Parent';
  static const appVersion = '1.0.0+1';
  static const clientPlatform = 'school-mobile';

  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api.saapttech.com/api/v1',
  );

  static const connectTimeout = Duration(seconds: 20);
  static const receiveTimeout = Duration(seconds: 30);
}
