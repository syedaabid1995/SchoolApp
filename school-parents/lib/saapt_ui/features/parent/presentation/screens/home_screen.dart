import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/saapt_theme.dart';
import '../../../../core/network/parent_api_client.dart';
import '../../data/parent_models.dart';
import '../providers/parent_providers.dart';
import 'parent_attendance_calendar.dart';
import 'parent_screen_widgets.dart';

class ParentHomeScreen extends ConsumerWidget {
  const ParentHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final childrenState = ref.watch(parentChildrenProvider);
    final selectedChild = ref.watch(effectiveSelectedChildProvider).asData?.value;
    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(parentChildrenProvider),
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: ParentHero(
                showMenu: true,
                showChildSwitcher: true,
                badge: '👨‍👩‍👧 Parent App',
                title: selectedChild?.name ?? 'Select Child',
                subtitle: childrenState.maybeWhen(
                  data: (children) => selectedChild == null
                      ? '${children.length} ${children.length == 1 ? 'student' : 'students'} mapped to this parent account'
                      : '${selectedChild.classLabel} • ${children.length} ${children.length == 1 ? 'student' : 'students'} mapped',
                  orElse: () => 'Loading mapped children',
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
              sliver: SliverToBoxAdapter(
                child: childrenState.when(
                  loading: () => const LoadingPanel(),
                  error: (error, _) => EmptyPanel(message: error.toString()),
                  data: (children) => _DashboardContent(children: children),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DashboardContent extends ConsumerStatefulWidget {
  const _DashboardContent({required this.children});

  final List<ParentChild> children;

  @override
  ConsumerState<_DashboardContent> createState() => _DashboardContentState();
}

class _DashboardContentState extends ConsumerState<_DashboardContent> {
  late DateTime _month;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _month = DateTime(now.year, now.month);
  }

  @override
  Widget build(BuildContext context) {
    if (widget.children.isEmpty) {
      return const EmptyPanel(
        message: 'No children are mapped to this parent account.',
      );
    }
    final selectedChildId = ref.watch(selectedChildIdProvider);
    var selected = widget.children.first;
    for (final child in widget.children) {
      if (child.id == selectedChildId) {
        selected = child;
        break;
      }
    }
    final selectedDate = DateTime(_month.year, _month.month);
    final attendanceState = ref.watch(
      parentMonthlyAttendanceProvider((
        childId: selected.id,
        month: _month,
        date: selectedDate,
      )),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            StatCard(
              value: widget.children.length.toString(),
              label: 'Children',
            ),
            const SizedBox(width: 14),
            const StatCard(
              value: 'Active',
              label: 'Status',
              color: SaaptTheme.success,
            ),
          ],
        ),
        const SizedBox(height: 22),
        attendanceState.when(
          loading: () => const LoadingPanel(),
          error: (error, _) => EmptyPanel(message: error.toString()),
          data: (attendance) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
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
                    color: const Color(0xFFF24852),
                  ),
                  const SizedBox(width: 12),
                  StatCard(
                    value: attendance.leaveDays.toString(),
                    label: 'Leave',
                    color: const Color(0xFF8B5CF6),
                  ),
                ],
              ),
              const SizedBox(height: 22),
              ParentAttendanceCalendar(
                month: _month,
                attendance: attendance,
                childName: selected.name,
                showMonthlyStatus: false,
                onMonthChanged: (value) {
                  setState(() {
                    _month = DateTime(value.year, value.month);
                  });
                },
                onDaySelected: (date) => _showTimetableSheet(
                  context,
                  ref,
                  childId: selected.id,
                  childName: selected.name,
                  date: date,
                ),
              ),
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: () => context.go('/attendance'),
                icon: const Icon(Icons.calendar_month_rounded),
                label: const Text('Open Attendance'),
                style: FilledButton.styleFrom(
                  backgroundColor: SaaptTheme.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 15),
                  textStyle: const TextStyle(fontWeight: FontWeight.w900),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _showTimetableSheet(
    BuildContext context,
    WidgetRef ref, {
    required String childId,
    required String childName,
    required DateTime date,
  }) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (sheetContext) {
        final maxHeight = MediaQuery.sizeOf(sheetContext).height * 0.78;
        return SafeArea(
          child: ConstrainedBox(
            constraints: BoxConstraints(maxHeight: maxHeight),
            child: _DayTimetableSheet(
              childId: childId,
              childName: childName,
              date: date,
            ),
          ),
        );
      },
    );
  }
}

class _DayTimetableSheet extends ConsumerStatefulWidget {
  const _DayTimetableSheet({
    required this.childId,
    required this.childName,
    required this.date,
  });

  final String childId;
  final String childName;
  final DateTime date;

  @override
  ConsumerState<_DayTimetableSheet> createState() => _DayTimetableSheetState();
}

class _DayTimetableSheetState extends ConsumerState<_DayTimetableSheet> {
  late Future<ParentTimetableDay> _future;

  @override
  void initState() {
    super.initState();
    _future = ref
        .read(parentRepositoryProvider)
        .getTimetable(childId: widget.childId, date: widget.date);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
      child: FutureBuilder<ParentTimetableDay>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Padding(
              padding: EdgeInsets.symmetric(vertical: 48),
              child: Center(child: CircularProgressIndicator()),
            );
          }
          if (snapshot.hasError) {
            return EmptyPanel(
              message: parentApiError(
                snapshot.error!,
                'Unable to load timetable',
              ),
            );
          }
          final timetable = snapshot.data!;
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Timetable',
                style: const TextStyle(
                  color: SaaptTheme.navy,
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '${widget.childName} · ${DateFormat('EEE, d MMM yyyy').format(widget.date)}',
                style: const TextStyle(
                  color: Color(0xFF60708F),
                  fontWeight: FontWeight.w700,
                ),
              ),
              if (timetable.classLabel?.trim().isNotEmpty == true) ...[
                const SizedBox(height: 2),
                Text(
                  timetable.classLabel!,
                  style: const TextStyle(
                    color: Color(0xFF8EA0BA),
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                  ),
                ),
              ],
              const SizedBox(height: 16),
              if (timetable.isNonWorkingDay)
                ParentCard(
                  child: Text(
                    timetable.nonWorkingReason?.trim().isNotEmpty == true
                        ? 'No classes — ${timetable.nonWorkingReason}'
                        : 'No classes on this day.',
                    style: const TextStyle(
                      color: SaaptTheme.navy,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                )
              else if (timetable.periods.isEmpty)
                ParentCard(
                  child: Text(
                    timetable.message?.trim().isNotEmpty == true
                        ? timetable.message!
                        : 'No timetable is published for this day.',
                    style: const TextStyle(
                      color: SaaptTheme.navy,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                )
              else
                Flexible(
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: timetable.periods.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final period = timetable.periods[index];
                      return _TimetablePeriodTile(period: period);
                    },
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _TimetablePeriodTile extends StatelessWidget {
  const _TimetablePeriodTile({required this.period});

  final ParentTimetablePeriod period;

  @override
  Widget build(BuildContext context) {
    final accent = period.isBreak
        ? const Color(0xFFF59E0B)
        : SaaptTheme.primary;
    return ParentCard(
      padding: const EdgeInsets.all(14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 4,
            height: 54,
            decoration: BoxDecoration(
              color: accent,
              borderRadius: BorderRadius.circular(999),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  period.periodName,
                  style: const TextStyle(
                    color: Color(0xFF8EA0BA),
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  period.isBreak ? 'Break' : period.subjectName,
                  style: const TextStyle(
                    color: SaaptTheme.navy,
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  period.isBreak
                      ? period.timeLabel
                      : [
                          period.teacherName,
                          if (period.room?.trim().isNotEmpty == true)
                            period.room!.trim(),
                        ].join(' · '),
                  style: const TextStyle(
                    color: Color(0xFF60708F),
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(
            period.timeLabel,
            style: TextStyle(
              color: accent,
              fontSize: 12,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}
