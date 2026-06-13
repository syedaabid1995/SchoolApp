import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../../../core/widgets/async_state_view.dart';
import '../../../classes/domain/entities/class_assignment.dart';
import '../providers/academic_providers.dart';

class ClassAcademicOverviewScreen extends ConsumerWidget {
  const ClassAcademicOverviewScreen({required this.assignedClass, super.key});

  final AssignedClass assignedClass;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final overview = ref.watch(classAcademicOverviewProvider(assignedClass));
    return AppScaffold(
      title: '${assignedClass.name} academics',
      onRefresh: () async {
        ref.invalidate(classAcademicOverviewProvider(assignedClass));
      },
      child: AsyncStateView(
        value: overview,
        data: (data) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AppCard(
              child: Wrap(
                spacing: AppSpacing.md,
                runSpacing: AppSpacing.sm,
                children: [
                  _Metric(label: 'Sections', value: data.sections.length),
                  _Metric(label: 'Subjects', value: data.subjects.length),
                  _Metric(label: 'Homework', value: data.homeworkCount),
                  _Metric(label: 'Exam papers', value: data.examPapers.length),
                  _Metric(label: 'Pending marks', value: data.pendingMarkTasks),
                  _Metric(label: 'Submitted marks', value: data.submittedMarks),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            _ListCard(
              title: 'Subjects',
              rows: data.subjects.map((subject) => subject.name).toList(),
            ),
            const SizedBox(height: AppSpacing.md),
            _ListCard(
              title: 'Recent homework',
              rows: data.homework.map((item) => item.description).toList(),
            ),
            const SizedBox(height: AppSpacing.md),
            _ListCard(
              title: 'Exam summary',
              rows: data.examPapers
                  .map((paper) => paper.subjectName ?? paper.id)
                  .toList(),
            ),
            const SizedBox(height: AppSpacing.md),
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Attendance summary',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    data.attendanceSummary == null
                        ? 'No attendance summary available.'
                        : '${data.attendanceSummary!.totals.present} present of ${data.attendanceSummary!.totals.records} records',
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({required this.label, required this.value});

  final String label;
  final int value;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 140,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: Theme.of(context).textTheme.labelMedium),
          Text('$value', style: Theme.of(context).textTheme.headlineSmall),
        ],
      ),
    );
  }
}

class _ListCard extends StatelessWidget {
  const _ListCard({required this.title, required this.rows});

  final String title;
  final List<String> rows;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          if (rows.isEmpty)
            const Text('No records found.')
          else
            for (final row in rows.take(5))
              ListTile(contentPadding: EdgeInsets.zero, title: Text(row)),
        ],
      ),
    );
  }
}
