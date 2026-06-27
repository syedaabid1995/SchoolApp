import 'package:equatable/equatable.dart';
import 'package:flutter/material.dart';

class SettingsState extends Equatable {
  const SettingsState({
    required this.themeMode,
    required this.languageCode,
    required this.notificationsEnabled,
    required this.appVersion,
    required this.buildNumber,
  });

  final String themeMode;
  final String languageCode;
  final bool notificationsEnabled;
  final String appVersion;
  final String buildNumber;

  ThemeMode get resolvedThemeMode {
    return switch (themeMode) {
      'light' => ThemeMode.light,
      'dark' => ThemeMode.dark,
      _ => ThemeMode.system,
    };
  }

  Locale get resolvedLocale => Locale(languageCode);

  @override
  List<Object?> get props => [
    themeMode,
    languageCode,
    notificationsEnabled,
    appVersion,
    buildNumber,
  ];
}
