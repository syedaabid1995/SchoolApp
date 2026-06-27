import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../../../core/widgets/async_state_view.dart';
import '../../../classes/presentation/providers/class_assignment_providers.dart';
import '../../../exams/domain/entities/exam.dart';
import '../providers/marks_providers.dart';
import 'marks_entry_screen.dart';

class MarksHomeScreen extends ConsumerStatefulWidget {
  const MarksHomeScreen({super.key});

  @override
  ConsumerState<MarksHomeScreen> createState() => _MarksHomeScreenState();
}

class _MarksHomeScreenState extends ConsumerState<MarksHomeScreen> {
  String? _classId;
  String? _sectionId;
  var _search = '';

  @override
  Widget build(BuildContext context) {
    final classes = ref.watch(classAssignmentsProvider);
    final tasks = ref.watch(
      marksTasksProvider(
        MarksTaskFilter(classId: _classId, sectionId: _sectionId),
      ),
    );

    return AppScaffold(
      title: 'Marks',
      emoji: '📊',
      subtitle: 'Enter, update, and review student marks.',
      actions: [
        IconButton(
          tooltip: 'Refresh',
          onPressed: () => ref.invalidate(marksTasksProvider),
          icon: const Icon(Icons.refresh),
        ),
      ],
      onRefresh: () async => ref.invalidate(marksTasksProvider),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: AppSpacing.md),

          // ── Search bar ──────────────────────────────────────────────
          _SearchBar(
            onChanged: (value) =>
                setState(() => _search = value.trim().toLowerCase()),
          ),
          const SizedBox(height: AppSpacing.md),

          // ── Chip filters ────────────────────────────────────────────
          AsyncStateView(
            value: classes,
            shimmerItemCount: 1,
            data: (data) => _FilterSection(
              assignments: data,
              classId: _classId,
              sectionId: _sectionId,
              onClassChanged: (id) => setState(() {
                _classId = id;
                _sectionId = null;
              }),
              onSectionChanged: (id) => setState(() => _sectionId = id),
            ),
          ),
          const SizedBox(height: AppSpacing.lg),

          // ── Task list ───────────────────────────────────────────────
          AsyncStateView(
            value: tasks,
            data: (items) {
              final filtered = items
                  .where(
                    (p) =>
                        _search.isEmpty ||
                        (p.examName ?? '').toLowerCase().contains(_search) ||
                        (p.subjectName ?? '').toLowerCase().contains(_search),
                  )
                  .toList();
              return _TaskList(papers: filtered);
            },
          ),
        ],
      ),
    );
  }
}

class _SearchBar extends StatelessWidget {
  const _SearchBar({required this.onChanged});

  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: colorScheme.shadow.withValues(alpha: 0.06),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: TextField(
        onChanged: onChanged,
        decoration: InputDecoration(
          hintText: 'Search exam or subject…',
          prefixIcon:
              Icon(Icons.search, color: colorScheme.onSurface.withValues(alpha: 0.4)),
          border: InputBorder.none,
          enabledBorder: InputBorder.none,
          focusedBorder: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
        ),
      ),
    );
  }
}

class _FilterSection extends StatelessWidget {
  const _FilterSection({
    required this.assignments,
    required this.classId,
    required this.sectionId,
    required this.onClassChanged,
    required this.onSectionChanged,
  });

  final dynamic assignments;
  final String? classId;
  final String? sectionId;
  final ValueChanged<String?> onClassChanged;
  final ValueChanged<String?> onSectionChanged;

  @override
  Widget build(BuildContext context) {
    final sections = assignments.sectionsForClass(classId);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          height: 36,
          child: ListView(
            scrollDirection: Axis.horizontal,
            children: [
              _Chip(
                label: 'All Classes',
                selected: classId == null,
                onTap: () => onClassChanged(null),
              ),
              for (final cls in assignments.classes)
                _Chip(
                  label: cls.name,
                  selected: classId == cls.id,
                  onTap: () => onClassChanged(cls.id),
                ),
            ],
          ),
        ),
        if (classId != null && sections.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.xs),
          SizedBox(
            height: 36,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                _Chip(
                  label: 'All Sections',
                  selected: sectionId == null,
                  onTap: () => onSectionChanged(null),
                ),
                for (final sec in sections)
                  _Chip(
                    label: sec.name,
                    selected: sectionId == sec.id,
                    onTap: () => onSectionChanged(sec.id),
                  ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({
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

class _TaskList extends StatelessWidget {
  const _TaskList({required this.papers});

  final List<ExamPaper> papers;

  @override
  Widget build(BuildContext context) {
    if (papers.isEmpty) {
      return _EmptyState();
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '${papers.length} Task${papers.length == 1 ? '' : 's'}',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
        ),
        const SizedBox(height: AppSpacing.sm),
        for (final paper in papers) ...[
          _TaskCard(paper: paper),
          const SizedBox(height: AppSpacing.sm),
        ],
      ],
    );
  }
}

class _TaskCard extends StatelessWidget {
  const _TaskCard({required this.paper});

  final ExamPaper paper;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final progress = paper.maxMarks > 0
        ? (paper.marksCount / paper.maxMarks).clamp(0.0, 1.0).toDouble()
        : 0.0;
    final isComplete = paper.marksCount >= paper.maxMarks;

    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => MarksEntryScreen(paper: paper)),
      ),
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
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: isComplete
                        ? colorScheme.tertiaryContainer
                        : colorScheme.primaryContainer,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    Icons.grading_outlined,
                    size: 22,
                    color: isComplete
                        ? colorScheme.onTertiaryContainer
                        : colorScheme.onPrimaryContainer,
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        paper.subjectName ?? 'Subject',
                        style: textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      if (paper.examName != null)
                        Text(
                          paper.examName!,
                          style: textTheme.bodySmall?.copyWith(
                            color: colorScheme.onSurface.withValues(alpha: 0.55),
                          ),
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
                    color: isComplete
                        ? colorScheme.tertiaryContainer
                        : colorScheme.secondaryContainer,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    isComplete ? 'Done' : 'Pending',
                    style: textTheme.labelSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: isComplete
                          ? colorScheme.onTertiaryContainer
                          : colorScheme.onSecondaryContainer,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                if (paper.className != null)
                  _MetaPill(label: paper.className!),
                if (paper.sectionName != null) ...[
                  const SizedBox(width: AppSpacing.xxs),
                  _MetaPill(label: paper.sectionName!),
                ],
                if (paper.scheduledAt != null) ...[
                  const SizedBox(width: AppSpacing.xxs),
                  _MetaPill(
                    label: DateFormat.yMMMd().format(paper.scheduledAt!),
                    icon: Icons.event_outlined,
                  ),
                ],
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: progress,
                      minHeight: 6,
                      backgroundColor: colorScheme.surfaceContainerHighest,
                      valueColor: AlwaysStoppedAnimation<Color>(
                        isComplete
                            ? colorScheme.tertiary
                            : colorScheme.primary,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  '${paper.marksCount} / ${paper.maxMarks}',
                  style: textTheme.labelSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: colorScheme.onSurface.withValues(alpha: 0.6),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _MetaPill extends StatelessWidget {
  const _MetaPill({required this.label, this.icon});

  final String label;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.xs,
        vertical: 2,
      ),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 10, color: colorScheme.onSurface.withValues(alpha: 0.5)),
            const SizedBox(width: 3),
          ],
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: colorScheme.onSurface.withValues(alpha: 0.6),
                ),
          ),
        ],
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
            Icons.grading_outlined,
            size: 48,
            color: colorScheme.onSurface.withValues(alpha: 0.25),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'No mark-entry tasks found.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: colorScheme.onSurface.withValues(alpha: 0.45),
                ),
          ),
        ],
      ),
    );
  }
}
