import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/saapt_theme.dart';
import '../../data/parent_models.dart';
import 'parent_screen_widgets.dart';

class ParentAttendanceCalendar extends StatelessWidget {
  const ParentAttendanceCalendar({
    super.key,
    required this.month,
    required this.attendance,
    required this.childName,
    this.onMonthChanged,
  });

  final DateTime month;
  final ParentAttendance attendance;
  final String childName;
  final ValueChanged<DateTime>? onMonthChanged;

  @override
  Widget build(BuildContext context) {
    final monthStart = DateTime(month.year, month.month);
    final daysInMonth = DateTime(month.year, month.month + 1, 0).day;
    final leadingBlanks = monthStart.weekday % 7;
    final cells = leadingBlanks + daysInMonth;
    final trailingBlanks = (7 - (cells % 7)) % 7;
    final byDate = {
      for (final day in attendance.calendar) _dateKey(day.date): day,
    };
    final statusRows = [
      for (var day = 1; day <= daysInMonth; day++)
        _CalendarDayStatus(
          date: DateTime(month.year, month.month, day),
          entry: byDate[_dateKey(DateTime(month.year, month.month, day))],
        ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ParentCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      '$childName Attendance',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: SaaptTheme.navy,
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                  IconButton(
                    tooltip: 'Previous month',
                    onPressed: onMonthChanged == null
                        ? null
                        : () => onMonthChanged!(
                            DateTime(month.year, month.month - 1),
                          ),
                    icon: const Icon(Icons.chevron_left_rounded),
                  ),
                  Text(
                    DateFormat('MMM yyyy').format(monthStart),
                    style: const TextStyle(
                      color: SaaptTheme.primary,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  IconButton(
                    tooltip: 'Next month',
                    onPressed: onMonthChanged == null
                        ? null
                        : () => onMonthChanged!(
                            DateTime(month.year, month.month + 1),
                          ),
                    icon: const Icon(Icons.chevron_right_rounded),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  for (final label in ['S', 'M', 'T', 'W', 'T', 'F', 'S'])
                    Expanded(
                      child: Center(
                        child: Text(
                          label,
                          style: const TextStyle(
                            color: Color(0xFF91A0BA),
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 10),
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: leadingBlanks + daysInMonth + trailingBlanks,
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 7,
                  mainAxisSpacing: 10,
                  crossAxisSpacing: 10,
                  childAspectRatio: 1,
                ),
                itemBuilder: (context, index) {
                  final day = index - leadingBlanks + 1;
                  if (day < 1 || day > daysInMonth) {
                    return const SizedBox.shrink();
                  }
                  final date = DateTime(month.year, month.month, day);
                  final status = _CalendarDayStatus(
                    date: date,
                    entry: byDate[_dateKey(date)],
                  );
                  return Tooltip(
                    message: status.tooltip,
                    child: _CalendarDayCell(status: status),
                  );
                },
              ),
              const SizedBox(height: 16),
              const Wrap(
                spacing: 12,
                runSpacing: 8,
                children: [
                  _CalendarLegend(color: SaaptTheme.success, label: 'Present'),
                  _CalendarLegend(color: Color(0xFFD64545), label: 'Absent'),
                  _CalendarLegend(color: SaaptTheme.warning, label: 'Holiday'),
                  _CalendarLegend(color: Color(0xFF8B5CF6), label: 'Leave'),
                  _CalendarLegend(color: Color(0xFF60708F), label: 'Pending'),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        const Text(
          'Monthly Status',
          style: TextStyle(
            color: SaaptTheme.navy,
            fontSize: 19,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 12),
        for (final row in statusRows) ...[
          _StatusListTile(status: row),
          const SizedBox(height: 10),
        ],
      ],
    );
  }
}

class _CalendarDayCell extends StatelessWidget {
  const _CalendarDayCell({required this.status});

  final _CalendarDayStatus status;

  @override
  Widget build(BuildContext context) {
    final background = status.isToday
        ? SaaptTheme.primary
        : status.color.withValues(alpha: status.isPending ? 0.08 : 0.12);
    final foreground = status.isToday ? Colors.white : status.color;

    return Container(
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(8),
        border: status.isToday
            ? null
            : Border.all(color: status.color.withValues(alpha: 0.12)),
      ),
      alignment: Alignment.center,
      child: Text(
        '${status.date.day}',
        style: TextStyle(
          color: foreground,
          fontSize: 16,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

class _StatusListTile extends StatelessWidget {
  const _StatusListTile({required this.status});

  final _CalendarDayStatus status;

  @override
  Widget build(BuildContext context) {
    return ParentCard(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: status.color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(status.icon, color: status.color, size: 21),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  DateFormat('EEE, d MMM').format(status.date),
                  style: const TextStyle(
                    color: SaaptTheme.navy,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                if (status.note != null) ...[
                  const SizedBox(height: 3),
                  Text(
                    status.note!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Color(0xFF60708F),
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
            decoration: BoxDecoration(
              color: status.color.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: status.color.withValues(alpha: 0.24)),
            ),
            child: Text(
              status.label,
              style: TextStyle(
                color: status.color,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CalendarLegend extends StatelessWidget {
  const _CalendarLegend({required this.color, required this.label});

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Container(
        width: 10,
        height: 10,
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(3),
        ),
      ),
      const SizedBox(width: 6),
      Text(
        label,
        style: const TextStyle(
          color: Color(0xFF60708F),
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    ],
  );
}

class _CalendarDayStatus {
  const _CalendarDayStatus({required this.date, this.entry});

  final DateTime date;
  final ParentAttendanceDay? entry;

  String get label {
    final normalized = entry?.status.trim().toLowerCase() ?? '';
    if (normalized == 'present') return 'Present';
    if (normalized == 'absent') return 'Absent';
    if (normalized == 'late') return 'Late';
    if (normalized == 'half day') return 'Half Day';
    if (normalized == 'holiday') return 'Holiday';
    if (normalized.contains('leave')) return 'Leave';
    return 'Pending';
  }

  String? get note =>
      entry?.remark?.trim().isEmpty == true ? null : entry?.remark;

  bool get isPending => label == 'Pending';

  bool get isToday {
    final now = DateTime.now();
    return date.year == now.year &&
        date.month == now.month &&
        date.day == now.day;
  }

  Color get color => switch (label) {
    'Present' => SaaptTheme.success,
    'Absent' => const Color(0xFFD64545),
    'Holiday' => SaaptTheme.warning,
    'Leave' => const Color(0xFF8B5CF6),
    'Late' || 'Half Day' => SaaptTheme.primary,
    _ => const Color(0xFF60708F),
  };

  IconData get icon => switch (label) {
    'Present' => Icons.check_circle_outline,
    'Absent' => Icons.cancel_outlined,
    'Holiday' => Icons.event_available_outlined,
    'Leave' => Icons.assignment_turned_in_outlined,
    'Late' || 'Half Day' => Icons.timelapse_outlined,
    _ => Icons.hourglass_empty_outlined,
  };

  String get tooltip {
    final details = note == null ? '' : ': $note';
    return '${DateFormat('d MMM').format(date)} - $label$details';
  }
}

String _dateKey(DateTime date) =>
    '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
