import 'package:flutter/widgets.dart';

class AppLocalizations {
  const AppLocalizations(this.locale);

  final Locale locale;

  static const supportedLocales = [Locale('en'), Locale('ar'), Locale('ur')];

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations) ??
        const AppLocalizations(Locale('en'));
  }

  String get appTitle => _text('appTitle');
  String get dashboard => _text('dashboard');
  String get settings => _text('settings');
  String get refresh => _text('refresh');
  String get theme => _text('theme');
  String get system => _text('system');
  String get light => _text('light');
  String get dark => _text('dark');
  String get language => _text('language');
  String get english => _text('english');
  String get arabic => _text('arabic');
  String get urdu => _text('urdu');
  String get notifications => _text('notifications');
  String get cacheManagement => _text('cacheManagement');
  String get clearCache => _text('clearCache');
  String get syncInformation => _text('syncInformation');
  String get diagnostics => _text('diagnostics');
  String get openDiagnostics => _text('openDiagnostics');
  String get appDiagnostics => _text('appDiagnostics');
  String get version => _text('version');
  String get buildNumber => _text('buildNumber');
  String get lastSync => _text('lastSync');
  String get queueSize => _text('queueSize');
  String get connectivity => _text('connectivity');
  String get environment => _text('environment');
  String get online => _text('online');
  String get offline => _text('offline');
  String get neverSynced => _text('neverSynced');
  String get quickActions => _text('quickActions');
  String get pendingOfflineActions => _text('pendingOfflineActions');
  String pendingActions(int count) =>
      _text('pendingActions').replaceAll('{count}', count.toString());
  String greeting(String name) => _text('greeting').replaceAll('{name}', name);
  String get schoolWorkspace => _text('schoolWorkspace');
  String get sync => _text('sync');
  String get syncing => _text('syncing');
  String get syncFailed => _text('syncFailed');
  String get synced => _text('synced');
  String get offlineReadyCache => _text('offlineReadyCache');
  String lastSynced(String time) =>
      _text('lastSynced').replaceAll('{time}', time);
  String get markAttendance => _text('markAttendance');
  String get applyLeave => _text('applyLeave');
  String get addHomework => _text('addHomework');
  String get enterMarks => _text('enterMarks');
  String get noDiagnosticsSecrets => _text('noDiagnosticsSecrets');

  String _text(String key) {
    final language = _strings[locale.languageCode] ?? _strings['en']!;
    return language[key] ?? _strings['en']![key] ?? key;
  }

  static const _strings = <String, Map<String, String>>{
    'en': {
      'appTitle': 'School ERP Staff',
      'dashboard': 'Dashboard',
      'settings': 'Settings',
      'refresh': 'Refresh',
      'theme': 'Theme',
      'system': 'System',
      'light': 'Light',
      'dark': 'Dark',
      'language': 'Language',
      'english': 'English',
      'arabic': 'Arabic',
      'urdu': 'Urdu',
      'notifications': 'Notifications',
      'cacheManagement': 'Cache management',
      'clearCache': 'Clear cache',
      'syncInformation': 'Sync information',
      'diagnostics': 'Diagnostics',
      'openDiagnostics': 'Open diagnostics',
      'appDiagnostics': 'App diagnostics',
      'version': 'Version',
      'buildNumber': 'Build number',
      'lastSync': 'Last sync',
      'queueSize': 'Queue size',
      'connectivity': 'Connectivity',
      'environment': 'Environment',
      'online': 'Online',
      'offline': 'Offline',
      'neverSynced': 'Never synced',
      'quickActions': 'Quick actions',
      'pendingOfflineActions': 'Pending offline actions',
      'pendingActions': '{count} action(s) waiting for sync',
      'greeting': 'Hello, {name}',
      'schoolWorkspace': 'School workspace',
      'sync': 'Sync',
      'syncing': 'Syncing latest school data...',
      'syncFailed': 'Sync failed. Saved data is available.',
      'synced': 'Synced',
      'offlineReadyCache': 'Offline-ready cache enabled',
      'lastSynced': 'Last synced {time}',
      'markAttendance': 'Mark Attendance',
      'applyLeave': 'Apply Leave',
      'addHomework': 'Add Homework',
      'enterMarks': 'Enter Marks',
      'noDiagnosticsSecrets': 'Diagnostics never display secrets or tokens.',
    },
    'ar': {
      'appTitle': 'نظام المدرسة للموظفين',
      'dashboard': 'لوحة التحكم',
      'settings': 'الإعدادات',
      'refresh': 'تحديث',
      'theme': 'المظهر',
      'system': 'النظام',
      'light': 'فاتح',
      'dark': 'داكن',
      'language': 'اللغة',
      'english': 'الإنجليزية',
      'arabic': 'العربية',
      'urdu': 'الأردية',
      'notifications': 'الإشعارات',
      'cacheManagement': 'إدارة التخزين المؤقت',
      'clearCache': 'مسح التخزين المؤقت',
      'syncInformation': 'معلومات المزامنة',
      'diagnostics': 'التشخيص',
      'openDiagnostics': 'فتح التشخيص',
      'appDiagnostics': 'تشخيص التطبيق',
      'version': 'الإصدار',
      'buildNumber': 'رقم البناء',
      'lastSync': 'آخر مزامنة',
      'queueSize': 'حجم قائمة الانتظار',
      'connectivity': 'الاتصال',
      'environment': 'البيئة',
      'online': 'متصل',
      'offline': 'غير متصل',
      'neverSynced': 'لم تتم المزامنة',
      'quickActions': 'إجراءات سريعة',
      'pendingOfflineActions': 'إجراءات غير متصلة معلقة',
      'pendingActions': '{count} إجراء بانتظار المزامنة',
      'greeting': 'مرحباً، {name}',
      'schoolWorkspace': 'مساحة المدرسة',
      'sync': 'مزامنة',
      'syncing': 'جار مزامنة بيانات المدرسة...',
      'syncFailed': 'فشلت المزامنة. البيانات المحفوظة متاحة.',
      'synced': 'تمت المزامنة',
      'offlineReadyCache': 'التخزين المؤقت دون اتصال مفعل',
      'lastSynced': 'آخر مزامنة {time}',
      'markAttendance': 'تسجيل الحضور',
      'applyLeave': 'طلب إجازة',
      'addHomework': 'إضافة واجب',
      'enterMarks': 'إدخال الدرجات',
      'noDiagnosticsSecrets': 'لا تعرض التشخيصات أي أسرار أو رموز.',
    },
    'ur': {
      'appTitle': 'اسکول ERP اسٹاف',
      'dashboard': 'ڈیش بورڈ',
      'settings': 'ترتیبات',
      'refresh': 'تازہ کریں',
      'theme': 'تھیم',
      'system': 'سسٹم',
      'light': 'لائٹ',
      'dark': 'ڈارک',
      'language': 'زبان',
      'english': 'انگریزی',
      'arabic': 'عربی',
      'urdu': 'اردو',
      'notifications': 'اطلاعات',
      'cacheManagement': 'کیش مینجمنٹ',
      'clearCache': 'کیش صاف کریں',
      'syncInformation': 'سنک معلومات',
      'diagnostics': 'تشخیص',
      'openDiagnostics': 'تشخیص کھولیں',
      'appDiagnostics': 'ایپ تشخیص',
      'version': 'ورژن',
      'buildNumber': 'بلڈ نمبر',
      'lastSync': 'آخری سنک',
      'queueSize': 'قطار کا سائز',
      'connectivity': 'کنیکٹیویٹی',
      'environment': 'ماحول',
      'online': 'آن لائن',
      'offline': 'آف لائن',
      'neverSynced': 'کبھی سنک نہیں ہوا',
      'quickActions': 'فوری اعمال',
      'pendingOfflineActions': 'زیر التوا آف لائن اعمال',
      'pendingActions': '{count} عمل سنک کے منتظر ہیں',
      'greeting': 'سلام، {name}',
      'schoolWorkspace': 'اسکول ورک اسپیس',
      'sync': 'سنک',
      'syncing': 'اسکول ڈیٹا سنک ہو رہا ہے...',
      'syncFailed': 'سنک ناکام ہوا۔ محفوظ ڈیٹا دستیاب ہے۔',
      'synced': 'سنک ہو گیا',
      'offlineReadyCache': 'آف لائن کیش فعال ہے',
      'lastSynced': 'آخری سنک {time}',
      'markAttendance': 'حاضری لگائیں',
      'applyLeave': 'چھٹی کی درخواست',
      'addHomework': 'ہوم ورک شامل کریں',
      'enterMarks': 'نمبر درج کریں',
      'noDiagnosticsSecrets': 'تشخیص میں راز یا ٹوکن ظاہر نہیں ہوتے۔',
    },
  };
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  bool isSupported(Locale locale) {
    return AppLocalizations.supportedLocales.any(
      (supported) => supported.languageCode == locale.languageCode,
    );
  }

  @override
  Future<AppLocalizations> load(Locale locale) async {
    return AppLocalizations(locale);
  }

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}
