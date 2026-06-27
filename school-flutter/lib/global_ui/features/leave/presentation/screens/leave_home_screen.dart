import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/permissions/permission_registry.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../../../core/widgets/async_state_view.dart';
import '../../../auth/presentation/providers/current_permission_provider.dart';
import '../../domain/entities/leave_entities.dart';
import '../providers/leave_providers.dart';
import 'leave_history_screen.dart';
import 'leave_request_screen.dart';

class LeaveHomeScreen extends ConsumerWidget {
  const LeaveHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(leaveHomeProvider);
    final checker = ref.watch(currentPermissionCheckerProvider);
    final canRequest = checker.canPerformAction(
      PermissionActionIds.requestLeave,
    );

    return AppScaffold(
      title: 'Leave',
      emoji: '🏖️',
      subtitle: 'Track your leave balances and requests.',
      onRefresh: () async => ref.invalidate(leaveHomeProvider),
      actions: [
        IconButton(
          tooltip: 'Refresh',
          onPressed: () => ref.invalidate(leaveHomeProvider),
          icon: const Icon(Icons.refresh),
        ),
      ],
      child: AsyncStateView(
        value: data,
        data: (value) => _LeaveHomeContent(
          value: value,
          canRequest: canRequest,
        ),
      ),
    );
  }
}

class _LeaveHomeContent extends StatelessWidget {
  const _LeaveHomeContent({
    required this.value,
    required this.canRequest,
  });

  final LeaveHomeData value;
  final bool canRequest;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Stack(
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: AppSpacing.md),

            // ── Summary banner ──────────────────────────────────────────
            _SummaryBanner(value: value),
            const SizedBox(height: AppSpacing.lg),

            // ── Section label ───────────────────────────────────────────
            Text(
              'Leave Balances',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: colorScheme.onSurface,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),

            if (value.balances.isEmpty)
              _EmptyCard(message: 'No leave balances available.')
            else
              for (final balance in value.balances) ...[
                _BalanceCard(balance: balance),
                const SizedBox(height: AppSpacing.sm),
              ],

            const SizedBox(height: AppSpacing.lg),

            Text(
              'Leave History',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: colorScheme.onSurface,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),

            LeaveHistoryScreen(applications: value.applications),

            // Bottom padding for FAB
            if (canRequest) const SizedBox(height: 80),
          ],
        ),

        // ── Floating action button ───────────────────────────────────────
        if (canRequest)
          Positioned(
            bottom: AppSpacing.lg,
            right: 0,
            child: FloatingActionButton.extended(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => LeaveRequestScreen(types: value.types),
                ),
              ),
              icon: const Icon(Icons.add),
              label: const Text('Request Leave'),
            ),
          ),
      ],
    );
  }
}

class _SummaryBanner extends StatelessWidget {
  const _SummaryBanner({required this.value});

  final LeaveHomeData value;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final pending = value.pendingCount;
    final approved = value.applications.where((a) => a.status == 'APPROVED').length;
    final totalUsed = value.balances.fold(0, (sum, b) => sum + b.usedDays);

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            colorScheme.primaryContainer,
            colorScheme.secondaryContainer,
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: [
          Expanded(
            child: _StatItem(
              icon: Icons.pending_actions_outlined,
              label: 'Pending',
              value: '$pending',
              color: colorScheme.onPrimaryContainer,
            ),
          ),
          _Divider(),
          Expanded(
            child: _StatItem(
              icon: Icons.check_circle_outline,
              label: 'Approved',
              value: '$approved',
              color: colorScheme.onPrimaryContainer,
            ),
          ),
          _Divider(),
          Expanded(
            child: _StatItem(
              icon: Icons.today_outlined,
              label: 'Days Used',
              value: '$totalUsed',
              color: colorScheme.onPrimaryContainer,
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
    return Container(
      width: 1,
      height: 40,
      color: Theme.of(context).colorScheme.onPrimaryContainer.withValues(alpha: 0.2),
    );
  }
}

class _StatItem extends StatelessWidget {
  const _StatItem({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Icon(icon, color: color, size: 22),
        const SizedBox(height: AppSpacing.xxs),
        Text(
          value,
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                color: color,
                fontWeight: FontWeight.w800,
              ),
        ),
        Text(
          label,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: color.withValues(alpha: 0.75),
              ),
        ),
      ],
    );
  }
}

class _BalanceCard extends StatelessWidget {
  const _BalanceCard({required this.balance});

  final LeaveBalance balance;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final progress =
        balance.totalDays > 0 ? balance.usedDays / balance.totalDays : 0.0;
    final isLow = balance.remainingDays <= 2;

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
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: isLow
                      ? colorScheme.errorContainer
                      : colorScheme.primaryContainer,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  Icons.beach_access_outlined,
                  size: 18,
                  color: isLow
                      ? colorScheme.onErrorContainer
                      : colorScheme.onPrimaryContainer,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  balance.leaveType.name,
                  style: textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: AppSpacing.xxs,
                ),
                decoration: BoxDecoration(
                  color: isLow
                      ? colorScheme.errorContainer
                      : colorScheme.secondaryContainer,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '${balance.remainingDays} left',
                  style: textTheme.labelSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: isLow
                        ? colorScheme.onErrorContainer
                        : colorScheme.onSecondaryContainer,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: progress.clamp(0.0, 1.0),
              minHeight: 6,
              backgroundColor: colorScheme.surfaceContainerHighest,
              valueColor: AlwaysStoppedAnimation<Color>(
                isLow ? colorScheme.error : colorScheme.primary,
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${balance.usedDays} used',
                style: textTheme.labelSmall?.copyWith(
                  color: colorScheme.onSurface.withValues(alpha: 0.55),
                ),
              ),
              Text(
                '${balance.totalDays} total',
                style: textTheme.labelSmall?.copyWith(
                  color: colorScheme.onSurface.withValues(alpha: 0.55),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _EmptyCard extends StatelessWidget {
  const _EmptyCard({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Center(
        child: Text(
          message,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: colorScheme.onSurface.withValues(alpha: 0.5),
              ),
        ),
      ),
    );
  }
}
