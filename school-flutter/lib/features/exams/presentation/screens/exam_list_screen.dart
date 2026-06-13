import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../../../core/widgets/async_state_view.dart';
import '../../domain/entities/exam.dart';
import '../providers/exam_providers.dart';
import 'exam_detail_screen.dart';
import 'exam_duty_screen.dart';

class ExamListScreen extends ConsumerWidget {
  const ExamListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final home = ref.watch(examHomeProvider);
    return AppScaffold(
      title: 'Exams',
      actions: [
        IconButton(
          tooltip: 'Refresh',
          onPressed: () {
            ref.invalidate(examHomeProvider);
            ref.invalidate(examDutiesProvider);
          },
          icon: const Icon(Icons.refresh),
        ),
      ],
      onRefresh: () async {
        ref.invalidate(examHomeProvider);
        ref.invalidate(examDutiesProvider);
      },
      child: AsyncStateView(
        value: home,
        data: (data) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _ExamSection(title: 'Upcoming exams', exams: data.upcoming),
            const SizedBox(height: AppSpacing.md),
            _ExamSection(title: 'Active exams', exams: data.active),
            const SizedBox(height: AppSpacing.md),
            _ExamSection(title: 'Completed exams', exams: data.completed),
            const SizedBox(height: AppSpacing.md),
            const ExamDutyScreen(),
          ],
        ),
      ),
    );
  }
}

class _ExamSection extends StatelessWidget {
  const _ExamSection({required this.title, required this.exams});

  final String title;
  final List<Exam> exams;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          if (exams.isEmpty)
            const Text('No exams found.')
          else
            for (final exam in exams)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.school_outlined),
                title: Text(exam.name),
                subtitle: Text(
                  [
                    exam.type,
                    exam.status,
                    if (exam.scheduledAt != null)
                      DateFormat.yMMMd().format(exam.scheduledAt!),
                  ].join(' · '),
                ),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => ExamDetailScreen(exam: exam),
                  ),
                ),
              ),
        ],
      ),
    );
  }
}
