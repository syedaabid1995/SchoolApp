import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../../global_ui/features/attendance/domain/entities/attendance_summary.dart';
import '../../../../../global_ui/features/attendance/presentation/providers/attendance_providers.dart';
import '../../../../../global_ui/features/classes/domain/entities/class_assignment.dart';
import '../../../../../global_ui/features/classes/presentation/providers/class_assignment_providers.dart';
import '../../../../app/theme/saapt_theme.dart';

enum _ReportMode { day, month }

class AttendanceReportScreen extends ConsumerStatefulWidget {
  const AttendanceReportScreen({super.key});

  @override
  ConsumerState<AttendanceReportScreen> createState() =>
      _AttendanceReportScreenState();
}

class _AttendanceReportScreenState
    extends ConsumerState<AttendanceReportScreen> {
  _ReportMode _mode = _ReportMode.day;
  DateTime _selectedDate = _dateOnly(DateTime.now());
  String? _classId;
  String? _sectionId;

  @override
  Widget build(BuildContext context) {
    final assignmentsState = ref.watch(classAssignmentsProvider);
    final optionsState = ref.watch(studentAttendanceOptionsProvider);
    final loading = assignmentsState.isLoading || optionsState.isLoading;
    final error = assignmentsState.error ?? optionsState.error;
    final assignments = assignmentsState.asData?.value;
    final options = optionsState.asData?.value;

    if (loading && (assignments == null || options == null)) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (error != null && (assignments == null || options == null)) {
      return Scaffold(body: _FullScreenMessage(message: error.toString()));
    }
    if (assignments == null || options == null) {
      return const Scaffold(
        body: _FullScreenMessage(message: 'Attendance report data is missing.'),
      );
    }

    final activeYear =
        options.academicYears.where((item) => item.isActive).firstOrNull ??
        options.academicYears.firstOrNull;
    final classChoices = _classChoices(assignments, options, activeYear?.id);
    _applyDefaults(classChoices, assignments, options);
    final selectedClass = classChoices
        .where((item) => item.id == _classId)
        .firstOrNull;
    final sectionChoices = _sectionChoices(assignments, options, _classId);
    final selectedSection = sectionChoices
        .where((item) => item.id == _sectionId)
        .firstOrNull;

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(child: _AttendanceHeader(onBack: _pop)),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
            sliver: SliverToBoxAdapter(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _ModeTabs(
                    mode: _mode,
                    onChanged: (value) => setState(() => _mode = value),
                  ),
                  const SizedBox(height: 16),
                  _FilterCard(
                    classes: classChoices,
                    sections: sectionChoices,
                    selectedClassId: _classId,
                    selectedSectionId: _sectionId,
                    selectedDate: _selectedDate,
                    mode: _mode,
                    onClassChanged: (value) =>
                        _selectClass(value, assignments, options),
                    onSectionChanged: (value) =>
                        setState(() => _sectionId = value),
                    onPickDate: _pickDate,
                  ),
                  const SizedBox(height: 18),
                  if (classChoices.isEmpty)
                    const _MessageCard(
                      message: 'No assigned classes are available.',
                    )
                  else if (selectedClass == null)
                    const _MessageCard(message: 'Select a class to continue.')
                  else if (selectedSection == null)
                    const _MessageCard(
                      message: 'Select a section to view attendance.',
                    )
                  else if (_mode == _ReportMode.day)
                    _DailyReportPanel(
                      scope: AttendanceScopeQuery(
                        academicYearId: selectedClass.academicSessionId,
                        classId: selectedClass.id,
                        sectionId: selectedSection.id,
                        date: _selectedDate,
                      ),
                    )
                  else
                    _MonthlyReportPanel(
                      query: StudentAttendanceReportQuery(
                        academicSessionId: selectedClass.academicSessionId,
                        classId: selectedClass.id,
                        sectionId: selectedSection.id,
                        month: _selectedDate.month,
                        year: _selectedDate.year,
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _pop() => Navigator.of(context).maybePop();

  void _applyDefaults(
    List<_ClassChoice> classes,
    ClassAssignments assignments,
    StudentAttendanceOptions options,
  ) {
    if (classes.isEmpty) {
      _classId = null;
      _sectionId = null;
      return;
    }
    if (!classes.any((item) => item.id == _classId)) {
      _classId = classes.first.id;
      _sectionId = null;
    }
    final sections = _sectionChoices(assignments, options, _classId);
    if (sections.isEmpty) {
      _sectionId = null;
      return;
    }
    if (!sections.any((item) => item.id == _sectionId)) {
      _sectionId = sections.first.id;
    }
  }

  void _selectClass(
    String? classId,
    ClassAssignments assignments,
    StudentAttendanceOptions options,
  ) {
    setState(() {
      _classId = classId;
      _sectionId = _sectionChoices(
        assignments,
        options,
        classId,
      ).firstOrNull?.id;
    });
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2020),
      lastDate: DateTime(DateTime.now().year + 1, 12, 31),
    );
    if (picked == null) return;
    setState(() => _selectedDate = _dateOnly(picked));
  }
}

class _AttendanceHeader extends StatelessWidget {
  const _AttendanceHeader({required this.onBack});
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) => Container(
    color: SaaptTheme.primary,
    padding: const EdgeInsets.fromLTRB(20, 48, 20, 28),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            IconButton(
              style: IconButton.styleFrom(
                backgroundColor: Colors.white.withValues(alpha: 0.14),
                foregroundColor: Colors.white,
              ),
              onPressed: onBack,
              icon: const Icon(Icons.arrow_back_rounded),
            ),
            const SizedBox(width: 8),
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
                  Icon(Icons.school_rounded, size: 18, color: Colors.white),
                  SizedBox(width: 7),
                  Text(
                    'Class-wise Reports',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 18),
        const Text(
          'Student Attendance',
          style: TextStyle(
            color: Colors.white,
            fontSize: 32,
            fontWeight: FontWeight.w800,
            height: 1.05,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Day-wise and monthly class report',
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

class _ModeTabs extends StatelessWidget {
  const _ModeTabs({required this.mode, required this.onChanged});

  final _ReportMode mode;
  final ValueChanged<_ReportMode> onChanged;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Expanded(
        child: _ModeButton(
          label: 'Day Wise',
          selected: mode == _ReportMode.day,
          onTap: () => onChanged(_ReportMode.day),
        ),
      ),
      const SizedBox(width: 12),
      Expanded(
        child: _ModeButton(
          label: 'Monthly',
          selected: mode == _ReportMode.month,
          onTap: () => onChanged(_ReportMode.month),
        ),
      ),
    ],
  );
}

class _ModeButton extends StatelessWidget {
  const _ModeButton({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
    borderRadius: BorderRadius.circular(8),
    onTap: onTap,
    child: Container(
      height: 64,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: selected ? const Color(0xFFEAF1FF) : Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: selected ? const Color(0xFFCFE0FF) : const Color(0xFFDDE5F2),
          width: selected ? 1.4 : 1,
        ),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: selected ? SaaptTheme.primary : const Color(0xFF60708F),
          fontWeight: FontWeight.w800,
          fontSize: 16,
        ),
      ),
    ),
  );
}

class _FilterCard extends StatelessWidget {
  const _FilterCard({
    required this.classes,
    required this.sections,
    required this.selectedClassId,
    required this.selectedSectionId,
    required this.selectedDate,
    required this.mode,
    required this.onClassChanged,
    required this.onSectionChanged,
    required this.onPickDate,
  });

  final List<_ClassChoice> classes;
  final List<_SectionChoice> sections;
  final String? selectedClassId;
  final String? selectedSectionId;
  final DateTime selectedDate;
  final _ReportMode mode;
  final ValueChanged<String?> onClassChanged;
  final ValueChanged<String?> onSectionChanged;
  final VoidCallback onPickDate;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(20),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(8),
      border: Border.all(color: const Color(0xFFDDE5F2)),
    ),
    child: Column(
      children: [
        _SelectField(
          label: 'CLASS STANDARD',
          value: selectedClassId,
          items: [
            for (final cls in classes)
              DropdownMenuItem(value: cls.id, child: Text(cls.name)),
          ],
          hint: 'Select class',
          onChanged: classes.isEmpty ? null : onClassChanged,
        ),
        const SizedBox(height: 16),
        _SelectField(
          label: 'SECTION',
          value: sections.any((section) => section.id == selectedSectionId)
              ? selectedSectionId
              : null,
          items: [
            for (final section in sections)
              DropdownMenuItem(value: section.id, child: Text(section.name)),
          ],
          hint: sections.isEmpty ? 'No sections assigned' : 'Select section',
          onChanged: sections.isEmpty ? null : onSectionChanged,
        ),
        const SizedBox(height: 16),
        _DateField(
          label: mode == _ReportMode.day ? 'DATE' : 'MONTH',
          value: mode == _ReportMode.day
              ? DateFormat('d MMMM yyyy').format(selectedDate)
              : DateFormat('MMMM yyyy').format(selectedDate),
          onTap: onPickDate,
        ),
      ],
    ),
  );
}

class _DailyReportPanel extends ConsumerWidget {
  const _DailyReportPanel({required this.scope});

  final AttendanceScopeQuery scope;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unitsState = ref.watch(attendanceUnitsProvider(scope));
    return unitsState.when(
      loading: () => const _LoadingPanel(),
      error: (error, _) => _MessageCard(message: error.toString()),
      data: (units) {
        if (units.isEmpty) {
          return const _MessageCard(
            message: 'No attendance units are configured for this selection.',
          );
        }

        final sheetStates = [
          for (final unit in units)
            ref.watch(
              attendanceSheetProvider(
                AttendanceSheetQuery(scope: scope, unit: unit),
              ),
            ),
        ];
        AsyncValue<AttendanceSheet>? blockingError;
        for (final state in sheetStates) {
          if (state.hasError && state.asData == null) {
            blockingError = state;
            break;
          }
        }
        if (blockingError != null) {
          return _MessageCard(message: blockingError.error.toString());
        }
        final loading = sheetStates.any((state) => state.isLoading);
        final sheets = [
          for (final state in sheetStates)
            if (state.asData != null) state.asData!.value,
        ];
        if (sheets.length != units.length && loading) {
          return const _LoadingPanel();
        }

        final report = _DailyAttendanceData.fromSheets(sheets);
        return _AttendanceReportContent(
          loading: loading,
          present: report.present,
          absent: report.absent,
          percentage: report.percentage,
          title: 'Student-wise Day Report',
          rows: [
            for (final row in report.rows)
              _StudentReportCard(
                name: row.name,
                meta: row.meta,
                status: row.status,
              ),
          ],
          emptyMessage: 'No students found for this class and section.',
        );
      },
    );
  }
}

class _MonthlyReportPanel extends ConsumerWidget {
  const _MonthlyReportPanel({required this.query});

  final StudentAttendanceReportQuery query;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reportState = ref.watch(studentAttendanceReportProvider(query));
    return reportState.when(
      loading: () => const _LoadingPanel(),
      error: (error, _) => _MessageCard(message: error.toString()),
      data: (report) {
        final data = _MonthlyAttendanceData.fromReport(report);
        return _AttendanceReportContent(
          present: data.present,
          absent: data.absent,
          percentage: data.percentage,
          title: 'Student-wise Monthly Report',
          rows: [
            for (final row in report.rows)
              _StudentReportCard(
                name: row.studentName,
                meta:
                    'Present: ${row.present + row.late} • Absent: ${row.absent} • ${row.percentage.toStringAsFixed(row.percentage.truncateToDouble() == row.percentage ? 0 : 1)}%',
                status: _monthlyBadgeStatus(row),
              ),
          ],
          emptyMessage: 'No student-wise attendance report is available.',
        );
      },
    );
  }
}

class _AttendanceReportContent extends StatelessWidget {
  const _AttendanceReportContent({
    required this.present,
    required this.absent,
    required this.percentage,
    required this.title,
    required this.rows,
    required this.emptyMessage,
    this.loading = false,
  });

  final int present;
  final int absent;
  final int percentage;
  final String title;
  final List<Widget> rows;
  final String emptyMessage;
  final bool loading;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      if (loading) const LinearProgressIndicator(minHeight: 2),
      if (loading) const SizedBox(height: 12),
      Row(
        children: [
          Expanded(
            child: _MetricCard(
              value: '$present',
              label: 'Present',
              color: SaaptTheme.success,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _MetricCard(
              value: '$absent',
              label: 'Absent',
              color: const Color(0xFFE94D4D),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _MetricCard(
              value: '$percentage%',
              label: 'Class %',
              color: SaaptTheme.primary,
            ),
          ),
        ],
      ),
      const SizedBox(height: 20),
      Text(
        title,
        style: const TextStyle(
          color: Color(0xFF102044),
          fontSize: 22,
          fontWeight: FontWeight.w800,
        ),
      ),
      const SizedBox(height: 14),
      if (rows.isEmpty)
        _MessageCard(message: emptyMessage)
      else
        for (final row in rows) ...[row, const SizedBox(height: 12)],
    ],
  );
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.value,
    required this.label,
    required this.color,
  });

  final String value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
    height: 112,
    padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(8),
      border: Border.all(color: const Color(0xFFDDE5F2)),
    ),
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        FittedBox(
          fit: BoxFit.scaleDown,
          child: Text(
            value,
            style: TextStyle(
              color: color,
              fontSize: 32,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: Color(0xFF91A0BA),
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    ),
  );
}

class _StudentReportCard extends StatelessWidget {
  const _StudentReportCard({
    required this.name,
    required this.meta,
    required this.status,
  });

  final String name;
  final String meta;
  final String status;

  @override
  Widget build(BuildContext context) {
    final color = _statusColor(status);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFDDE5F2)),
      ),
      child: Row(
        children: [
          Container(
            width: 58,
            height: 58,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: const Color(0xFFEAF1FF),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFFD5E2FF)),
            ),
            child: const Icon(
              Icons.person_rounded,
              color: SaaptTheme.primary,
              size: 30,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name.isEmpty ? 'Unnamed Student' : name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Color(0xFF102044),
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    height: 1.15,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  meta,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Color(0xFF60708F),
                    fontWeight: FontWeight.w600,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Container(
            width: 54,
            height: 36,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: color.withValues(alpha: 0.30)),
            ),
            child: Text(
              _statusShortLabel(status),
              style: TextStyle(color: color, fontWeight: FontWeight.w900),
            ),
          ),
        ],
      ),
    );
  }
}

class _SelectField extends StatelessWidget {
  const _SelectField({
    required this.label,
    required this.value,
    required this.items,
    required this.hint,
    required this.onChanged,
  });

  final String label;
  final String? value;
  final List<DropdownMenuItem<String>> items;
  final String hint;
  final ValueChanged<String?>? onChanged;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      _FieldLabel(label),
      const SizedBox(height: 8),
      DropdownButtonFormField<String>(
        initialValue: value,
        items: items,
        isExpanded: true,
        hint: Text(hint),
        icon: const Icon(Icons.keyboard_arrow_down_rounded),
        onChanged: onChanged,
      ),
    ],
  );
}

class _DateField extends StatelessWidget {
  const _DateField({
    required this.label,
    required this.value,
    required this.onTap,
  });

  final String label;
  final String value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      _FieldLabel(label),
      const SizedBox(height: 8),
      InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onTap,
        child: InputDecorator(
          decoration: const InputDecoration(
            suffixIcon: Icon(Icons.calendar_month_rounded),
          ),
          child: Text(
            value,
            style: const TextStyle(
              color: Color(0xFF102044),
              fontSize: 17,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
      ),
    ],
  );
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.label);
  final String label;

  @override
  Widget build(BuildContext context) => Text(
    label,
    style: const TextStyle(
      color: Color(0xFF91A0BA),
      fontSize: 13,
      fontWeight: FontWeight.w900,
      letterSpacing: 0,
    ),
  );
}

class _LoadingPanel extends StatelessWidget {
  const _LoadingPanel();

  @override
  Widget build(BuildContext context) => const SizedBox(
    height: 220,
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

class _FullScreenMessage extends StatelessWidget {
  const _FullScreenMessage({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: _MessageCard(message: message),
    ),
  );
}

class _ClassChoice {
  const _ClassChoice({
    required this.id,
    required this.name,
    required this.academicSessionId,
  });

  final String id;
  final String name;
  final String academicSessionId;
}

class _SectionChoice {
  const _SectionChoice({required this.id, required this.name});

  final String id;
  final String name;
}

class _DailyAttendanceData {
  const _DailyAttendanceData({
    required this.present,
    required this.absent,
    required this.percentage,
    required this.rows,
  });

  factory _DailyAttendanceData.fromSheets(List<AttendanceSheet> sheets) {
    final students = <String, _DailyStudentAccumulator>{};
    for (final sheet in sheets) {
      final unitLabel = _unitTitle(sheet.unit);
      for (final row in sheet.rows) {
        final student = students.putIfAbsent(
          row.studentId,
          () => _DailyStudentAccumulator(row.studentId, row.fullName),
        );
        student.statuses[unitLabel] = row.recordId == null
            ? 'UNMARKED'
            : row.status;
      }
    }

    final rows = [
      for (final student in students.values)
        _DailyStudentReport(
          name: student.name,
          status: _aggregateStatus(student.statuses.values),
          meta: student.statuses.entries
              .map((entry) => '${entry.key}: ${_statusLabel(entry.value)}')
              .join(' • '),
        ),
    ]..sort((a, b) => a.name.compareTo(b.name));

    final present = rows.where((row) => _isPresentStatus(row.status)).length;
    final absent = rows.where((row) => _isAbsentStatus(row.status)).length;
    final marked = present + absent;
    final percentage = marked == 0 ? 0 : ((present / marked) * 100).round();
    return _DailyAttendanceData(
      present: present,
      absent: absent,
      percentage: percentage,
      rows: rows,
    );
  }

  final int present;
  final int absent;
  final int percentage;
  final List<_DailyStudentReport> rows;
}

class _DailyStudentAccumulator {
  _DailyStudentAccumulator(this.id, this.name);

  final String id;
  final String name;
  final Map<String, String> statuses = {};
}

class _DailyStudentReport {
  const _DailyStudentReport({
    required this.name,
    required this.status,
    required this.meta,
  });

  final String name;
  final String status;
  final String meta;
}

class _MonthlyAttendanceData {
  const _MonthlyAttendanceData({
    required this.present,
    required this.absent,
    required this.percentage,
  });

  factory _MonthlyAttendanceData.fromReport(StudentAttendanceReport report) {
    final present = report.rows.fold<int>(
      0,
      (sum, row) => sum + row.present + row.late,
    );
    final absent = report.rows.fold<int>(0, (sum, row) => sum + row.absent);
    final halfDays = report.rows.fold<int>(0, (sum, row) => sum + row.halfDay);
    final workingDays = (report.daysInMonth - report.holidays.length).clamp(
      0,
      report.daysInMonth,
    );
    final possible = workingDays * report.rows.length;
    final attended = present + (halfDays * 0.5);
    final percentage = possible == 0
        ? 0
        : ((attended / possible) * 100).round();
    return _MonthlyAttendanceData(
      present: present,
      absent: absent,
      percentage: percentage,
    );
  }

  final int present;
  final int absent;
  final int percentage;
}

List<_ClassChoice> _classChoices(
  ClassAssignments assignments,
  StudentAttendanceOptions options,
  String? fallbackAcademicSessionId,
) {
  final choices = <_ClassChoice>[];
  final seen = <String>{};
  for (final cls in assignments.classes) {
    final academicSessionId =
        cls.academicYearId ??
        options.classes
            .where((item) => item.id == cls.id)
            .firstOrNull
            ?.academicYearId ??
        fallbackAcademicSessionId;
    if (academicSessionId == null || academicSessionId.isEmpty) continue;
    if (seen.add(cls.id)) {
      choices.add(
        _ClassChoice(
          id: cls.id,
          name: cls.name,
          academicSessionId: academicSessionId,
        ),
      );
    }
  }
  if (choices.isNotEmpty) return choices;
  for (final cls in options.classes) {
    final academicSessionId = cls.academicYearId ?? fallbackAcademicSessionId;
    if (academicSessionId == null || academicSessionId.isEmpty) continue;
    if (seen.add(cls.id)) {
      choices.add(
        _ClassChoice(
          id: cls.id,
          name: cls.name,
          academicSessionId: academicSessionId,
        ),
      );
    }
  }
  return choices;
}

List<_SectionChoice> _sectionChoices(
  ClassAssignments assignments,
  StudentAttendanceOptions options,
  String? classId,
) {
  final seen = <String>{};
  final assigned = assignments.sectionsForClass(classId);
  final source = assigned.isNotEmpty
      ? [
          for (final section in assigned)
            _SectionChoice(id: section.id, name: _sectionLabel(section.name)),
        ]
      : [
          for (final section in options.sectionsForClass(classId))
            _SectionChoice(id: section.id, name: _sectionLabel(section.name)),
        ];
  return [
    for (final section in source)
      if (seen.add(section.id)) section,
  ];
}

String _sectionLabel(String section) {
  final trimmed = section.trim();
  if (trimmed.isEmpty) return 'Section';
  if (trimmed.toLowerCase().startsWith('section')) return trimmed;
  return 'Section $trimmed';
}

String _unitTitle(AttendanceUnit unit) {
  if (unit.unitType == AttendanceUnitType.day) return 'Day';
  if (unit.slotType == AttendanceSlotType.morning) return 'Morning';
  if (unit.slotType == AttendanceSlotType.afternoon) return 'Afternoon';
  return unit.label;
}

String _aggregateStatus(Iterable<String> statuses) {
  final marked = statuses.where((status) => status != 'UNMARKED').toList();
  if (marked.isEmpty) return 'UNMARKED';
  if (marked.any((status) => status == 'ABSENT')) return 'ABSENT';
  if (marked.any((status) => status == 'HALF_DAY')) return 'HALF_DAY';
  if (marked.any((status) => status == 'PRESENT' || status == 'LATE')) {
    return 'PRESENT';
  }
  return marked.first;
}

String _monthlyBadgeStatus(StudentAttendanceReportRow row) {
  if (row.percentage >= 75) return 'PRESENT';
  if (row.absent > 0 || row.halfDay > 0) return 'ABSENT';
  if (row.present > 0 || row.late > 0) return 'PRESENT';
  if (row.percentage == 0) {
    return 'UNMARKED';
  }
  return 'ABSENT';
}

String _statusLabel(String status) {
  return switch (status) {
    'PRESENT' => 'Present',
    'LATE' => 'Late',
    'ABSENT' => 'Absent',
    'HALF_DAY' => 'Half Day',
    'HOLIDAY' => 'Holiday',
    _ => 'Pending',
  };
}

String _statusShortLabel(String status) {
  return switch (status) {
    'PRESENT' => 'P',
    'LATE' => 'L',
    'ABSENT' => 'A',
    'HALF_DAY' => 'HD',
    'HOLIDAY' => 'H',
    _ => '-',
  };
}

Color _statusColor(String status) {
  return switch (status) {
    'PRESENT' || 'LATE' => SaaptTheme.success,
    'ABSENT' || 'HALF_DAY' => const Color(0xFFE94D4D),
    'HOLIDAY' => SaaptTheme.warning,
    _ => const Color(0xFF91A0BA),
  };
}

bool _isPresentStatus(String status) => status == 'PRESENT' || status == 'LATE';

bool _isAbsentStatus(String status) =>
    status == 'ABSENT' || status == 'HALF_DAY';

DateTime _dateOnly(DateTime date) => DateTime(date.year, date.month, date.day);
