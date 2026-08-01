import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../../../core/widgets/async_state_view.dart';
import '../../domain/entities/homework.dart';
import '../providers/homework_providers.dart';

class HomeworkEvaluationScreen extends ConsumerWidget {
  const HomeworkEvaluationScreen({required this.homework, super.key});

  final Homework homework;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(homeworkEvaluationProvider(homework.id));
    return AppScaffold(
      title: 'Evaluate Homework',
      child: AsyncStateView(
        value: detail,
        data: (item) => _EvaluationForm(detail: item),
      ),
    );
  }
}

class _EvaluationForm extends ConsumerStatefulWidget {
  const _EvaluationForm({required this.detail});

  final HomeworkEvaluationDetail detail;

  @override
  ConsumerState<_EvaluationForm> createState() => _EvaluationFormState();
}

class _EvaluationFormState extends ConsumerState<_EvaluationForm> {
  late DateTime _evaluationDate;
  late List<_EvaluationRowDraft> _rows;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final homework = widget.detail.homework;
    _evaluationDate = homework.evaluationDate ?? DateTime.now();
    _rows = [
      for (final row in widget.detail.rows)
        _EvaluationRowDraft(
          studentId: row.student.id,
          admissionNo: row.student.admissionNo,
          fullName: row.student.fullName,
          marks: row.evaluation?.marks?.toString() ?? '',
          comments: row.evaluation?.comments ?? '',
          qualityStatus:
              row.evaluation?.qualityStatus ?? HomeworkQualityStatus.good,
          completionStatus:
              row.evaluation?.completionStatus ??
              HomeworkCompletionStatus.completed,
        ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final homework = widget.detail.homework;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: AppSpacing.md),
        Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: colorScheme.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: colorScheme.outlineVariant),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                homework.subjectName ?? 'Homework',
                style: textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: AppSpacing.xxs),
              Text(
                '${homework.className ?? ''} ${homework.sectionName ?? ''}'
                    .trim(),
                style: textTheme.bodySmall?.copyWith(
                  color: colorScheme.onSurface.withValues(alpha: 0.65),
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: _saving ? null : () => _pickEvaluationDate(context),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.sm,
                    vertical: AppSpacing.xs,
                  ),
                  decoration: BoxDecoration(
                    color: colorScheme.primaryContainer,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.event_available_outlined,
                        size: 16,
                        color: colorScheme.onPrimaryContainer,
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      Text(
                        DateFormat.yMMMd().format(_evaluationDate),
                        style: textTheme.labelMedium?.copyWith(
                          color: colorScheme.onPrimaryContainer,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        if (_rows.isEmpty)
          Container(
            padding: const EdgeInsets.all(AppSpacing.lg),
            decoration: BoxDecoration(
              color: colorScheme.surface,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Text(
              'No students found for this class and section.',
              textAlign: TextAlign.center,
              style: textTheme.bodyMedium?.copyWith(
                color: colorScheme.onSurface.withValues(alpha: 0.55),
              ),
            ),
          )
        else
          for (var index = 0; index < _rows.length; index++) ...[
            _StudentEvaluationCard(
              row: _rows[index],
              onChanged: (row) => setState(() => _rows[index] = row),
            ),
            const SizedBox(height: AppSpacing.sm),
          ],
        const SizedBox(height: AppSpacing.md),
        AppButton(
          label: 'Save Evaluation',
          icon: Icons.save_outlined,
          isLoading: _saving,
          onPressed: _rows.isEmpty || _saving ? null : _save,
        ),
        const SizedBox(height: AppSpacing.lg),
      ],
    );
  }

  Future<void> _pickEvaluationDate(BuildContext context) async {
    final picked = await showDatePicker(
      context: context,
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      initialDate: _evaluationDate,
    );
    if (picked != null) setState(() => _evaluationDate = picked);
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await ref
          .read(homeworkMutationProvider.notifier)
          .saveEvaluation(
            id: widget.detail.homework.id,
            evaluationDate: _evaluationDate,
            evaluations: [
              for (final row in _rows)
                HomeworkEvaluationDraftRow(
                  studentId: row.studentId,
                  marks: row.marks.trim().isEmpty
                      ? null
                      : num.tryParse(row.marks.trim()),
                  comments: row.comments.trim().isEmpty
                      ? null
                      : row.comments.trim(),
                  qualityStatus: row.qualityStatus,
                  completionStatus: row.completionStatus,
                ),
            ],
          );
      ref.invalidate(homeworkEvaluationProvider(widget.detail.homework.id));
      if (mounted) Navigator.of(context).pop();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }
}

class _StudentEvaluationCard extends StatelessWidget {
  const _StudentEvaluationCard({required this.row, required this.onChanged});

  final _EvaluationRowDraft row;
  final ValueChanged<_EvaluationRowDraft> onChanged;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: colorScheme.shadow.withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            row.fullName,
            style: textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: AppSpacing.xxs),
          Text(
            row.admissionNo,
            style: textTheme.bodySmall?.copyWith(
              color: colorScheme.onSurface.withValues(alpha: 0.55),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  initialValue: row.marks,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Marks'),
                  onChanged: (value) => onChanged(row.copyWith(marks: value)),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: DropdownButtonFormField<HomeworkCompletionStatus>(
                  initialValue: row.completionStatus,
                  decoration: const InputDecoration(labelText: 'Status'),
                  items: const [
                    DropdownMenuItem(
                      value: HomeworkCompletionStatus.completed,
                      child: Text('Completed'),
                    ),
                    DropdownMenuItem(
                      value: HomeworkCompletionStatus.notCompleted,
                      child: Text('Not Completed'),
                    ),
                  ],
                  onChanged: (value) {
                    if (value != null) {
                      onChanged(row.copyWith(completionStatus: value));
                    }
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          DropdownButtonFormField<HomeworkQualityStatus>(
            initialValue: row.qualityStatus,
            decoration: const InputDecoration(labelText: 'Quality'),
            items: const [
              DropdownMenuItem(
                value: HomeworkQualityStatus.good,
                child: Text('Good'),
              ),
              DropdownMenuItem(
                value: HomeworkQualityStatus.notGood,
                child: Text('Not Good'),
              ),
            ],
            onChanged: (value) {
              if (value != null) onChanged(row.copyWith(qualityStatus: value));
            },
          ),
          const SizedBox(height: AppSpacing.sm),
          TextFormField(
            initialValue: row.comments,
            decoration: const InputDecoration(labelText: 'Comments'),
            onChanged: (value) => onChanged(row.copyWith(comments: value)),
          ),
        ],
      ),
    );
  }
}

class _EvaluationRowDraft {
  const _EvaluationRowDraft({
    required this.studentId,
    required this.admissionNo,
    required this.fullName,
    required this.marks,
    required this.comments,
    required this.qualityStatus,
    required this.completionStatus,
  });

  final String studentId;
  final String admissionNo;
  final String fullName;
  final String marks;
  final String comments;
  final HomeworkQualityStatus qualityStatus;
  final HomeworkCompletionStatus completionStatus;

  _EvaluationRowDraft copyWith({
    String? marks,
    String? comments,
    HomeworkQualityStatus? qualityStatus,
    HomeworkCompletionStatus? completionStatus,
  }) {
    return _EvaluationRowDraft(
      studentId: studentId,
      admissionNo: admissionNo,
      fullName: fullName,
      marks: marks ?? this.marks,
      comments: comments ?? this.comments,
      qualityStatus: qualityStatus ?? this.qualityStatus,
      completionStatus: completionStatus ?? this.completionStatus,
    );
  }
}
