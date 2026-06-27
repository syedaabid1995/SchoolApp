import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/widgets/async_state_view.dart';
import '../providers/attendance_providers.dart';

class AttendanceHistoryScreen extends ConsumerWidget {
  const AttendanceHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final history = ref.watch(teacherAttendanceHistoryProvider);
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return AsyncStateView(
      value: history,
      data: (records) => Container(
        decoration: BoxDecoration(
          color: colorScheme.surface,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: colorScheme.shadow.withOpacity(0.07),
              blurRadius: 16,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: colorScheme.secondaryContainer,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
              ),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: colorScheme.secondary,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(Icons.history_outlined, color: colorScheme.onSecondary, size: 20),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Text(
                    'My attendance history',
                    style: textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: colorScheme.onSecondaryContainer,
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: records.isEmpty
                  ? Row(
                      children: [
                        Icon(Icons.inbox_outlined, size: 18, color: colorScheme.onSurface.withOpacity(0.40)),
                        const SizedBox(width: AppSpacing.xs),
                        Text(
                          'No self-attendance records for this month.',
                          style: textTheme.bodyMedium?.copyWith(
                            color: colorScheme.onSurface.withOpacity(0.50),
                          ),
                        ),
                      ],
                    )
                  : Column(
                      children: [
                        for (int i = 0; i < records.take(10).length; i++) ...[
                          _HistoryRow(record: records[i]),
                          if (i < records.take(10).length - 1)
                            Divider(height: 1, color: colorScheme.outlineVariant.withOpacity(0.35)),
                        ],
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HistoryRow extends StatelessWidget {
  const _HistoryRow({required this.record});
  final dynamic record;

  Color _statusBg(String status) => switch (status) {
    'PRESENT' => const Color(0xFFE8F5E9),
    'ABSENT'  => const Color(0xFFFFEBEE),
    'LATE'    => const Color(0xFFFFF8E1),
    'HALF_DAY'=> const Color(0xFFFFF3E0),
    _         => const Color(0xFFF5F5F5),
  };

  Color _statusFg(String status) => switch (status) {
    'PRESENT' => const Color(0xFF2E7D32),
    'ABSENT'  => const Color(0xFFC62828),
    'LATE'    => const Color(0xFFF57F17),
    'HALF_DAY'=> const Color(0xFFE65100),
    _         => const Color(0xFF757575),
  };

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final colorScheme = Theme.of(context).colorScheme;
    final status = record.status as String;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: _statusBg(status),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  DateFormat.d().format(record.date as DateTime),
                  style: textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: _statusFg(status),
                  ),
                ),
                Text(
                  DateFormat.MMM().format(record.date as DateTime),
                  style: textTheme.labelSmall?.copyWith(
                    fontSize: 9,
                    color: _statusFg(status).withOpacity(0.75),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Text(
              DateFormat.yMMMMEEEEd().format(record.date as DateTime),
              style: textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w500),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 4),
            decoration: BoxDecoration(
              color: _statusBg(status),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              status,
              style: textTheme.labelSmall?.copyWith(
                color: _statusFg(status),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
