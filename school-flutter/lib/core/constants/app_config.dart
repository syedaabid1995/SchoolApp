class AppConfig {
  const AppConfig._();

  static const appName = 'School ERP Staff';
  static const clientPlatform = 'school-mobile';

  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://akademify.techstageit.com/api/v1',
  );

  static const connectTimeout = Duration(seconds: 20);
  static const receiveTimeout = Duration(seconds: 30);
}
