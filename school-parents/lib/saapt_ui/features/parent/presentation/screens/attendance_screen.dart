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
    final absentSessions = attendance.sessions
        .where((session) => session.status.toLowerCase() == 'absent')
        .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            StatCard(
              value: attendance.presentSessions.toString(),
              label: 'Present',
              color: SaaptTheme.success,
            ),
            const SizedBox(width: 12),
            StatCard(
              value: attendance.absentSessions.toString(),
              label: 'Absent',
              color: const Color(0xFFEF4C55),
            ),
            const SizedBox(width: 12),
            StatCard(
              value: '${attendance.selectedDayPercent}%',
              label: 'Day',
              color: SaaptTheme.warning,
            ),
          ],
        ),
        const SizedBox(height: 26),
        const Text(
          'Session-wise Attendance',
          style: TextStyle(
            color: SaaptTheme.navy,
            fontSize: 19,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 16),
        if (attendance.sessions.isEmpty)
          const EmptyPanel(
            message: 'No attendance sessions are available for this date.',
          )
        else
          ...attendance.sessions.map(
            (session) => Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: _SessionAttendanceCard(session: session),
            ),
          ),
        if (absentSessions.isNotEmpty) ...[
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
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  '${child.name} was marked absent for ${absentSessions.first.label.toLowerCase()}.',
                  style: const TextStyle(
                    color: Color(0xFF586985),
                    fontSize: 15,
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

class _SessionAttendanceCard extends StatelessWidget {
  const _SessionAttendanceCard({required this.session});

  final ParentAttendanceSession session;

  @override
  Widget build(BuildContext context) {
    final status = session.status.toLowerCase();
    final absent = status == 'absent';
    final late = status == 'late';
    final unmarked = status == 'unmarked';
    final color = absent
        ? const Color(0xFFEF4C55)
        : late
        ? SaaptTheme.warning
        : unmarked
        ? const Color(0xFF8EA0BA)
        : SaaptTheme.success;
    final icon = session.unitType == 'SLOT'
        ? (session.label.toLowerCase().contains('afternoon') ? '☀️' : '🌅')
        : session.unitType == 'DAY'
        ? '📅'
        : '📚';
    final timeRange = _formatTimeRange(session.startTime, session.endTime);

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
            child: Text(icon, style: const TextStyle(fontSize: 23)),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  session.label,
                  style: const TextStyle(
                    color: SaaptTheme.navy,
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  session.remark?.isNotEmpty == true
                      ? session.remark!
                      : timeRange,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Color(0xFF586985),
                    fontSize: 13,
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
              session.status,
              style: TextStyle(color: color, fontWeight: FontWeight.w900),
            ),
          ),
        ],
      ),
    );
  }

  String _formatTimeRange(String? start, String? end) {
    final startLabel = _formatTime(start);
    final endLabel = _formatTime(end);
    if (startLabel == null || endLabel == null) {
      return 'Attendance session';
    }
    return '$startLabel - $endLabel';
  }

  String? _formatTime(String? value) {
    if (value == null || value.trim().isEmpty) return null;
    final parts = value.split(':');
    final hour = int.tryParse(parts.first);
    if (hour == null) return value;
    final minute = parts.length > 1 ? int.tryParse(parts[1]) ?? 0 : 0;
    final suffix = hour >= 12 ? 'PM' : 'AM';
    final displayHour = hour == 0 ? 12 : (hour > 12 ? hour - 12 : hour);
    return '$displayHour:${minute.toString().padLeft(2, '0')} $suffix';
  }
}
