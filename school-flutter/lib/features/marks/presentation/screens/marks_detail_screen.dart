import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/widgets/app_card.dart';
import '../../domain/entities/marks.dart';

class MarksDetailScreen extends StatelessWidget {
  const MarksDetailScreen({required this.records, super.key});

  final List<MarkRecord> records;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Submitted marks',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: AppSpacing.sm),
          if (records.isEmpty)
            const Text('No marks submitted yet.')
          else
            for (final record in records)
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(record.studentId),
                subtitle: Text(record.status),
                trailing: Text(
                  record.grade == null
                      ? record.marks.toString()
                      : '${record.marks} · ${record.grade}',
                ),
              ),
        ],
      ),
    );
  }
}
