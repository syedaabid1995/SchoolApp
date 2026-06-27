import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../domain/entities/leave_entities.dart';
import '../providers/leave_providers.dart';

class LeaveRequestScreen extends ConsumerStatefulWidget {
  const LeaveRequestScreen({required this.types, super.key});

  final List<LeaveType> types;

  @override
  ConsumerState<LeaveRequestScreen> createState() => _LeaveRequestScreenState();
}

class _LeaveRequestScreenState extends ConsumerState<LeaveRequestScreen> {
  final _reasonController = TextEditingController();
  String? _leaveTypeId;
  DateTime _fromDate = DateTime.now();
  DateTime _toDate = DateTime.now();

  int get _durationDays => _toDate.difference(_fromDate).inDays + 1;

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(leaveRequestControllerProvider);
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return AppScaffold(
      title: 'Request Leave',
      emoji: '📋',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: AppSpacing.md),

          // ── Leave type ──────────────────────────────────────────────
          _SectionLabel(label: 'Leave Type'),
          const SizedBox(height: AppSpacing.xs),
          _FormCard(
            child: DropdownButtonFormField<String>(
              initialValue: _leaveTypeId,
              decoration: InputDecoration(
                hintText: 'Select leave type',
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                prefixIcon: Icon(
                  Icons.category_outlined,
                  color: colorScheme.primary,
                ),
                contentPadding: const EdgeInsets.symmetric(
                  vertical: AppSpacing.sm,
                ),
              ),
              items: [
                for (final type in widget.types)
                  DropdownMenuItem(value: type.id, child: Text(type.name)),
              ],
              onChanged: (value) => setState(() => _leaveTypeId = value),
            ),
          ),

          const SizedBox(height: AppSpacing.md),

          // ── Date range ──────────────────────────────────────────────
          _SectionLabel(label: 'Date Range'),
          const SizedBox(height: AppSpacing.xs),
          Row(
            children: [
              Expanded(
                child: _DateCard(
                  label: 'From',
                  icon: Icons.flight_takeoff_outlined,
                  date: _fromDate,
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: context,
                      firstDate: DateTime.now().subtract(
                        const Duration(days: 1),
                      ),
                      lastDate: DateTime.now().add(const Duration(days: 365)),
                      initialDate: _fromDate,
                    );
                    if (picked != null) {
                      setState(() {
                        _fromDate = picked;
                        if (_toDate.isBefore(picked)) _toDate = picked;
                      });
                    }
                  },
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: _DateCard(
                  label: 'To',
                  icon: Icons.flight_land_outlined,
                  date: _toDate,
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: context,
                      firstDate: _fromDate,
                      lastDate: DateTime.now().add(const Duration(days: 365)),
                      initialDate: _toDate,
                    );
                    if (picked != null) setState(() => _toDate = picked);
                  },
                ),
              ),
            ],
          ),

          const SizedBox(height: AppSpacing.xs),

          // Duration pill
          Align(
            alignment: Alignment.centerRight,
            child: Container(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.sm,
                vertical: AppSpacing.xxs,
              ),
              decoration: BoxDecoration(
                color: colorScheme.primaryContainer,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.timelapse_outlined,
                    size: 14,
                    color: colorScheme.onPrimaryContainer,
                  ),
                  const SizedBox(width: AppSpacing.xxs),
                  Text(
                    '$_durationDays ${_durationDays == 1 ? 'day' : 'days'}',
                    style: textTheme.labelSmall?.copyWith(
                      color: colorScheme.onPrimaryContainer,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: AppSpacing.md),

          // ── Reason ──────────────────────────────────────────────────
          _SectionLabel(label: 'Reason'),
          const SizedBox(height: AppSpacing.xs),
          _FormCard(
            child: TextField(
              controller: _reasonController,
              minLines: 3,
              maxLines: 5,
              decoration: InputDecoration(
                hintText: 'Briefly describe the reason for your leave…',
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                prefixIcon: Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.xl),
                  child: Icon(Icons.notes_outlined, color: colorScheme.primary),
                ),
              ),
            ),
          ),

          // ── Error ────────────────────────────────────────────────────
          if (state.hasError) ...[
            const SizedBox(height: AppSpacing.sm),
            Container(
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: BoxDecoration(
                color: colorScheme.errorContainer,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Icon(Icons.error_outline,
                      size: 16, color: colorScheme.onErrorContainer),
                  const SizedBox(width: AppSpacing.xs),
                  Expanded(
                    child: Text(
                      state.error.toString(),
                      style: textTheme.bodySmall?.copyWith(
                        color: colorScheme.onErrorContainer,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: AppSpacing.lg),

          AppButton(
            label: 'Submit Request',
            icon: Icons.send_outlined,
            isLoading: state.isLoading,
            onPressed: _leaveTypeId == null
                ? null
                : () async {
                    await ref
                        .read(leaveRequestControllerProvider.notifier)
                        .submit(
                          leaveTypeId: _leaveTypeId!,
                          fromDate: _fromDate,
                          toDate: _toDate,
                          reason: _reasonController.text,
                        );
                    if (context.mounted) Navigator.of(context).pop();
                  },
          ),

          const SizedBox(height: AppSpacing.lg),
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Text(
      label,
      style: Theme.of(context).textTheme.labelLarge?.copyWith(
            color: colorScheme.onSurface.withValues(alpha: 0.6),
            fontWeight: FontWeight.w600,
            letterSpacing: 0.5,
          ),
    );
  }
}

class _FormCard extends StatelessWidget {
  const _FormCard({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
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
      child: child,
    );
  }
}

class _DateCard extends StatelessWidget {
  const _DateCard({
    required this.label,
    required this.icon,
    required this.date,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final DateTime date;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: colorScheme.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: colorScheme.primary.withValues(alpha: 0.2),
          ),
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
                Icon(icon, size: 16, color: colorScheme.primary),
                const SizedBox(width: AppSpacing.xxs),
                Text(
                  label,
                  style: textTheme.labelSmall?.copyWith(
                    color: colorScheme.primary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              DateFormat.MMMd().format(date),
              style: textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            Text(
              DateFormat.y().format(date),
              style: textTheme.bodySmall?.copyWith(
                color: colorScheme.onSurface.withValues(alpha: 0.5),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
