import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'routes/app_router.dart';
import 'theme/saapt_theme.dart';

class SaaptApp extends ConsumerWidget {
  const SaaptApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: 'SAAPT Teacher',
      debugShowCheckedModeBanner: false,
      theme: SaaptTheme.light,
      routerConfig: ref.watch(saaptRouterProvider),
    );
  }
}
