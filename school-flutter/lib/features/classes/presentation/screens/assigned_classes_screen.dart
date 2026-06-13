import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../../../core/widgets/async_state_view.dart';
import '../providers/class_assignment_providers.dart';
import 'class_detail_screen.dart';

class AssignedClassesScreen extends ConsumerWidget {
  const AssignedClassesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final assignments = ref.watch(classAssignmentsProvider);
    return AppScaffold(
      title: 'Assigned classes',
      onRefresh: () async => ref.invalidate(classAssignmentsProvider),
      actions: [
        IconButton(
          tooltip: 'Refresh',
          icon: const Icon(Icons.refresh),
          onPressed: () => ref.invalidate(classAssignmentsProvider),
        ),
      ],
      child: AsyncStateView(
        value: assignments,
        data: (value) => AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Classes', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: AppSpacing.sm),
              if (value.classes.isEmpty)
                const Text('No classes assigned.')
              else
                for (final item in value.classes)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(item.name),
                    subtitle: Text(
                      '${value.sectionsForClass(item.id).length} section(s) · ${value.subjectsForClass(item.id).length} subject(s)',
                    ),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => ClassDetailScreen(
                          assignedClass: item,
                          assignments: value,
                        ),
                      ),
                    ),
                  ),
            ],
          ),
        ),
      ),
    );
  }
}
