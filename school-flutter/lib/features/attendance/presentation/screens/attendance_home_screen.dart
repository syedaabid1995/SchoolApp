import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/permissions/permission_registry.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../../../core/widgets/async_state_view.dart';
import '../../../auth/presentation/providers/current_permission_provider.dart';
import '../providers/attendance_providers.dart';
import 'attendance_detail_screen.dart';
import 'attendance_history_screen.dart';
import 'attendance_summary_screen.dart';
import 'teacher_attendance_calendar_screen.dart';

class TeacherAttendanceHomeScreen extends AttendanceHomeScreen {
  const TeacherAttendanceHomeScreen({super.key});
}

class AttendanceHomeScreen extends ConsumerWidget {
  const AttendanceHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summary = ref.watch(attendanceSummaryProvider);
    final markState = ref.watch(markSelfAttendanceProvider);
    final canMarkAttendance = ref
        .watch(currentPermissionCheckerProvider)
        .canPerformAction(PermissionActionIds.markAttendance);

    return AppScaffold(
      title: 'Attendance',
      emoji: '📊',
      breadcrumb: '👩🏫 Teacher Dashboard',
      subtitle: 'Teacher self attendance and student session status.',
      onRefresh: () async {
        ref.invalidate(attendanceSummaryProvider);
        ref.invalidate(teacherAttendanceHistoryProvider);
      },
      actions: [
        IconButton(
          tooltip: 'Refresh',
          onPressed: () {
            ref.invalidate(attendanceSummaryProvider);
            ref.invalidate(teacherAttendanceHistoryProvider);
          },
          icon: const Icon(Icons.refresh),
        ),
      ],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AsyncStateView(
            value: summary,
            data: (value) => AttendanceSummaryScreen(summary: value),
          ),
          const SizedBox(height: AppSpacing.md),
          if (canMarkAttendance) ...[
            Container(
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: Theme.of(context).colorScheme.shadow.withOpacity(0.07),
                    blurRadius: 16,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.secondaryContainer,
                      borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: Theme.of(context).colorScheme.secondary,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Icon(
                            Icons.how_to_reg_outlined,
                            color: Theme.of(context).colorScheme.onSecondary,
                            size: 20,
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Text(
                          'Self attendance',
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                            color: Theme.of(context).colorScheme.onSecondaryContainer,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: AppButton(
                                label: 'Present',
                                icon: Icons.check_circle_outline,
                                isLoading: markState.isLoading,
                                onPressed: () => ref
                                    .read(markSelfAttendanceProvider.notifier)
                                    .mark('PRESENT'),
                              ),
                            ),
                            const SizedBox(width: AppSpacing.sm),
                            Expanded(
                              child: OutlinedButton.icon(
                                onPressed: markState.isLoading
                                    ? null
                                    : () => ref
                                          .read(markSelfAttendanceProvider.notifier)
                                          .mark('LEAVE'),
                                icon: Icon(
                                  Icons.event_busy_outlined,
                                  color: Theme.of(context).colorScheme.error,
                                ),
                                label: const Text('Leave'),
                              ),
                            ),
                          ],
                        ),
                        if (markState.hasError) ...[
                          const SizedBox(height: AppSpacing.sm),
                          Container(
                            padding: const EdgeInsets.all(AppSpacing.sm),
                            decoration: BoxDecoration(
                              color: Theme.of(context).colorScheme.errorContainer,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Row(
                              children: [
                                Icon(Icons.error_outline, color: Theme.of(context).colorScheme.error, size: 16),
                                const SizedBox(width: AppSpacing.xs),
                                Expanded(
                                  child: Text(
                                    markState.error.toString(),
                                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                      color: Theme.of(context).colorScheme.onErrorContainer,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),
          ],
          const AttendanceHistoryScreen(),
          const SizedBox(height: AppSpacing.md),
          AsyncStateView(
            value: ref.watch(teacherAttendanceHistoryProvider),
            data: (records) =>
                TeacherAttendanceCalendarScreen(records: records),
          ),
          const SizedBox(height: AppSpacing.md),
          AsyncStateView(
            value: summary,
            data: (value) => AttendanceDetailScreen(sessions: value.sessions),
          ),
        ],
      ),
    );
  }
}
