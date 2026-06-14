import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/routes/app_routes.dart';
import '../../../../app/theme/app_breakpoints.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_typography.dart';
import '../../../../core/localization/app_localizations.dart';
import '../../../../core/permissions/permission_checker.dart';
import '../../../../core/permissions/permission_registry.dart';
import '../../../../core/sync/sync_manager.dart';
import '../../../../core/sync/sync_models.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../../../core/widgets/async_state_view.dart';
import '../providers/dashboard_providers.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboard = ref.watch(dashboardProvider);
    final sync = ref.watch(syncManagerProvider);
    final l10n = AppLocalizations.of(context);

    return AppScaffold(
      title: l10n.dashboard,
      emoji: '🏠',
      breadcrumb: '👩‍🏫 Teacher Dashboard',
      subtitle: 'Welcome back — here\'s your overview.',
      actions: [
        IconButton(
          tooltip: l10n.refresh,
          onPressed: () => ref.invalidate(dashboardProvider),
          icon: const Icon(Icons.refresh),
        ),
      ],
      child: AsyncStateView(
        value: dashboard,
        data: (snapshot) {
          final colorScheme = Theme.of(context).colorScheme;
          final textTheme = Theme.of(context).textTheme;
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: AppSpacing.md),
              _SyncStatusBanner(sync: sync),
              const SizedBox(height: AppSpacing.md),
              _QuickActions(
                checker: PermissionChecker(snapshot.user.permissionCodes),
              ),
              const SizedBox(height: AppSpacing.md),
              if (sync.hasPendingOperations) ...[
                _DashCard(
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
                        Icons.sync_problem_outlined,
                        color: colorScheme.onErrorContainer,
                        size: 20,
                      ),
                    ),
                    title: Text(l10n.pendingOfflineActions),
                    subtitle: Text(l10n.pendingActions(sync.pendingOperations)),
                    trailing: TextButton(
                      onPressed: () =>
                          ref.read(syncManagerProvider.notifier).sync(),
                      child: Text(l10n.sync),
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
              ],
              // Metric cards
              LayoutBuilder(
                builder: (context, constraints) {
                  final columns = AppBreakpoints.dashboardColumns(context);
                  final width =
                      (constraints.maxWidth - (AppSpacing.md * (columns - 1))) /
                      columns;
                  final cardColors = [
                    colorScheme.primaryContainer,
                    colorScheme.secondaryContainer,
                    colorScheme.tertiaryContainer,
                    colorScheme.surfaceContainerHighest,
                  ];
                  final onCardColors = [
                    colorScheme.onPrimaryContainer,
                    colorScheme.onSecondaryContainer,
                    colorScheme.onTertiaryContainer,
                    colorScheme.onSurface,
                  ];
                  return Wrap(
                    spacing: AppSpacing.md,
                    runSpacing: AppSpacing.md,
                    children: [
                      for (final (i, card) in snapshot.cards.indexed)
                        SizedBox(
                          width: width.isFinite ? width : double.infinity,
                          child: Container(
                            padding: const EdgeInsets.all(AppSpacing.md),
                            decoration: BoxDecoration(
                              color: colorScheme.surface,
                              borderRadius: BorderRadius.circular(16),
                              boxShadow: [
                                BoxShadow(
                                  color: colorScheme.shadow.withOpacity(0.07),
                                  blurRadius: 12,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: Semantics(
                              label: '${card.title}: ${card.value}${card.subtitle == null ? '' : '. ${card.subtitle}'}',
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Container(
                                    width: 36,
                                    height: 36,
                                    decoration: BoxDecoration(
                                      color: cardColors[i % cardColors.length],
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: Icon(
                                      Icons.bar_chart_outlined,
                                      size: 18,
                                      color: onCardColors[i % onCardColors.length],
                                    ),
                                  ),
                                  const SizedBox(height: AppSpacing.sm),
                                  Text(
                                    card.title,
                                    style: AppTypography.sectionTitle(context),
                                  ),
                                  const SizedBox(height: AppSpacing.xs),
                                  Text(
                                    card.value,
                                    style: AppTypography.metric(context),
                                  ),
                                  if (card.subtitle != null)
                                    Text(
                                      card.subtitle!,
                                      style: AppTypography.supporting(context),
                                    ),
                                ],
                              ),
                            ),
                          ),
                        ),
                    ],
                  );
                },
              ),
              const SizedBox(height: AppSpacing.lg),
              for (final module in PermissionChecker(
                snapshot.user.permissionCodes,
              ).visibleModules().where(
                (module) =>
                    module.route != AppRoutes.dashboard &&
                    module.route != AppRoutes.profile &&
                    module.route != AppRoutes.settings,
              )) ...[
                _DashboardTile(
                  title: module.displayName,
                  subtitle: _moduleSubtitle(module),
                  icon: module.icon,
                  onTap: () => context.go(module.route),
                ),
                const SizedBox(height: AppSpacing.md),
              ],
            ],
          );
        },
      ),
    );
  }

  String _moduleSubtitle(StaffModuleDefinition module) {
    return switch (module.id) {
      'attendance' => 'Mark attendance and review session summaries.',
      'timetable' => 'View today and weekly timetable slots.',
      'leave' => 'Request leave and track approval status.',
      'homework' => 'Create and manage assigned homework.',
      'notices' => 'Read school notices and announcements.',
      'classes' => 'Review assigned classes, sections, and subjects.',
      'exams' => 'View exams, schedules, and duty assignments.',
      'marks' => 'Enter, update, and review student marks.',
      'fees' => 'Review collections and revenue metrics.',
      'reports' => 'Open reports available to your permissions.',
      'notifications' => 'Review operational alerts and school messages.',
      _ => 'Open ${module.displayName.toLowerCase()} tools.',
    };
  }
}

class _SyncStatusBanner extends StatelessWidget {
  const _SyncStatusBanner({required this.sync});

  final SyncSnapshot sync;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final isFailed = sync.phase == SyncPhase.failed;
    final isSyncing = sync.phase == SyncPhase.syncing;
    final color = isFailed
        ? colorScheme.errorContainer
        : isSyncing
            ? colorScheme.primaryContainer
            : colorScheme.surfaceContainerHighest;
    final iconColor = isFailed
        ? colorScheme.onErrorContainer
        : isSyncing
            ? colorScheme.onPrimaryContainer
            : colorScheme.onSurface.withOpacity(0.60);
    final text = switch (sync.phase) {
      SyncPhase.syncing => AppLocalizations.of(context).syncing,
      SyncPhase.failed =>
        sync.message ?? AppLocalizations.of(context).syncFailed,
      SyncPhase.success =>
        sync.lastSyncAt == null
            ? AppLocalizations.of(context).synced
            : AppLocalizations.of(context).lastSynced(
                TimeOfDay.fromDateTime(sync.lastSyncAt!).format(context),
              ),
      SyncPhase.idle =>
        sync.lastSyncAt == null
            ? AppLocalizations.of(context).offlineReadyCache
            : AppLocalizations.of(context).lastSynced(
                TimeOfDay.fromDateTime(sync.lastSyncAt!).format(context),
              ),
    };
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          isSyncing
              ? SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: iconColor,
                  ),
                )
              : Icon(
                  isFailed ? Icons.cloud_off : Icons.cloud_done_outlined,
                  size: 18,
                  color: iconColor,
                ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              text,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: iconColor,
                    fontWeight: FontWeight.w500,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _QuickActions extends StatelessWidget {
  const _QuickActions({required this.checker});

  final PermissionChecker checker;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final actions = [
      if (checker.canPerformAction(PermissionActionIds.markAttendance))
        _QuickAction(
          AppLocalizations.of(context).markAttendance,
          Icons.fact_check,
          AppRoutes.attendance,
        ),
      if (checker.canPerformAction(PermissionActionIds.requestLeave))
        _QuickAction(
          AppLocalizations.of(context).applyLeave,
          Icons.event_available,
          AppRoutes.leave,
        ),
      if (checker.canPerformAction(PermissionActionIds.createHomework))
        _QuickAction(
          AppLocalizations.of(context).addHomework,
          Icons.assignment,
          AppRoutes.homework,
        ),
      if (checker.canPerformAction(PermissionActionIds.enterMarks))
        _QuickAction(
          AppLocalizations.of(context).enterMarks,
          Icons.grading,
          AppRoutes.marks,
        ),
    ];
    if (actions.isEmpty) return const SizedBox.shrink();
    return _DashCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: colorScheme.primaryContainer,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  Icons.bolt_outlined,
                  size: 16,
                  color: colorScheme.onPrimaryContainer,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(
                AppLocalizations.of(context).quickActions,
                style: textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              for (final action in actions)
                ActionChip(
                  avatar: Icon(action.icon, size: 18),
                  label: Text(action.label),
                  tooltip: action.label,
                  onPressed: () => context.go(action.route),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _QuickAction {
  const _QuickAction(this.label, this.icon, this.route);

  final String label;
  final IconData icon;
  final String route;
}

class _DashboardTile extends StatelessWidget {
  const _DashboardTile({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: onTap,
      child: _DashCard(
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: colorScheme.secondaryContainer,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                icon,
                size: 22,
                color: colorScheme.onSecondaryContainer,
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xxs),
                  Text(
                    subtitle,
                    style: textTheme.bodySmall?.copyWith(
                      color: colorScheme.onSurface.withOpacity(0.55),
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.chevron_right,
              color: colorScheme.onSurface.withOpacity(0.35),
            ),
          ],
        ),
      ),
    );
  }
}

class _DashCard extends StatelessWidget {
  const _DashCard({required this.child});
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
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: child,
    );
  }
}
