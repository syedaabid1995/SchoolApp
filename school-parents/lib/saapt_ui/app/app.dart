import 'dart:async';

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
  StreamSubscription<String>? _notificationRouteSubscription;

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      final notificationService = ref.read(parentNotificationServiceProvider);
      _notificationRouteSubscription = notificationService.routeStream.listen((
        route,
      ) {
        final destination = route.trim();
        if (!mounted || destination.isEmpty) return;
        ref.read(saaptRouterProvider).go(destination);
      });
      unawaited(notificationService.initialize());
    });
  }

  @override
  void dispose() {
    _notificationRouteSubscription?.cancel();
    super.dispose();
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
