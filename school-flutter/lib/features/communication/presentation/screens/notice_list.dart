import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../notices/domain/entities/notice.dart';
import 'notice_details_screen.dart';

class NoticeList extends StatelessWidget {
  const NoticeList({required this.notices, this.onOpen, super.key});

  final List<Notice> notices;
  final Future<void> Function(Notice notice)? onOpen;

  @override
  Widget build(BuildContext context) {
    if (notices.isEmpty) return const EmptyState(title: 'No messages found');
    return Column(
      children: [
        for (final notice in notices)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.sm),
            child: ListTile(
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
              tileColor: Theme.of(context).colorScheme.surfaceContainerHighest,
              leading: Icon(
                notice.isRead ? Icons.campaign_outlined : Icons.campaign,
              ),
              title: Text(notice.title),
              subtitle: Text(notice.message ?? notice.category),
              trailing: notice.isRead
                  ? null
                  : const Icon(Icons.circle, size: 10),
              onTap: () async {
                await onOpen?.call(notice);
                if (!context.mounted) return;
                Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => NoticeDetailsScreen(notice: notice),
                  ),
                );
              },
            ),
          ),
      ],
    );
  }
}
