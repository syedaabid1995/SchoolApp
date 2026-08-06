import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/saapt_theme.dart';
import '../../../../core/network/parent_api_client.dart';
import '../../data/parent_models.dart';
import '../providers/parent_providers.dart';
import 'parent_screen_widgets.dart';

class ParentLeaveScreen extends ConsumerStatefulWidget {
  const ParentLeaveScreen({super.key});

  @override
  ConsumerState<ParentLeaveScreen> createState() => _ParentLeaveScreenState();
}

class _ParentLeaveScreenState extends ConsumerState<ParentLeaveScreen> {
  bool _applying = false;
  String _leaveType = 'Sick Leave';
  DateTime _fromDate = DateTime.now();
  DateTime _toDate = DateTime.now();
  final _reasonController = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final selectedChildState = ref.watch(effectiveSelectedChildProvider);
    return Scaffold(
      body: selectedChildState.when(
        loading: () => const LoadingPanel(),
        error: (error, _) => EmptyPanel(message: parentApiError(error)),
        data: (selectedChild) {
          if (selectedChild == null) {
            return const EmptyPanel(
              message: 'Select a child from Home to view leave requests.',
            );
          }
          final leaveCenter = ref.watch(
            parentLeaveCenterProvider(selectedChild),
          );
          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(parentLeaveCenterProvider(selectedChild));
              await ref.read(parentLeaveCenterProvider(selectedChild).future);
            },
            child: CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: ParentHero(
                    showMenu: true,
                    showChildSwitcher: true,
                    badge: _applying
                        ? '📝 Leave Request'
                        : '✅ Leave Requests',
                    title: selectedChild.name,
                    subtitle: _applying
                        ? 'Submit leave request to school'
                        : '${selectedChild.classLabel} • Track submitted leave requests',
                    showDefaultTrailing: !_applying,
                    leading: _applying
                        ? IconButton(
                            tooltip: 'Back',
                            style: IconButton.styleFrom(
                              backgroundColor: Colors.white.withValues(
                                alpha: 0.16,
                              ),
                              foregroundColor: Colors.white,
                            ),
                            onPressed: _submitting
                                ? null
                                : () => setState(() => _applying = false),
                            icon: const Icon(Icons.arrow_back_rounded),
                          )
                        : null,
                  ),
                ),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
                  sliver: SliverToBoxAdapter(
                    child: _applying
                        ? _buildApplyForm(selectedChild, leaveCenter.value)
                        : _buildHistory(leaveCenter, selectedChild),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildHistory(
    AsyncValue<ParentLeaveCenter> leaveCenter,
    ParentChild selectedChild,
  ) {
    return leaveCenter.when(
      loading: () => const LoadingPanel(),
      error: (error, _) => EmptyPanel(message: parentApiError(error)),
      data: (center) {
        final items = center.items
            .where((item) => item.childId == selectedChild.id)
            .toList();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                StatCard(
                  value: items.length.toString(),
                  label: 'Total Leave Requests',
                ),
                const SizedBox(width: 14),
                StatCard(
                  value: center.currentMonth.isEmpty
                      ? _monthLabel(DateTime.now())
                      : center.currentMonth,
                  label: 'Current Month',
                  color: SaaptTheme.success,
                ),
              ],
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                minimumSize: const Size.fromHeight(54),
                backgroundColor: SaaptTheme.primary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(18),
                ),
              ),
              onPressed: () => setState(() {
                _applying = true;
                _leaveType = center.leaveTypes.firstOrNull ?? 'Sick Leave';
              }),
              child: const Text(
                'Apply Leave',
                style: TextStyle(fontWeight: FontWeight.w900),
              ),
            ),
            const SizedBox(height: 18),
            if (items.isEmpty)
              const EmptyPanel(message: 'No leave requests submitted yet.')
            else
              for (final item in items) ...[
                _LeaveHistoryCard(item: item),
                const SizedBox(height: 14),
              ],
          ],
        );
      },
    );
  }

  Widget _buildApplyForm(
    ParentChild selectedChild,
    ParentLeaveCenter? leaveCenter,
  ) {
    final leaveTypes = leaveCenter?.leaveTypes.isNotEmpty == true
        ? leaveCenter!.leaveTypes
        : const [
            'Sick Leave',
            'Medical Leave',
            'Family Function',
            'Medical Checkup',
            'Others',
          ];
    if (!leaveTypes.contains(_leaveType)) _leaveType = leaveTypes.first;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ParentCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _FieldLabel('LEAVE TYPE'),
              _SelectBox(
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _leaveType,
                    isExpanded: true,
                    items: leaveTypes
                        .map(
                          (type) =>
                              DropdownMenuItem(value: type, child: Text(type)),
                        )
                        .toList(),
                    onChanged: (value) =>
                        setState(() => _leaveType = value ?? _leaveType),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              _FieldLabel('FROM DATE'),
              _DateBox(
                date: _fromDate,
                onTap: () async {
                  final picked = await _pickDate(_fromDate);
                  if (picked == null) return;
                  setState(() {
                    _fromDate = picked;
                    if (_toDate.isBefore(_fromDate)) _toDate = picked;
                  });
                },
              ),
              const SizedBox(height: 18),
              _FieldLabel('TO DATE'),
              _DateBox(
                date: _toDate,
                onTap: () async {
                  final picked = await _pickDate(_toDate);
                  if (picked == null) return;
                  setState(() => _toDate = picked);
                },
              ),
              const SizedBox(height: 18),
              _FieldLabel('REASON'),
              TextField(
                controller: _reasonController,
                minLines: 4,
                maxLines: 6,
                decoration: _inputDecoration('Enter leave reason'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        ElevatedButton(
          style: ElevatedButton.styleFrom(
            minimumSize: const Size.fromHeight(54),
            backgroundColor: SaaptTheme.primary,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(18),
            ),
          ),
          onPressed: _submitting ? null : () => _submit(selectedChild),
          child: Text(
            _submitting ? 'Submitting...' : 'Submit Leave Request',
            style: const TextStyle(fontWeight: FontWeight.w900),
          ),
        ),
      ],
    );
  }

  Future<DateTime?> _pickDate(DateTime initialDate) {
    final today = DateTime.now();
    return showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: DateTime(today.year - 1),
      lastDate: DateTime(today.year + 2),
    );
  }

  Future<void> _submit(ParentChild selectedChild) async {
    final childId = selectedChild.id;
    final reason = _reasonController.text.trim();
    if (_toDate.isBefore(_fromDate)) {
      _showSnack('To date must be after from date.');
      return;
    }
    if (reason.length < 3) {
      _showSnack('Enter a reason.');
      return;
    }
    setState(() => _submitting = true);
    try {
      final request = await ref
          .read(parentRepositoryProvider)
          .submitLeaveRequest(
            childId: childId,
            leaveType: _leaveType,
            fromDate: _fromDate,
            toDate: _toDate,
            reason: reason,
          );
      ref.invalidate(parentLeaveCenterProvider);
      ref.invalidate(parentMonthlyAttendanceProvider);
      ref.invalidate(parentAttendanceProvider);
      _reasonController.clear();
      if (!mounted) return;
      setState(() => _applying = false);
      final skipped = request.skippedDays.isEmpty
          ? ''
          : ' ${request.skippedDays.length} non-working day(s) were excluded.';
      _showSnack(
        'Leave request submitted for ${request.workingDays} working day(s).$skipped',
      );
    } catch (error) {
      if (!mounted) return;
      _showSnack(parentApiError(error, 'Unable to submit leave request'));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _showSnack(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }
}

class _LeaveHistoryCard extends StatelessWidget {
  const _LeaveHistoryCard({required this.item});

  final ParentLeaveRequest item;

  @override
  Widget build(BuildContext context) {
    return ParentCard(
      padding: const EdgeInsets.all(16),
      child: InkWell(
        onTap: () => showModalBottomSheet<void>(
          context: context,
          showDragHandle: true,
          isScrollControlled: true,
          builder: (_) => _LeaveDetailsSheet(item: item),
        ),
        child: Row(
          children: [
            Container(
              width: 58,
              height: 58,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: const Color(0xFFEAF1FF),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFD5E2FF)),
              ),
              child: Text(
                _leaveIcon(item.leaveType),
                style: const TextStyle(fontSize: 22),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.leaveType,
                    style: const TextStyle(
                      color: Color(0xFF0F1D3A),
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    '${item.childName} • ${_dateRange(item.fromDate, item.toDate)}',
                    style: const TextStyle(
                      color: Color(0xFF61718D),
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
            _StatusPill(status: item.status),
          ],
        ),
      ),
    );
  }
}

class _LeaveDetailsSheet extends StatelessWidget {
  const _LeaveDetailsSheet({required this.item});

  final ParentLeaveRequest item;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              item.leaveType,
              style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 14),
            _DetailRow(
              label: 'Student',
              value: '${item.childName} • ${item.classLabel}',
            ),
            _DetailRow(
              label: 'Dates',
              value: _dateRange(item.fromDate, item.toDate),
            ),
            _DetailRow(label: 'Working days', value: '${item.workingDays}'),
            _DetailRow(label: 'Requested days', value: '${item.requestedDays}'),
            _DetailRow(label: 'Status', value: item.status),
            _DetailRow(label: 'Reason', value: item.reason),
            if (item.skippedDays.isNotEmpty) ...[
              const SizedBox(height: 12),
              const Text(
                'Excluded Days',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 8),
              for (final day in item.skippedDays)
                _DetailRow(
                  label: _formatDate(day.date),
                  value: '${day.reason} (${day.type.toLowerCase()})',
                ),
            ],
          ],
        ),
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        text,
        style: const TextStyle(
          color: Color(0xFF91A1BB),
          fontSize: 12,
          fontWeight: FontWeight.w900,
          letterSpacing: 0,
        ),
      ),
    );
  }
}

class _SelectBox extends StatelessWidget {
  const _SelectBox({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 16),
    decoration: BoxDecoration(
      color: const Color(0xFFF7F9FE),
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: const Color(0xFFDDE7F7), width: 1.4),
    ),
    child: child,
  );
}

class _DateBox extends StatelessWidget {
  const _DateBox({required this.date, required this.onTap});

  final DateTime date;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    borderRadius: BorderRadius.circular(18),
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 18),
      decoration: BoxDecoration(
        color: const Color(0xFFF7F9FE),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFDDE7F7), width: 1.4),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              _formatDate(date),
              style: const TextStyle(
                color: Color(0xFF0F1D3A),
                fontSize: 15,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
          const Text('📅', style: TextStyle(fontSize: 18)),
        ],
      ),
    ),
  );
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final normalized = status.toUpperCase();
    final color = normalized == 'REJECTED'
        ? const Color(0xFFEF4444)
        : normalized == 'APPROVED'
        ? SaaptTheme.success
        : SaaptTheme.warning;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: color.withValues(alpha: 0.28)),
      ),
      child: Text(
        normalized == 'PENDING' ? 'Sent' : normalized,
        style: TextStyle(color: color, fontWeight: FontWeight.w900),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 118,
          child: Text(
            label,
            style: const TextStyle(
              color: Color(0xFF91A1BB),
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(
              color: Color(0xFF0F1D3A),
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
      ],
    ),
  );
}

InputDecoration _inputDecoration(String hint) => InputDecoration(
  hintText: hint,
  filled: true,
  fillColor: const Color(0xFFF7F9FE),
  border: OutlineInputBorder(
    borderRadius: BorderRadius.circular(18),
    borderSide: const BorderSide(color: Color(0xFFDDE7F7), width: 1.4),
  ),
  enabledBorder: OutlineInputBorder(
    borderRadius: BorderRadius.circular(18),
    borderSide: const BorderSide(color: Color(0xFFDDE7F7), width: 1.4),
  ),
  focusedBorder: OutlineInputBorder(
    borderRadius: BorderRadius.circular(18),
    borderSide: const BorderSide(color: SaaptTheme.primary, width: 2),
  ),
);

String _leaveIcon(String type) {
  final normalized = type.toLowerCase();
  if (normalized.contains('sick')) return '🤒';
  if (normalized.contains('family')) return '🏠';
  if (normalized.contains('medical')) return '🩺';
  return '📝';
}

String _dateRange(DateTime from, DateTime to) {
  if (from.year == to.year && from.month == to.month && from.day == to.day) {
    return _formatDate(from);
  }
  return '${_formatDate(from)} - ${_formatDate(to)}';
}

String _formatDate(DateTime value) {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return '${value.day.toString().padLeft(2, '0')} ${months[value.month - 1]} ${value.year}';
}

String _monthLabel(DateTime value) {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return '${months[value.month - 1]} ${value.year}';
}
