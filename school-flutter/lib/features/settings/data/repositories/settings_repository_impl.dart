import 'package:package_info_plus/package_info_plus.dart';

import '../../../../core/storage/hive_cache_service.dart';
import '../../domain/entities/settings_state.dart';
import '../../domain/repositories/settings_repository.dart';

class SettingsRepositoryImpl implements SettingsRepository {
  const SettingsRepositoryImpl(this._cache);

  static const _themeModeKey = 'settings.themeMode';
  static const _languageCodeKey = 'settings.languageCode';
  static const _notificationsEnabledKey = 'settings.notificationsEnabled';

  final HiveCacheService _cache;

  @override
  Future<SettingsState> loadSettings() async {
    final info = await PackageInfo.fromPlatform();
    return SettingsState(
      themeMode: _cache.read<String>(_themeModeKey) ?? 'system',
      languageCode: _cache.read<String>(_languageCodeKey) ?? 'en',
      notificationsEnabled: _cache.read<bool>(_notificationsEnabledKey) ?? true,
      appVersion: info.version,
      buildNumber: info.buildNumber,
    );
  }

  @override
  Future<void> setThemeMode(String themeMode) =>
      _cache.write(_themeModeKey, themeMode);

  @override
  Future<void> setLanguageCode(String languageCode) =>
      _cache.write(_languageCodeKey, languageCode);

  @override
  Future<void> setNotificationsEnabled(bool enabled) =>
      _cache.write(_notificationsEnabledKey, enabled);
}
