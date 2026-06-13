import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../domain/entities/notice.dart';

class NoticeDetailScreen extends StatelessWidget {
  const NoticeDetailScreen({required this.notice, super.key});

  final Notice notice;

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      title: 'Notice',
      child: AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(notice.title, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: AppSpacing.xs),
            Text(notice.category),
            const SizedBox(height: AppSpacing.md),
            Text(notice.message ?? 'No message content.'),
          ],
        ),
      ),
    );
  }
}
