import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/widgets/app_card.dart';
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
          AsyncStateView(
            value: classes,
            data: (data) => AppCard(
              child: Column(
                children: [
                  DropdownButtonFormField<String>(
                    initialValue: _classId,
                    decoration: const InputDecoration(labelText: 'Class'),
                    items: [
                      const DropdownMenuItem(value: null, child: Text('All')),
                      for (final cls in data.classes)
                        DropdownMenuItem(value: cls.id, child: Text(cls.name)),
                    ],
                    onChanged: (value) => setState(() {
                      _classId = value;
                      _sectionId = null;
                    }),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  DropdownButtonFormField<String>(
                    initialValue: _sectionId,
                    decoration: const InputDecoration(labelText: 'Section'),
                    items: [
                      const DropdownMenuItem(value: null, child: Text('All')),
                      for (final section in data.sectionsForClass(_classId))
                        DropdownMenuItem(
                          value: section.id,
                          child: Text(section.name),
                        ),
                    ],
                    onChanged: (value) => setState(() => _sectionId = value),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  TextField(
                    decoration: const InputDecoration(
                      labelText: 'Search exam or subject',
                      prefixIcon: Icon(Icons.search),
                    ),
                    onChanged: (value) =>
                        setState(() => _search = value.trim().toLowerCase()),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          AsyncStateView(
            value: tasks,
            data: (items) => _TaskList(
              papers: items
                  .where(
                    (paper) =>
                        _search.isEmpty ||
                        (paper.examName ?? '').toLowerCase().contains(
                          _search,
                        ) ||
                        (paper.subjectName ?? '').toLowerCase().contains(
                          _search,
                        ),
                  )
                  .toList(),
            ),
          ),
        ],
      ),
    );
  }
}

class _TaskList extends StatelessWidget {
  const _TaskList({required this.papers});

  final List<ExamPaper> papers;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Mark-entry tasks',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: AppSpacing.sm),
          if (papers.isEmpty)
            const Text('No mark-entry tasks found.')
          else
            for (final paper in papers)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.grading_outlined),
                title: Text(paper.subjectName ?? 'Subject'),
                subtitle: Text(
                  [
                    if (paper.examName != null) paper.examName!,
                    if (paper.scheduledAt != null)
                      DateFormat.yMMMd().format(paper.scheduledAt!),
                    if (paper.className != null) paper.className!,
                    if (paper.sectionName != null) paper.sectionName!,
                  ].join(' · '),
                ),
                trailing: Text('${paper.marksCount}/${paper.maxMarks}'),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => MarksEntryScreen(paper: paper),
                  ),
                ),
              ),
        ],
      ),
    );
  }
}
