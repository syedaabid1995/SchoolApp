import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_card.dart';
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

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(leaveRequestControllerProvider);
    return AppScaffold(
      title: 'Request leave',
      child: AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            DropdownButtonFormField<String>(
              initialValue: _leaveTypeId,
              decoration: const InputDecoration(labelText: 'Leave type'),
              items: [
                for (final type in widget.types)
                  DropdownMenuItem(value: type.id, child: Text(type.name)),
              ],
              onChanged: (value) => setState(() => _leaveTypeId = value),
            ),
            const SizedBox(height: AppSpacing.md),
            _DateTile(
              label: 'From',
              value: _fromDate,
              onChanged: (value) => setState(() {
                _fromDate = value;
                if (_toDate.isBefore(value)) _toDate = value;
              }),
            ),
            _DateTile(
              label: 'To',
              value: _toDate,
              onChanged: (value) => setState(() => _toDate = value),
            ),
            const SizedBox(height: AppSpacing.md),
            TextField(
              controller: _reasonController,
              minLines: 3,
              maxLines: 5,
              decoration: const InputDecoration(labelText: 'Reason'),
            ),
            if (state.hasError) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                state.error.toString(),
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ],
            const SizedBox(height: AppSpacing.lg),
            AppButton(
              label: 'Submit request',
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
          ],
        ),
      ),
    );
  }
}

class _DateTile extends StatelessWidget {
  const _DateTile({
    required this.label,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final DateTime value;
  final ValueChanged<DateTime> onChanged;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      title: Text(label),
      subtitle: Text(MaterialLocalizations.of(context).formatFullDate(value)),
      trailing: const Icon(Icons.calendar_month_outlined),
      onTap: () async {
        final picked = await showDatePicker(
          context: context,
          firstDate: DateTime.now().subtract(const Duration(days: 1)),
          lastDate: DateTime.now().add(const Duration(days: 365)),
          initialDate: value,
        );
        if (picked != null) onChanged(picked);
      },
    );
  }
}
