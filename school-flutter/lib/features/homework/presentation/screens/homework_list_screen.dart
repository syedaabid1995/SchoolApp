import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/permissions/permission_registry.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../../../core/widgets/async_state_view.dart';
import '../../../auth/presentation/providers/current_permission_provider.dart';
import '../../../classes/domain/entities/class_assignment.dart';
import '../../../classes/presentation/providers/class_assignment_providers.dart';
import '../../domain/entities/homework.dart';
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
      emoji: '📚',
      subtitle: 'Manage and review assigned homework.',
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
        data: (assignmentData) => _HomeworkContent(
          assignmentData: assignmentData,
          homeworks: homeworks,
          filter: _filter,
          canCreate: canCreate,
          onFilterChanged: (f) => setState(() => _filter = f),
          onRefresh: () => ref.invalidate(homeworkListProvider(_filter)),
        ),
      ),
    );
  }
}

class _HomeworkContent extends StatelessWidget {
  const _HomeworkContent({
    required this.assignmentData,
    required this.homeworks,
    required this.filter,
    required this.canCreate,
    required this.onFilterChanged,
    required this.onRefresh,
  });

  final ClassAssignments assignmentData;
  final AsyncValue<List<Homework>> homeworks;
  final HomeworkFilter filter;
  final bool canCreate;
  final ValueChanged<HomeworkFilter> onFilterChanged;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: AppSpacing.md),
            _FilterRow(
              assignments: assignmentData,
              filter: filter,
              onChanged: onFilterChanged,
            ),
            const SizedBox(height: AppSpacing.lg),
            AsyncStateView(
              value: homeworks,
              data: (items) => _HomeworkList(
                items: items,
                assignmentData: assignmentData,
                onRefresh: onRefresh,
              ),
            ),
            if (canCreate) const SizedBox(height: 80),
          ],
        ),
        if (canCreate)
          Positioned(
            bottom: AppSpacing.lg,
            right: 0,
            child: FloatingActionButton.extended(
              onPressed: () async {
                await Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) =>
                        HomeworkCreateScreen(assignments: assignmentData),
                  ),
                );
                onRefresh();
              },
              icon: const Icon(Icons.add),
              label: const Text('Create Homework'),
            ),
          ),
      ],
    );
  }
}

class _FilterRow extends StatelessWidget {
  const _FilterRow({
    required this.assignments,
    required this.filter,
    required this.onChanged,
  });

  final ClassAssignments assignments;
  final HomeworkFilter filter;
  final ValueChanged<HomeworkFilter> onChanged;

  @override
  Widget build(BuildContext context) {
    final sections = assignments.sectionsForClass(filter.classId);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Class chips
        SizedBox(
          height: 36,
          child: ListView(
            scrollDirection: Axis.horizontal,
            children: [
              _FilterChip(
                label: 'All Classes',
                selected: filter.classId == null,
                onTap: () => onChanged(const HomeworkFilter()),
              ),
              for (final cls in assignments.classes)
                _FilterChip(
                  label: cls.name,
                  selected: filter.classId == cls.id,
                  onTap: () => onChanged(HomeworkFilter(classId: cls.id)),
                ),
            ],
          ),
        ),
        if (filter.classId != null && sections.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.xs),
          SizedBox(
            height: 36,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                _FilterChip(
                  label: 'All Sections',
                  selected: filter.sectionId == null,
                  onTap: () => onChanged(HomeworkFilter(classId: filter.classId)),
                ),
                for (final sec in sections)
                  _FilterChip(
                    label: sec.name,
                    selected: filter.sectionId == sec.id,
                    onTap: () => onChanged(
                      HomeworkFilter(
                        classId: filter.classId,
                        sectionId: sec.id,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(right: AppSpacing.xs),
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.sm,
            vertical: AppSpacing.xxs,
          ),
          decoration: BoxDecoration(
            color: selected
                ? colorScheme.primary
                : colorScheme.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Text(
            label,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: selected
                      ? colorScheme.onPrimary
                      : colorScheme.onSurface.withValues(alpha: 0.7),
                  fontWeight:
                      selected ? FontWeight.w700 : FontWeight.w500,
                ),
          ),
        ),
      ),
    );
  }
}

class _HomeworkList extends StatelessWidget {
  const _HomeworkList({
    required this.items,
    required this.assignmentData,
    required this.onRefresh,
  });

  final List<Homework> items;
  final ClassAssignments assignmentData;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return _EmptyState();
    }
    return Column(
      children: [
        for (final item in items) ...[
          _HomeworkCard(
            homework: item,
            assignmentData: assignmentData,
            onRefresh: onRefresh,
          ),
          const SizedBox(height: AppSpacing.sm),
        ],
      ],
    );
  }
}

class _HomeworkCard extends StatelessWidget {
  const _HomeworkCard({
    required this.homework,
    required this.assignmentData,
    required this.onRefresh,
  });

  final Homework homework;
  final ClassAssignments assignmentData;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final now = DateTime.now();
    final isOverdue = homework.submissionDate.isBefore(
      DateTime(now.year, now.month, now.day),
    );
    final isDueSoon = !isOverdue &&
        homework.submissionDate.difference(now).inDays <= 2;

    final dueBadgeColor = isOverdue
        ? colorScheme.errorContainer
        : isDueSoon
            ? colorScheme.tertiaryContainer
            : colorScheme.secondaryContainer;
    final dueBadgeTextColor = isOverdue
        ? colorScheme.onErrorContainer
        : isDueSoon
            ? colorScheme.onTertiaryContainer
            : colorScheme.onSecondaryContainer;

    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: () async {
        await Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => HomeworkDetailScreen(
              homework: homework,
              assignments: assignmentData,
            ),
          ),
        );
        onRefresh();
      },
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: colorScheme.surface,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: colorScheme.shadow.withValues(alpha: 0.06),
              blurRadius: 10,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: colorScheme.primaryContainer,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                Icons.assignment_outlined,
                size: 22,
                color: colorScheme.onPrimaryContainer,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    homework.subjectName ?? 'Homework',
                    style: textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xxs),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.xs,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: colorScheme.surfaceContainerHighest,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          '${homework.className ?? ''} ${homework.sectionName ?? ''}'.trim(),
                          style: textTheme.labelSmall?.copyWith(
                            color: colorScheme.onSurface.withValues(alpha: 0.65),
                          ),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.xs,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: colorScheme.surfaceContainerHighest,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          '${homework.marks} marks',
                          style: textTheme.labelSmall?.copyWith(
                            color: colorScheme.onSurface.withValues(alpha: 0.65),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Row(
                    children: [
                      Icon(
                        Icons.upload_outlined,
                        size: 12,
                        color: dueBadgeTextColor,
                      ),
                      const SizedBox(width: 3),
                      Text(
                        'Due ${DateFormat.yMMMd().format(homework.submissionDate)}',
                        style: textTheme.labelSmall?.copyWith(
                          color: dueBadgeTextColor,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.xs,
                vertical: AppSpacing.xxs,
              ),
              decoration: BoxDecoration(
                color: dueBadgeColor,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                isOverdue ? 'Overdue' : isDueSoon ? 'Due Soon' : 'Active',
                style: textTheme.labelSmall?.copyWith(
                  color: dueBadgeTextColor,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xxl),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          Icon(
            Icons.assignment_outlined,
            size: 48,
            color: colorScheme.onSurface.withValues(alpha: 0.25),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'No homework found.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: colorScheme.onSurface.withValues(alpha: 0.45),
                ),
          ),
        ],
      ),
    );
  }
}
