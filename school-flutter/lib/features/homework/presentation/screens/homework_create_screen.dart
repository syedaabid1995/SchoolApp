import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../../classes/domain/entities/class_assignment.dart';
import '../../domain/entities/homework.dart';
import '../providers/homework_providers.dart';

class HomeworkCreateScreen extends ConsumerStatefulWidget {
  const HomeworkCreateScreen({
    required this.assignments,
    this.homework,
    super.key,
  });

  final ClassAssignments assignments;
  final Homework? homework;

  @override
  ConsumerState<HomeworkCreateScreen> createState() =>
      _HomeworkCreateScreenState();
}

class _HomeworkCreateScreenState extends ConsumerState<HomeworkCreateScreen> {
  final _descriptionController = TextEditingController();
  String? _classId;
  String? _sectionId;
  String? _subjectId;
  DateTime _homeworkDate = DateTime.now();
  DateTime _submissionDate = DateTime.now();
  num _marks = 10;

  @override
  void initState() {
    super.initState();
    final item = widget.homework;
    if (item != null) {
      _classId = item.classId;
      _sectionId = item.sectionId;
      _subjectId = item.subjectId;
      _homeworkDate = item.homeworkDate;
      _submissionDate = item.submissionDate;
      _marks = item.marks;
      _descriptionController.text = item.description;
    }
  }

  @override
  void dispose() {
    _descriptionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final sections = widget.assignments.sectionsForClass(_classId);
    final subjects = widget.assignments.subjectsForClass(_classId);
    final state = ref.watch(homeworkMutationProvider);

    return AppScaffold(
      title: widget.homework == null ? 'Create homework' : 'Edit homework',
      child: AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            DropdownButtonFormField<String>(
              initialValue: _classId,
              decoration: const InputDecoration(labelText: 'Class'),
              items: [
                for (final item in widget.assignments.classes)
                  DropdownMenuItem(value: item.id, child: Text(item.name)),
              ],
              onChanged: (value) => setState(() {
                _classId = value;
                _sectionId = null;
                _subjectId = null;
              }),
            ),
            const SizedBox(height: AppSpacing.md),
            DropdownButtonFormField<String>(
              initialValue: _sectionId,
              decoration: const InputDecoration(labelText: 'Section'),
              items: [
                for (final item in sections)
                  DropdownMenuItem(value: item.id, child: Text(item.name)),
              ],
              onChanged: (value) => setState(() => _sectionId = value),
            ),
            const SizedBox(height: AppSpacing.md),
            DropdownButtonFormField<String>(
              initialValue: _subjectId,
              decoration: const InputDecoration(labelText: 'Subject'),
              items: [
                for (final item in subjects)
                  DropdownMenuItem(value: item.id, child: Text(item.name)),
              ],
              onChanged: (value) => setState(() => _subjectId = value),
            ),
            const SizedBox(height: AppSpacing.md),
            TextField(
              controller: _descriptionController,
              minLines: 3,
              maxLines: 5,
              decoration: const InputDecoration(labelText: 'Description'),
            ),
            const SizedBox(height: AppSpacing.md),
            TextFormField(
              initialValue: _marks.toString(),
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Marks'),
              onChanged: (value) => _marks = num.tryParse(value) ?? _marks,
            ),
            _DateTile(
              label: 'Homework date',
              value: _homeworkDate,
              onChanged: (value) => setState(() => _homeworkDate = value),
            ),
            _DateTile(
              label: 'Submission date',
              value: _submissionDate,
              onChanged: (value) => setState(() => _submissionDate = value),
            ),
            if (state.hasError) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                state.error.toString(),
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ],
            const SizedBox(height: AppSpacing.lg),
            AppButton(
              label: 'Save homework',
              icon: Icons.save_outlined,
              isLoading: state.isLoading,
              onPressed:
                  _classId == null || _sectionId == null || _subjectId == null
                  ? null
                  : () async {
                      final draft = HomeworkDraft(
                        classId: _classId!,
                        sectionId: _sectionId!,
                        subjectId: _subjectId!,
                        homeworkDate: _homeworkDate,
                        submissionDate: _submissionDate,
                        marks: _marks,
                        description: _descriptionController.text,
                      );
                      final id = widget.homework?.id;
                      if (id == null) {
                        await ref
                            .read(homeworkMutationProvider.notifier)
                            .create(draft);
                      } else {
                        await ref
                            .read(homeworkMutationProvider.notifier)
                            .saveUpdate(id, draft);
                      }
                      if (context.mounted) Navigator.of(context).pop();
                    },
            ),
          ],
        ),
      ),
    );
  }
}

class _DateTile extends StatelessWidget {
  const _DateTile({
    required this.label,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final DateTime value;
  final ValueChanged<DateTime> onChanged;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      title: Text(label),
      subtitle: Text(MaterialLocalizations.of(context).formatFullDate(value)),
      trailing: const Icon(Icons.calendar_month_outlined),
      onTap: () async {
        final picked = await showDatePicker(
          context: context,
          firstDate: DateTime.now().subtract(const Duration(days: 365)),
          lastDate: DateTime.now().add(const Duration(days: 365)),
          initialDate: value,
        );
        if (picked != null) onChanged(picked);
      },
    );
  }
}
