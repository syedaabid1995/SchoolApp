import 'package:flutter_test/flutter_test.dart';
import 'package:school_flutter/global_ui/core/constants/app_config.dart';

void main() {
  group('AppConfig brand mapping', () {
    test('uses SAAPT for saapttech API hosts', () {
      expect(
        AppConfig.brandForApiBaseUrl('https://api.saapttech.com/api/v1'),
        AppBrand.saapt,
      );
      expect(
        AppConfig.brandForApiBaseUrl('https://API.SAAPTTECH.COM/api/v1'),
        AppBrand.saapt,
      );
    });

    test('tolerates the common saapptech typo', () {
      expect(
        AppConfig.brandForApiBaseUrl('https://api.saapptech.com/api/v1'),
        AppBrand.saapt,
      );
    });

    test('uses Akademifyy for Akademifyy API hosts and local development', () {
      expect(
        AppConfig.brandForApiBaseUrl('https://api.akademifyy.in/api/v1'),
        AppBrand.akademifyy,
      );
      expect(
        AppConfig.brandForApiBaseUrl('http://10.0.2.2:3000/api/v1'),
        AppBrand.akademifyy,
      );
    });
  });
}
