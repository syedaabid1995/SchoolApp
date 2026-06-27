import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../domain/entities/timetable_entry.dart';

class TimetableDetailScreen extends StatelessWidget {
  const TimetableDetailScreen({required this.timetable, super.key});

  final TeacherTimetable timetable;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

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
          // Header
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
                    Icons.today_outlined,
                    color: colorScheme.onPrimary,
                    size: 20,
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Today',
                      style: textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: colorScheme.onPrimaryContainer,
                      ),
                    ),
                    Text(
                      DateFormat.yMMMMEEEEd().format(timetable.date),
                      style: textTheme.bodySmall?.copyWith(
                        color: colorScheme.onPrimaryContainer.withOpacity(0.70),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          // Entries
          Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: timetable.entries.isEmpty
                ? Row(
                    children: [
                      Icon(
                        Icons.event_busy_outlined,
                        size: 18,
                        color: colorScheme.onSurface.withOpacity(0.40),
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      Text(
                        'No timetable entries for this day.',
                        style: textTheme.bodyMedium?.copyWith(
                          color: colorScheme.onSurface.withOpacity(0.50),
                        ),
                      ),
                    ],
                  )
                : Column(
                    children: [
                      for (int i = 0; i < timetable.entries.length; i++) ...[
                        _EntryRow(
                          entry: timetable.entries[i],
                          index: i,
                        ),
                        if (i < timetable.entries.length - 1)
                          Divider(
                            height: AppSpacing.md,
                            color: colorScheme.outlineVariant.withOpacity(0.35),
                          ),
                      ],
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

class _EntryRow extends StatelessWidget {
  const _EntryRow({required this.entry, required this.index});

  final TimetableEntry entry;
  final int index;

  static const _palette = [
    Color(0xFFE8F5E9),
    Color(0xFFE3F2FD),
    Color(0xFFFFF8E1),
    Color(0xFFF3E5F5),
    Color(0xFFE0F7FA),
  ];
  static const _paletteOn = [
    Color(0xFF2E7D32),
    Color(0xFF1565C0),
    Color(0xFFF57F17),
    Color(0xFF6A1B9A),
    Color(0xFF00695C),
  ];

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final accentBg = _palette[index % _palette.length];
    final accentFg = _paletteOn[index % _paletteOn.length];
    final room = entry.classRoom?.roomNumber ?? entry.room ?? '';

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Time chip
        Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.sm,
            vertical: AppSpacing.xs,
          ),
          decoration: BoxDecoration(
            color: accentBg,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Column(
            children: [
              Text(
                entry.period.startTime,
                style: textTheme.labelSmall?.copyWith(
                  color: accentFg,
                  fontWeight: FontWeight.w700,
                  fontSize: 11,
                ),
              ),
              Text(
                entry.period.endTime,
                style: textTheme.labelSmall?.copyWith(
                  color: accentFg.withOpacity(0.70),
                  fontSize: 10,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        // Subject + class
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                entry.subjectName,
                style: textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                '${entry.className}${entry.sectionName == null ? '' : ' · ${entry.sectionName}'}',
                style: textTheme.bodySmall?.copyWith(
                  color: colorScheme.onSurface.withOpacity(0.55),
                ),
              ),
            ],
          ),
        ),
        // Room badge
        if (room.isNotEmpty)
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.xs,
              vertical: 3,
            ),
            decoration: BoxDecoration(
              color: colorScheme.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              room,
              style: textTheme.labelSmall?.copyWith(
                color: colorScheme.onSurface.withOpacity(0.60),
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
      ],
    );
  }
}
