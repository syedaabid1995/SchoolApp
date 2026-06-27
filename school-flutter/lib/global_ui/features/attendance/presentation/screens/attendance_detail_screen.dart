import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../domain/entities/attendance_summary.dart';

class AttendanceDetailScreen extends StatelessWidget {
  const AttendanceDetailScreen({required this.sessions, super.key});

  final List<AttendanceSessionSummary> sessions;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return Container(
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: colorScheme.shadow.withOpacity(0.07),
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
              color: colorScheme.tertiaryContainer,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
            ),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: colorScheme.tertiary,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(Icons.list_alt_outlined, color: colorScheme.onTertiary, size: 20),
                ),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  'Session details',
                  style: textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: colorScheme.onTertiaryContainer,
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: sessions.isEmpty
                ? Row(
                    children: [
                      Icon(Icons.inbox_outlined, size: 18, color: colorScheme.onSurface.withOpacity(0.40)),
                      const SizedBox(width: AppSpacing.xs),
                      Text(
                        'No student attendance sessions found.',
                        style: textTheme.bodyMedium?.copyWith(
                          color: colorScheme.onSurface.withOpacity(0.50),
                        ),
                      ),
                    ],
                  )
                : Column(
                    children: [
                      for (int i = 0; i < sessions.take(10).length; i++) ...[
                        _SessionRow(session: sessions[i]),
                        if (i < sessions.take(10).length - 1)
                          Divider(height: 1, color: colorScheme.outlineVariant.withOpacity(0.35)),
                      ],
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

class _SessionRow extends StatelessWidget {
  const _SessionRow({required this.session});
  final AttendanceSessionSummary session;

  Color _statusBg(String status) => switch (status.toUpperCase()) {
    'COMPLETED' => const Color(0xFFE8F5E9),
    'PENDING'   => const Color(0xFFFFF8E1),
    _           => const Color(0xFFF5F5F5),
  };

  Color _statusFg(String status) => switch (status.toUpperCase()) {
    'COMPLETED' => const Color(0xFF2E7D32),
    'PENDING'   => const Color(0xFFF57F17),
    _           => const Color(0xFF757575),
  };

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final className =
        '${session.className ?? 'Class'}${session.sectionName == null ? '' : ' · ${session.sectionName}'}';

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: colorScheme.primaryContainer,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              Icons.groups_outlined,
              size: 20,
              color: colorScheme.onPrimaryContainer,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  className,
                  style: textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 2),
                Text(
                  '${DateFormat.yMMMd().format(session.date)} · ${session.recordCount} records',
                  style: textTheme.bodySmall?.copyWith(
                    color: colorScheme.onSurface.withOpacity(0.55),
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 4),
            decoration: BoxDecoration(
              color: _statusBg(session.status),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              session.status,
              style: textTheme.labelSmall?.copyWith(
                color: _statusFg(session.status),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
