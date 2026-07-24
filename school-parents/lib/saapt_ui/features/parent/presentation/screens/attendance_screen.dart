import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/saapt_theme.dart';
import '../../data/parent_models.dart';
import '../providers/parent_providers.dart';
import 'parent_screen_widgets.dart';

class ParentAttendanceScreen extends ConsumerWidget {
  const ParentAttendanceScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final childState = ref.watch(effectiveSelectedChildProvider);
    return Scaffold(
      body: childState.when(
        loading: () => const LoadingPanel(),
        error: (error, _) => EmptyPanel(message: error.toString()),
        data: (child) {
          if (child == null) {
            return const _NoChildSelected();
          }
          final attendanceState = ref.watch(parentAttendanceProvider(child));
          return RefreshIndicator(
            onRefresh: () async =>
                ref.invalidate(parentAttendanceProvider(child)),
            child: CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: ParentHero(
                    badge: '📅 Parent Attendance',
                    title: child.name,
                    subtitle:
                        '${child.classLabel} • ${DateFormat('d MMM y').format(DateTime.now())}',
                  ),
                ),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
                  sliver: SliverToBoxAdapter(
                    child: attendanceState.when(
                      loading: () => const LoadingPanel(),
                      error: (error, _) =>
                          EmptyPanel(message: error.toString()),
                      data: (attendance) => _AttendanceContent(
                        child: child,
                        attendance: attendance,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _NoChildSelected extends StatelessWidget {
  const _NoChildSelected();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(24),
        child: EmptyPanel(
          message: 'Select a child from Home to view attendance.',
        ),
      ),
    );
  }
}

class _AttendanceContent extends StatelessWidget {
  const _AttendanceContent({required this.child, required this.attendance});

  final ParentChild child;
  final ParentAttendance attendance;

  @override
  Widget build(BuildContext context) {
    final latestAbsent =
        attendance.calendar
            .where((day) => day.status.toLowerCase() == 'absent')
            .toList()
          ..sort((a, b) => b.date.compareTo(a.date));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            StatCard(
              value: attendance.presentDays.toString(),
              label: 'Present',
              color: SaaptTheme.success,
            ),
            const SizedBox(width: 12),
            StatCard(
              value: attendance.absentDays.toString(),
              label: 'Absent',
              color: const Color(0xFFEF4C55),
            ),
            const SizedBox(width: 12),
            StatCard(
              value: '${attendance.attendancePercent}%',
              label: 'Month',
              color: SaaptTheme.warning,
            ),
          ],
        ),
        const SizedBox(height: 26),
        const Text(
          'Session-wise Attendance',
          style: TextStyle(
            color: SaaptTheme.navy,
            fontSize: 23,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 16),
        if (attendance.calendar.isEmpty)
          const EmptyPanel(
            message: 'No attendance records are available for this month.',
          )
        else
          ...attendance.calendar
              .take(12)
              .map(
                (day) => Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: _DayAttendanceCard(day: day),
                ),
              ),
        if (latestAbsent.isNotEmpty) ...[
          const SizedBox(height: 10),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF8EA),
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: const Color(0xFFFFD89B)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Attendance Alert',
                  style: TextStyle(
                    color: SaaptTheme.warning,
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  '${child.name} was marked absent on ${DateFormat('d MMM y').format(latestAbsent.first.date)}.',
                  style: const TextStyle(
                    color: Color(0xFF586985),
                    fontSize: 18,
                    height: 1.45,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _DayAttendanceCard extends StatelessWidget {
  const _DayAttendanceCard({required this.day});

  final ParentAttendanceDay day;

  @override
  Widget build(BuildContext context) {
    final absent = day.status.toLowerCase() == 'absent';
    final late = day.status.toLowerCase() == 'late';
    final color = absent
        ? const Color(0xFFEF4C55)
        : late
        ? SaaptTheme.warning
        : SaaptTheme.success;
    return ParentCard(
      child: Row(
        children: [
          Container(
            width: 58,
            height: 58,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: const Color(0xFFEAF1FF),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFD2E1FF)),
            ),
            child: Text(
              absent ? '☀️' : '🌅',
              style: const TextStyle(fontSize: 28),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  DateFormat('EEE, d MMM').format(day.date),
                  style: const TextStyle(
                    color: SaaptTheme.navy,
                    fontSize: 19,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  day.remark?.isNotEmpty == true
                      ? day.remark!
                      : 'Daily attendance',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Color(0xFF586985),
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: color.withValues(alpha: 0.3)),
            ),
            child: Text(
              day.status,
              style: TextStyle(color: color, fontWeight: FontWeight.w900),
            ),
          ),
        ],
      ),
    );
  }
}
