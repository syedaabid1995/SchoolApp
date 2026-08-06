import 'dart:io';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';

import '../../../../app/theme/saapt_theme.dart';
import '../../data/parent_models.dart';
import '../providers/parent_providers.dart';
import 'parent_screen_widgets.dart';

enum _ReportKind { performance, attendance }

class SaaptReportsScreen extends ConsumerStatefulWidget {
  const SaaptReportsScreen({super.key});

  @override
  ConsumerState<SaaptReportsScreen> createState() => _SaaptReportsScreenState();
}

class _SaaptReportsScreenState extends ConsumerState<SaaptReportsScreen> {
  _ReportKind _kind = _ReportKind.performance;
  String? _selectedExamId;
  DateTime _selectedMonth = DateTime(DateTime.now().year, DateTime.now().month);
  bool _savingReport = false;

  @override
  Widget build(BuildContext context) {
    final selectedChildState = ref.watch(effectiveSelectedChildProvider);

    return selectedChildState.when(
      loading: () => const Scaffold(body: LoadingPanel()),
      error: (error, _) =>
          Scaffold(body: EmptyPanel(message: error.toString())),
      data: (selectedChild) {
        return ParentStickyScaffold(
          showMenu: true,
          showChildSwitcher: true,
          badge: _kind == _ReportKind.performance
              ? '📊 Performance Report'
              : '📅 Attendance Report',
          title: selectedChild?.name ?? 'Reports',
          subtitle: _kind == _ReportKind.performance
              ? selectedChild == null
                    ? 'Select child and exam'
                    : '${selectedChild.classLabel} • Admin uploaded marks'
              : selectedChild == null
              ? 'Child-wise graphical attendance overview'
              : '${selectedChild.classLabel} • Monthly attendance overview',
          onRefresh: () async {
            if (selectedChild != null) {
              ref.invalidate(parentResultsProvider(selectedChild));
              ref.invalidate(
                parentMonthlyAttendanceProvider((
                  childId: selectedChild.id,
                  month: _selectedMonth,
                  date: _selectedMonth,
                )),
              );
            }
          },
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
          body: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _ReportSwitch(
                value: _kind,
                onChanged: (value) => setState(() => _kind = value),
              ),
              const SizedBox(height: 18),
              if (selectedChild == null)
                const EmptyPanel(
                  message: 'Select a child from Home to view reports.',
                )
              else if (_kind == _ReportKind.performance)
                _PerformanceReportView(
                  child: selectedChild,
                  selectedExamId: _selectedExamId,
                  onExamChanged: (examId) =>
                      setState(() => _selectedExamId = examId),
                )
              else
                _AttendanceReportView(
                  child: selectedChild,
                  selectedMonth: _selectedMonth,
                  savingReport: _savingReport,
                  onMonthChanged: (month) => setState(
                    () => _selectedMonth = DateTime(month.year, month.month),
                  ),
                  onDownload: _downloadAttendanceReport,
                ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _downloadAttendanceReport(
    ParentChild child,
    ParentAttendance attendance,
  ) async {
    if (_savingReport) return;
    setState(() => _savingReport = true);
    try {
      final monthLabel = DateFormat('yyyy-MM').format(_selectedMonth);
      final rows = [
        'Date,Status,Remark',
        ...attendance.calendar.map(
          (day) =>
              '${DateFormat('yyyy-MM-dd').format(day.date)},${_csvCell(day.status)},${_csvCell(day.remark ?? '')}',
        ),
      ];
      final directory = await getApplicationDocumentsDirectory();
      final file = File(
        '${directory.path}/attendance_${_safeFileName(child.name)}_$monthLabel.csv',
      );
      await file.writeAsString(rows.join('\n'));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Attendance report saved: ${file.path}')),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Unable to save report: $error')));
    } finally {
      if (mounted) setState(() => _savingReport = false);
    }
  }
}

class _ReportSwitch extends StatelessWidget {
  const _ReportSwitch({required this.value, required this.onChanged});

  final _ReportKind value;
  final ValueChanged<_ReportKind> onChanged;

  @override
  Widget build(BuildContext context) {
    return ParentCard(
      padding: const EdgeInsets.all(6),
      child: Row(
        children: [
          _SwitchButton(
            selected: value == _ReportKind.performance,
            icon: Icons.bar_chart_rounded,
            label: 'Performance',
            onTap: () => onChanged(_ReportKind.performance),
          ),
          const SizedBox(width: 6),
          _SwitchButton(
            selected: value == _ReportKind.attendance,
            icon: Icons.calendar_month_rounded,
            label: 'Attendance',
            onTap: () => onChanged(_ReportKind.attendance),
          ),
        ],
      ),
    );
  }
}

class _SwitchButton extends StatelessWidget {
  const _SwitchButton({
    required this.selected,
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final bool selected;
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 10),
          decoration: BoxDecoration(
            color: selected ? SaaptTheme.primary : Colors.transparent,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                color: selected ? Colors.white : const Color(0xFF7A8BA6),
                size: 20,
              ),
              const SizedBox(width: 8),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: selected ? Colors.white : SaaptTheme.navy,
                    fontSize: 13,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PerformanceReportView extends ConsumerWidget {
  const _PerformanceReportView({
    required this.child,
    required this.selectedExamId,
    required this.onExamChanged,
  });

  final ParentChild child;
  final String? selectedExamId;
  final ValueChanged<String?> onExamChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final resultsState = ref.watch(parentResultsProvider(child));
    return resultsState.when(
      loading: () => const LoadingPanel(),
      error: (error, _) => EmptyPanel(message: error.toString()),
      data: (results) {
        final selectedResult = _selectedResult(results, selectedExamId);
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _SelectionPanel(
              results: results,
              selectedResult: selectedResult,
              onExamChanged: onExamChanged,
            ),
            const SizedBox(height: 18),
            if (results.isEmpty)
              const EmptyPanel(
                message: 'No published performance reports are available yet.',
              )
            else ...[
              ParentCard(
                child: const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Performance Source',
                      style: TextStyle(
                        color: SaaptTheme.primary,
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    SizedBox(height: 14),
                    Text(
                      'Marks are uploaded by school admin/teacher in admin panel.',
                      style: TextStyle(
                        color: Color(0xFF586985),
                        fontSize: 15,
                        height: 1.35,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 22),
              _DonutSummary(result: selectedResult!),
              const SizedBox(height: 22),
              _PerformanceStatsRow(result: selectedResult),
              const SizedBox(height: 22),
              _SubjectMarksCard(result: selectedResult),
            ],
          ],
        );
      },
    );
  }

  ParentResult? _selectedResult(List<ParentResult> results, String? examId) {
    if (results.isEmpty) return null;
    if (examId != null) {
      for (final result in results) {
        if (result.examId == examId) return result;
      }
    }
    return results.first;
  }
}

class _AttendanceReportView extends ConsumerWidget {
  const _AttendanceReportView({
    required this.child,
    required this.selectedMonth,
    required this.savingReport,
    required this.onMonthChanged,
    required this.onDownload,
  });

  final ParentChild child;
  final DateTime selectedMonth;
  final bool savingReport;
  final ValueChanged<DateTime> onMonthChanged;
  final Future<void> Function(ParentChild child, ParentAttendance attendance)
  onDownload;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final attendanceState = ref.watch(
      parentMonthlyAttendanceProvider((
        childId: child.id,
        month: selectedMonth,
        date: selectedMonth,
      )),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SelectionPanel(
          selectedMonth: selectedMonth,
          onMonthChanged: onMonthChanged,
        ),
        const SizedBox(height: 18),
        attendanceState.when(
          loading: () => const LoadingPanel(),
          error: (error, _) => EmptyPanel(message: error.toString()),
          data: (attendance) => Column(
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
                    color: SaaptTheme.warning,
                  ),
                ],
              ),
              const SizedBox(height: 22),
              _AttendanceBarsCard(attendance: attendance),
              const SizedBox(height: 22),
              _AttendanceProgressCard(attendance: attendance),
              const SizedBox(height: 22),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: savingReport
                      ? null
                      : () => onDownload(child, attendance),
                  icon: savingReport
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.download_rounded),
                  label: Text(
                    savingReport
                        ? 'Preparing Report'
                        : 'Download Attendance Report',
                  ),
                  style: FilledButton.styleFrom(
                    backgroundColor: SaaptTheme.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 15),
                    textStyle: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _SelectionPanel extends StatelessWidget {
  const _SelectionPanel({
    this.results = const [],
    this.selectedResult,
    this.selectedMonth,
    this.onExamChanged,
    this.onMonthChanged,
  });

  final List<ParentResult> results;
  final ParentResult? selectedResult;
  final DateTime? selectedMonth;
  final ValueChanged<String?>? onExamChanged;
  final ValueChanged<DateTime>? onMonthChanged;

  @override
  Widget build(BuildContext context) {
    return ParentCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (onExamChanged != null) ...[
            _FieldLabel('Select Exam'),
            const SizedBox(height: 10),
            _DropdownField<String>(
              value: selectedResult?.examId,
              hint: 'Select exam',
              items: results
                  .map(
                    (result) => DropdownMenuItem(
                      value: result.examId,
                      child: Text(result.examName),
                    ),
                  )
                  .toList(),
              onChanged: onExamChanged,
            ),
          ],
          if (selectedMonth != null && onMonthChanged != null) ...[
            if (onExamChanged != null) const SizedBox(height: 20),
            _FieldLabel('Select Month'),
            const SizedBox(height: 10),
            _MonthPickerField(
              month: selectedMonth!,
              onChanged: onMonthChanged!,
            ),
          ],
        ],
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text.toUpperCase(),
      style: const TextStyle(
        color: Color(0xFF9BADCA),
        fontSize: 12,
        fontWeight: FontWeight.w900,
      ),
    );
  }
}

class _DropdownField<T> extends StatelessWidget {
  const _DropdownField({
    required this.value,
    required this.items,
    required this.onChanged,
    this.hint,
  });

  final T? value;
  final List<DropdownMenuItem<T>> items;
  final ValueChanged<T?>? onChanged;
  final String? hint;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<T>(
      initialValue: value,
      items: items,
      onChanged: items.isEmpty ? null : onChanged,
      isExpanded: true,
      icon: const Icon(Icons.keyboard_arrow_down_rounded),
      hint: hint == null ? null : Text(hint!),
      decoration: InputDecoration(
        filled: true,
        fillColor: const Color(0xFFF5F8FE),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 18,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(color: Color(0xFFDCE7FA), width: 2),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(color: Color(0xFFDCE7FA), width: 2),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(color: SaaptTheme.primary, width: 2),
        ),
      ),
      style: const TextStyle(
        color: SaaptTheme.primary,
        fontSize: 15,
        fontWeight: FontWeight.w900,
      ),
    );
  }
}

class _MonthPickerField extends StatelessWidget {
  const _MonthPickerField({required this.month, required this.onChanged});

  final DateTime month;
  final ValueChanged<DateTime> onChanged;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () async {
        final picked = await showDatePicker(
          context: context,
          initialDate: month,
          firstDate: DateTime(DateTime.now().year - 3),
          lastDate: DateTime(DateTime.now().year + 1, 12, 31),
          helpText: 'Select month',
          initialEntryMode: DatePickerEntryMode.calendarOnly,
        );
        if (picked != null) onChanged(DateTime(picked.year, picked.month));
      },
      borderRadius: BorderRadius.circular(18),
      child: InputDecorator(
        decoration: InputDecoration(
          filled: true,
          fillColor: const Color(0xFFF7F9FE),
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 18,
          ),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(18),
            borderSide: const BorderSide(color: Color(0xFFDCE7FA), width: 2),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(18),
            borderSide: const BorderSide(color: Color(0xFFDCE7FA), width: 2),
          ),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                DateFormat('MMMM yyyy').format(month),
                style: const TextStyle(
                  color: SaaptTheme.navy,
                  fontSize: 15,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
            const Icon(Icons.keyboard_arrow_down_rounded),
          ],
        ),
      ),
    );
  }
}

class _DonutSummary extends StatelessWidget {
  const _DonutSummary({required this.result});

  final ParentResult result;

  @override
  Widget build(BuildContext context) {
    final percent = _resultPercent(result);
    return Center(
      child: SizedBox(
        width: 190,
        height: 190,
        child: Stack(
          alignment: Alignment.center,
          children: [
            CustomPaint(
              size: const Size.square(190),
              painter: _DonutPainter(percent: percent),
            ),
            Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '$percent%',
                  style: const TextStyle(
                    color: SaaptTheme.primary,
                    fontSize: 26,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 22),
                const Text(
                  'Overall',
                  style: TextStyle(
                    color: Color(0xFF6E7C95),
                    fontSize: 12,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _PerformanceStatsRow extends StatelessWidget {
  const _PerformanceStatsRow({required this.result});

  final ParentResult result;

  @override
  Widget build(BuildContext context) {
    final rank = result.sectionRank ?? result.classRank;
    return Row(
      children: [
        StatCard(
          value: '${_resultPercent(result)}%',
          label: 'Overall',
          color: SaaptTheme.success,
        ),
        const SizedBox(width: 12),
        StatCard(
          value: _overallGrade(result),
          label: 'Grade',
          color: SaaptTheme.primary,
        ),
        const SizedBox(width: 12),
        StatCard(
          value: rank?.toString() ?? '-',
          label: 'Rank',
          color: SaaptTheme.warning,
        ),
      ],
    );
  }
}

class _DonutPainter extends CustomPainter {
  const _DonutPainter({required this.percent});

  final int percent;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = math.min(size.width, size.height) / 2;
    final rect = Rect.fromCircle(center: center, radius: radius);
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 32
      ..strokeCap = StrokeCap.butt;

    paint.color = const Color(0xFFE9EFFA);
    canvas.drawArc(rect, -math.pi / 2, math.pi * 2, false, paint);

    paint.shader = const SweepGradient(
      colors: [SaaptTheme.success, Color(0xFF7EE8C0), SaaptTheme.success],
      stops: [0, 0.65, 1],
    ).createShader(rect);
    canvas.drawArc(
      rect,
      -math.pi / 2,
      math.pi * 2 * (percent.clamp(0, 100) / 100),
      false,
      paint,
    );

    paint.shader = null;
    paint.color = const Color(0xFFF24852);
    if (percent < 100) {
      canvas.drawArc(
        rect,
        -math.pi / 2 + math.pi * 2 * (percent.clamp(0, 100) / 100),
        math.pi * 2 * ((100 - percent.clamp(0, 100)) / 100),
        false,
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _DonutPainter oldDelegate) {
    return oldDelegate.percent != percent;
  }
}

class _SubjectMarksCard extends StatelessWidget {
  const _SubjectMarksCard({required this.result});

  final ParentResult result;

  @override
  Widget build(BuildContext context) {
    final subjects = result.subjects.isEmpty
        ? [
            ParentResultSubject(
              subjectId: 'overall',
              subjectName: 'Overall',
              marks: result.totalMarks,
              maxMarks: result.totalMaxMarks,
            ),
          ]
        : result.subjects;

    return ParentCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Subject-wise Marks',
            style: TextStyle(
              color: SaaptTheme.navy,
              fontSize: 17,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 18),
          for (var index = 0; index < subjects.length; index++) ...[
            _SubjectProgressRow(
              subject: subjects[index],
              color: _barColor(index),
            ),
            if (index != subjects.length - 1) const SizedBox(height: 14),
          ],
        ],
      ),
    );
  }
}

class _SubjectProgressRow extends StatelessWidget {
  const _SubjectProgressRow({required this.subject, required this.color});

  final ParentResultSubject subject;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final percent = subject.percentage.clamp(0, 100);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          subject.subjectName,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            color: SaaptTheme.navy,
            fontSize: 17,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 9),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: LinearProgressIndicator(
            value: percent / 100,
            minHeight: 9,
            backgroundColor: const Color(0xFFEAF0FB),
            color: color,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          '${_formatMark(subject.marks)} marks • ${subject.grade?.trim().isNotEmpty == true ? subject.grade!.trim() : _performanceRemark(percent)}',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            color: Color(0xFF586985),
            fontSize: 15,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}

class _AttendanceBarsCard extends StatelessWidget {
  const _AttendanceBarsCard({required this.attendance});

  final ParentAttendance attendance;

  @override
  Widget build(BuildContext context) {
    final sessions = attendance.sessions.isEmpty
        ? [
            ParentAttendanceSession(
              id: 'overall',
              unitType: 'DAY',
              mode: attendance.mode,
              label: 'Overall',
              status: attendance.attendancePercent >= 75
                  ? 'Present'
                  : attendance.absentDays > 0
                  ? 'Absent'
                  : 'Unmarked',
              sequence: 0,
            ),
          ]
        : attendance.sessions;

    return ParentCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Monthly Till Date Attendance',
            style: TextStyle(
              color: SaaptTheme.navy,
              fontSize: 17,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 24),
          SizedBox(
            height: 160,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                for (var index = 0; index < sessions.length; index++) ...[
                  Expanded(
                    child: _SessionBar(
                      session: sessions[index],
                      color: _barColor(index),
                    ),
                  ),
                  if (index != sessions.length - 1) const SizedBox(width: 18),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SessionBar extends StatelessWidget {
  const _SessionBar({required this.session, required this.color});

  final ParentAttendanceSession session;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final heightFactor = _sessionHeight(session.status);
    return Column(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        Flexible(
          child: FractionallySizedBox(
            heightFactor: heightFactor,
            alignment: Alignment.bottomCenter,
            child: Container(
              width: double.infinity,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                gradient: LinearGradient(
                  colors: [color, color.withValues(alpha: 0.58)],
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Text(
          _sessionLabel(session.label),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: Color(0xFF6E7C95),
            fontSize: 12,
            fontWeight: FontWeight.w900,
          ),
        ),
      ],
    );
  }
}

class _AttendanceProgressCard extends StatelessWidget {
  const _AttendanceProgressCard({required this.attendance});

  final ParentAttendance attendance;

  @override
  Widget build(BuildContext context) {
    final sessions = attendance.sessions.take(4).toList();
    return ParentCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _ProgressLine(
            title: 'Overall Attendance',
            percent: attendance.attendancePercent,
            note: '${attendance.attendancePercent}% monthly attendance',
            color: SaaptTheme.success,
          ),
          for (final session in sessions) ...[
            const SizedBox(height: 18),
            _ProgressLine(
              title: _sessionLabel(session.label, titleCase: true),
              percent: _sessionPercent(session.status),
              note: _sessionNote(session),
              color: _sessionColor(session.status),
            ),
          ],
        ],
      ),
    );
  }
}

class _ProgressLine extends StatelessWidget {
  const _ProgressLine({
    required this.title,
    required this.percent,
    required this.note,
    required this.color,
  });

  final String title;
  final int percent;
  final String note;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            color: SaaptTheme.navy,
            fontSize: 17,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 10),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: LinearProgressIndicator(
            value: percent.clamp(0, 100) / 100,
            minHeight: 9,
            backgroundColor: const Color(0xFFEAF0FB),
            color: color,
          ),
        ),
        const SizedBox(height: 10),
        Text(
          note,
          style: const TextStyle(
            color: Color(0xFF586985),
            fontSize: 14,
            height: 1.3,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}

int _resultPercent(ParentResult result) {
  if (result.percentage != null) return result.percentage!.clamp(0, 100);
  if (result.totalMaxMarks == 0) return 0;
  return ((result.totalMarks / result.totalMaxMarks) * 100).round().clamp(
    0,
    100,
  );
}

String _overallGrade(ParentResult result) {
  final grade = result.overallGrade?.trim();
  if (grade != null && grade.isNotEmpty) return grade;
  final subjectGrades = result.subjects
      .map((subject) => subject.grade?.trim())
      .whereType<String>()
      .where((grade) => grade.isNotEmpty)
      .toList();
  return subjectGrades.isEmpty ? '-' : subjectGrades.first;
}

String _performanceRemark(int percent) {
  if (percent >= 90) return 'Excellent';
  if (percent >= 80) return 'Very Good';
  if (percent >= 70) return 'Good';
  if (percent >= 50) return 'Average';
  return 'Needs Improvement';
}

String _formatMark(num value) {
  return value % 1 == 0 ? value.toInt().toString() : value.toStringAsFixed(1);
}

Color _barColor(int index) {
  const colors = [
    SaaptTheme.success,
    SaaptTheme.primary,
    SaaptTheme.warning,
    Color(0xFF16C99A),
    Color(0xFF8B5CF6),
    Color(0xFFEC4899),
  ];
  return colors[index % colors.length];
}

double _sessionHeight(String status) {
  final normalized = status.toLowerCase();
  if (normalized == 'present') return 1;
  if (normalized == 'late' || normalized == 'half_day') return 0.7;
  if (normalized.contains('leave')) return 0.55;
  if (normalized == 'absent') return 0.42;
  return 0.2;
}

int _sessionPercent(String status) => (_sessionHeight(status) * 100).round();

Color _sessionColor(String status) {
  final normalized = status.toLowerCase();
  if (normalized == 'present') return SaaptTheme.success;
  if (normalized == 'absent') return SaaptTheme.primary;
  if (normalized.contains('leave')) return SaaptTheme.warning;
  return const Color(0xFF8EA0BF);
}

String _sessionNote(ParentAttendanceSession session) {
  final label = _sessionLabel(session.label).toLowerCase();
  final status = session.status.toLowerCase();
  if (status == 'present') return 'Very good $label attendance';
  if (status == 'absent') {
    return '${_titleCase(label)} attendance needs improvement';
  }
  if (status.contains('leave')) return '${_titleCase(label)} marked as leave';
  if (status == 'late') return '${_titleCase(label)} marked late';
  return '${_titleCase(label)} attendance is not marked';
}

String _sessionLabel(String label, {bool titleCase = false}) {
  final cleaned = label
      .replaceAll(RegExp('session', caseSensitive: false), '')
      .trim();
  final value = cleaned.isEmpty ? label : cleaned;
  return titleCase ? _titleCase(value) : value;
}

String _titleCase(String value) {
  return value
      .split(RegExp(r'\s+'))
      .where((part) => part.isNotEmpty)
      .map(
        (part) => part.length == 1
            ? part.toUpperCase()
            : '${part[0].toUpperCase()}${part.substring(1).toLowerCase()}',
      )
      .join(' ');
}

String _safeFileName(String value) {
  final sanitized = value
      .trim()
      .toLowerCase()
      .replaceAll(RegExp(r'[^a-z0-9]+'), '_')
      .replaceAll(RegExp(r'_+'), '_');
  return sanitized.isEmpty ? 'student' : sanitized;
}

String _csvCell(String value) {
  final escaped = value.replaceAll('"', '""');
  return '"$escaped"';
}
