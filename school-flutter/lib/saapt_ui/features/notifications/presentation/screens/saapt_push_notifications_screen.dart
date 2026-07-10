import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../global_ui/features/notifications/domain/entities/staff_notification.dart';
import '../../../../../global_ui/features/notifications/presentation/providers/notification_providers.dart';
import '../../../../app/theme/saapt_theme.dart';

class SaaptPushNotificationsScreen extends ConsumerWidget {
  const SaaptPushNotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final center = ref.watch(pushNotificationCenterProvider);
    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(pushNotificationCenterProvider),
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: _NotificationHeader(
                onBack: () => Navigator.of(context).maybePop(),
                onMarkAllRead: () => ref
                    .read(pushNotificationCenterProvider.notifier)
                    .markAllAsRead(),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
              sliver: SliverToBoxAdapter(
                child: center.when(
                  loading: () => const SizedBox(
                    height: 240,
                    child: Center(child: CircularProgressIndicator()),
                  ),
                  error: (error, _) => _MessageCard(message: error.toString()),
                  data: (state) {
                    if (state.items.isEmpty) {
                      return const _MessageCard(
                        message: 'No push notifications available.',
                      );
                    }
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        for (final item in state.items) ...[
                          _NotificationCard(
                            item: item,
                            onTap: () async {
                              await ref
                                  .read(pushNotificationCenterProvider.notifier)
                                  .markAsRead(item.id);
                              if (!context.mounted) return;
                              await showModalBottomSheet<void>(
                                context: context,
                                showDragHandle: true,
                                isScrollControlled: true,
                                constraints: BoxConstraints(
                                  maxWidth: MediaQuery.sizeOf(context).width,
                                ),
                                builder: (_) =>
                                    _NotificationDetails(item: item),
                              );
                            },
                          ),
                          const SizedBox(height: 12),
                        ],
                      ],
                    );
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NotificationHeader extends StatelessWidget {
  const _NotificationHeader({
    required this.onBack,
    required this.onMarkAllRead,
  });

  final VoidCallback onBack;
  final VoidCallback onMarkAllRead;

  @override
  Widget build(BuildContext context) => Container(
    color: SaaptTheme.primary,
    padding: const EdgeInsets.fromLTRB(20, 48, 20, 28),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            IconButton(
              style: IconButton.styleFrom(
                backgroundColor: Colors.white.withValues(alpha: 0.14),
                foregroundColor: Colors.white,
              ),
              onPressed: onBack,
              icon: const Icon(Icons.arrow_back_rounded),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: Colors.white.withValues(alpha: 0.32)),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.notifications_active_rounded,
                    size: 18,
                    color: Colors.white,
                  ),
                  SizedBox(width: 7),
                  Text(
                    'Push Notifications',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
            const Spacer(),
            IconButton(
              style: IconButton.styleFrom(
                backgroundColor: Colors.white.withValues(alpha: 0.14),
                foregroundColor: Colors.white,
              ),
              tooltip: 'Mark all as read',
              onPressed: onMarkAllRead,
              icon: const Icon(Icons.done_all_rounded),
            ),
          ],
        ),
        const SizedBox(height: 18),
        const Text(
          'Notifications',
          style: TextStyle(
            color: Colors.white,
            fontSize: 32,
            fontWeight: FontWeight.w800,
            height: 1.05,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Push updates sent from the school backend.',
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.82),
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    ),
  );
}

class _NotificationCard extends StatelessWidget {
  const _NotificationCard({required this.item, required this.onTap});

  final StaffNotification item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
    borderRadius: BorderRadius.circular(8),
    onTap: onTap,
    child: Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFDDE5F2)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 52,
            height: 52,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: item.isRead
                  ? const Color(0xFFF2F5FA)
                  : const Color(0xFFEAF1FF),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFFD5E2FF)),
            ),
            child: Icon(
              item.isRead
                  ? Icons.notifications_none_rounded
                  : Icons.notifications_active_rounded,
              color: SaaptTheme.primary,
              size: 26,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        item.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Color(0xFF102044),
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          height: 1.2,
                        ),
                      ),
                    ),
                    if (!item.isRead) ...[
                      const SizedBox(width: 8),
                      Container(
                        width: 9,
                        height: 9,
                        decoration: const BoxDecoration(
                          color: SaaptTheme.success,
                          shape: BoxShape.circle,
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 7),
                Text(
                  item.message?.trim().isNotEmpty == true
                      ? item.message!.trim()
                      : 'No message content.',
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Color(0xFF60708F),
                    fontWeight: FontWeight.w600,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

class _NotificationDetails extends StatelessWidget {
  const _NotificationDetails({required this.item});

  final StaffNotification item;

  @override
  Widget build(BuildContext context) => SafeArea(
    child: SizedBox(
      width: double.infinity,
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          10,
          20,
          20 + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              item.title,
              style: const TextStyle(
                color: Color(0xFF102044),
                fontSize: 22,
                fontWeight: FontWeight.w900,
                height: 1.2,
              ),
            ),
            const SizedBox(height: 14),
            Text(
              item.message?.trim().isNotEmpty == true
                  ? item.message!.trim()
                  : 'No message content.',
              style: const TextStyle(
                color: Color(0xFF60708F),
                fontSize: 16,
                fontWeight: FontWeight.w600,
                height: 1.45,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _MessageCard extends StatelessWidget {
  const _MessageCard({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(8),
      border: Border.all(color: const Color(0xFFDDE5F2)),
    ),
    child: Text(
      message,
      textAlign: TextAlign.center,
      style: const TextStyle(
        color: Color(0xFF60708F),
        fontWeight: FontWeight.w600,
      ),
    ),
  );
}
