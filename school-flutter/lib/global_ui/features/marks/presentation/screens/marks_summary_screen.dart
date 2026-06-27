import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_spacing.dart';
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
      shimmerItemCount: 2,
      data: (data) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Summary',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
          ),
          const SizedBox(height: AppSpacing.sm),
          _StatsBanner(
            submitted: data.submittedCount,
            drafts: data.draftCount,
            average: data.averageMarks,
            maxMarks: paper.maxMarks,
          ),
          if (data.records.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            MarksDetailScreen(records: data.records),
          ],
        ],
      ),
    );
  }
}

class _StatsBanner extends StatelessWidget {
  const _StatsBanner({
    required this.submitted,
    required this.drafts,
    required this.average,
    required this.maxMarks,
  });

  final int submitted;
  final int drafts;
  final num average;
  final num maxMarks;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
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
              icon: Icons.check_circle_outline,
              label: 'Submitted',
              value: '$submitted',
              color: colorScheme.onPrimaryContainer,
            ),
          ),
          _VerticalDivider(color: colorScheme.onPrimaryContainer),
          Expanded(
            child: _StatItem(
              icon: Icons.edit_note_outlined,
              label: 'Drafts',
              value: '$drafts',
              color: colorScheme.onPrimaryContainer,
            ),
          ),
          _VerticalDivider(color: colorScheme.onPrimaryContainer),
          Expanded(
            child: _StatItem(
              icon: Icons.analytics_outlined,
              label: 'Average',
              value: average.toStringAsFixed(1),
              color: colorScheme.onPrimaryContainer,
            ),
          ),
        ],
      ),
    );
  }
}

class _VerticalDivider extends StatelessWidget {
  const _VerticalDivider({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 1,
      height: 40,
      color: color.withValues(alpha: 0.2),
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
        Icon(icon, color: color, size: 20),
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
