import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';
import 'package:school_flutter/app/routes/app_routes.dart';
import 'package:school_flutter/app/theme/app_breakpoints.dart';
import 'package:school_flutter/app/theme/app_icons.dart';
import 'package:school_flutter/app/theme/app_theme.dart';
import 'package:school_flutter/app/theme/app_typography.dart';
import 'package:school_flutter/core/cache/cache_invalidation_service.dart';
import 'package:school_flutter/core/localization/app_localizations.dart';
import 'package:school_flutter/core/services/notification_service.dart';
import 'package:school_flutter/core/storage/hive_cache_service.dart';
import 'package:school_flutter/core/widgets/app_button.dart';
import 'package:school_flutter/core/widgets/app_text_field.dart';
import 'package:school_flutter/core/widgets/empty_state.dart';
import 'package:school_flutter/core/widgets/status_panel.dart';
import 'package:school_flutter/features/settings/domain/entities/settings_state.dart';

void main() {
  setUpAll(() {
    AppTheme.useGoogleFonts = false;
  });

  group('localization foundation', () {
    test('supports English Arabic and Urdu', () {
      expect(
        AppLocalizations.supportedLocales.map((locale) => locale.languageCode),
        ['en', 'ar', 'ur'],
      );
    });

    test('English strings are available', () {
      const l10n = AppLocalizations(Locale('en'));

      expect(l10n.dashboard, 'Dashboard');
      expect(l10n.settings, 'Settings');
      expect(l10n.quickActions, 'Quick actions');
    });

    test('Arabic strings are available', () {
      const l10n = AppLocalizations(Locale('ar'));

      expect(l10n.dashboard, isNot('Dashboard'));
      expect(l10n.settings, isNot('Settings'));
    });

    test('Urdu strings are available', () {
      const l10n = AppLocalizations(Locale('ur'));

      expect(l10n.dashboard, isNot('Dashboard'));
      expect(l10n.settings, isNot('Settings'));
    });

    test('unknown locale falls back to English', () {
      const l10n = AppLocalizations(Locale('ta'));

      expect(l10n.dashboard, 'Dashboard');
    });

    test('greeting interpolates staff name', () {
      const l10n = AppLocalizations(Locale('en'));

      expect(l10n.greeting('Asha'), 'Hello, Asha');
    });

    test('pending action message interpolates count', () {
      const l10n = AppLocalizations(Locale('en'));

      expect(l10n.pendingActions(3), contains('3'));
    });

    test('last synced message interpolates time', () {
      const l10n = AppLocalizations(Locale('en'));

      expect(l10n.lastSynced('10:30'), contains('10:30'));
    });

    test('theme labels are localized', () {
      const l10n = AppLocalizations(Locale('en'));

      expect([l10n.system, l10n.light, l10n.dark], hasLength(3));
    });

    test('settings labels are localized', () {
      const l10n = AppLocalizations(Locale('en'));

      expect(l10n.cacheManagement, isNotEmpty);
      expect(l10n.openDiagnostics, isNotEmpty);
      expect(l10n.noDiagnosticsSecrets, contains('secrets'));
    });

    test('delegate supports configured locales', () {
      expect(AppLocalizations.delegate.isSupported(const Locale('ar')), isTrue);
      expect(AppLocalizations.delegate.isSupported(const Locale('ur')), isTrue);
    });

    test('delegate rejects unsupported locales', () {
      expect(
        AppLocalizations.delegate.isSupported(const Locale('fr')),
        isFalse,
      );
    });

    test('delegate loads localization object', () async {
      final l10n = await AppLocalizations.delegate.load(const Locale('en'));

      expect(l10n.appTitle, 'School ERP Staff');
    });
  });

  group('settings state', () {
    const base = SettingsState(
      themeMode: 'system',
      languageCode: 'en',
      notificationsEnabled: true,
      appVersion: '1.0.0',
      buildNumber: '1',
    );

    test('system theme resolves to ThemeMode.system', () {
      expect(base.resolvedThemeMode, ThemeMode.system);
    });

    test('light theme resolves to ThemeMode.light', () {
      final state = SettingsState(
        themeMode: 'light',
        languageCode: base.languageCode,
        notificationsEnabled: base.notificationsEnabled,
        appVersion: base.appVersion,
        buildNumber: base.buildNumber,
      );

      expect(state.resolvedThemeMode, ThemeMode.light);
    });

    test('dark theme resolves to ThemeMode.dark', () {
      final state = SettingsState(
        themeMode: 'dark',
        languageCode: base.languageCode,
        notificationsEnabled: base.notificationsEnabled,
        appVersion: base.appVersion,
        buildNumber: base.buildNumber,
      );

      expect(state.resolvedThemeMode, ThemeMode.dark);
    });

    test('unknown theme falls back to system', () {
      final state = SettingsState(
        themeMode: 'unknown',
        languageCode: base.languageCode,
        notificationsEnabled: base.notificationsEnabled,
        appVersion: base.appVersion,
        buildNumber: base.buildNumber,
      );

      expect(state.resolvedThemeMode, ThemeMode.system);
    });

    test('language code resolves to locale', () {
      expect(base.resolvedLocale, const Locale('en'));
    });

    test('Arabic language resolves to Arabic locale', () {
      const state = SettingsState(
        themeMode: 'system',
        languageCode: 'ar',
        notificationsEnabled: true,
        appVersion: '1.0.0',
        buildNumber: '1',
      );

      expect(state.resolvedLocale, const Locale('ar'));
    });

    test('settings state equality uses values', () {
      expect(base, equals(base));
    });
  });

  group('notification deep links', () {
    test('accepts approved explicit route', () {
      expect(
        NotificationService.routeFromData({'route': AppRoutes.attendance}),
        AppRoutes.attendance,
      );
    });

    test('rejects unapproved explicit route', () {
      expect(
        NotificationService.routeFromData({'route': '/admin/secrets'}),
        isNull,
      );
    });

    test('maps attendance module to attendance route', () {
      expect(
        NotificationService.routeFromData({'module': 'attendance'}),
        AppRoutes.attendance,
      );
    });

    test('maps timetable module to timetable route', () {
      expect(
        NotificationService.routeFromData({'module': 'timetable'}),
        AppRoutes.timetable,
      );
    });

    test('maps leave module to leave route', () {
      expect(
        NotificationService.routeFromData({'module': 'leave'}),
        AppRoutes.leave,
      );
    });

    test('maps homework module to homework route', () {
      expect(
        NotificationService.routeFromData({'module': 'homework'}),
        AppRoutes.homework,
      );
    });

    test('maps exams module to exams route', () {
      expect(
        NotificationService.routeFromData({'module': 'exams'}),
        AppRoutes.exams,
      );
    });

    test('maps marks module to marks route', () {
      expect(
        NotificationService.routeFromData({'module': 'marks'}),
        AppRoutes.marks,
      );
    });

    test('unknown module has no route', () {
      expect(NotificationService.routeFromData({'module': 'unknown'}), isNull);
    });

    test('accepts approved local notification payload', () {
      expect(
        NotificationService.routeFromPayload(AppRoutes.notices),
        AppRoutes.notices,
      );
    });

    test('rejects unsafe local notification payload', () {
      expect(NotificationService.routeFromPayload('/unsafe'), isNull);
    });

    test('rejects empty local notification payload', () {
      expect(NotificationService.routeFromPayload(''), isNull);
    });
  });

  group('responsive breakpoints', () {
    testWidgets('compact width is detected', (tester) async {
      await tester.pumpWidget(
        _SizedHarness(
          size: const Size(390, 800),
          child: Builder(
            builder: (context) =>
                Text(AppBreakpoints.isCompact(context).toString()),
          ),
        ),
      );

      expect(find.text('true'), findsOneWidget);
    });

    testWidgets('medium width is detected', (tester) async {
      await tester.pumpWidget(
        _SizedHarness(
          size: const Size(700, 900),
          child: Builder(
            builder: (context) =>
                Text(AppBreakpoints.isMedium(context).toString()),
          ),
        ),
      );

      expect(find.text('true'), findsOneWidget);
    });

    testWidgets('expanded width is detected', (tester) async {
      await tester.pumpWidget(
        _SizedHarness(
          size: const Size(1000, 900),
          child: Builder(
            builder: (context) =>
                Text(AppBreakpoints.isExpanded(context).toString()),
          ),
        ),
      );

      expect(find.text('true'), findsOneWidget);
    });

    testWidgets('dashboard column count scales up', (tester) async {
      await tester.pumpWidget(
        _SizedHarness(
          size: const Size(1280, 900),
          child: Builder(
            builder: (context) =>
                Text(AppBreakpoints.dashboardColumns(context).toString()),
          ),
        ),
      );

      expect(find.text('4'), findsOneWidget);
    });

    testWidgets('content max width constrains expanded layouts', (
      tester,
    ) async {
      await tester.pumpWidget(
        _SizedHarness(
          size: const Size(1280, 900),
          child: Builder(
            builder: (context) =>
                Text(AppBreakpoints.contentMaxWidth(context).toString()),
          ),
        ),
      );

      expect(find.text('1120.0'), findsOneWidget);
    });
  });

  group('theme and design primitives', () {
    test('light theme uses Material 3', () {
      expect(AppTheme.light.useMaterial3, isTrue);
    });

    test('dark theme uses dark brightness', () {
      expect(AppTheme.dark.brightness, Brightness.dark);
    });

    testWidgets('typography helpers return styles', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: Builder(
            builder: (context) {
              return Text(
                [
                  AppTypography.screenTitle(context) != null,
                  AppTypography.sectionTitle(context) != null,
                  AppTypography.metric(context) != null,
                ].join(','),
              );
            },
          ),
        ),
      );

      expect(find.text('true,true,true'), findsOneWidget);
    });

    test('app icon registry exposes diagnostics icon', () {
      expect(AppIcons.diagnostics, Icons.monitor_heart_outlined);
    });
  });

  group('accessibility widgets', () {
    testWidgets('status panel renders title and message', (tester) async {
      await tester.pumpWidget(
        const _MaterialHarness(
          child: StatusPanel(title: 'Sync', message: 'Up to date'),
        ),
      );

      expect(find.text('Sync'), findsOneWidget);
      expect(find.text('Up to date'), findsOneWidget);
    });

    testWidgets('status panel supports action widget', (tester) async {
      await tester.pumpWidget(
        _MaterialHarness(
          child: StatusPanel(
            title: 'Offline',
            action: TextButton(onPressed: () {}, child: const Text('Retry')),
          ),
        ),
      );

      expect(find.text('Retry'), findsOneWidget);
    });

    testWidgets('app button shows loading indicator', (tester) async {
      await tester.pumpWidget(
        _MaterialHarness(
          child: AppButton(label: 'Save', onPressed: () {}, isLoading: true),
        ),
      );

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('app button calls callback when enabled', (tester) async {
      var tapped = false;
      await tester.pumpWidget(
        _MaterialHarness(
          child: AppButton(label: 'Save', onPressed: () => tapped = true),
        ),
      );

      await tester.tap(find.text('Save'));

      expect(tapped, isTrue);
    });

    testWidgets('app text field validates input', (tester) async {
      final controller = TextEditingController();
      final formKey = GlobalKey<FormState>();
      await tester.pumpWidget(
        _MaterialHarness(
          child: Form(
            key: formKey,
            child: AppTextField(
              controller: controller,
              label: 'Reason',
              validator: (value) => value.isEmpty ? 'Required' : null,
            ),
          ),
        ),
      );

      expect(formKey.currentState!.validate(), isFalse);
      await tester.pump();
      expect(find.text('Required'), findsOneWidget);
    });

    testWidgets('empty state renders semantic content', (tester) async {
      await tester.pumpWidget(
        const _MaterialHarness(
          child: EmptyState(title: 'No notices', message: 'Pull to refresh'),
        ),
      );

      expect(find.text('No notices'), findsOneWidget);
      expect(find.text('Pull to refresh'), findsOneWidget);
    });
  });

  group('cache management', () {
    late Directory hiveDir;

    setUp(() {
      hiveDir = Directory.systemTemp.createTempSync('staff_app_phase1g_');
      Hive.init(hiveDir.path);
    });

    tearDown(() async {
      await Hive.close();
      if (hiveDir.existsSync()) hiveDir.deleteSync(recursive: true);
    });

    test('runtime cache invalidation preserves settings keys', () async {
      final box = await Hive.openBox<dynamic>('settings_cache_one');
      final cache = HiveCacheService(box);
      final invalidation = CacheInvalidationService(cache);

      await cache.write('settings.themeMode', 'dark');
      await cache.write('attendance.history', ['row']);
      await invalidation.invalidateRuntimeCache();

      expect(cache.read<String>('settings.themeMode'), 'dark');
      expect(cache.hasCachedValue('attendance.history'), isFalse);

      await box.deleteFromDisk();
    });

    test('runtime cache invalidation removes sync metadata', () async {
      final box = await Hive.openBox<dynamic>('settings_cache_two');
      final cache = HiveCacheService(box);
      final invalidation = CacheInvalidationService(cache);

      await cache.write('sync.lastSyncAt', '2026-01-01');
      await invalidation.invalidateRuntimeCache();

      expect(cache.hasCachedValue('sync.lastSyncAt'), isFalse);

      await box.deleteFromDisk();
    });

    test('cache keys expose stored values for diagnostics', () async {
      final box = await Hive.openBox<dynamic>('settings_cache_three');
      final cache = HiveCacheService(box);

      await cache.write('one', 1);
      await cache.write('two', 2);

      expect(
        cache.keys.map((key) => key.toString()),
        containsAll(['one', 'two']),
      );

      await box.deleteFromDisk();
    });
  });
}

class _MaterialHarness extends StatelessWidget {
  const _MaterialHarness({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      theme: AppTheme.light,
      home: Scaffold(body: child),
    );
  }
}

class _SizedHarness extends StatelessWidget {
  const _SizedHarness({required this.size, required this.child});

  final Size size;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return MediaQuery(
      data: MediaQueryData(size: size),
      child: Directionality(textDirection: TextDirection.ltr, child: child),
    );
  }
}
