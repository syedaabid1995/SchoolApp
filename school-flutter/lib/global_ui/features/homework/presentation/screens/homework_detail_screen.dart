import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/permissions/permission_registry.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../../auth/presentation/providers/current_permission_provider.dart';
import '../../../classes/domain/entities/class_assignment.dart';
import '../../domain/entities/homework.dart';
import '../providers/homework_providers.dart';
import 'homework_create_screen.dart';
import 'homework_evaluation_screen.dart';

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
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    final now = DateTime.now();
    final isOverdue = homework.submissionDate.isBefore(
      DateTime(now.year, now.month, now.day),
    );

    return AppScaffold(
      title: 'Homework Detail',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: AppSpacing.md),

          // ── Header card ─────────────────────────────────────────────
          Container(
            padding: const EdgeInsets.all(AppSpacing.lg),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  colorScheme.primaryContainer,
                  colorScheme.secondaryContainer.withValues(alpha: 0.6),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: colorScheme.primary.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(
                    Icons.assignment_outlined,
                    size: 26,
                    color: colorScheme.primary,
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        homework.subjectName ?? 'Homework',
                        style: textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xxs),
                      Text(
                        '${homework.className ?? ''} ${homework.sectionName ?? ''}'
                            .trim(),
                        style: textTheme.bodyMedium?.copyWith(
                          color: colorScheme.onSurface.withValues(alpha: 0.65),
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.sm,
                    vertical: AppSpacing.xxs,
                  ),
                  decoration: BoxDecoration(
                    color: isOverdue
                        ? colorScheme.errorContainer
                        : colorScheme.tertiaryContainer,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    isOverdue ? 'Overdue' : 'Active',
                    style: textTheme.labelSmall?.copyWith(
                      color: isOverdue
                          ? colorScheme.onErrorContainer
                          : colorScheme.onTertiaryContainer,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: AppSpacing.md),

          // ── Meta info grid ──────────────────────────────────────────
          _SectionCard(
            children: [
              _MetaGrid(
                items: [
                  _MetaItem(
                    icon: Icons.calendar_today_outlined,
                    label: 'Assigned',
                    value: DateFormat.yMMMd().format(homework.homeworkDate),
                  ),
                  _MetaItem(
                    icon: Icons.upload_outlined,
                    label: 'Due Date',
                    value: DateFormat.yMMMd().format(homework.submissionDate),
                  ),
                  _MetaItem(
                    icon: Icons.grade_outlined,
                    label: 'Marks',
                    value: '${homework.marks}',
                  ),
                  _MetaItem(
                    icon: Icons.rate_review_outlined,
                    label: 'Evaluations',
                    value: '${homework.evaluationCount}',
                  ),
                ],
              ),
            ],
          ),

          const SizedBox(height: AppSpacing.md),

          // ── Description ─────────────────────────────────────────────
          _SectionCard(
            children: [
              Row(
                children: [
                  Icon(
                    Icons.notes_outlined,
                    size: 18,
                    color: colorScheme.primary,
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  Text(
                    'Description',
                    style: textTheme.labelMedium?.copyWith(
                      color: colorScheme.primary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                homework.description,
                style: textTheme.bodyMedium?.copyWith(
                  color: colorScheme.onSurface.withValues(alpha: 0.8),
                  height: 1.6,
                ),
              ),
            ],
          ),

          if (homework.attachmentUrl != null &&
              homework.attachmentUrl!.trim().isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            _SectionCard(
              children: [
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(
                    Icons.attach_file_outlined,
                    color: colorScheme.primary,
                  ),
                  title: Text(homework.attachmentName ?? 'Attachment'),
                  trailing: const Icon(Icons.open_in_new),
                  onTap: () => launchUrl(
                    Uri.parse(homework.attachmentUrl!),
                    mode: LaunchMode.externalApplication,
                  ),
                ),
              ],
            ),
          ],

          // ── Actions ──────────────────────────────────────────────────
          if (canEdit || canDelete) ...[
            const SizedBox(height: AppSpacing.lg),
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (canEdit) ...[
                  AppButton(
                    label: 'Evaluate',
                    icon: Icons.fact_check_outlined,
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) =>
                            HomeworkEvaluationScreen(homework: homework),
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                ],
                Row(
                  children: [
                    if (canEdit)
                      Expanded(
                        child: OutlinedButton.icon(
                          icon: const Icon(Icons.edit_outlined),
                          label: const Text('Edit'),
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(
                              vertical: AppSpacing.sm,
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          onPressed: () => Navigator.of(context).push(
                            MaterialPageRoute<void>(
                              builder: (_) => HomeworkCreateScreen(
                                assignments: assignments,
                                homework: homework,
                              ),
                            ),
                          ),
                        ),
                      ),
                    if (canEdit && canDelete)
                      const SizedBox(width: AppSpacing.sm),
                    if (canDelete)
                      Expanded(
                        child: AppButton(
                          label: 'Delete',
                          icon: Icons.delete_outline,
                          isLoading: state.isLoading,
                          onPressed: () async {
                            final confirmed = await showDialog<bool>(
                              context: context,
                              builder: (ctx) => AlertDialog(
                                title: const Text('Delete Homework'),
                                content: const Text(
                                  'Are you sure you want to delete this homework?',
                                ),
                                actions: [
                                  TextButton(
                                    onPressed: () => Navigator.pop(ctx, false),
                                    child: const Text('Cancel'),
                                  ),
                                  TextButton(
                                    onPressed: () => Navigator.pop(ctx, true),
                                    child: const Text('Delete'),
                                  ),
                                ],
                              ),
                            );
                            if (confirmed == true) {
                              await ref
                                  .read(homeworkMutationProvider.notifier)
                                  .delete(homework.id);
                              if (context.mounted) Navigator.of(context).pop();
                            }
                          },
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ],

          const SizedBox(height: AppSpacing.lg),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
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
        children: children,
      ),
    );
  }
}

class _MetaGrid extends StatelessWidget {
  const _MetaGrid({required this.items});

  final List<_MetaItem> items;

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: AppSpacing.sm,
      mainAxisSpacing: AppSpacing.sm,
      childAspectRatio: 2.8,
      children: items.map((item) => _MetaCell(item: item)).toList(),
    );
  }
}

class _MetaItem {
  const _MetaItem({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;
}

class _MetaCell extends StatelessWidget {
  const _MetaCell({required this.item});

  final _MetaItem item;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Icon(item.icon, size: 16, color: colorScheme.primary),
          const SizedBox(width: AppSpacing.xxs),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  item.label,
                  style: textTheme.labelSmall?.copyWith(
                    color: colorScheme.onSurface.withValues(alpha: 0.5),
                  ),
                ),
                Text(
                  item.value,
                  style: textTheme.labelMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
