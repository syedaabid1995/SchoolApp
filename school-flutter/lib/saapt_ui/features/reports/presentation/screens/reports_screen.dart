import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../../global_ui/features/attendance/domain/entities/attendance_summary.dart';
import '../../../../../global_ui/features/attendance/presentation/providers/attendance_providers.dart';
import '../../../../../global_ui/features/classes/domain/entities/class_assignment.dart';
import '../../../../../global_ui/features/classes/presentation/providers/class_assignment_providers.dart';
import '../../../../app/theme/saapt_theme.dart';
import 'class_performance_screen.dart';

final _attendanceSummaryForDateProvider = FutureProvider.autoDispose
    .family<AttendanceSummary, DateTime>((ref, date) {
      return ref.watch(attendanceRepositoryProvider).getSummary(date: date);
    });

class SaaptReportsScreen extends ConsumerWidget {
  const SaaptReportsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final assignmentsState = ref.watch(classAssignmentsProvider);
    final optionsState = ref.watch(studentAttendanceOptionsProvider);
    final today = _dateOnly(DateTime.now());

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(classAssignmentsProvider);
          ref.invalidate(studentAttendanceOptionsProvider);
          ref.invalidate(_attendanceSummaryForDateProvider);
        },
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            const _ReportsHeader(),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 22, 20, 28),
              child: _ReportBody(
                assignmentsState: assignmentsState,
                optionsState: optionsState,
                today: today,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ReportBody extends StatelessWidget {
  const _ReportBody({
    required this.assignmentsState,
    required this.optionsState,
    required this.today,
  });

  final AsyncValue<ClassAssignments> assignmentsState;
  final AsyncValue<StudentAttendanceOptions> optionsState;
  final DateTime today;

  @override
  Widget build(BuildContext context) {
    final loading = assignmentsState.isLoading || optionsState.isLoading;
    final error = assignmentsState.error ?? optionsState.error;
    final assignments = assignmentsState.asData?.value;
    final options = optionsState.asData?.value;

    if (loading && (assignments == null || options == null)) {
      return const _LoadingPanel();
    }
    if (error != null && (assignments == null || options == null)) {
      return _MessageCard(message: error.toString());
    }
    if (assignments == null || options == null) {
      return const _MessageCard(message: 'Report data is not available.');
    }

    final scopes = _buildReportScopes(assignments, options, today);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Student Sessions',
          style: TextStyle(
            color: Color(0xFF102044),
            fontSize: 23,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 14),
        if (scopes.isEmpty)
          const _MessageCard(
            message: 'No assigned classes are available for this teacher.',
          )
        else
          for (final scope in scopes) ...[
            _AssignedScopeSessions(scope: scope),
            const SizedBox(height: 12),
          ],
        const SizedBox(height: 10),
        _WeeklyStudentAttendance(today: today),
        const SizedBox(height: 16),
        FilledButton.icon(
          style: FilledButton.styleFrom(
            minimumSize: const Size.fromHeight(56),
            backgroundColor: SaaptTheme.primary,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
          ),
          onPressed: () => Navigator.of(context, rootNavigator: true).push(
            MaterialPageRoute(builder: (_) => const ClassPerformanceScreen()),
          ),
          icon: const Icon(Icons.insights_rounded),
          label: const Text(
            'Class Performance',
            style: TextStyle(fontWeight: FontWeight.w800),
          ),
        ),
      ],
    );
  }
}

class _ReportsHeader extends StatelessWidget {
  const _ReportsHeader();

  @override
  Widget build(BuildContext context) => Container(
    color: SaaptTheme.primary,
    padding: const EdgeInsets.fromLTRB(24, 52, 24, 28),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.14),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: Colors.white.withValues(alpha: 0.32)),
          ),
          child: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.bar_chart_rounded, size: 19, color: Colors.white),
              SizedBox(width: 7),
              Text(
                'Teacher Reports',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        const Text(
          'Attendance Dashboard',
          style: TextStyle(
            color: Colors.white,
            fontSize: 32,
            fontWeight: FontWeight.w800,
            height: 1.05,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Student Sessions',
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.82),
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    ),
  );
}

class _AssignedScopeSessions extends ConsumerWidget {
  const _AssignedScopeSessions({required this.scope});
  final _ReportScope scope;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scopeQuery = AttendanceScopeQuery(
      academicYearId: scope.academicYearId,
      classId: scope.classId,
      sectionId: scope.sectionId,
      date: scope.date,
    );
    final unitsState = ref.watch(attendanceUnitsProvider(scopeQuery));
    return unitsState.when(
      loading: () => const _SessionLoadingCard(),
      error: (error, _) => _MessageCard(message: error.toString()),
      data: (units) {
        if (units.isEmpty) {
          return _MessageCard(
            message: '${scope.label} has no attendance units configured.',
          );
        }
        return Column(
          children: [
            for (final unit in units) ...[
              _SessionCard(scope: scope, scopeQuery: scopeQuery, unit: unit),
              if (unit != units.last) const SizedBox(height: 12),
            ],
          ],
        );
      },
    );
  }
}

class _SessionCard extends ConsumerWidget {
  const _SessionCard({
    required this.scope,
    required this.scopeQuery,
    required this.unit,
  });

  final _ReportScope scope;
  final AttendanceScopeQuery scopeQuery;
  final AttendanceUnit unit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final query = AttendanceSheetQuery(scope: scopeQuery, unit: unit);
    final sheetState = ref.watch(attendanceSheetProvider(query));
    return sheetState.when(
      loading: () => const _SessionLoadingCard(),
      error: (error, _) => _MessageCard(message: error.toString()),
      data: (sheet) {
        final stats = _SessionStats.fromSheet(sheet);
        final color = stats.rate >= 0.9
            ? SaaptTheme.success
            : stats.rate >= 0.75
            ? SaaptTheme.primary
            : SaaptTheme.warning;
        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFFDDE5F2)),
          ),
          child: Row(
            children: [
              _SessionIcon(unit: unit),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${scope.label} - ${_unitTitle(unit)}',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Color(0xFF102044),
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      stats.marked == 0
                          ? '${stats.total} Students • 0 Marked'
                          : '${stats.present} Present • ${stats.notPresent} Absent',
                      style: const TextStyle(
                        color: Color(0xFF60708F),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (_unitDetails(unit).isNotEmpty) ...[
                      const SizedBox(height: 3),
                      Text(
                        _unitDetails(unit),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Color(0xFF91A0BA),
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 10),
              _RateBadge(rate: stats.rate, color: color),
            ],
          ),
        );
      },
    );
  }
}

class _WeeklyStudentAttendance extends StatelessWidget {
  const _WeeklyStudentAttendance({required this.today});
  final DateTime today;

  @override
  Widget build(BuildContext context) {
    final days = _weekDays(today);
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFDDE5F2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Weekly Student Attendance',
            style: TextStyle(
              color: Color(0xFF102044),
              fontSize: 19,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 18),
          SizedBox(
            height: 178,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                for (final day in days) ...[
                  Expanded(child: _WeeklyBar(day: day)),
                  if (day != days.last) const SizedBox(width: 8),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _WeeklyBar extends ConsumerWidget {
  const _WeeklyBar({required this.day});
  final DateTime day;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summary = ref.watch(_attendanceSummaryForDateProvider(day));
    final rate = summary.maybeWhen(
      data: (value) => value.totals.presentRate.clamp(0, 1).toDouble(),
      orElse: () => 0.0,
    );
    final color = rate >= 0.9
        ? SaaptTheme.success
        : rate >= 0.75
        ? SaaptTheme.primary
        : SaaptTheme.warning;
    final height = 28 + (112 * rate);
    return Column(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          height: summary.isLoading ? 42 : height,
          width: double.infinity,
          constraints: const BoxConstraints(maxWidth: 54),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                color,
                color.withValues(alpha: summary.hasError ? 0.25 : 0.55),
              ],
            ),
            borderRadius: BorderRadius.circular(8),
          ),
        ),
        const SizedBox(height: 9),
        Text(
          DateFormat.E().format(day),
          style: const TextStyle(
            color: Color(0xFF60708F),
            fontWeight: FontWeight.w800,
            fontSize: 12,
          ),
        ),
      ],
    );
  }
}

class _SessionIcon extends StatelessWidget {
  const _SessionIcon({required this.unit});
  final AttendanceUnit unit;

  @override
  Widget build(BuildContext context) {
    final icon = switch (unit.slotType) {
      AttendanceSlotType.morning => Icons.wb_twilight_rounded,
      AttendanceSlotType.afternoon => Icons.wb_sunny_rounded,
      _ =>
        unit.unitType == AttendanceUnitType.day
            ? Icons.calendar_today_rounded
            : Icons.menu_book_rounded,
    };
    return Container(
      width: 58,
      height: 58,
      decoration: BoxDecoration(
        color: const Color(0xFFEAF1FF),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFD5E2FF)),
      ),
      child: Icon(icon, color: SaaptTheme.primary, size: 26),
    );
  }
}

class _RateBadge extends StatelessWidget {
  const _RateBadge({required this.rate, required this.color});
  final double rate;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
    decoration: BoxDecoration(
      color: color.withValues(alpha: 0.10),
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: color.withValues(alpha: 0.32)),
    ),
    child: Text(
      '${(rate * 100).round()}%',
      style: TextStyle(color: color, fontWeight: FontWeight.w800),
    ),
  );
}

class _SessionLoadingCard extends StatelessWidget {
  const _SessionLoadingCard();

  @override
  Widget build(BuildContext context) => Container(
    height: 92,
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(8),
      border: Border.all(color: const Color(0xFFDDE5F2)),
    ),
    child: const Center(child: CircularProgressIndicator()),
  );
}

class _LoadingPanel extends StatelessWidget {
  const _LoadingPanel();

  @override
  Widget build(BuildContext context) => const SizedBox(
    height: 260,
    child: Center(child: CircularProgressIndicator()),
  );
}

class _MessageCard extends StatelessWidget {
  const _MessageCard({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(8),
      border: Border.all(color: const Color(0xFFDDE5F2)),
    ),
    child: Text(
      message,
      textAlign: TextAlign.center,
      style: const TextStyle(
        color: Color(0xFF60708F),
        fontWeight: FontWeight.w600,
      ),
    ),
  );
}

class _ReportScope {
  const _ReportScope({
    required this.academicYearId,
    required this.classId,
    required this.className,
    required this.date,
    this.sectionId,
    this.sectionName,
  });

  final String academicYearId;
  final String classId;
  final String className;
  final String? sectionId;
  final String? sectionName;
  final DateTime date;

  String get label {
    final section = sectionName?.trim();
    if (section == null || section.isEmpty) return className;
    if (section.length <= 2) return '$className$section';
    return '$className - $section';
  }
}

class _SessionStats {
  const _SessionStats({
    required this.total,
    required this.marked,
    required this.present,
  });

  factory _SessionStats.fromSheet(AttendanceSheet sheet) {
    final markedRows = sheet.rows.where((row) => row.recordId != null);
    final present = markedRows.where((row) => row.status == 'PRESENT').length;
    return _SessionStats(
      total: sheet.rows.length,
      marked: markedRows.length,
      present: present,
    );
  }

  final int total;
  final int marked;
  final int present;

  int get notPresent => marked - present;

  double get rate {
    if (marked == 0) return 0;
    return present / marked;
  }
}

List<_ReportScope> _buildReportScopes(
  ClassAssignments assignments,
  StudentAttendanceOptions options,
  DateTime date,
) {
  final activeYear =
      options.academicYears.where((item) => item.isActive).firstOrNull ??
      options.academicYears.firstOrNull;
  if (activeYear == null) return const [];

  final scopes = <_ReportScope>[];
  final seen = <String>{};
  for (final assignedClass in assignments.classes) {
    final academicYearId = assignedClass.academicYearId?.isNotEmpty == true
        ? assignedClass.academicYearId!
        : activeYear.id;
    final assignedSections = assignments.sectionsForClass(assignedClass.id);
    final optionSections = options.sectionsForClass(assignedClass.id);
    final sections = assignedSections.isNotEmpty
        ? [
            for (final section in assignedSections)
              _ScopeSection(id: section.id, name: section.name),
          ]
        : [
            for (final section in optionSections)
              _ScopeSection(id: section.id, name: section.name),
          ];

    if (sections.isEmpty) {
      final key = '${assignedClass.id}:none';
      if (seen.add(key)) {
        scopes.add(
          _ReportScope(
            academicYearId: academicYearId,
            classId: assignedClass.id,
            className: assignedClass.name,
            date: date,
          ),
        );
      }
      continue;
    }

    for (final section in sections) {
      final key = '${assignedClass.id}:${section.id}';
      if (!seen.add(key)) continue;
      scopes.add(
        _ReportScope(
          academicYearId: academicYearId,
          classId: assignedClass.id,
          className: assignedClass.name,
          sectionId: section.id,
          sectionName: section.name,
          date: date,
        ),
      );
    }
  }
  return scopes;
}

class _ScopeSection {
  const _ScopeSection({required this.id, required this.name});
  final String id;
  final String name;
}

List<DateTime> _weekDays(DateTime today) {
  final monday = today.subtract(Duration(days: today.weekday - 1));
  return [
    for (var index = 0; index < 7; index++) monday.add(Duration(days: index)),
  ];
}

DateTime _dateOnly(DateTime date) => DateTime(date.year, date.month, date.day);

String _unitTitle(AttendanceUnit unit) {
  if (unit.unitType == AttendanceUnitType.day) return 'Day';
  if (unit.slotType == AttendanceSlotType.morning) return 'Morning';
  if (unit.slotType == AttendanceSlotType.afternoon) return 'Afternoon';
  return unit.label;
}

String _unitDetails(AttendanceUnit unit) {
  return [
    unit.subjectName,
    unit.teacherName,
    [unit.startTime, unit.endTime].whereType<String>().join(' - '),
  ].where((item) => item != null && item.isNotEmpty).join(' • ');
}
