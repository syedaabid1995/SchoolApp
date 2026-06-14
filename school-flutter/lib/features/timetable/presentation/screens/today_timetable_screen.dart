import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../../../core/widgets/async_state_view.dart';
import '../providers/timetable_providers.dart';
import 'timetable_detail_screen.dart';
import 'weekly_timetable_screen.dart';

class TodayTimetableScreen extends ConsumerWidget {
  const TodayTimetableScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final timetable = ref.watch(todayTimetableProvider);
    return AppScaffold(
      title: 'Timetable',
      emoji: '🗓️',
      breadcrumb: '👩🏫 Teacher Dashboard',
      subtitle: 'Today\'s schedule and weekly overview.',
      actions: [
        IconButton(
          tooltip: 'Refresh',
          onPressed: () {
            ref.invalidate(todayTimetableProvider);
            ref.invalidate(weeklyTimetableProvider);
          },
          icon: const Icon(Icons.refresh),
        ),
      ],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AsyncStateView(
            value: timetable,
            data: (value) => TimetableDetailScreen(timetable: value),
          ),
          const SizedBox(height: AppSpacing.lg),
          const WeeklyTimetableScreen(),
        ],
      ),
    );
  }
}
