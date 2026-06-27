import 'package:flutter/material.dart';

import '../../app/theme/app_icons.dart';
import '../../app/theme/app_spacing.dart';

enum StatusPanelType { info, success, warning, error }

class StatusPanel extends StatelessWidget {
  const StatusPanel({
    required this.title,
    this.message,
    this.type = StatusPanelType.info,
    this.action,
    super.key,
  });

  final String title;
  final String? message;
  final StatusPanelType type;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final panelMessage = message;
    final scheme = Theme.of(context).colorScheme;
    final (background, foreground, icon) = switch (type) {
      StatusPanelType.success => (
        scheme.tertiaryContainer,
        scheme.onTertiaryContainer,
        AppIcons.success,
      ),
      StatusPanelType.warning => (
        scheme.secondaryContainer,
        scheme.onSecondaryContainer,
        AppIcons.warning,
      ),
      StatusPanelType.error => (
        scheme.errorContainer,
        scheme.onErrorContainer,
        AppIcons.error,
      ),
      StatusPanelType.info => (
        scheme.surfaceContainerHighest,
        scheme.onSurfaceVariant,
        Icons.info_outline,
      ),
    };

    return Semantics(
      container: true,
      label: message == null ? title : '$title. $message',
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: foreground),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      color: foreground,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  ...?_messageWidgets(panelMessage, foreground),
                ],
              ),
            ),
            ?action,
          ],
        ),
      ),
    );
  }

  List<Widget>? _messageWidgets(String? value, Color foreground) {
    if (value == null) return null;
    return [
      const SizedBox(height: AppSpacing.xxs),
      Text(value, style: TextStyle(color: foreground)),
    ];
  }
}
