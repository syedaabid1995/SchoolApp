import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../../../core/widgets/async_state_view.dart';
import '../../../../core/widgets/empty_state.dart';
import '../providers/notification_providers.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final center = ref.watch(notificationCenterProvider);
    return AppScaffold(
      title: 'Notifications',
      actions: [
        TextButton(
          onPressed: () =>
              ref.read(notificationCenterProvider.notifier).markAllAsRead(),
          child: const Text('Mark read'),
        ),
      ],
      child: AsyncStateView(
        value: center,
        data: (state) {
          if (state.items.isEmpty) {
            return const EmptyState(title: 'No notifications yet');
          }
          return Column(
            children: [
              for (final item in state.items)
                Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                  child: ListTile(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                    tileColor: Theme.of(
                      context,
                    ).colorScheme.surfaceContainerHighest,
                    leading: Icon(
                      item.isRead
                          ? Icons.notifications_none
                          : Icons.notifications_active,
                    ),
                    title: Text(item.title),
                    subtitle: item.message == null ? null : Text(item.message!),
                    trailing: item.isRead
                        ? null
                        : const Icon(Icons.circle, size: 10),
                    onTap: () => ref
                        .read(notificationCenterProvider.notifier)
                        .markAsRead(item.id),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}
