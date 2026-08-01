import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/saapt_theme.dart';
import '../../data/parent_models.dart';
import '../providers/parent_providers.dart';
import 'parent_attendance_calendar.dart';
import 'parent_screen_widgets.dart';

class ParentHomeScreen extends ConsumerWidget {
  const ParentHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final childrenState = ref.watch(parentChildrenProvider);
    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(parentChildrenProvider),
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: ParentHero(
                badge: '👨‍👩‍👧 Parent App',
                title: 'Select Child',
                subtitle: childrenState.maybeWhen(
                  data: (children) =>
                      '${children.length} ${children.length == 1 ? 'student' : 'students'} mapped to this parent account',
                  orElse: () => 'Loading mapped children',
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
              sliver: SliverToBoxAdapter(
                child: childrenState.when(
                  loading: () => const LoadingPanel(),
                  error: (error, _) => EmptyPanel(message: error.toString()),
                  data: (children) => _DashboardContent(children: children),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DashboardContent extends ConsumerStatefulWidget {
  const _DashboardContent({required this.children});

  final List<ParentChild> children;

  @override
  ConsumerState<_DashboardContent> createState() => _DashboardContentState();
}

class _DashboardContentState extends ConsumerState<_DashboardContent> {
  late DateTime _month;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _month = DateTime(now.year, now.month);
  }

  @override
  Widget build(BuildContext context) {
    if (widget.children.isEmpty) {
      return const EmptyPanel(
        message: 'No children are mapped to this parent account.',
      );
    }
    final selected = ref.watch(selectedChildProvider) ?? widget.children.first;
    final selectedDate = DateTime(_month.year, _month.month);
    final attendanceState = ref.watch(
      parentMonthlyAttendanceProvider((
        childId: selected.id,
        month: _month,
        date: selectedDate,
      )),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _SelectedChildCard(child: selected, children: widget.children),
        const SizedBox(height: 18),
        Row(
          children: [
            StatCard(
              value: widget.children.length.toString(),
              label: 'Children',
            ),
            const SizedBox(width: 14),
            const StatCard(
              value: 'Active',
              label: 'Status',
              color: SaaptTheme.success,
            ),
          ],
        ),
        const SizedBox(height: 22),
        attendanceState.when(
          loading: () => const LoadingPanel(),
          error: (error, _) => EmptyPanel(message: error.toString()),
          data: (attendance) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  StatCard(
                    value: attendance.presentDays.toString(),
                    label: 'Present',
                    color: SaaptTheme.success,
                  ),
                  const SizedBox(width: 12),
                  StatCard(
                    value: attendance.absentDays.toString(),
                    label: 'Absent',
                    color: const Color(0xFFF24852),
                  ),
                  const SizedBox(width: 12),
                  StatCard(
                    value: attendance.leaveDays.toString(),
                    label: 'Leave',
                    color: const Color(0xFF8B5CF6),
                  ),
                ],
              ),
              const SizedBox(height: 22),
              ParentAttendanceCalendar(
                month: _month,
                attendance: attendance,
                childName: selected.name,
                showMonthlyStatus: false,
                onMonthChanged: (value) {
                  setState(() {
                    _month = DateTime(value.year, value.month);
                  });
                },
              ),
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: () => context.go('/attendance'),
                icon: const Icon(Icons.calendar_month_rounded),
                label: const Text('Open Attendance'),
                style: FilledButton.styleFrom(
                  backgroundColor: SaaptTheme.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 15),
                  textStyle: const TextStyle(fontWeight: FontWeight.w900),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _SelectedChildCard extends ConsumerWidget {
  const _SelectedChildCard({required this.child, required this.children});

  final ParentChild child;
  final List<ParentChild> children;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ParentCard(
      child: Row(
        children: [
          Container(
            width: 58,
            height: 58,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: const Color(0xFFEAF1FF),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFD2E1FF)),
            ),
            child: Text(
              _avatarFor(child.name),
              style: const TextStyle(fontSize: 23),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  child.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: SaaptTheme.navy,
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  child.classLabel,
                  style: const TextStyle(
                    color: Color(0xFF586985),
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              foregroundColor: SaaptTheme.primary,
              backgroundColor: const Color(0xFFF1F6FF),
              side: const BorderSide(color: Color(0xFFD4E2FF)),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(22),
              ),
            ),
            onPressed: () => _showChildSheet(context, ref, children, child),
            icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 18),
            label: Text(
              children.length == 1 ? 'Selected' : 'Change',
              style: const TextStyle(fontWeight: FontWeight.w900),
            ),
          ),
        ],
      ),
    );
  }

  void _showChildSheet(
    BuildContext context,
    WidgetRef ref,
    List<ParentChild> children,
    ParentChild selected,
  ) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Select Child',
                style: TextStyle(
                  color: SaaptTheme.navy,
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                DateFormat('d MMM yyyy').format(DateTime.now()),
                style: const TextStyle(
                  color: Color(0xFF60708F),
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 18),
              for (final child in children) ...[
                _ChildOptionTile(
                  child: child,
                  selected: child.id == selected.id,
                  onTap: () {
                    ref.read(selectedChildProvider.notifier).state = child;
                    Navigator.of(context).pop();
                  },
                ),
                const SizedBox(height: 12),
              ],
            ],
          ),
        ),
      ),
    );
  }

  String _avatarFor(String name) {
    final lower = name.toLowerCase();
    return lower.endsWith('a') || lower.contains('ananya') ? '👧' : '👦';
  }
}

class _ChildOptionTile extends StatelessWidget {
  const _ChildOptionTile({
    required this.child,
    required this.selected,
    required this.onTap,
  });

  final ParentChild child;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFFF6F8FC),
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: const Color(0xFFE7EFFD),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  selected ? Icons.check_circle_rounded : Icons.person_outline,
                  color: SaaptTheme.primary,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      child.name,
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        color: SaaptTheme.navy,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      child.classLabel,
                      style: const TextStyle(
                        color: Color(0xFF60708F),
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: Color(0xFF8A9AB8)),
            ],
          ),
        ),
      ),
    );
  }
}
