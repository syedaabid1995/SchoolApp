import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/async_state_view.dart';
import '../providers/exam_providers.dart';

class ExamDutyScreen extends ConsumerWidget {
  const ExamDutyScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final duties = ref.watch(examDutiesProvider);
    return AsyncStateView(
      value: duties,
      data: (items) => AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Invigilation duties',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: AppSpacing.sm),
            if (items.isEmpty)
              const Text('No exam duties assigned.')
            else
              for (final duty in items)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.supervisor_account_outlined),
                  title: Text(duty.subjectName ?? duty.examName ?? 'Exam duty'),
                  subtitle: Text(
                    [
                      if (duty.scheduledAt != null)
                        DateFormat.yMMMd().format(duty.scheduledAt!),
                      if (duty.centerName != null) duty.centerName!,
                      if (duty.roomName != null) duty.roomName!,
                    ].join(' · '),
                  ),
                ),
          ],
        ),
      ),
    );
  }
}
