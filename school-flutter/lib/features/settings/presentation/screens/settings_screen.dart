import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/routes/app_routes.dart';
import '../../../../app/theme/app_icons.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../core/cache/cache_invalidation_service.dart';
import '../../../../core/constants/app_config.dart';
import '../../../../core/localization/app_localizations.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../../../core/widgets/async_state_view.dart';
import '../../../../core/widgets/status_panel.dart';
import '../../../auth/presentation/providers/auth_controller.dart';
import '../providers/settings_providers.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(settingsProvider);
    final l10n = AppLocalizations.of(context);
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    return AppScaffold(
      title: l10n.settings,
      child: AsyncStateView(
        value: settings,
        data: (state) => FocusTraversalGroup(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Preferences card
              _SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _SectionHeader(
                      icon: Icons.tune_outlined,
                      label: AppConfig.appName,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    DropdownButtonFormField<String>(
                      initialValue: state.themeMode,
                      decoration: InputDecoration(labelText: l10n.theme),
                      items: [
                        DropdownMenuItem(value: 'system', child: Text(l10n.system)),
                        DropdownMenuItem(value: 'light', child: Text(l10n.light)),
                        DropdownMenuItem(value: 'dark', child: Text(l10n.dark)),
                      ],
                      onChanged: (value) {
                        if (value != null) {
                          ref.read(settingsProvider.notifier).setThemeMode(value);
                        }
                      },
                    ),
                    const SizedBox(height: AppSpacing.md),
                    DropdownButtonFormField<String>(
                      initialValue: state.languageCode,
                      decoration: InputDecoration(labelText: l10n.language),
                      items: [
                        DropdownMenuItem(value: 'en', child: Text(l10n.english)),
                        DropdownMenuItem(value: 'ar', child: Text(l10n.arabic)),
                        DropdownMenuItem(value: 'ur', child: Text(l10n.urdu)),
                      ],
                      onChanged: (value) {
                        if (value != null) {
                          ref.read(settingsProvider.notifier).setLanguageCode(value);
                        }
                      },
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      value: state.notificationsEnabled,
                      onChanged: (value) => ref
                          .read(settingsProvider.notifier)
                          .setNotificationsEnabled(value),
                      title: Text(l10n.notifications),
                      secondary: const Icon(Icons.notifications_outlined),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              // Cache management card
              _SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _SectionHeader(
                      icon: Icons.storage_outlined,
                      label: l10n.cacheManagement,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    StatusPanel(
                      title: l10n.syncInformation,
                      message: l10n.noDiagnosticsSecrets,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    OutlinedButton.icon(
                      onPressed: () async {
                        await ref
                            .read(cacheInvalidationServiceProvider)
                            .invalidateRuntimeCache();
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text(l10n.clearCache)),
                          );
                        }
                      },
                      icon: const Icon(Icons.delete_sweep_outlined),
                      label: Text(l10n.clearCache),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              // Logout card
              _SectionCard(
                child: ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: colorScheme.errorContainer,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      Icons.logout,
                      color: colorScheme.onErrorContainer,
                      size: 20,
                    ),
                  ),
                  title: Text(
                    'Logout',
                    style: textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                      color: colorScheme.error,
                    ),
                  ),
                  subtitle: Text(
                    'Sign out of your account',
                    style: textTheme.bodySmall?.copyWith(
                      color: colorScheme.onSurface.withOpacity(0.55),
                    ),
                  ),
                  trailing: Icon(
                    Icons.chevron_right,
                    color: colorScheme.onSurface.withOpacity(0.40),
                  ),
                  onTap: () => ref.read(authControllerProvider.notifier).logout(),
                ),
              ),
              _SectionCard(
                child: ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: colorScheme.primaryContainer,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      AppIcons.diagnostics,
                      color: colorScheme.onPrimaryContainer,
                      size: 20,
                    ),
                  ),
                  title: Text(
                    l10n.diagnostics,
                    style: textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
                  ),
                  subtitle: Text(
                    '${l10n.version} ${state.appVersion}+${state.buildNumber}',
                    style: textTheme.bodySmall?.copyWith(
                      color: colorScheme.onSurface.withOpacity(0.55),
                    ),
                  ),
                  trailing: Icon(
                    Icons.chevron_right,
                    color: colorScheme.onSurface.withOpacity(0.40),
                  ),
                  onTap: () => context.go(AppRoutes.diagnostics),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: colorScheme.shadow.withOpacity(0.07),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: child,
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    return Row(
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: colorScheme.primaryContainer,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, size: 16, color: colorScheme.onPrimaryContainer),
        ),
        const SizedBox(width: AppSpacing.sm),
        Semantics(
          header: true,
          child: Text(
            label,
            style: textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
          ),
        ),
      ],
    );
  }
}
