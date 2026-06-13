import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/permissions/permission_registry.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../../../core/widgets/async_state_view.dart';
import '../../../auth/presentation/providers/current_permission_provider.dart';
import '../../../classes/presentation/providers/class_assignment_providers.dart';
import '../providers/homework_providers.dart';
import 'homework_create_screen.dart';
import 'homework_detail_screen.dart';

class HomeworkListScreen extends ConsumerStatefulWidget {
  const HomeworkListScreen({super.key});

  @override
  ConsumerState<HomeworkListScreen> createState() => _HomeworkListScreenState();
}

class _HomeworkListScreenState extends ConsumerState<HomeworkListScreen> {
  HomeworkFilter _filter = const HomeworkFilter();

  @override
  Widget build(BuildContext context) {
    final assignments = ref.watch(classAssignmentsProvider);
    final homeworks = ref.watch(homeworkListProvider(_filter));
    final checker = ref.watch(currentPermissionCheckerProvider);
    final canCreate = checker.canPerformAction(
      PermissionActionIds.createHomework,
    );

    return AppScaffold(
      title: 'Homework',
      onRefresh: () async {
        ref.invalidate(classAssignmentsProvider);
        ref.invalidate(homeworkListProvider(_filter));
      },
      actions: [
        IconButton(
          tooltip: 'Refresh',
          icon: const Icon(Icons.refresh),
          onPressed: () {
            ref.invalidate(classAssignmentsProvider);
            ref.invalidate(homeworkListProvider(_filter));
          },
        ),
      ],
      child: AsyncStateView(
        value: assignments,
        data: (assignmentData) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (canCreate)
              AppButton(
                label: 'Create homework',
                icon: Icons.add,
                onPressed: () async {
                  await Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) =>
                          HomeworkCreateScreen(assignments: assignmentData),
                    ),
                  );
                  ref.invalidate(homeworkListProvider(_filter));
                },
              ),
            if (canCreate) const SizedBox(height: AppSpacing.md),
            _HomeworkFilters(
              assignments: assignmentData,
              filter: _filter,
              onChanged: (filter) => setState(() => _filter = filter),
            ),
            const SizedBox(height: AppSpacing.md),
            AsyncStateView(
              value: homeworks,
              data: (items) => AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Assigned homework',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    if (items.isEmpty)
                      const Text('No homework found.')
                    else
                      for (final item in items)
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(item.subjectName ?? 'Homework'),
                          subtitle: Text(
                            '${item.className ?? 'Class'} ${item.sectionName ?? ''} · Due ${DateFormat.yMMMd().format(item.submissionDate)}',
                          ),
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () async {
                            await Navigator.of(context).push(
                              MaterialPageRoute<void>(
                                builder: (_) => HomeworkDetailScreen(
                                  homework: item,
                                  assignments: assignmentData,
                                ),
                              ),
                            );
                            ref.invalidate(homeworkListProvider(_filter));
                          },
                        ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HomeworkFilters extends StatelessWidget {
  const _HomeworkFilters({
    required this.assignments,
    required this.filter,
    required this.onChanged,
  });

  final dynamic assignments;
  final HomeworkFilter filter;
  final ValueChanged<HomeworkFilter> onChanged;

  @override
  Widget build(BuildContext context) {
    final sections = assignments.sectionsForClass(filter.classId);
    return AppCard(
      child: Column(
        children: [
          DropdownButtonFormField<String>(
            initialValue: filter.classId,
            decoration: const InputDecoration(labelText: 'Class filter'),
            items: [
              const DropdownMenuItem(value: '', child: Text('All classes')),
              for (final item in assignments.classes)
                DropdownMenuItem(value: item.id, child: Text(item.name)),
            ],
            onChanged: (value) {
              onChanged(
                HomeworkFilter(classId: value?.isEmpty == true ? null : value),
              );
            },
          ),
          const SizedBox(height: AppSpacing.md),
          DropdownButtonFormField<String>(
            initialValue: filter.sectionId,
            decoration: const InputDecoration(labelText: 'Section filter'),
            items: [
              const DropdownMenuItem(value: '', child: Text('All sections')),
              for (final item in sections)
                DropdownMenuItem(value: item.id, child: Text(item.name)),
            ],
            onChanged: (value) {
              onChanged(
                HomeworkFilter(
                  classId: filter.classId,
                  sectionId: value?.isEmpty == true ? null : value,
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}
