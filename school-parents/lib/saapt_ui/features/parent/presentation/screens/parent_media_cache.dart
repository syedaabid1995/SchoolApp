import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';
import 'package:path_provider/path_provider.dart';

/// Disk + memory cache for authenticated parent media (documents / face photos).
///
/// Behaves like [CachedNetworkImage]: first open hits the API, later opens
/// reuse local bytes until [maxAge] expires.
class ParentMediaCache {
  ParentMediaCache._();

  static const maxAge = Duration(days: 14);
  static const _maxMemoryEntries = 80;

  static final Map<String, Uint8List> _memory = <String, Uint8List>{};
  static final List<String> _memoryOrder = <String>[];
  static Future<Directory>? _directoryFuture;

  static String cacheKeyFor(String rawUrl) {
    final normalized = rawUrl.trim();
    return sha1.convert(utf8.encode(normalized)).toString();
  }

  static Future<Directory> _directory() {
    return _directoryFuture ??= () async {
      final root = await getApplicationCacheDirectory();
      final dir = Directory('${root.path}/parent_media_cache');
      if (!await dir.exists()) {
        await dir.create(recursive: true);
      }
      return dir;
    }();
  }

  static Future<Uint8List?> read(String rawUrl) async {
    final key = cacheKeyFor(rawUrl);
    final memoryHit = _memory[key];
    if (memoryHit != null) {
      _touchMemory(key);
      return memoryHit;
    }

    try {
      final file = File('${(await _directory()).path}/$key');
      if (!await file.exists()) return null;
      final stat = await file.stat();
      if (DateTime.now().difference(stat.modified) > maxAge) {
        await file.delete();
        return null;
      }
      final bytes = await file.readAsBytes();
      if (bytes.isEmpty) return null;
      _putMemory(key, bytes);
      return bytes;
    } catch (_) {
      return null;
    }
  }

  static Future<void> write(String rawUrl, List<int> bytes) async {
    if (bytes.isEmpty) return;
    final key = cacheKeyFor(rawUrl);
    final data = bytes is Uint8List ? bytes : Uint8List.fromList(bytes);
    _putMemory(key, data);
    try {
      final file = File('${(await _directory()).path}/$key');
      await file.writeAsBytes(data, flush: true);
    } catch (_) {
      // Memory cache still helps within this session.
    }
  }

  static void _putMemory(String key, Uint8List bytes) {
    if (_memory.containsKey(key)) {
      _memory[key] = bytes;
      _touchMemory(key);
      return;
    }
    _memory[key] = bytes;
    _memoryOrder.add(key);
    while (_memoryOrder.length > _maxMemoryEntries) {
      final evicted = _memoryOrder.removeAt(0);
      _memory.remove(evicted);
    }
  }

  static void _touchMemory(String key) {
    _memoryOrder.remove(key);
    _memoryOrder.add(key);
  }
}
