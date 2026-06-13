import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/permissions/permission_registry.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../../../core/widgets/async_state_view.dart';
import '../../../auth/presentation/providers/current_permission_provider.dart';
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
        data: (value) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (canRequest)
              AppButton(
                label: 'Request leave',
                icon: Icons.add,
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => LeaveRequestScreen(types: value.types),
                  ),
                ),
              ),
            if (canRequest) const SizedBox(height: AppSpacing.md),
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Balances',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  if (value.balances.isEmpty)
                    const Text('No leave balances available.')
                  else
                    for (final balance in value.balances)
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(balance.leaveType.name),
                        subtitle: Text(
                          '${balance.remainingDays} remaining of ${balance.totalDays}',
                        ),
                        trailing: Text('${balance.usedDays} used'),
                      ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            LeaveHistoryScreen(applications: value.applications),
          ],
        ),
      ),
    );
  }
}
