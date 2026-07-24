import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/config/parent_app_config.dart';
import '../core/notifications/parent_notification_service.dart';
import 'routes/app_router.dart';
import 'theme/saapt_theme.dart';

class SaaptApp extends ConsumerStatefulWidget {
  const SaaptApp({super.key});

  @override
  ConsumerState<SaaptApp> createState() => _SaaptAppState();
}

class _SaaptAppState extends ConsumerState<SaaptApp> {
  @override
  void initState() {
    super.initState();
    Future.microtask(
      () => ref.read(parentNotificationServiceProvider).initialize(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: ParentAppConfig.appName,
      debugShowCheckedModeBanner: false,
      theme: SaaptTheme.light,
      routerConfig: ref.watch(saaptRouterProvider),
    );
  }
}
