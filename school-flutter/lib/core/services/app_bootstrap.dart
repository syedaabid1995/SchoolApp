import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';

import '../storage/hive_cache_service.dart';

class AppBootstrap {
  const AppBootstrap._();

  static Future<void> initialize() async {
    await Hive.initFlutter();
    await Future.wait([
      Hive.openBox<dynamic>(HiveCacheService.boxName),
      Hive.openBox<dynamic>(HiveCacheService.preferencesBoxName),
    ]);

    try {
      await Firebase.initializeApp();
    } catch (error) {
      if (kDebugMode) {
        debugPrint('Firebase initialization skipped: $error');
      }
    }
  }
}
