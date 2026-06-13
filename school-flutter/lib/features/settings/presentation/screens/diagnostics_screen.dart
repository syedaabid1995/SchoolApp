import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/connectivity/connectivity_service.dart';
import '../../../../core/constants/app_config.dart';
import '../../../../core/localization/app_localizations.dart';
import '../../../../core/sync/mutation_queue_service.dart';
import '../../../../core/sync/sync_manager.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../../../core/widgets/async_state_view.dart';
import '../../../../core/widgets/status_panel.dart';
import '../providers/settings_providers.dart';

class DiagnosticsScreen extends ConsumerWidget {
  const DiagnosticsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final settings = ref.watch(settingsProvider);
    final sync = ref.watch(syncManagerProvider);
    final connectivity = ref.watch(connectivityStatusProvider);
    final queueSize = ref.watch(_queueSizeProvider);

    return AppScaffold(
      title: l10n.appDiagnostics,
      child: AsyncStateView(
        value: settings,
        data: (state) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            StatusPanel(
              title: l10n.diagnostics,
              message: l10n.noDiagnosticsSecrets,
            ),
            const SizedBox(height: AppSpacing.md),
            AppCard(
              child: Column(
                children: [
                  _DiagnosticRow(label: l10n.version, value: state.appVersion),
                  _DiagnosticRow(
                    label: l10n.buildNumber,
                    value: state.buildNumber,
                  ),
                  _DiagnosticRow(
                    label: l10n.lastSync,
                    value: sync.lastSyncAt == null
                        ? l10n.neverSynced
                        : MaterialLocalizations.of(
                            context,
                          ).formatFullDate(sync.lastSyncAt!),
                  ),
                  _DiagnosticRow(
                    label: l10n.queueSize,
                    value: queueSize.when(
                      data: (value) => value.toString(),
                      loading: () => '...',
                      error: (_, _) => '0',
                    ),
                  ),
                  _DiagnosticRow(
                    label: l10n.connectivity,
                    value: connectivity.when(
                      data: (online) => online ? l10n.online : l10n.offline,
                      loading: () => '...',
                      error: (_, _) => l10n.offline,
                    ),
                  ),
                  _DiagnosticRow(
                    label: l10n.environment,
                    value: _environmentLabel,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String get _environmentLabel {
    final baseUrl = AppConfig.apiBaseUrl;
    if (baseUrl.contains('localhost') || baseUrl.contains('10.0.2.2')) {
      return 'Local';
    }
    return 'Configured API';
  }
}

final _queueSizeProvider = FutureProvider.autoDispose<int>((ref) async {
  return ref.watch(mutationQueueServiceProvider).pending().length;
});

class _DiagnosticRow extends StatelessWidget {
  const _DiagnosticRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: '$label: $value',
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
        child: Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
            ),
            Flexible(
              child: Text(
                value,
                textAlign: TextAlign.end,
                style: Theme.of(
                  context,
                ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
