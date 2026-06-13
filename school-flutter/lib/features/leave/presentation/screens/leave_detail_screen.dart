import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/permissions/permission_registry.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_card.dart';
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

    return AppScaffold(
      title: 'Leave detail',
      child: AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              application.leaveType?.name ?? 'Leave',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text('Status: ${application.status}'),
            Text('Duration: ${application.durationDays} day(s)'),
            Text('From: ${DateFormat.yMMMd().format(application.fromDate)}'),
            Text('To: ${DateFormat.yMMMd().format(application.toDate)}'),
            const SizedBox(height: AppSpacing.sm),
            Text(application.reason),
            if (application.reviewNote != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text('Review note: ${application.reviewNote}'),
            ],
            if (canCancel) ...[
              const SizedBox(height: AppSpacing.lg),
              AppButton(
                label: 'Cancel request',
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
          ],
        ),
      ),
    );
  }
}
