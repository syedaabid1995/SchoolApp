import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/permissions/permission_registry.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../../../core/widgets/async_state_view.dart';
import '../../../auth/presentation/providers/current_permission_provider.dart';
import '../../../exams/domain/entities/exam.dart';
import '../../domain/entities/marks.dart';
import '../providers/marks_providers.dart';
import 'marks_summary_screen.dart';

class MarksEntryScreen extends ConsumerStatefulWidget {
  const MarksEntryScreen({required this.paper, super.key});

  final ExamPaper paper;

  @override
  ConsumerState<MarksEntryScreen> createState() => _MarksEntryScreenState();
}

class _MarksEntryScreenState extends ConsumerState<MarksEntryScreen> {
  final _controllers = <String, TextEditingController>{};
  final _errors = <String, String>{};
  var _submitAs = 'DRAFT';

  @override
  void dispose() {
    for (final c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  TextEditingController _controllerFor(String studentId) =>
      _controllers.putIfAbsent(studentId, TextEditingController.new);

  void _validateField(String studentId, String raw) {
    setState(() {
      if (raw.isEmpty) {
        _errors.remove(studentId);
        return;
      }
      final val = num.tryParse(raw);
      if (val == null) {
        _errors[studentId] = 'Invalid number';
      } else if (val < 0) {
        _errors[studentId] = 'Cannot be negative';
      } else if (val > widget.paper.maxMarks) {
        _errors[studentId] = 'Exceeds max ${widget.paper.maxMarks}';
      } else {
        _errors.remove(studentId);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final checker = ref.watch(currentPermissionCheckerProvider);
    final canEnter = checker.canPerformAction(PermissionActionIds.enterMarks);
    final canPublish =
        checker.canPerformAction(PermissionActionIds.publishMarks);
    final students = ref.watch(
      assignedStudentsForMarksProvider(
        StudentFilter(classId: widget.paper.classId),
      ),
    );
    final submission = ref.watch(marksSubmissionProvider);
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return AppScaffold(
      title: widget.paper.subjectName ?? 'Marks',
      onRefresh: () async {
        ref.invalidate(assignedStudentsForMarksProvider);
        ref.invalidate(marksSummaryProvider(widget.paper));
      },
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: AppSpacing.md),

          // ── Paper header ────────────────────────────────────────────
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  colorScheme.primaryContainer,
                  colorScheme.secondaryContainer.withValues(alpha: 0.5),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: colorScheme.primary.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(
                    Icons.grading_outlined,
                    size: 24,
                    color: colorScheme.primary,
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.paper.subjectName ?? 'Subject',
                        style: textTheme.titleMedium
                            ?.copyWith(fontWeight: FontWeight.w800),
                      ),
                      if (widget.paper.examName != null)
                        Text(
                          widget.paper.examName!,
                          style: textTheme.bodySmall?.copyWith(
                            color: colorScheme.onSurface.withValues(alpha: 0.6),
                          ),
                        ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    _InfoPill(
                      icon: Icons.star_outline,
                      label: 'Max ${widget.paper.maxMarks}',
                    ),
                    const SizedBox(height: AppSpacing.xxs),
                    _InfoPill(
                      icon: Icons.check_circle_outline,
                      label: 'Pass ${widget.paper.passMarks}',
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: AppSpacing.md),

          // ── Meta pills row ──────────────────────────────────────────
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              if (widget.paper.className != null)
                _TagPill(label: widget.paper.className!),
              if (widget.paper.sectionName != null)
                _TagPill(label: widget.paper.sectionName!),
              if (widget.paper.scheduledAt != null)
                _TagPill(
                  label: DateFormat.yMMMd().format(widget.paper.scheduledAt!),
                  icon: Icons.event_outlined,
                ),
              if (widget.paper.examType != null)
                _TagPill(label: widget.paper.examType!),
            ],
          ),

          const SizedBox(height: AppSpacing.lg),

          // ── Student mark entries ────────────────────────────────────
          AsyncStateView(
            value: students,
            data: (items) => Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Text(
                      'Students (${items.length})',
                      style: textTheme.titleMedium
                          ?.copyWith(fontWeight: FontWeight.w700),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                if (items.isEmpty)
                  _EmptyStudents()
                else
                  for (final student in items) ...[
                    _StudentMarkCard(
                      student: student,
                      controller: _controllerFor(student.id),
                      maxMarks: widget.paper.maxMarks,
                      enabled: canEnter,
                      error: _errors[student.id],
                      onChanged: (v) => _validateField(student.id, v),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                  ],
                if (items.isNotEmpty && canEnter) ...[
                  const SizedBox(height: AppSpacing.md),
                  // Draft / Submit toggle
                  _SubmitToggle(
                    value: _submitAs,
                    canPublish: canPublish,
                    onChanged: (v) => setState(() => _submitAs = v),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  AppButton(
                    label: _submitAs == 'SUBMITTED'
                        ? 'Submit Marks'
                        : 'Save as Draft',
                    icon: _submitAs == 'SUBMITTED'
                        ? Icons.publish_outlined
                        : Icons.save_outlined,
                    isLoading: submission.isLoading,
                    onPressed:
                        _errors.isNotEmpty ? null : () => _submit(items),
                  ),
                ],
              ],
            ),
          ),

          const SizedBox(height: AppSpacing.lg),

          // ── Summary ─────────────────────────────────────────────────
          MarksSummaryScreen(paper: widget.paper),

          const SizedBox(height: AppSpacing.lg),
        ],
      ),
    );
  }

  Future<void> _submit(List<AssignedStudent> students) async {
    final entries = <MarkEntry>[];
    for (final student in students) {
      final raw = _controllerFor(student.id).text.trim();
      if (raw.isEmpty) continue;
      final marks = num.tryParse(raw);
      if (marks == null) {
        _show('Invalid marks for ${student.fullName}');
        return;
      }
      entries.add(MarkEntry(studentId: student.id, marks: marks));
    }
    final draft = MarksDraft(
      examPaperId: widget.paper.id,
      entries: entries,
      status: _submitAs,
    );
    final errors = draft.validate(widget.paper);
    if (errors.isNotEmpty) {
      _show(errors.first);
      return;
    }
    await ref.read(marksSubmissionProvider.notifier).submit(draft);
    if (!mounted) return;
    ref.invalidate(marksSummaryProvider(widget.paper));
    _show(_submitAs == 'SUBMITTED' ? 'Marks submitted.' : 'Draft saved.');
  }

  void _show(String message) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }
}

class _InfoPill extends StatelessWidget {
  const _InfoPill({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 12, color: colorScheme.primary),
        const SizedBox(width: 3),
        Text(
          label,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: colorScheme.onSurface.withValues(alpha: 0.7),
                fontWeight: FontWeight.w600,
              ),
        ),
      ],
    );
  }
}

class _TagPill extends StatelessWidget {
  const _TagPill({required this.label, this.icon});

  final String label;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xxs,
      ),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 12, color: colorScheme.onSurface.withValues(alpha: 0.5)),
            const SizedBox(width: 3),
          ],
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: colorScheme.onSurface.withValues(alpha: 0.65),
                  fontWeight: FontWeight.w600,
                ),
          ),
        ],
      ),
    );
  }
}

class _StudentMarkCard extends StatelessWidget {
  const _StudentMarkCard({
    required this.student,
    required this.controller,
    required this.maxMarks,
    required this.enabled,
    required this.onChanged,
    this.error,
  });

  final AssignedStudent student;
  final TextEditingController controller;
  final num maxMarks;
  final bool enabled;
  final String? error;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final hasError = error != null;

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(14),
        border: hasError
            ? Border.all(color: colorScheme.error.withValues(alpha: 0.5))
            : null,
        boxShadow: [
          BoxShadow(
            color: colorScheme.shadow.withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          // Avatar
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: colorScheme.primaryContainer,
              borderRadius: BorderRadius.circular(10),
            ),
            alignment: Alignment.center,
            child: Text(
              student.rollNo?.toString() ??
                  student.fullName.substring(0, 1).toUpperCase(),
              style: textTheme.labelMedium?.copyWith(
                color: colorScheme.onPrimaryContainer,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          // Name + error
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  student.fullName,
                  style: textTheme.bodyMedium
                      ?.copyWith(fontWeight: FontWeight.w600),
                ),
                if (student.admissionNo != null)
                  Text(
                    'Adm: ${student.admissionNo}',
                    style: textTheme.labelSmall?.copyWith(
                      color: colorScheme.onSurface.withValues(alpha: 0.45),
                    ),
                  ),
                if (hasError)
                  Text(
                    error!,
                    style: textTheme.labelSmall?.copyWith(
                      color: colorScheme.error,
                    ),
                  ),
              ],
            ),
          ),
          // Marks input
          SizedBox(
            width: 72,
            child: TextField(
              controller: controller,
              enabled: enabled,
              textAlign: TextAlign.center,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              onChanged: onChanged,
              style: textTheme.titleSmall
                  ?.copyWith(fontWeight: FontWeight.w700),
              decoration: InputDecoration(
                hintText: '—',
                filled: true,
                fillColor: hasError
                    ? colorScheme.errorContainer.withValues(alpha: 0.4)
                    : colorScheme.surfaceContainerHighest,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide.none,
                ),
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.xs,
                  vertical: AppSpacing.xs,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SubmitToggle extends StatelessWidget {
  const _SubmitToggle({
    required this.value,
    required this.canPublish,
    required this.onChanged,
  });

  final String value;
  final bool canPublish;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    final options = [
      ('DRAFT', 'Save Draft', Icons.edit_note_outlined),
      if (canPublish) ('SUBMITTED', 'Submit', Icons.publish_outlined),
    ];

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          for (final (key, label, icon) in options)
            Expanded(
              child: GestureDetector(
                onTap: () => onChanged(key),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
                  decoration: BoxDecoration(
                    color: value == key
                        ? colorScheme.primary
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        icon,
                        size: 16,
                        color: value == key
                            ? colorScheme.onPrimary
                            : colorScheme.onSurface.withValues(alpha: 0.6),
                      ),
                      const SizedBox(width: AppSpacing.xxs),
                      Text(
                        label,
                        style: textTheme.labelMedium?.copyWith(
                          color: value == key
                              ? colorScheme.onPrimary
                              : colorScheme.onSurface.withValues(alpha: 0.6),
                          fontWeight: value == key
                              ? FontWeight.w700
                              : FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _EmptyStudents extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xl),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Center(
        child: Text(
          'No students available for this paper.',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: colorScheme.onSurface.withValues(alpha: 0.45),
              ),
        ),
      ),
    );
  }
}
