import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../../notices/domain/entities/notice.dart';

class NoticeDetailsScreen extends StatelessWidget {
  const NoticeDetailsScreen({required this.notice, super.key});

  final Notice notice;

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      title: notice.category,
      child: AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(notice.title, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: AppSpacing.sm),
            Text(notice.message ?? 'No message content.'),
          ],
        ),
      ),
    );
  }
}
