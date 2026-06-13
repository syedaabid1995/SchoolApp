import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/localization/app_localizations.dart';
import '../core/sync/sync_manager.dart';
import '../features/settings/presentation/providers/settings_providers.dart';
import 'routes/app_router.dart';
import 'theme/app_theme.dart';

class StaffErpApp extends ConsumerStatefulWidget {
  const StaffErpApp({super.key});

  @override
  ConsumerState<StaffErpApp> createState() => _StaffErpAppState();
}

class _StaffErpAppState extends ConsumerState<StaffErpApp>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    Future.microtask(
      () => ref.read(syncManagerProvider.notifier).sync(reason: 'startup'),
    );
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      ref.read(syncManagerProvider.notifier).sync(reason: 'foreground');
    }
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(appRouterProvider);
    final settingsValue = ref.watch(settingsProvider);
    final settings = settingsValue.hasValue ? settingsValue.value : null;

    return MaterialApp.router(
      title: AppLocalizations(const Locale('en')).appTitle,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: settings?.resolvedThemeMode ?? ThemeMode.system,
      locale: settings?.resolvedLocale,
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      routerConfig: router,
    );
  }
}
