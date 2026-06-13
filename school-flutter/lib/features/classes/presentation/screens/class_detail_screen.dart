import 'package:flutter/material.dart';

import '../../../../app/routes/app_routes.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../../academic/presentation/screens/class_academic_overview_screen.dart';
import '../../domain/entities/class_assignment.dart';

class ClassDetailScreen extends StatelessWidget {
  const ClassDetailScreen({
    required this.assignedClass,
    required this.assignments,
    super.key,
  });

  final AssignedClass assignedClass;
  final ClassAssignments assignments;

  @override
  Widget build(BuildContext context) {
    final sections = assignments.sectionsForClass(assignedClass.id);
    final subjects = assignments.subjectsForClass(assignedClass.id);

    return AppScaffold(
      title: assignedClass.name,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Sections',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: AppSpacing.sm),
                if (sections.isEmpty)
                  const Text('No sections assigned.')
                else
                  for (final section in sections)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(section.name),
                    ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Subjects',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: AppSpacing.sm),
                if (subjects.isEmpty)
                  const Text('No subjects assigned.')
                else
                  for (final subject in subjects)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(subject.name),
                    ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Linked workflows',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: AppSpacing.sm),
                const ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(Icons.calendar_month_outlined),
                  title: Text('Timetable'),
                  subtitle: Text(AppRoutes.timetable),
                ),
                const ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(Icons.fact_check_outlined),
                  title: Text('Attendance'),
                  subtitle: Text(AppRoutes.attendance),
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.insights_outlined),
                  title: const Text('Academic overview'),
                  subtitle: const Text('Subjects, homework, exams, marks'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => ClassAcademicOverviewScreen(
                        assignedClass: assignedClass,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
