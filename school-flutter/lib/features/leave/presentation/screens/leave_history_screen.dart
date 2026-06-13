import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/widgets/app_card.dart';
import '../../domain/entities/leave_entities.dart';
import 'leave_detail_screen.dart';

class LeaveHistoryScreen extends StatelessWidget {
  const LeaveHistoryScreen({required this.applications, super.key});

  final List<LeaveApplication> applications;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Leave history', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          if (applications.isEmpty)
            const Text('No leave requests yet.')
          else
            for (final item in applications.take(20))
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(item.leaveType?.name ?? 'Leave request'),
                subtitle: Text(
                  '${DateFormat.yMMMd().format(item.fromDate)} - ${DateFormat.yMMMd().format(item.toDate)}',
                ),
                trailing: Text(item.status),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => LeaveDetailScreen(application: item),
                  ),
                ),
              ),
        ],
      ),
    );
  }
}
