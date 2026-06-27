import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/permissions/permission_codes.dart';
import '../../../../core/widgets/async_state_view.dart';
import '../../../auth/presentation/providers/current_permission_provider.dart';
import '../../domain/entities/attendance_summary.dart';
import '../providers/attendance_providers.dart';

// ── Status config ─────────────────────────────────────────────────────────────

const _statuses = ['PRESENT', 'LATE', 'ABSENT', 'HALF_DAY'];

Color _statusColor(BuildContext context, String status) {
  final cs = Theme.of(context).colorScheme;
  return switch (status) {
    'PRESENT'  => const Color(0xFF15803D),
    'LATE'     => const Color(0xFFD97706),
    'ABSENT'   => cs.error,
    'HALF_DAY' => const Color(0xFF0284C7),
    _          => cs.outline,
  };
}

IconData _statusIcon(String status) => switch (status) {
      'PRESENT'  => Icons.check_circle_rounded,
      'LATE'     => Icons.watch_later_rounded,
      'ABSENT'   => Icons.cancel_rounded,
      'HALF_DAY' => Icons.timelapse_rounded,
      _          => Icons.help_outline_rounded,
    };

String _statusLabel(String status) => switch (status) {
      'PRESENT'  => 'Present',
      'LATE'     => 'Late',
      'ABSENT'   => 'Absent',
      'HALF_DAY' => 'Half Day',
      _          => status,
    };

// ── Screen ────────────────────────────────────────────────────────────────────

class StudentAttendanceCaptureScreen extends ConsumerStatefulWidget {
  const StudentAttendanceCaptureScreen({super.key});

  @override
  ConsumerState<StudentAttendanceCaptureScreen> createState() =>
      _StudentAttendanceCaptureScreenState();
}

class _StudentAttendanceCaptureScreenState
    extends ConsumerState<StudentAttendanceCaptureScreen> {
  String? _academicSessionId;
  String? _classId;
  String? _sectionId;
  DateTime _date = DateTime.now();
  bool _markHoliday = false;
  final _holidayReason = TextEditingController();
  StudentAttendanceQuery? _activeQuery;
  List<StudentAttendanceRow>? _editedRows;

  @override
  void dispose() {
    _holidayReason.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final checker = ref.watch(currentPermissionCheckerProvider);
    final canView = checker.canAny([
      PermissionCodes.attendanceView,
      PermissionCodes.attendanceCreate,
      PermissionCodes.attendanceEdit,
    ]);
    final canSave = checker.canAny([
      PermissionCodes.attendanceCreate,
      PermissionCodes.attendanceEdit,
    ]);

    if (!canView) return const SizedBox.shrink();

    final optionsState = ref.watch(studentAttendanceOptionsProvider);
    final saveState = ref.watch(saveStudentAttendanceProvider);
    final cs = Theme.of(context).colorScheme;

    return AsyncStateView(
      value: optionsState,
      data: (options) {
        _applyDefaults(options);
        final sections = options.sectionsForClass(_classId);
        final query = _buildQuery();

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Filter card ──
            _FilterCard(
              options: options,
              sections: sections,
              academicSessionId: _academicSessionId,
              classId: _classId,
              sectionId: _sectionId,
              date: _date,
              markHoliday: _markHoliday,
              holidayReason: _holidayReason,
              canSave: canSave,
              isLoaded: _activeQuery != null,
              onSessionChanged: (v) => setState(() {
                _academicSessionId = v;
                _activeQuery = null;
                _editedRows = null;
              }),
              onClassChanged: (v) => setState(() {
                _classId = v;
                final next = options.sectionsForClass(v);
                _sectionId = next.isEmpty ? null : next.first.id;
                _activeQuery = null;
                _editedRows = null;
              }),
              onSectionChanged: (v) => setState(() {
                _sectionId = v;
                _activeQuery = null;
                _editedRows = null;
              }),
              onDateChanged: (v) => setState(() {
                _date = v;
                _activeQuery = null;
                _editedRows = null;
              }),
              onHolidayChanged: canSave
                  ? (v) => setState(() => _markHoliday = v)
                  : null,
              onLoad: query == null
                  ? null
                  : () => setState(() {
                        _activeQuery = query;
                        _editedRows = null;
                      }),
            ),

            // ── Student list ──
            if (_activeQuery != null) ...[
              const SizedBox(height: AppSpacing.md),
              AsyncStateView(
                value: ref.watch(studentAttendanceSheetProvider(_activeQuery!)),
                data: (sheet) => _AttendanceSheet(
                  sheet: sheet,
                  rows: _editedRows ?? sheet.students,
                  canSave: canSave,
                  markHoliday: _markHoliday,
                  isSaving: saveState.isLoading,
                  onStatusChanged: (rows, id, status) => setState(() {
                    _editedRows = [
                      for (final r in rows)
                        r.id == id ? r.copyWith(status: status) : r,
                    ];
                  }),
                  onMarkAll: (rows, status) => setState(() {
                    _editedRows = [for (final r in rows) r.copyWith(status: status)];
                  }),
                  onSave: () => _save(_activeQuery!, _editedRows ?? sheet.students),
                ),
              ),
            ],

            if (saveState.hasError) ...[
              const SizedBox(height: AppSpacing.sm),
              Container(
                padding: const EdgeInsets.all(AppSpacing.sm),
                decoration: BoxDecoration(
                  color: cs.errorContainer,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    Icon(Icons.error_outline, color: cs.onErrorContainer, size: 18),
                    const SizedBox(width: AppSpacing.xs),
                    Expanded(
                      child: Text(
                        saveState.error.toString(),
                        style: TextStyle(color: cs.onErrorContainer, fontSize: 13),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        );
      },
    );
  }

  void _applyDefaults(StudentAttendanceOptions options) {
    if (_academicSessionId == null && options.academicYears.isNotEmpty) {
      final active = options.academicYears.where((y) => y.isActive);
      _academicSessionId =
          active.isNotEmpty ? active.first.id : options.academicYears.first.id;
    }
    if (_classId == null && options.classes.isNotEmpty) {
      _classId = options.classes.first.id;
    }
    if (_sectionId == null && _classId != null) {
      final sections = options.sectionsForClass(_classId);
      if (sections.isNotEmpty) _sectionId = sections.first.id;
    }
  }

  StudentAttendanceQuery? _buildQuery() {
    final sid = _academicSessionId;
    final cid = _classId;
    final sec = _sectionId;
    if (sid == null || cid == null || sec == null) return null;
    return StudentAttendanceQuery(
      academicSessionId: sid,
      classId: cid,
      sectionId: sec,
      date: _date,
    );
  }

  Future<void> _save(
    StudentAttendanceQuery query,
    List<StudentAttendanceRow> rows,
  ) async {
    await ref.read(saveStudentAttendanceProvider.notifier).save(
          StudentAttendanceSaveRequest(
            query: query,
            markHoliday: _markHoliday,
            holidayReason: _holidayReason.text.trim().isEmpty
                ? null
                : _holidayReason.text.trim(),
            records: _markHoliday ? const [] : rows,
          ),
        );
  }
}

// ── Filter card ───────────────────────────────────────────────────────────────

class _FilterCard extends StatefulWidget {
  const _FilterCard({
    required this.options,
    required this.sections,
    required this.academicSessionId,
    required this.classId,
    required this.sectionId,
    required this.date,
    required this.markHoliday,
    required this.holidayReason,
    required this.canSave,
    required this.isLoaded,
    required this.onSessionChanged,
    required this.onClassChanged,
    required this.onSectionChanged,
    required this.onDateChanged,
    required this.onHolidayChanged,
    required this.onLoad,
  });

  final StudentAttendanceOptions options;
  final List<dynamic> sections;
  final String? academicSessionId;
  final String? classId;
  final String? sectionId;
  final DateTime date;
  final bool markHoliday;
  final TextEditingController holidayReason;
  final bool canSave;
  final bool isLoaded;
  final ValueChanged<String?> onSessionChanged;
  final ValueChanged<String?> onClassChanged;
  final ValueChanged<String?> onSectionChanged;
  final ValueChanged<DateTime> onDateChanged;
  final ValueChanged<bool>? onHolidayChanged;
  final VoidCallback? onLoad;

  @override
  State<_FilterCard> createState() => _FilterCardState();
}

class _FilterCardState extends State<_FilterCard> {
  bool _collapsed = false;

  @override
  void didUpdateWidget(_FilterCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Auto-collapse when students are loaded for the first time
    if (!oldWidget.isLoaded && widget.isLoaded) {
      setState(() => _collapsed = true);
    }
    // Auto-expand when query is cleared
    if (oldWidget.isLoaded && !widget.isLoaded) {
      setState(() => _collapsed = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    // Collapsed summary pills
    final className = widget.options.classes
        .where((c) => c.id == widget.classId)
        .map((c) => c.name)
        .firstOrNull ?? '';
    final sectionName = widget.sections
        .where((s) => s.id == widget.sectionId)
        .map((s) => s.name as String)
        .firstOrNull ?? '';

    return Container(
      decoration: BoxDecoration(
        color: cs.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: cs.shadow.withValues(alpha: 0.08),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Tappable header ──
          GestureDetector(
            onTap: widget.isLoaded
                ? () => setState(() => _collapsed = !_collapsed)
                : null,
            child: Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF2B4EFF), Color(0xFF6B3FFF)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: _collapsed
                    ? BorderRadius.circular(20)
                    : const BorderRadius.vertical(top: Radius.circular(20)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.fact_check_rounded, color: Colors.white, size: 22),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: _collapsed
                        ? Row(
                            children: [
                              Text(
                                'Student Attendance',
                                style: tt.titleMedium?.copyWith(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(width: AppSpacing.xs),
                              if (className.isNotEmpty)
                                _HeaderPill('$className${sectionName.isNotEmpty ? ' · $sectionName' : ''}'),
                              const SizedBox(width: AppSpacing.xs),
                              _HeaderPill(DateFormat('d MMM').format(widget.date)),
                            ],
                          )
                        : Text(
                            'Student Attendance',
                            style: tt.titleMedium?.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                  ),
                  if (widget.isLoaded)
                    AnimatedRotation(
                      turns: _collapsed ? 0 : 0.5,
                      duration: const Duration(milliseconds: 200),
                      child: const Icon(
                        Icons.keyboard_arrow_down_rounded,
                        color: Colors.white,
                        size: 22,
                      ),
                    )
                  else
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.sm,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        DateFormat('EEE, d MMM').format(widget.date),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),

          // ── Collapsible fields ──
          AnimatedCrossFade(
            duration: const Duration(milliseconds: 250),
            crossFadeState: _collapsed
                ? CrossFadeState.showSecond
                : CrossFadeState.showFirst,
            firstChild: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _DropdownField(
                    label: 'Academic Session',
                    icon: Icons.school_outlined,
                    value: widget.academicSessionId,
                    items: [
                      for (final y in widget.options.academicYears)
                        DropdownMenuItem(value: y.id, child: Text(y.name)),
                    ],
                    onChanged: widget.onSessionChanged,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Row(
                    children: [
                      Expanded(
                        child: _DropdownField(
                          label: 'Class',
                          icon: Icons.class_outlined,
                          value: widget.classId,
                          items: [
                            for (final c in widget.options.classes)
                              DropdownMenuItem(value: c.id, child: Text(c.name)),
                          ],
                          onChanged: widget.onClassChanged,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: _DropdownField(
                          label: 'Section',
                          icon: Icons.group_outlined,
                          value: widget.sections.any((s) => s.id == widget.sectionId)
                              ? widget.sectionId
                              : null,
                          items: [
                            for (final s in widget.sections)
                              DropdownMenuItem(value: s.id, child: Text(s.name)),
                          ],
                          onChanged: widget.onSectionChanged,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  InkWell(
                    borderRadius: BorderRadius.circular(12),
                    onTap: () async {
                      final picked = await showDatePicker(
                        context: context,
                        initialDate: widget.date,
                        firstDate: DateTime(DateTime.now().year - 2),
                        lastDate: DateTime(DateTime.now().year + 1),
                      );
                      if (picked != null) widget.onDateChanged(picked);
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.md,
                        vertical: AppSpacing.sm,
                      ),
                      decoration: BoxDecoration(
                        border: Border.all(color: cs.outline.withValues(alpha: 0.4)),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.calendar_month_outlined, size: 18, color: cs.primary),
                          const SizedBox(width: AppSpacing.sm),
                          Text(
                            DateFormat.yMMMd().format(widget.date),
                            style: tt.bodyMedium?.copyWith(fontWeight: FontWeight.w500),
                          ),
                          const Spacer(),
                          Icon(Icons.edit_calendar_outlined, size: 16, color: cs.outline),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Container(
                    decoration: BoxDecoration(
                      color: widget.markHoliday
                          ? cs.errorContainer.withValues(alpha: 0.4)
                          : cs.surfaceContainerHighest.withValues(alpha: 0.5),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: SwitchListTile(
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.md,
                        vertical: 0,
                      ),
                      dense: true,
                      title: Text(
                        'Mark as Holiday',
                        style: tt.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                      ),
                      subtitle: Text(
                        'No attendance will be recorded',
                        style: tt.bodySmall?.copyWith(
                          color: cs.onSurface.withValues(alpha: 0.55),
                        ),
                      ),
                      secondary: Icon(
                        Icons.beach_access_outlined,
                        color: widget.markHoliday ? cs.error : cs.outline,
                      ),
                      value: widget.markHoliday,
                      onChanged: widget.onHolidayChanged,
                    ),
                  ),
                  if (widget.markHoliday) ...[
                    const SizedBox(height: AppSpacing.sm),
                    TextField(
                      controller: widget.holidayReason,
                      decoration: InputDecoration(
                        labelText: 'Holiday reason (optional)',
                        prefixIcon: const Icon(Icons.edit_note_outlined),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: AppSpacing.md),
                  FilledButton.icon(
                    onPressed: widget.onLoad,
                    icon: const Icon(Icons.groups_rounded, size: 18),
                    label: const Text('Load Students'),
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(48),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            secondChild: const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }
}

class _HeaderPill extends StatelessWidget {
  const _HeaderPill(this.label);
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

// ── Dropdown helper ───────────────────────────────────────────────────────────

class _DropdownField extends StatelessWidget {
  const _DropdownField({
    required this.label,
    required this.icon,
    required this.value,
    required this.items,
    required this.onChanged,
  });

  final String label;
  final IconData icon;
  final String? value;
  final List<DropdownMenuItem<String>> items;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<String>(
      initialValue: value,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon, size: 18),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
      ),
      items: items,
      onChanged: onChanged,
    );
  }
}

// ── Attendance sheet ──────────────────────────────────────────────────────────

class _AttendanceSheet extends StatelessWidget {
  const _AttendanceSheet({
    required this.sheet,
    required this.rows,
    required this.canSave,
    required this.markHoliday,
    required this.isSaving,
    required this.onStatusChanged,
    required this.onMarkAll,
    required this.onSave,
  });

  final StudentAttendanceSheet sheet;
  final List<StudentAttendanceRow> rows;
  final bool canSave;
  final bool markHoliday;
  final bool isSaving;
  final void Function(List<StudentAttendanceRow>, String, String) onStatusChanged;
  final void Function(List<StudentAttendanceRow>, String) onMarkAll;
  final VoidCallback onSave;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    // Holiday already marked
    if (sheet.isHoliday && markHoliday) {
      return Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: cs.errorContainer.withValues(alpha: 0.4),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: [
            Icon(Icons.beach_access_outlined, color: cs.error),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Text(
                'Holiday already marked${sheet.holiday?.reason == null ? '' : ': ${sheet.holiday!.reason}'}',
                style: tt.bodyMedium?.copyWith(color: cs.error),
              ),
            ),
          ],
        ),
      );
    }

    if (rows.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(AppSpacing.lg),
        decoration: BoxDecoration(
          color: cs.surfaceContainerHighest.withValues(alpha: 0.5),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          children: [
            Icon(Icons.people_outline_rounded, size: 48, color: cs.outline),
            const SizedBox(height: AppSpacing.sm),
            Text('No students found', style: tt.bodyMedium),
          ],
        ),
      );
    }

    // Count stats
    final counts = <String, int>{};
    for (final r in rows) {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // ── Summary bar ──
        _SummaryBar(rows: rows, counts: counts),
        const SizedBox(height: AppSpacing.md),

        if (!markHoliday) ...[
          if (sheet.isHoliday) ...[
            Container(
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: BoxDecoration(
                color: cs.tertiaryContainer.withValues(alpha: 0.5),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Icon(Icons.info_outline, size: 16, color: cs.tertiary),
                  const SizedBox(width: AppSpacing.xs),
                  Expanded(
                    child: Text(
                      'Saving will remove the existing holiday for this class-section.',
                      style: tt.bodySmall?.copyWith(color: cs.tertiary),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
          ],

          // ── Mark all chips ──
          _MarkAllBar(
            canSave: canSave,
            rows: rows,
            onMarkAll: onMarkAll,
          ),
          const SizedBox(height: AppSpacing.md),

          // ── Student cards ──
          Container(
            decoration: BoxDecoration(
              color: cs.surface,
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: cs.shadow.withValues(alpha: 0.07),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              children: [
                for (int i = 0; i < rows.length; i++) ...[
                  _StudentRow(
                    row: rows[i],
                    canSave: canSave,
                    isFirst: i == 0,
                    isLast: i == rows.length - 1,
                    onStatusChanged: (id, status) =>
                        onStatusChanged(rows, id, status),
                  ),
                  if (i < rows.length - 1)
                    Divider(
                      height: 1,
                      indent: AppSpacing.md + 44 + AppSpacing.sm,
                      color: cs.outlineVariant.withValues(alpha: 0.5),
                    ),
                ],
              ],
            ),
          ),
        ],

        const SizedBox(height: AppSpacing.md),

        // ── Save button ──
        FilledButton.icon(
          onPressed: canSave && !isSaving ? onSave : null,
          icon: isSaving
              ? const SizedBox.square(
                  dimension: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : const Icon(Icons.save_rounded, size: 18),
          label: Text(markHoliday ? 'Save Holiday' : 'Save Attendance'),
          style: FilledButton.styleFrom(
            minimumSize: const Size.fromHeight(52),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
            ),
          ),
        ),
      ],
    );
  }
}

// ── Summary bar ───────────────────────────────────────────────────────────────

class _SummaryBar extends StatelessWidget {
  const _SummaryBar({required this.rows, required this.counts});

  final List<StudentAttendanceRow> rows;
  final Map<String, int> counts;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF2B4EFF), Color(0xFF6B3FFF)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Expanded(
            child: _SummaryChip(
              label: 'Total',
              count: rows.length,
              color: Colors.white,
            ),
          ),
          for (final status in _statuses)
            Expanded(
              child: _SummaryChip(
                label: _statusLabel(status),
                count: counts[status] ?? 0,
                color: _statusColor(context, status),
              ),
            ),
        ],
      ),
    );
  }
}

class _SummaryChip extends StatelessWidget {
  const _SummaryChip({
    required this.label,
    required this.count,
    required this.color,
  });

  final String label;
  final int count;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          '$count',
          style: TextStyle(
            color: Colors.white,
            fontSize: 20,
            fontWeight: FontWeight.w800,
          ),
        ),
        Text(
          label,
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.75),
            fontSize: 10,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}

// ── Mark all bar ──────────────────────────────────────────────────────────────

class _MarkAllBar extends StatelessWidget {
  const _MarkAllBar({
    required this.canSave,
    required this.rows,
    required this.onMarkAll,
  });

  final bool canSave;
  final List<StudentAttendanceRow> rows;
  final void Function(List<StudentAttendanceRow>, String) onMarkAll;

  @override
  Widget build(BuildContext context) {
    final tt = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Mark all as',
          style: tt.labelMedium?.copyWith(
            color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        Wrap(
          spacing: AppSpacing.xs,
          children: [
            for (final status in _statuses)
              ActionChip(
                avatar: Icon(
                  _statusIcon(status),
                  size: 16,
                  color: _statusColor(context, status),
                ),
                label: Text(_statusLabel(status)),
                onPressed: canSave ? () => onMarkAll(rows, status) : null,
                side: BorderSide(
                  color: _statusColor(context, status).withValues(alpha: 0.4),
                ),
                backgroundColor: _statusColor(context, status).withValues(alpha: 0.08),
                labelStyle: TextStyle(
                  color: _statusColor(context, status),
                  fontWeight: FontWeight.w600,
                  fontSize: 12,
                ),
              ),
          ],
        ),
      ],
    );
  }
}

// ── Student row ───────────────────────────────────────────────────────────────

class _StudentRow extends StatelessWidget {
  const _StudentRow({
    required this.row,
    required this.canSave,
    required this.isFirst,
    required this.isLast,
    required this.onStatusChanged,
  });

  final StudentAttendanceRow row;
  final bool canSave;
  final bool isFirst;
  final bool isLast;
  final void Function(String id, String status) onStatusChanged;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final currentStatus =
        _statuses.contains(row.status) ? row.status : 'PRESENT';
    final statusColor = _statusColor(context, currentStatus);

    final initials = row.fullName.trim().split(' ')
        .take(2)
        .map((w) => w.isEmpty ? '' : w[0].toUpperCase())
        .join();

    final meta = [
      if (row.rollNo != null && row.rollNo!.isNotEmpty) 'Roll ${row.rollNo}',
      if (row.admissionNo != null && row.admissionNo!.isNotEmpty) row.admissionNo!,
    ].join(' · ');

    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      child: Row(
        children: [
          // Avatar
          CircleAvatar(
            radius: 22,
            backgroundColor: statusColor.withValues(alpha: 0.15),
            child: Text(
              initials,
              style: TextStyle(
                color: statusColor,
                fontWeight: FontWeight.w700,
                fontSize: 13,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),

          // Name + meta
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  row.fullName,
                  style: tt.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                ),
                if (meta.isNotEmpty)
                  Text(
                    meta,
                    style: tt.bodySmall?.copyWith(
                      color: cs.onSurface.withValues(alpha: 0.5),
                    ),
                  ),
              ],
            ),
          ),

          // Status chips
          if (canSave)
            _StatusToggle(
              currentStatus: currentStatus,
              onChanged: (status) => onStatusChanged(row.id, status),
            )
          else
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.sm,
                vertical: 4,
              ),
              decoration: BoxDecoration(
                color: statusColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(_statusIcon(currentStatus), size: 14, color: statusColor),
                  const SizedBox(width: 4),
                  Text(
                    _statusLabel(currentStatus),
                    style: TextStyle(
                      color: statusColor,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

// ── Status toggle ─────────────────────────────────────────────────────────────

class _StatusToggle extends StatelessWidget {
  const _StatusToggle({
    required this.currentStatus,
    required this.onChanged,
  });

  final String currentStatus;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<String>(
      onSelected: onChanged,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      offset: const Offset(0, 8),
      itemBuilder: (_) => [
        for (final status in _statuses)
          PopupMenuItem(
            value: status,
            child: Row(
              children: [
                Icon(
                  _statusIcon(status),
                  size: 18,
                  color: _statusColor(context, status),
                ),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  _statusLabel(status),
                  style: TextStyle(
                    fontWeight: currentStatus == status
                        ? FontWeight.w700
                        : FontWeight.normal,
                  ),
                ),
                if (currentStatus == status) ...[
                  const Spacer(),
                  Icon(
                    Icons.check_rounded,
                    size: 16,
                    color: _statusColor(context, status),
                  ),
                ],
              ],
            ),
          ),
      ],
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm,
          vertical: 6,
        ),
        decoration: BoxDecoration(
          color: _statusColor(context, currentStatus).withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: _statusColor(context, currentStatus).withValues(alpha: 0.3),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              _statusIcon(currentStatus),
              size: 14,
              color: _statusColor(context, currentStatus),
            ),
            const SizedBox(width: 4),
            Text(
              _statusLabel(currentStatus),
              style: TextStyle(
                color: _statusColor(context, currentStatus),
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(width: 4),
            Icon(
              Icons.expand_more_rounded,
              size: 14,
              color: _statusColor(context, currentStatus),
            ),
          ],
        ),
      ),
    );
  }
}
