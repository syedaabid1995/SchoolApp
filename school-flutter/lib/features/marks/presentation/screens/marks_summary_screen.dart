import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/async_state_view.dart';
import '../../../exams/domain/entities/exam.dart';
import '../providers/marks_providers.dart';
import 'marks_detail_screen.dart';

class MarksSummaryScreen extends ConsumerWidget {
  const MarksSummaryScreen({required this.paper, super.key});

  final ExamPaper paper;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summary = ref.watch(marksSummaryProvider(paper));
    return AsyncStateView(
      value: summary,
      data: (data) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Summary', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: AppSpacing.sm),
                Text('Submitted: ${data.submittedCount}'),
                Text('Drafts: ${data.draftCount}'),
                Text('Average: ${data.averageMarks.toStringAsFixed(1)}'),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          MarksDetailScreen(records: data.records),
        ],
      ),
    );
  }
}
