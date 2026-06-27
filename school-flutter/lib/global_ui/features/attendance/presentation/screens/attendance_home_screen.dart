import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/permissions/permission_registry.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../../../core/widgets/async_state_view.dart';
import '../../../auth/presentation/providers/current_permission_provider.dart';
import '../../domain/entities/attendance_summary.dart';
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
            const _SelfAttendanceCard(),
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

class _SelfAttendanceCard extends ConsumerStatefulWidget {
  const _SelfAttendanceCard();

  @override
  ConsumerState<_SelfAttendanceCard> createState() =>
      _SelfAttendanceCardState();
}

class _SelfAttendanceCardState extends ConsumerState<_SelfAttendanceCard> {
  String? _selectedUnitKey;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final options = ref.watch(selfAttendanceOptionsProvider(today));
    final markState = ref.watch(markSelfAttendanceProvider);
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(8),
        boxShadow: [
          BoxShadow(
            color: colorScheme.shadow.withValues(alpha: 0.07),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            color: colorScheme.secondaryContainer,
            child: Row(
              children: [
                Icon(Icons.how_to_reg_outlined, color: colorScheme.secondary),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  'Self attendance',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: colorScheme.onSecondaryContainer,
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: options.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, _) => _ErrorMessage(message: error.toString()),
              data: (value) {
                final selectedUnit =
                    value.units
                        .where((unit) => unit.identityPart == _selectedUnitKey)
                        .firstOrNull ??
                    value.units.firstOrNull;
                final needsSelector =
                    value.configuration.mode != AttendanceMode.daily;

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Wrap(
                      spacing: AppSpacing.sm,
                      runSpacing: AppSpacing.xs,
                      children: [
                        Chip(label: Text(value.configuration.mode.value)),
                        Chip(label: Text(value.configuration.source)),
                      ],
                    ),
                    if (needsSelector) ...[
                      const SizedBox(height: AppSpacing.sm),
                      DropdownButtonFormField<String>(
                        initialValue: selectedUnit?.identityPart,
                        decoration: InputDecoration(
                          labelText:
                              value.configuration.mode ==
                                  AttendanceMode.twiceDaily
                              ? 'Session'
                              : 'Period',
                          border: const OutlineInputBorder(),
                        ),
                        items: [
                          for (final unit in value.units)
                            DropdownMenuItem(
                              value: unit.identityPart,
                              child: Text(_unitLabel(unit)),
                            ),
                        ],
                        onChanged: markState.isLoading
                            ? null
                            : (unitKey) =>
                                  setState(() => _selectedUnitKey = unitKey),
                      ),
                    ],
                    const SizedBox(height: AppSpacing.md),
                    Row(
                      children: [
                        Expanded(
                          child: AppButton(
                            label: 'Present',
                            icon: Icons.check_circle_outline,
                            isLoading: markState.isLoading,
                            onPressed: selectedUnit == null
                                ? null
                                : () => _mark('PRESENT', selectedUnit, today),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed:
                                markState.isLoading || selectedUnit == null
                                ? null
                                : () => _mark('LEAVE', selectedUnit, today),
                            icon: Icon(
                              Icons.event_busy_outlined,
                              color: colorScheme.error,
                            ),
                            label: const Text('Leave'),
                          ),
                        ),
                      ],
                    ),
                    if (markState.hasError) ...[
                      const SizedBox(height: AppSpacing.sm),
                      _ErrorMessage(message: markState.error.toString()),
                    ],
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  String _unitLabel(AttendanceUnit unit) {
    final time = [
      unit.startTime,
      unit.endTime,
    ].whereType<String>().where((value) => value.isNotEmpty).join(' - ');
    return time.isEmpty ? unit.label : '${unit.label} ($time)';
  }

  Future<void> _mark(String status, AttendanceUnit unit, DateTime date) async {
    await ref
        .read(markSelfAttendanceProvider.notifier)
        .mark(status, unit: unit, date: date);
  }
}

class _ErrorMessage extends StatelessWidget {
  const _ErrorMessage({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.sm),
      color: colorScheme.errorContainer,
      child: Row(
        children: [
          Icon(Icons.error_outline, color: colorScheme.error, size: 16),
          const SizedBox(width: AppSpacing.xs),
          Expanded(
            child: Text(
              message,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: colorScheme.onErrorContainer,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
