import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../storage/hive_cache_service.dart';

final cacheInvalidationServiceProvider = Provider<CacheInvalidationService>((
  ref,
) {
  return CacheInvalidationService(ref.watch(hiveCacheServiceProvider));
});

class CacheInvalidationService {
  const CacheInvalidationService(this._cache);

  final HiveCacheService _cache;

  Future<void> invalidateKeys(Iterable<String> keys) async {
    for (final key in keys) {
      await _cache.remove(key);
    }
  }

  Future<void> invalidateAllStaffData() => _cache.clear();

  Future<void> invalidateRuntimeCache() async {
    final keys = _cache.keys
        .map((key) => key.toString())
        .where((key) => !key.startsWith('settings.'))
        .toList(growable: false);
    await invalidateKeys(keys);
  }
}
