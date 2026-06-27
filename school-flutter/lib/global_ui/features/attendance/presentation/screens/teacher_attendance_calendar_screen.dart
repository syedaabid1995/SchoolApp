import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../domain/entities/attendance_summary.dart';

class TeacherAttendanceCalendarScreen extends StatelessWidget {
  const TeacherAttendanceCalendarScreen({required this.records, super.key});

  final List<TeacherAttendanceRecord> records;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final now = DateTime.now();
    final daysInMonth = DateTime(now.year, now.month + 1, 0).day;
    final byDay = <int, List<TeacherAttendanceRecord>>{};
    for (final record in records) {
      byDay.putIfAbsent(record.date.day, () => []).add(record);
    }

    return Container(
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
              color: colorScheme.primaryContainer,
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(20),
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: colorScheme.primary,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    Icons.calendar_today_outlined,
                    color: colorScheme.onPrimary,
                    size: 20,
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  DateFormat.yMMMM().format(now),
                  style: textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: colorScheme.onPrimaryContainer,
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              children: [
                // Weekday headers
                Row(
                  children: [
                    for (final d in ['M', 'T', 'W', 'T', 'F', 'S', 'S'])
                      Expanded(
                        child: Center(
                          child: Text(
                            d,
                            style: textTheme.labelSmall?.copyWith(
                              fontWeight: FontWeight.w700,
                              color: colorScheme.onSurface.withOpacity(0.45),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: AppSpacing.xs),
                GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: daysInMonth,
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 7,
                    mainAxisSpacing: 6,
                    crossAxisSpacing: 6,
                  ),
                  itemBuilder: (context, index) {
                    final day = index + 1;
                    final dayRecords = byDay[day] ?? const [];
                    final status = _aggregateStatus(dayRecords);
                    final isToday = now.day == day;
                    final bg = _statusBg(context, status);
                    final fg = _statusFg(context, status);

                    return Container(
                      decoration: BoxDecoration(
                        color: isToday ? colorScheme.primary : bg,
                        borderRadius: BorderRadius.circular(10),
                        border: isToday
                            ? null
                            : Border.all(color: fg.withOpacity(0.20), width: 1),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            day.toString(),
                            style: textTheme.labelSmall?.copyWith(
                              fontWeight: FontWeight.w700,
                              color: isToday ? colorScheme.onPrimary : fg,
                              fontSize: 11,
                            ),
                          ),
                          if (status != null)
                            Text(
                              _dayLabel(dayRecords, status),
                              style: textTheme.labelSmall?.copyWith(
                                fontSize: 8,
                                color: isToday
                                    ? colorScheme.onPrimary.withOpacity(0.75)
                                    : fg.withOpacity(0.70),
                              ),
                            ),
                        ],
                      ),
                    );
                  },
                ),
                // Legend
                const SizedBox(height: AppSpacing.md),
                Wrap(
                  spacing: AppSpacing.md,
                  runSpacing: AppSpacing.xs,
                  children: [
                    _LegendDot(
                      color: const Color(0xFF2E7D32),
                      label: 'Present',
                    ),
                    _LegendDot(color: const Color(0xFFC62828), label: 'Absent'),
                    _LegendDot(color: const Color(0xFFC62828), label: 'Leave'),
                    _LegendDot(color: const Color(0xFFF57F17), label: 'Late'),
                    _LegendDot(
                      color: const Color(0xFFE65100),
                      label: 'Half day',
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Color _statusBg(BuildContext context, String? status) => switch (status) {
    'PRESENT' => const Color(0xFFE8F5E9),
    'LATE' => const Color(0xFFFFF8E1),
    'HALF_DAY' => const Color(0xFFFFF3E0),
    'ABSENT' => const Color(0xFFFFEBEE),
    'LEAVE' => const Color(0xFFFFEBEE),
    'MIXED' => const Color(0xFFE3F2FD),
    _ => Theme.of(context).colorScheme.surfaceContainerHighest,
  };

  Color _statusFg(BuildContext context, String? status) => switch (status) {
    'PRESENT' => const Color(0xFF2E7D32),
    'LATE' => const Color(0xFFF57F17),
    'HALF_DAY' => const Color(0xFFE65100),
    'ABSENT' => const Color(0xFFC62828),
    'LEAVE' => const Color(0xFFC62828),
    'MIXED' => const Color(0xFF1565C0),
    _ => Theme.of(context).colorScheme.onSurface.withOpacity(0.40),
  };

  String? _aggregateStatus(List<TeacherAttendanceRecord> records) {
    if (records.isEmpty) return null;
    final statuses = records.map((record) => record.status).toSet();
    return statuses.length == 1 ? statuses.first : 'MIXED';
  }

  String _dayLabel(List<TeacherAttendanceRecord> records, String status) {
    if (records.length <= 1) return status[0];
    final present = records
        .where((record) => record.status == 'PRESENT')
        .length;
    return '$present/${records.length}';
  }
}

class _LegendDot extends StatelessWidget {
  const _LegendDot({required this.color, required this.label});
  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 4),
        Text(
          label,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(color: color),
        ),
      ],
    );
  }
}
