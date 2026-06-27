import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/storage/hive_cache_service.dart';
import '../../data/repositories/settings_repository_impl.dart';
import '../../domain/entities/settings_state.dart';
import '../../domain/repositories/settings_repository.dart';

final settingsRepositoryProvider = Provider<SettingsRepository>((ref) {
  return SettingsRepositoryImpl(ref.watch(hiveCacheServiceProvider));
});

final settingsProvider =
    AsyncNotifierProvider<SettingsController, SettingsState>(
      SettingsController.new,
    );

class SettingsController extends AsyncNotifier<SettingsState> {
  @override
  Future<SettingsState> build() {
    return ref.watch(settingsRepositoryProvider).loadSettings();
  }

  Future<void> setThemeMode(String value) async {
    await ref.read(settingsRepositoryProvider).setThemeMode(value);
    state = await AsyncValue.guard(
      () => ref.read(settingsRepositoryProvider).loadSettings(),
    );
  }

  Future<void> setLanguageCode(String value) async {
    await ref.read(settingsRepositoryProvider).setLanguageCode(value);
    state = await AsyncValue.guard(
      () => ref.read(settingsRepositoryProvider).loadSettings(),
    );
  }

  Future<void> setNotificationsEnabled(bool value) async {
    await ref.read(settingsRepositoryProvider).setNotificationsEnabled(value);
    state = await AsyncValue.guard(
      () => ref.read(settingsRepositoryProvider).loadSettings(),
    );
  }
}
