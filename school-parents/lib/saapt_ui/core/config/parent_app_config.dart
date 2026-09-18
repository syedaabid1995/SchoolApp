class ParentAppConfig {
  const ParentAppConfig._();

  static const appVersion = '1.0.0+1';
  static const clientPlatform = 'school-mobile';

  /// Brand flavor: `saapt` | `akademifyy` (from `--dart-define` / flavor JSON).
  static const appBrandDefine = String.fromEnvironment(
    'APP_BRAND',
    defaultValue: '',
  );

  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api.saapttech.com/api/v1',
  );

  static const connectTimeout = Duration(seconds: 20);
  static const receiveTimeout = Duration(seconds: 30);

  static ParentAppBrand get brand {
    final fromDefine = brandForAppBrandDefine(appBrandDefine);
    if (fromDefine != null) return fromDefine;
    return brandForApiBaseUrl(apiBaseUrl);
  }

  static String get appName => '${brand.appName} Parent';

  static String get logoAsset => brand.parentLogoAsset;

  static ParentAppBrand? brandForAppBrandDefine(String value) {
    switch (value.trim().toLowerCase()) {
      case 'saapt':
        return ParentAppBrand.saapt;
      case 'akademifyy':
        return ParentAppBrand.akademifyy;
      default:
        return null;
    }
  }

  static ParentAppBrand brandForApiBaseUrl(String value) {
    final normalized = value.trim().toLowerCase();
    final uri = Uri.tryParse(normalized);
    final host = uri?.host.isNotEmpty == true ? uri!.host : normalized;

    if (_isSaaptHost(host) ||
        normalized.contains('saapttech.com') ||
        normalized.contains('saapptech.com')) {
      return ParentAppBrand.saapt;
    }

    return ParentAppBrand.akademifyy;
  }

  static bool _isSaaptHost(String host) {
    final normalizedHost = host.trim().toLowerCase();
    return normalizedHost == 'saapttech.com' ||
        normalizedHost.endsWith('.saapttech.com') ||
        normalizedHost == 'saapptech.com' ||
        normalizedHost.endsWith('.saapptech.com');
  }
}

enum ParentAppBrand {
  akademifyy(
    'Akademifyy',
    parentLogoAsset: 'assets/branding/akademifyy_parent_logo.png',
  ),
  saapt(
    'SAAPT',
    parentLogoAsset: 'assets/branding/saapt_parent_logo.png',
  );

  const ParentAppBrand(this.appName, {required this.parentLogoAsset});

  final String appName;
  final String parentLogoAsset;
}
