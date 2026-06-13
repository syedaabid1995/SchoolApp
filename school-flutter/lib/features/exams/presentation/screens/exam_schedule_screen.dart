import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/widgets/app_card.dart';
import '../../domain/entities/exam.dart';

class ExamScheduleScreen extends StatelessWidget {
  const ExamScheduleScreen({required this.papers, super.key});

  final List<ExamPaper> papers;

  @override
  Widget build(BuildContext context) {
    final sorted = [...papers]
      ..sort((a, b) {
        final left = a.scheduledAt ?? DateTime.fromMillisecondsSinceEpoch(0);
        final right = b.scheduledAt ?? DateTime.fromMillisecondsSinceEpoch(0);
        return left.compareTo(right);
      });
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Schedule', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          if (sorted.isEmpty)
            const Text('No exam papers scheduled.')
          else
            for (final paper in sorted)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.event_note_outlined),
                title: Text(paper.subjectName ?? 'Subject'),
                subtitle: Text(
                  [
                    if (paper.scheduledAt != null)
                      DateFormat.yMMMd().format(paper.scheduledAt!),
                    if (paper.className != null) paper.className!,
                    if (paper.sectionName != null) paper.sectionName!,
                  ].join(' · '),
                ),
                trailing: Text('${paper.maxMarks}'),
              ),
        ],
      ),
    );
  }
}
