import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/permissions/permission_codes.dart';
import '../../../../core/widgets/async_state_view.dart';
import '../../../auth/presentation/providers/current_permission_provider.dart';
import '../../domain/entities/attendance_summary.dart';
import '../providers/attendance_providers.dart';

const _v2Statuses = ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'];

class StudentAttendanceV2CaptureScreen extends ConsumerStatefulWidget {
  const StudentAttendanceV2CaptureScreen({super.key});

  @override
  ConsumerState<StudentAttendanceV2CaptureScreen> createState() =>
      _StudentAttendanceV2CaptureScreenState();
}

class _StudentAttendanceV2CaptureScreenState
    extends ConsumerState<StudentAttendanceV2CaptureScreen> {
  String? _academicYearId;
  String? _classId;
  String? _sectionId;
  DateTime _date = DateTime.now();
  AttendanceScopeQuery? _activeScope;
  AttendanceUnit? _selectedUnit;
  List<AttendanceStudentRecord>? _editedRows;

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

    return AsyncStateView(
      value: ref.watch(studentAttendanceOptionsProvider),
      data: (options) {
        _applyDefaults(options);
        final sections = options.sectionsForClass(_classId);
        final scope = _buildScope();

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _V2FilterCard(
              options: options,
              sections: sections,
              academicYearId: _academicYearId,
              classId: _classId,
              sectionId: _sectionId,
              date: _date,
              onAcademicYearChanged: (value) => setState(() {
                _academicYearId = value;
                _clearLoadedState();
              }),
              onClassChanged: (value) => setState(() {
                _classId = value;
                final next = options.sectionsForClass(value);
                _sectionId = next.isEmpty ? null : next.first.id;
                _clearLoadedState();
              }),
              onSectionChanged: (value) => setState(() {
                _sectionId = value;
                _clearLoadedState();
              }),
              onDateChanged: (value) => setState(() {
                _date = value;
                _clearLoadedState();
              }),
              onResolve: scope == null
                  ? null
                  : () => setState(() {
                      _activeScope = scope;
                      _selectedUnit = null;
                      _editedRows = null;
                    }),
            ),
            if (_activeScope != null) ...[
              const SizedBox(height: AppSpacing.md),
              _ResolvedAttendancePanel(
                scope: _activeScope!,
                selectedUnit: _selectedUnit,
                canSave: canSave,
                editedRows: _editedRows,
                onUnitChanged: (unit) => setState(() {
                  _selectedUnit = unit;
                  _editedRows = null;
                }),
                onRowsChanged: (rows) => setState(() => _editedRows = rows),
              ),
            ],
          ],
        );
      },
    );
  }

  void _applyDefaults(StudentAttendanceOptions options) {
    if (_academicYearId == null && options.academicYears.isNotEmpty) {
      final active = options.academicYears.where((year) => year.isActive);
      _academicYearId = active.isNotEmpty
          ? active.first.id
          : options.academicYears.first.id;
    }
    if (_classId == null && options.classes.isNotEmpty) {
      _classId = options.classes.first.id;
    }
    if (_sectionId == null && _classId != null) {
      final sections = options.sectionsForClass(_classId);
      if (sections.isNotEmpty) _sectionId = sections.first.id;
    }
  }

  AttendanceScopeQuery? _buildScope() {
    final yearId = _academicYearId;
    final classId = _classId;
    if (yearId == null || classId == null) return null;
    return AttendanceScopeQuery(
      academicYearId: yearId,
      classId: classId,
      sectionId: _sectionId,
      date: _date,
    );
  }

  void _clearLoadedState() {
    _activeScope = null;
    _selectedUnit = null;
    _editedRows = null;
  }
}

class _V2FilterCard extends StatelessWidget {
  const _V2FilterCard({
    required this.options,
    required this.sections,
    required this.academicYearId,
    required this.classId,
    required this.sectionId,
    required this.date,
    required this.onAcademicYearChanged,
    required this.onClassChanged,
    required this.onSectionChanged,
    required this.onDateChanged,
    required this.onResolve,
  });

  final StudentAttendanceOptions options;
  final List<StudentAttendanceOption> sections;
  final String? academicYearId;
  final String? classId;
  final String? sectionId;
  final DateTime date;
  final ValueChanged<String?> onAcademicYearChanged;
  final ValueChanged<String?> onClassChanged;
  final ValueChanged<String?> onSectionChanged;
  final ValueChanged<DateTime> onDateChanged;
  final VoidCallback? onResolve;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Student Attendance',
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          _DropdownField(
            label: 'Academic Year',
            value: academicYearId,
            items: [
              for (final year in options.academicYears)
                DropdownMenuItem(value: year.id, child: Text(year.name)),
            ],
            onChanged: onAcademicYearChanged,
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Expanded(
                child: _DropdownField(
                  label: 'Class',
                  value: classId,
                  items: [
                    for (final klass in options.classes)
                      DropdownMenuItem(
                        value: klass.id,
                        child: Text(klass.name),
                      ),
                  ],
                  onChanged: onClassChanged,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: _DropdownField(
                  label: 'Section',
                  value: sections.any((section) => section.id == sectionId)
                      ? sectionId
                      : null,
                  items: [
                    for (final section in sections)
                      DropdownMenuItem(
                        value: section.id,
                        child: Text(section.name),
                      ),
                  ],
                  onChanged: onSectionChanged,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          OutlinedButton.icon(
            onPressed: () async {
              final picked = await showDatePicker(
                context: context,
                initialDate: date,
                firstDate: DateTime(DateTime.now().year - 2),
                lastDate: DateTime(DateTime.now().year + 1),
              );
              if (picked != null) onDateChanged(picked);
            },
            icon: const Icon(Icons.calendar_month_outlined),
            label: Text(DateFormat.yMMMd().format(date)),
          ),
          const SizedBox(height: AppSpacing.md),
          FilledButton.icon(
            onPressed: onResolve,
            icon: const Icon(Icons.rule_rounded),
            label: const Text('Resolve Attendance Mode'),
          ),
        ],
      ),
    );
  }
}

class _ResolvedAttendancePanel extends ConsumerWidget {
  const _ResolvedAttendancePanel({
    required this.scope,
    required this.selectedUnit,
    required this.canSave,
    required this.editedRows,
    required this.onUnitChanged,
    required this.onRowsChanged,
  });

  final AttendanceScopeQuery scope;
  final AttendanceUnit? selectedUnit;
  final bool canSave;
  final List<AttendanceStudentRecord>? editedRows;
  final ValueChanged<AttendanceUnit> onUnitChanged;
  final ValueChanged<List<AttendanceStudentRecord>> onRowsChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final configState = ref.watch(attendanceConfigProvider(scope));
    final unitsState = ref.watch(attendanceUnitsProvider(scope));

    return AsyncStateView(
      value: configState,
      data: (config) => AsyncStateView(
        value: unitsState,
        data: (units) {
          if (units.isEmpty) {
            return const _InfoPanel(
              message: 'No attendance units are configured for this selection.',
            );
          }
          final unit = units.contains(selectedUnit)
              ? selectedUnit!
              : units.first;
          final query = AttendanceSheetQuery(scope: scope, unit: unit);
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _ModeUnitCard(
                config: config,
                units: units,
                selectedUnit: unit,
                onUnitChanged: onUnitChanged,
              ),
              const SizedBox(height: AppSpacing.md),
              AsyncStateView(
                value: ref.watch(attendanceSheetProvider(query)),
                data: (sheet) => _V2AttendanceSheet(
                  query: query,
                  sheet: sheet,
                  rows: editedRows ?? sheet.rows,
                  canSave: canSave,
                  onRowsChanged: onRowsChanged,
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _ModeUnitCard extends StatelessWidget {
  const _ModeUnitCard({
    required this.config,
    required this.units,
    required this.selectedUnit,
    required this.onUnitChanged,
  });

  final AttendanceConfiguration config;
  final List<AttendanceUnit> units;
  final AttendanceUnit selectedUnit;
  final ValueChanged<AttendanceUnit> onUnitChanged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: theme.colorScheme.secondaryContainer.withValues(alpha: 0.45),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.xs,
            children: [
              Chip(label: Text(_modeLabel(config.mode))),
              Chip(label: Text('Source: ${config.source}')),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          DropdownButtonFormField<AttendanceUnit>(
            initialValue: selectedUnit,
            decoration: InputDecoration(
              labelText: 'Attendance Unit',
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            items: [
              for (final unit in units)
                DropdownMenuItem(value: unit, child: Text(_unitLabel(unit))),
            ],
            onChanged: (value) {
              if (value != null) onUnitChanged(value);
            },
          ),
          if (_unitMeta(selectedUnit).isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              _unitMeta(selectedUnit),
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _V2AttendanceSheet extends ConsumerWidget {
  const _V2AttendanceSheet({
    required this.query,
    required this.sheet,
    required this.rows,
    required this.canSave,
    required this.onRowsChanged,
  });

  final AttendanceSheetQuery query;
  final AttendanceSheet sheet;
  final List<AttendanceStudentRecord> rows;
  final bool canSave;
  final ValueChanged<List<AttendanceStudentRecord>> onRowsChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final saveState = ref.watch(saveAttendanceProvider);
    final lockState = ref.watch(lockAttendanceSheetProvider);
    final isLocked = sheet.isLocked;
    final canEdit = canSave && !isLocked;

    if (rows.isEmpty) {
      return const _InfoPanel(
        message: 'No students found for this class and section.',
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (isLocked)
          _InfoPanel(
            message:
                'This sheet is locked${sheet.session?.lockReason == null ? '' : ': ${sheet.session!.lockReason}'}',
            icon: Icons.lock_outline,
          ),
        if (!canSave && !isLocked)
          const _InfoPanel(
            message:
                'You can view this attendance sheet, but your account does not have permission to edit attendance.',
            icon: Icons.lock_outline,
          ),
        if (isLocked || !canSave) const SizedBox(height: AppSpacing.sm),
        _V2SummaryBar(rows: rows),
        const SizedBox(height: AppSpacing.sm),
        _MarkAllBar(
          enabled: canEdit,
          onMarkAll: (status) => onRowsChanged([
            for (final row in rows) row.copyWith(status: status),
          ]),
        ),
        const SizedBox(height: AppSpacing.sm),
        Container(
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: Theme.of(context).colorScheme.outlineVariant,
            ),
          ),
          child: Column(
            children: [
              for (var index = 0; index < rows.length; index++) ...[
                _StudentV2Row(
                  row: rows[index],
                  enabled: canEdit,
                  onChanged: (status) => onRowsChanged([
                    for (final row in rows)
                      row.studentId == rows[index].studentId
                          ? row.copyWith(status: status)
                          : row,
                  ]),
                ),
                if (index < rows.length - 1) const Divider(height: 1),
              ],
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Row(
          children: [
            Expanded(
              child: FilledButton.icon(
                onPressed: canEdit && !saveState.isLoading
                    ? () => ref
                          .read(saveAttendanceProvider.notifier)
                          .save(
                            AttendanceSheetSaveRequest(
                              query: query,
                              records: rows,
                            ),
                          )
                    : null,
                icon: saveState.isLoading
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.save_rounded),
                label: const Text('Save'),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            OutlinedButton.icon(
              onPressed:
                  canSave &&
                      !isLocked &&
                      sheet.session != null &&
                      !lockState.isLoading
                  ? () => ref
                        .read(lockAttendanceSheetProvider.notifier)
                        .lock(
                          sessionId: sheet.session!.id,
                          query: query,
                          reason: 'Locked from mobile',
                        )
                  : null,
              icon: const Icon(Icons.lock_outline),
              label: const Text('Lock'),
            ),
          ],
        ),
        if (saveState.hasError || lockState.hasError) ...[
          const SizedBox(height: AppSpacing.sm),
          _InfoPanel(
            message: (saveState.error ?? lockState.error).toString(),
            icon: Icons.error_outline,
          ),
        ],
      ],
    );
  }
}

class _V2SummaryBar extends StatelessWidget {
  const _V2SummaryBar({required this.rows});

  final List<AttendanceStudentRecord> rows;

  @override
  Widget build(BuildContext context) {
    final counts = <String, int>{};
    for (final row in rows) {
      counts[row.status] = (counts[row.status] ?? 0) + 1;
    }
    return Wrap(
      spacing: AppSpacing.xs,
      runSpacing: AppSpacing.xs,
      children: [
        Chip(label: Text('Total ${rows.length}')),
        for (final status in _v2Statuses)
          Chip(label: Text('${_statusLabel(status)} ${counts[status] ?? 0}')),
      ],
    );
  }
}

class _MarkAllBar extends StatelessWidget {
  const _MarkAllBar({required this.enabled, required this.onMarkAll});

  final bool enabled;
  final ValueChanged<String> onMarkAll;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: AppSpacing.xs,
      children: [
        for (final status in _v2Statuses)
          ActionChip(
            avatar: Icon(_statusIcon(status), size: 16),
            label: Text(_statusLabel(status)),
            onPressed: enabled ? () => onMarkAll(status) : null,
          ),
      ],
    );
  }
}

class _StudentV2Row extends StatelessWidget {
  const _StudentV2Row({
    required this.row,
    required this.enabled,
    required this.onChanged,
  });

  final AttendanceStudentRecord row;
  final bool enabled;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final meta = [
      if (row.rollNo != null && row.rollNo!.isNotEmpty) 'Roll ${row.rollNo}',
      if (row.admissionNo != null && row.admissionNo!.isNotEmpty)
        row.admissionNo!,
    ].join(' · ');
    return ListTile(
      title: Text(row.fullName),
      subtitle: meta.isEmpty ? null : Text(meta),
      trailing: DropdownButton<String>(
        value: _v2Statuses.contains(row.status) ? row.status : 'PRESENT',
        underline: const SizedBox.shrink(),
        items: [
          for (final status in _v2Statuses)
            DropdownMenuItem(value: status, child: Text(_statusLabel(status))),
        ],
        onChanged: enabled
            ? (value) => value == null ? null : onChanged(value)
            : null,
      ),
    );
  }
}

class _DropdownField extends StatelessWidget {
  const _DropdownField({
    required this.label,
    required this.value,
    required this.items,
    required this.onChanged,
  });

  final String label;
  final String? value;
  final List<DropdownMenuItem<String>> items;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<String>(
      initialValue: value,
      decoration: InputDecoration(
        labelText: label,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
      ),
      items: items,
      onChanged: onChanged,
    );
  }
}

class _InfoPanel extends StatelessWidget {
  const _InfoPanel({required this.message, this.icon = Icons.info_outline});

  final String message;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(icon, color: colorScheme.onSurfaceVariant),
          const SizedBox(width: AppSpacing.sm),
          Expanded(child: Text(message)),
        ],
      ),
    );
  }
}

String _modeLabel(AttendanceMode mode) {
  return switch (mode) {
    AttendanceMode.daily => 'Daily',
    AttendanceMode.twiceDaily => 'Twice Daily',
    AttendanceMode.periodWise => 'Period Wise',
  };
}

String _unitLabel(AttendanceUnit unit) {
  if (unit.unitType == AttendanceUnitType.slot && unit.slotType != null) {
    return unit.slotType == AttendanceSlotType.morning
        ? 'Morning'
        : 'Afternoon';
  }
  return unit.label;
}

String _unitMeta(AttendanceUnit unit) {
  final parts = [
    if (unit.subjectName != null && unit.subjectName!.isNotEmpty)
      unit.subjectName!,
    if (unit.teacherName != null && unit.teacherName!.isNotEmpty)
      unit.teacherName!,
    if (unit.startTime != null && unit.endTime != null)
      '${unit.startTime} - ${unit.endTime}',
  ];
  return parts.join(' · ');
}

String _statusLabel(String status) => switch (status) {
  'PRESENT' => 'Present',
  'LATE' => 'Late',
  'ABSENT' => 'Absent',
  'EXCUSED' => 'Excused',
  _ => status,
};

IconData _statusIcon(String status) => switch (status) {
  'PRESENT' => Icons.check_circle_outline,
  'LATE' => Icons.schedule,
  'ABSENT' => Icons.cancel_outlined,
  'EXCUSED' => Icons.event_available_outlined,
  _ => Icons.help_outline,
};
