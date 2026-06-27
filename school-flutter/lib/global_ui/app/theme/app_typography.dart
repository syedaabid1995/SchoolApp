import 'package:flutter/material.dart';

class AppTypography {
  const AppTypography._();

  static TextStyle? screenTitle(BuildContext context) => Theme.of(
    context,
  ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700);

  static TextStyle? sectionTitle(BuildContext context) => Theme.of(
    context,
  ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700);

  static TextStyle? metric(BuildContext context) => Theme.of(
    context,
  ).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w800);

  static TextStyle? supporting(BuildContext context) => Theme.of(context)
      .textTheme
      .bodyMedium
      ?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant);
}
