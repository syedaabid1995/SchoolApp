import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../../../core/widgets/async_state_view.dart';
import '../../domain/entities/exam.dart';
import '../providers/exam_providers.dart';
import 'exam_schedule_screen.dart';

class ExamDetailScreen extends ConsumerWidget {
  const ExamDetailScreen({required this.exam, super.key});

  final Exam exam;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(examDetailProvider(exam.id));
    return AppScaffold(
      title: exam.name,
      onRefresh: () async => ref.invalidate(examDetailProvider(exam.id)),
      child: AsyncStateView(
        value: detail,
        data: (value) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    value.name,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text('${value.type} · ${value.status}'),
                  if (value.scheduledAt != null)
                    Text(DateFormat.yMMMMd().format(value.scheduledAt!)),
                  if (value.className != null || value.sectionName != null)
                    Text(
                      [
                        value.className,
                        value.sectionName,
                      ].whereType<String>().join(' '),
                    ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            ExamScheduleScreen(papers: value.papers),
          ],
        ),
      ),
    );
  }
}
