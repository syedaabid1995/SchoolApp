import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

final hiveCacheServiceProvider = Provider<HiveCacheService>((ref) {
  return HiveCacheService(Hive.box<dynamic>(HiveCacheService.boxName));
});

class HiveCacheService {
  HiveCacheService(this._box);

  static const boxName = 'staff_cache';
  static const preferencesBoxName = 'staff_preferences';

  final Box<dynamic> _box;

  Iterable<dynamic> get keys => _box.keys;

  T? read<T>(String key) {
    final value = _box.get(key);
    return value is T ? value : null;
  }

  Future<void> write(String key, Object? value) => _box.put(key, value);
  Future<void> writeCached(String key, Object? value) async {
    await _box.put(key, value);
    await _box.put(_syncedAtKey(key), DateTime.now().toIso8601String());
  }

  DateTime? lastSyncedAt(String key) {
    final value = _box.get(_syncedAtKey(key));
    return DateTime.tryParse(value?.toString() ?? '');
  }

  bool hasCachedValue(String key) => _box.containsKey(key);

  Future<void> remove(String key) => _box.delete(key);
  Future<void> clear() => _box.clear();

  String _syncedAtKey(String key) => '$key.__syncedAt';
}
