import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/permissions/permission_registry.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../../auth/presentation/providers/current_permission_provider.dart';
import '../../domain/entities/leave_entities.dart';
import '../providers/leave_providers.dart';

class LeaveDetailScreen extends ConsumerWidget {
  const LeaveDetailScreen({required this.application, super.key});

  final LeaveApplication application;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final checker = ref.watch(currentPermissionCheckerProvider);
    final canCancel =
        application.canCancel &&
        checker.canPerformAction(PermissionActionIds.cancelLeave);
    final state = ref.watch(leaveRequestControllerProvider);
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final (statusColor, statusBg, statusIcon) =
        _statusStyle(application.status, colorScheme);

    return AppScaffold(
      title: 'Leave Detail',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: AppSpacing.md),

          // ── Status header card ──────────────────────────────────────
          Container(
            padding: const EdgeInsets.all(AppSpacing.lg),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [statusBg, statusBg.withValues(alpha: 0.5)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Icon(statusIcon, size: 28, color: statusColor),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        application.leaveType?.name ?? 'Leave',
                        style: textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: colorScheme.onSurface,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xxs),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.sm,
                          vertical: AppSpacing.xxs,
                        ),
                        decoration: BoxDecoration(
                          color: statusColor.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          application.status[0] +
                              application.status.substring(1).toLowerCase(),
                          style: textTheme.labelMedium?.copyWith(
                            color: statusColor,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                Column(
                  children: [
                    Text(
                      '${application.durationDays}',
                      style: textTheme.displaySmall?.copyWith(
                        color: statusColor,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      application.durationDays == 1 ? 'day' : 'days',
                      style: textTheme.labelSmall?.copyWith(
                        color: statusColor.withValues(alpha: 0.75),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: AppSpacing.lg),

          // ── Details card ────────────────────────────────────────────
          _SectionCard(
            children: [
              _InfoRow(
                icon: Icons.calendar_today_outlined,
                label: 'From',
                value: DateFormat.yMMMMd().format(application.fromDate),
              ),
              _Divider(),
              _InfoRow(
                icon: Icons.event_outlined,
                label: 'To',
                value: DateFormat.yMMMMd().format(application.toDate),
              ),
              if (application.appliedAt != null) ...[
                _Divider(),
                _InfoRow(
                  icon: Icons.schedule_outlined,
                  label: 'Applied On',
                  value: DateFormat.yMMMd().format(application.appliedAt!),
                ),
              ],
            ],
          ),

          const SizedBox(height: AppSpacing.md),

          // ── Reason card ─────────────────────────────────────────────
          _SectionCard(
            children: [
              Row(
                children: [
                  Icon(
                    Icons.notes_outlined,
                    size: 18,
                    color: colorScheme.primary,
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  Text(
                    'Reason',
                    style: textTheme.labelMedium?.copyWith(
                      color: colorScheme.primary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                application.reason,
                style: textTheme.bodyMedium?.copyWith(
                  color: colorScheme.onSurface.withValues(alpha: 0.8),
                  height: 1.5,
                ),
              ),
            ],
          ),

          // ── Review note ─────────────────────────────────────────────
          if (application.reviewNote != null) ...[
            const SizedBox(height: AppSpacing.md),
            Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: colorScheme.tertiaryContainer.withValues(alpha: 0.4),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: colorScheme.tertiary.withValues(alpha: 0.3),
                ),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    Icons.rate_review_outlined,
                    size: 18,
                    color: colorScheme.tertiary,
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Reviewer Note',
                          style: textTheme.labelMedium?.copyWith(
                            color: colorScheme.tertiary,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xxs),
                        Text(
                          application.reviewNote!,
                          style: textTheme.bodySmall?.copyWith(
                            color: colorScheme.onTertiaryContainer,
                            height: 1.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],

          // ── Cancel button ────────────────────────────────────────────
          if (canCancel) ...[
            const SizedBox(height: AppSpacing.xl),
            AppButton(
              label: 'Cancel Request',
              icon: Icons.cancel_outlined,
              isLoading: state.isLoading,
              onPressed: () async {
                await ref
                    .read(leaveRequestControllerProvider.notifier)
                    .cancel(application.id);
                if (context.mounted) Navigator.of(context).pop();
              },
            ),
          ],

          const SizedBox(height: AppSpacing.lg),
        ],
      ),
    );
  }

  (Color, Color, IconData) _statusStyle(
      String status, ColorScheme colorScheme) {
    return switch (status.toUpperCase()) {
      'APPROVED' => (
          colorScheme.onTertiaryContainer,
          colorScheme.tertiaryContainer,
          Icons.check_circle_outline,
        ),
      'REJECTED' => (
          colorScheme.onErrorContainer,
          colorScheme.errorContainer,
          Icons.cancel_outlined,
        ),
      'PENDING' => (
          colorScheme.onSecondaryContainer,
          colorScheme.secondaryContainer,
          Icons.hourglass_top_outlined,
        ),
      _ => (
          colorScheme.onSurface,
          colorScheme.surfaceContainerHighest,
          Icons.info_outline,
        ),
    };
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: colorScheme.shadow.withValues(alpha: 0.06),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: children,
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Row(
        children: [
          Icon(icon, size: 18, color: colorScheme.primary),
          const SizedBox(width: AppSpacing.sm),
          Text(
            label,
            style: textTheme.bodySmall?.copyWith(
              color: colorScheme.onSurface.withValues(alpha: 0.55),
            ),
          ),
          const Spacer(),
          Text(
            value,
            style: textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _Divider extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Divider(
      height: 1,
      color: Theme.of(context).colorScheme.outlineVariant.withValues(alpha: 0.5),
    );
  }
}
