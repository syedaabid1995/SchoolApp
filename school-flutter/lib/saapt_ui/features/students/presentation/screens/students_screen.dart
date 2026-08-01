import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../../../global_ui/features/attendance/domain/entities/attendance_summary.dart';
import '../../../../../global_ui/features/attendance/presentation/providers/attendance_providers.dart';
import '../../../../../global_ui/features/auth/presentation/providers/auth_controller.dart';
import '../../../../../global_ui/features/classes/domain/entities/class_assignment.dart';
import '../../../../../global_ui/features/classes/presentation/providers/class_assignment_providers.dart';
import '../../../../app/theme/saapt_theme.dart';
import 'student_attendance_preview_screen.dart';

class SaaptStudentsScreen extends ConsumerStatefulWidget {
  const SaaptStudentsScreen({super.key});

  @override
  ConsumerState<SaaptStudentsScreen> createState() =>
      _SaaptStudentsScreenState();
}

class _SaaptStudentsScreenState extends ConsumerState<SaaptStudentsScreen> {
  final _picker = ImagePicker();
  String? _academicYearId;
  String? _classId;
  String? _sectionId;
  String? _selectedUnitKey;
  String? _schoolId;
  bool _openingCamera = false;

  @override
  Widget build(BuildContext context) {
    final activeSchoolId = ref.watch(
      authControllerProvider.select((state) => state.value?.user?.schoolId),
    );
    if (_schoolId != activeSchoolId) {
      _schoolId = activeSchoolId;
      _academicYearId = null;
      _classId = null;
      _sectionId = null;
      _selectedUnitKey = null;
    }
    final optionsState = ref.watch(studentAttendanceOptionsProvider);
    final assignmentsState = ref.watch(classAssignmentsProvider);
    return Scaffold(body: _buildBody(optionsState, assignmentsState));
  }

  Widget _buildBody(
    AsyncValue<StudentAttendanceOptions> optionsState,
    AsyncValue<ClassAssignments> assignmentsState,
  ) {
    final loading = optionsState.isLoading || assignmentsState.isLoading;
    final error = optionsState.error ?? assignmentsState.error;
    final options = optionsState.asData?.value;
    final assignments = assignmentsState.asData?.value;

    if (loading && (options == null || assignments == null)) {
      return const Center(child: CircularProgressIndicator());
    }
    if (error != null && (options == null || assignments == null)) {
      return _LoadError(
        message: error.toString(),
        onRetry: () {
          ref.invalidate(studentAttendanceOptionsProvider);
          ref.invalidate(classAssignmentsProvider);
        },
      );
    }
    if (options == null || assignments == null) {
      return const _NoAssignedClasses();
    }

    final classes = _classChoices(options, assignments);
    _applyDefaults(options, classes, assignments);
    final sections = _sectionChoices(options, assignments, _classId);
    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(child: _SetupHeader(scope: _scope)),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
          sliver: SliverToBoxAdapter(
            child: Builder(
              builder: (context) {
                if (classes.isEmpty) return const _NoAssignedClasses();
                final scope = _scope;
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _SelectionCard(
                      options: options,
                      classes: classes,
                      sections: sections,
                      academicYearId: _academicYearId,
                      classId: _classId,
                      sectionId: _sectionId,
                      onAcademicYearChanged: (value) => setState(() {
                        _academicYearId = value;
                        _selectedUnitKey = null;
                      }),
                      onClassChanged: (value) => setState(() {
                        _classId = value;
                        final nextSections = _sectionChoices(
                          options,
                          assignments,
                          value,
                        );
                        _sectionId = nextSections.firstOrNull?.id;
                        _selectedUnitKey = null;
                      }),
                      onSectionChanged: (value) => setState(() {
                        _sectionId = value;
                        _selectedUnitKey = null;
                      }),
                    ),
                    if (scope != null) ...[
                      const SizedBox(height: 16),
                      _ResolvedClassPanel(
                        scope: scope,
                        selectedUnitKey: _selectedUnitKey,
                        onUnitChanged: (value) =>
                            setState(() => _selectedUnitKey = value),
                        openingCamera: _openingCamera,
                        onScan: _captureAndPreview,
                      ),
                    ],
                  ],
                );
              },
            ),
          ),
        ),
      ],
    );
  }

  AttendanceScopeQuery? get _scope {
    if (_academicYearId == null || _classId == null) return null;
    return AttendanceScopeQuery(
      academicYearId: _academicYearId!,
      classId: _classId!,
      sectionId: _sectionId,
      date: DateTime.now(),
    );
  }

  void _applyDefaults(
    StudentAttendanceOptions options,
    List<StudentAttendanceOption> classes,
    ClassAssignments assignments,
  ) {
    if (!options.academicYears.any((item) => item.id == _academicYearId)) {
      _academicYearId =
          options.academicYears
              .where((item) => item.isActive)
              .firstOrNull
              ?.id ??
          options.academicYears.firstOrNull?.id;
      _classId = null;
      _sectionId = null;
      _selectedUnitKey = null;
    }
    if (!classes.any((item) => item.id == _classId)) {
      _classId = classes.firstOrNull?.id;
      _sectionId = null;
      _selectedUnitKey = null;
    }
    final sections = _sectionChoices(options, assignments, _classId);
    if (!sections.any((item) => item.id == _sectionId)) {
      _sectionId = sections.firstOrNull?.id;
      _selectedUnitKey = null;
    }
  }

  Future<void> _captureAndPreview(
    AttendanceSheetQuery query,
    AttendanceSheet sheet,
  ) async {
    if (_openingCamera) return;
    final source = await _chooseAiAttendanceSource();
    if (source == null) return;

    setState(() => _openingCamera = true);
    try {
      final captures = await _pickAiAttendanceImages(source);
      if (captures.isEmpty || !mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => StudentAttendancePreviewScreen(
            query: query,
            initialSheet: sheet,
            initialCaptures: captures,
          ),
        ),
      );
    } catch (error) {
      if (!mounted) return;
      final label = source == _AiAttendanceImageSource.camera
          ? 'camera'
          : 'internal storage';
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Unable to open $label: $error')));
    } finally {
      if (mounted) setState(() => _openingCamera = false);
    }
  }

  Future<List<XFile>> _pickAiAttendanceImages(
    _AiAttendanceImageSource source,
  ) async {
    if (source == _AiAttendanceImageSource.camera) {
      final capture = await _picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 82,
        maxWidth: 2048,
      );
      return capture == null ? const <XFile>[] : [capture];
    }
    return _picker.pickMultiImage(imageQuality: 82, maxWidth: 2048);
  }

  Future<_AiAttendanceImageSource?> _chooseAiAttendanceSource() {
    return showModalBottomSheet<_AiAttendanceImageSource>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt_outlined),
              title: const Text('Camera'),
              onTap: () =>
                  Navigator.of(context).pop(_AiAttendanceImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.folder_open_outlined),
              title: const Text('Internal storage'),
              onTap: () =>
                  Navigator.of(context).pop(_AiAttendanceImageSource.storage),
            ),
          ],
        ),
      ),
    );
  }
}

enum _AiAttendanceImageSource { camera, storage }

class _SetupHeader extends ConsumerWidget {
  const _SetupHeader({required this.scope});
  final AttendanceScopeQuery? scope;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final config = scope == null
        ? null
        : ref.watch(attendanceConfigProvider(scope!));
    final resolvedConfig = config?.value;
    return Container(
      color: SaaptTheme.primary,
      padding: const EdgeInsets.fromLTRB(24, 52, 24, 26),
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
                Icon(Icons.assignment_outlined, size: 18, color: Colors.white),
                SizedBox(width: 7),
                Text(
                  'Class Setup',
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
            'Select Class Details',
            style: TextStyle(
              color: Colors.white,
              fontSize: 31,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 5),
          Text(
            resolvedConfig != null
                ? '${resolvedConfig.mode.value.replaceAll('_', ' ')} attendance'
                : 'Attendance mode resolves automatically',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.80),
              fontSize: 15,
            ),
          ),
        ],
      ),
    );
  }
}

List<StudentAttendanceOption> _classChoices(
  StudentAttendanceOptions options,
  ClassAssignments assignments,
) {
  if (assignments.classes.isEmpty) return const [];
  final optionsById = {for (final item in options.classes) item.id: item};
  return [
    for (final item in assignments.classes)
      optionsById[item.id] ??
          StudentAttendanceOption(
            id: item.id,
            name: item.name,
            academicYearId: item.academicYearId,
            isActive: true,
          ),
  ];
}

List<StudentAttendanceOption> _sectionChoices(
  StudentAttendanceOptions options,
  ClassAssignments assignments,
  String? classId,
) {
  if (classId == null || classId.isEmpty) return const [];
  final assignedSections = assignments.sectionsForClass(classId);
  if (assignedSections.isNotEmpty) {
    return [
      for (final item in assignedSections)
        StudentAttendanceOption(
          id: item.id,
          name: item.name,
          classId: item.classId,
          isActive: true,
        ),
    ];
  }
  return options.sectionsForClass(classId);
}

class _SelectionCard extends StatelessWidget {
  const _SelectionCard({
    required this.options,
    required this.classes,
    required this.sections,
    required this.academicYearId,
    required this.classId,
    required this.sectionId,
    required this.onAcademicYearChanged,
    required this.onClassChanged,
    required this.onSectionChanged,
  });

  final StudentAttendanceOptions options;
  final List<StudentAttendanceOption> classes;
  final List<StudentAttendanceOption> sections;
  final String? academicYearId;
  final String? classId;
  final String? sectionId;
  final ValueChanged<String?> onAcademicYearChanged;
  final ValueChanged<String?> onClassChanged;
  final ValueChanged<String?> onSectionChanged;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(8),
      border: Border.all(color: const Color(0xFFDDE5F2)),
    ),
    child: Column(
      children: [
        _SelectField(
          label: 'ACADEMIC YEAR',
          value: academicYearId,
          items: [
            for (final item in options.academicYears)
              DropdownMenuItem(value: item.id, child: Text(item.name)),
          ],
          onChanged: onAcademicYearChanged,
        ),
        const SizedBox(height: 14),
        _SelectField(
          label: 'CLASS STANDARD',
          value: classId,
          items: [
            for (final item in classes)
              DropdownMenuItem(value: item.id, child: Text(item.name)),
          ],
          onChanged: onClassChanged,
        ),
        const SizedBox(height: 14),
        _SelectField(
          label: 'SECTION',
          value: sections.any((item) => item.id == sectionId)
              ? sectionId
              : null,
          items: [
            for (final item in sections)
              DropdownMenuItem(value: item.id, child: Text(item.name)),
          ],
          onChanged: onSectionChanged,
        ),
      ],
    ),
  );
}

class _ResolvedClassPanel extends ConsumerWidget {
  const _ResolvedClassPanel({
    required this.scope,
    required this.selectedUnitKey,
    required this.onUnitChanged,
    required this.openingCamera,
    required this.onScan,
  });

  final AttendanceScopeQuery scope;
  final String? selectedUnitKey;
  final ValueChanged<String?> onUnitChanged;
  final bool openingCamera;
  final Future<void> Function(AttendanceSheetQuery, AttendanceSheet) onScan;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unitsState = ref.watch(attendanceUnitsProvider(scope));
    return unitsState.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => _LoadError(
        message: error.toString(),
        onRetry: () => ref.invalidate(attendanceUnitsProvider(scope)),
      ),
      data: (units) {
        if (units.isEmpty) return const _NoUnits();
        final selected =
            units
                .where((item) => item.identityPart == selectedUnitKey)
                .firstOrNull ??
            units.first;
        final query = AttendanceSheetQuery(scope: scope, unit: selected);
        final sheetState = ref.watch(attendanceSheetProvider(query));
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFDDE5F2)),
              ),
              child: _SelectField(
                label: 'ATTENDANCE UNIT',
                value: selected.identityPart,
                items: [
                  for (final item in units)
                    DropdownMenuItem(
                      value: item.identityPart,
                      child: Text(_unitLabel(item)),
                    ),
                ],
                onChanged: onUnitChanged,
              ),
            ),
            const SizedBox(height: 16),
            sheetState.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, _) => _LoadError(
                message: error.toString(),
                onRetry: () => ref.invalidate(attendanceSheetProvider(query)),
              ),
              data: (sheet) {
                final marked = sheet.rows
                    .where((row) => row.recordId != null)
                    .length;
                final present = sheet.rows
                    .where(
                      (row) => row.status == 'PRESENT' && row.recordId != null,
                    )
                    .length;
                final absent = sheet.rows
                    .where(
                      (row) => row.status == 'ABSENT' && row.recordId != null,
                    )
                    .length;
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: _CountCard(
                            value: '${sheet.rows.length}',
                            label: 'Students',
                            color: SaaptTheme.primary,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _CountCard(
                            value: '$marked',
                            label: 'Marked',
                            color: SaaptTheme.success,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: _CountCard(
                            value: '$present',
                            label: 'Present',
                            color: SaaptTheme.success,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _CountCard(
                            value: '$absent',
                            label: 'Absent',
                            color: const Color(0xFFD64545),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    FilledButton.icon(
                      style: FilledButton.styleFrom(
                        minimumSize: const Size.fromHeight(56),
                        backgroundColor: SaaptTheme.primary,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                      onPressed: openingCamera || sheet.rows.isEmpty
                          ? null
                          : () => onScan(query, sheet),
                      icon: openingCamera
                          ? const SizedBox.square(
                              dimension: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Icon(Icons.camera_alt_outlined),
                      label: const Text(
                        'Start AI Attendance Scan',
                        style: TextStyle(fontWeight: FontWeight.w800),
                      ),
                    ),
                  ],
                );
              },
            ),
          ],
        );
      },
    );
  }

  String _unitLabel(AttendanceUnit unit) {
    final details = [
      unit.subjectName,
      unit.startTime,
      unit.endTime,
    ].whereType<String>().where((item) => item.isNotEmpty).join(' • ');
    return details.isEmpty ? unit.label : '${unit.label} • $details';
  }
}

class _SelectField extends StatelessWidget {
  const _SelectField({
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
    final values = items.map((item) => item.value).whereType<String>().toSet();
    final resolvedValue = value != null && values.contains(value)
        ? value
        : null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: Color(0xFF91A0BA),
            fontSize: 12,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 7),
        DropdownButtonFormField<String>(
          key: ValueKey('$label:$resolvedValue:${items.length}'),
          initialValue: resolvedValue,
          isExpanded: true,
          items: items,
          onChanged: items.isEmpty ? null : onChanged,
        ),
      ],
    );
  }
}

class _CountCard extends StatelessWidget {
  const _CountCard({
    required this.value,
    required this.label,
    required this.color,
  });
  final String value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(vertical: 16),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(8),
      border: Border.all(color: const Color(0xFFDDE5F2)),
    ),
    child: Column(
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: 27,
            fontWeight: FontWeight.w800,
            color: color,
          ),
        ),
        Text(
          label,
          style: const TextStyle(
            color: Color(0xFF91A0BA),
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    ),
  );
}

class _LoadError extends StatelessWidget {
  const _LoadError({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh),
            label: const Text('Retry'),
          ),
        ],
      ),
    ),
  );
}

class _NoUnits extends StatelessWidget {
  const _NoUnits();
  @override
  Widget build(BuildContext context) => const Center(
    child: Padding(
      padding: EdgeInsets.all(24),
      child: Text('No attendance units are configured for this selection.'),
    ),
  );
}

class _NoAssignedClasses extends StatelessWidget {
  const _NoAssignedClasses();

  @override
  Widget build(BuildContext context) => const Center(
    child: Padding(
      padding: EdgeInsets.all(24),
      child: Text(
        'No assigned classes are available for attendance marking.',
        textAlign: TextAlign.center,
      ),
    ),
  );
}
