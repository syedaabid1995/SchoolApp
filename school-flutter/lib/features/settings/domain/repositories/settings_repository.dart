import '../entities/settings_state.dart';

abstract class SettingsRepository {
  Future<SettingsState> loadSettings();
  Future<void> setThemeMode(String themeMode);
  Future<void> setLanguageCode(String languageCode);
  Future<void> setNotificationsEnabled(bool enabled);
}
