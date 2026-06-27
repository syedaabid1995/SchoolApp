import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../../../core/widgets/async_state_view.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../communication/presentation/screens/announcement_screen.dart';
import '../../../communication/presentation/screens/important_alerts_screen.dart';
import '../../../communication/presentation/screens/notice_list.dart';
import '../providers/notice_providers.dart';

class NoticeBoardScreen extends ConsumerStatefulWidget {
  const NoticeBoardScreen({super.key});

  @override
  ConsumerState<NoticeBoardScreen> createState() => _NoticeBoardScreenState();
}

class _NoticeBoardScreenState extends ConsumerState<NoticeBoardScreen> {
  var _query = '';
  var _filter = 'all';

  @override
  Widget build(BuildContext context) {
    final board = ref.watch(noticeBoardProvider);
    return AppScaffold(
      title: 'Notices',
      onRefresh: () async => ref.invalidate(noticeBoardProvider),
      actions: [
        IconButton(
          tooltip: 'Refresh',
          icon: const Icon(Icons.refresh),
          onPressed: () => ref.invalidate(noticeBoardProvider),
        ),
      ],
      child: AsyncStateView(
        value: board,
        data: (state) {
          final filtered = _filter == 'unread'
              ? state.search(_query).where((notice) => !notice.isRead).toList()
              : state.search(_query);
          if (state.notices.isEmpty) {
            return const EmptyState(title: 'No notices yet');
          }
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(
                decoration: const InputDecoration(
                  labelText: 'Search notices',
                  prefixIcon: Icon(Icons.search),
                ),
                onChanged: (value) => setState(() => _query = value),
              ),
              const SizedBox(height: AppSpacing.sm),
              Wrap(
                spacing: AppSpacing.sm,
                children: [
                  ChoiceChip(
                    label: const Text('All'),
                    selected: _filter == 'all',
                    onSelected: (_) => setState(() => _filter = 'all'),
                  ),
                  ChoiceChip(
                    label: Text('Unread (${state.unreadCount})'),
                    selected: _filter == 'unread',
                    onSelected: (_) => setState(() => _filter = 'unread'),
                  ),
                  ActionChip(
                    label: const Text('Announcements'),
                    avatar: const Icon(Icons.campaign_outlined),
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => const AnnouncementScreen(),
                      ),
                    ),
                  ),
                  ActionChip(
                    label: const Text('Important'),
                    avatar: const Icon(Icons.priority_high),
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => const ImportantAlertsScreen(),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              if (filtered.isEmpty)
                const EmptyState(title: 'No matching notices')
              else
                NoticeList(
                  notices: filtered,
                  onOpen: (notice) => ref
                      .read(noticeBoardProvider.notifier)
                      .markRead(notice.id),
                ),
            ],
          );
        },
      ),
    );
  }
}
