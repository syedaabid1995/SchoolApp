import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/permissions/permission_registry.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../../auth/presentation/providers/current_permission_provider.dart';
import '../../../classes/domain/entities/class_assignment.dart';
import '../../domain/entities/homework.dart';
import '../providers/homework_providers.dart';
import 'homework_create_screen.dart';

class HomeworkDetailScreen extends ConsumerWidget {
  const HomeworkDetailScreen({
    required this.homework,
    required this.assignments,
    super.key,
  });

  final Homework homework;
  final ClassAssignments assignments;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final checker = ref.watch(currentPermissionCheckerProvider);
    final canEdit = checker.canPerformAction(PermissionActionIds.editHomework);
    final canDelete = checker.canPerformAction(
      PermissionActionIds.deleteHomework,
    );
    final state = ref.watch(homeworkMutationProvider);

    return AppScaffold(
      title: 'Homework detail',
      child: AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              homework.subjectName ?? 'Homework',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              '${homework.className ?? 'Class'} ${homework.sectionName ?? ''}',
            ),
            Text(
              'Assigned: ${DateFormat.yMMMd().format(homework.homeworkDate)}',
            ),
            Text('Due: ${DateFormat.yMMMd().format(homework.submissionDate)}'),
            Text('Marks: ${homework.marks}'),
            const SizedBox(height: AppSpacing.md),
            Text(homework.description),
            const SizedBox(height: AppSpacing.lg),
            Wrap(
              spacing: AppSpacing.sm,
              children: [
                if (canEdit)
                  OutlinedButton.icon(
                    icon: const Icon(Icons.edit_outlined),
                    label: const Text('Edit'),
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => HomeworkCreateScreen(
                          assignments: assignments,
                          homework: homework,
                        ),
                      ),
                    ),
                  ),
                if (canDelete)
                  AppButton(
                    label: 'Delete',
                    icon: Icons.delete_outline,
                    isLoading: state.isLoading,
                    onPressed: () async {
                      await ref
                          .read(homeworkMutationProvider.notifier)
                          .delete(homework.id);
                      if (context.mounted) Navigator.of(context).pop();
                    },
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
