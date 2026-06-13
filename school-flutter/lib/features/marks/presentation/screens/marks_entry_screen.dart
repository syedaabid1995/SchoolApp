import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/permissions/permission_registry.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_card.dart';
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
  var _submitAs = 'DRAFT';

  @override
  void dispose() {
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final checker = ref.watch(currentPermissionCheckerProvider);
    final canEnter = checker.canPerformAction(PermissionActionIds.enterMarks);
    final canPublish = checker.canPerformAction(
      PermissionActionIds.publishMarks,
    );
    final students = ref.watch(
      assignedStudentsForMarksProvider(
        StudentFilter(
          classId: widget.paper.classId,
          sectionId: _sectionIdFromPaper(widget.paper),
        ),
      ),
    );
    final submission = ref.watch(marksSubmissionProvider);

    return AppScaffold(
      title: widget.paper.subjectName ?? 'Marks',
      onRefresh: () async {
        ref.invalidate(assignedStudentsForMarksProvider);
        ref.invalidate(marksSummaryProvider(widget.paper));
      },
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(widget.paper.examName ?? 'Exam'),
                Text('Max marks: ${widget.paper.maxMarks}'),
                if (widget.paper.className != null)
                  Text(widget.paper.className!),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          AsyncStateView(
            value: students,
            data: (items) => AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Students',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  if (items.isEmpty)
                    const Text('No students available for this paper.')
                  else
                    for (final student in items)
                      Padding(
                        padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                        child: TextField(
                          controller: _controllerFor(student.id),
                          enabled: canEnter,
                          keyboardType: const TextInputType.numberWithOptions(
                            decimal: true,
                          ),
                          decoration: InputDecoration(
                            labelText: student.fullName,
                            helperText: [
                              if (student.rollNo != null)
                                'Roll ${student.rollNo}',
                              'Max ${widget.paper.maxMarks}',
                            ].join(' · '),
                          ),
                        ),
                      ),
                  if (items.isNotEmpty && canEnter) ...[
                    const SizedBox(height: AppSpacing.sm),
                    SegmentedButton<String>(
                      segments: [
                        const ButtonSegment(
                          value: 'DRAFT',
                          label: Text('Draft'),
                        ),
                        if (canPublish)
                          const ButtonSegment(
                            value: 'SUBMITTED',
                            label: Text('Submit'),
                          ),
                      ],
                      selected: {_submitAs},
                      onSelectionChanged: (value) =>
                          setState(() => _submitAs = value.single),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    AppButton(
                      label: _submitAs == 'SUBMITTED'
                          ? 'Submit marks'
                          : 'Save draft',
                      isLoading: submission.isLoading,
                      onPressed: () => _submit(items),
                      icon: Icons.save_outlined,
                    ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          MarksSummaryScreen(paper: widget.paper),
        ],
      ),
    );
  }

  TextEditingController _controllerFor(String studentId) {
    return _controllers.putIfAbsent(studentId, TextEditingController.new);
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
    _show('Marks saved.');
  }

  void _show(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  String? _sectionIdFromPaper(ExamPaper paper) => null;
}
