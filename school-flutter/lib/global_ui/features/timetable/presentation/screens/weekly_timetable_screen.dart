import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/widgets/async_state_view.dart';
import '../providers/timetable_providers.dart';

class WeeklyTimetableScreen extends ConsumerWidget {
  const WeeklyTimetableScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final weekly = ref.watch(weeklyTimetableProvider);
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return AsyncStateView(
      value: weekly,
      data: (days) => Container(
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
            // Header
            Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: colorScheme.secondaryContainer,
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
                      color: colorScheme.secondary,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(
                      Icons.calendar_month_outlined,
                      color: colorScheme.onSecondary,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Text(
                    'This week',
                    style: textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: colorScheme.onSecondaryContainer,
                    ),
                  ),
                ],
              ),
            ),
            // Day rows
            Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md,
                vertical: AppSpacing.xs,
              ),
              child: Column(
                children: [
                  for (int i = 0; i < days.length; i++) ...[
                    _DayRow(day: days[i], index: i),
                    if (i < days.length - 1)
                      Divider(
                        height: 1,
                        color: colorScheme.outlineVariant.withOpacity(0.35),
                      ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
          ],
        ),
      ),
    );
  }
}

class _DayRow extends StatelessWidget {
  const _DayRow({required this.day, required this.index});

  final dynamic day;
  final int index;

  static const _dayColors = [
    Color(0xFFE3F2FD),
    Color(0xFFE8F5E9),
    Color(0xFFFFF8E1),
    Color(0xFFF3E5F5),
    Color(0xFFE0F7FA),
  ];
  static const _dayOnColors = [
    Color(0xFF1565C0),
    Color(0xFF2E7D32),
    Color(0xFFF57F17),
    Color(0xFF6A1B9A),
    Color(0xFF00695C),
  ];

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final bg = _dayColors[index % _dayColors.length];
    final fg = _dayOnColors[index % _dayOnColors.length];
    final isToday = DateUtils.isSameDay(day.date, DateTime.now());

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Row(
        children: [
          // Day badge
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: isToday ? colorScheme.primary : bg,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  DateFormat.E().format(day.date),
                  style: textTheme.labelSmall?.copyWith(
                    color: isToday ? colorScheme.onPrimary : fg,
                    fontWeight: FontWeight.w700,
                    fontSize: 11,
                  ),
                ),
                Text(
                  DateFormat.d().format(day.date),
                  style: textTheme.labelMedium?.copyWith(
                    color: isToday ? colorScheme.onPrimary : fg,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Text(
              DateFormat.EEEE().format(day.date),
              style: textTheme.bodyMedium?.copyWith(
                fontWeight: isToday ? FontWeight.w700 : FontWeight.w400,
                color: isToday
                    ? colorScheme.primary
                    : colorScheme.onSurface,
              ),
            ),
          ),
          // Slot count pill
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.sm,
              vertical: 4,
            ),
            decoration: BoxDecoration(
              color: day.entries.length > 0
                  ? colorScheme.primaryContainer
                  : colorScheme.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              day.entries.length > 0
                  ? '${day.entries.length} slot${day.entries.length == 1 ? '' : 's'}'
                  : 'Free',
              style: textTheme.labelSmall?.copyWith(
                fontWeight: FontWeight.w600,
                color: day.entries.length > 0
                    ? colorScheme.onPrimaryContainer
                    : colorScheme.onSurface.withOpacity(0.45),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
