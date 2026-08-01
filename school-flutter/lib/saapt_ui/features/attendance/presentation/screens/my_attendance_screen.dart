import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../../global_ui/features/attendance/domain/entities/attendance_summary.dart';
import '../../../../../global_ui/features/attendance/presentation/providers/attendance_providers.dart';
import '../../../../../global_ui/features/auth/presentation/providers/auth_controller.dart';
import '../../../../../global_ui/features/notices/domain/entities/notice.dart';
import '../../../../../global_ui/features/notices/presentation/providers/notice_providers.dart';
import '../../../../../global_ui/features/notifications/domain/entities/staff_notification.dart';
import '../../../../../global_ui/features/notifications/presentation/providers/notification_providers.dart';
import '../../../../app/theme/saapt_theme.dart';
import '../../../notices/presentation/screens/saapt_notice_board_screen.dart';
import '../../../notifications/presentation/screens/saapt_push_notifications_screen.dart';
import '../../../profile/presentation/widgets/school_switch_sheet.dart';

class MyAttendanceScreen extends ConsumerWidget {
  const MyAttendanceScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final options = ref.watch(selfAttendanceOptionsProvider(today));
    final history = ref.watch(teacherAttendanceHistoryProvider);
    final notices = ref.watch(noticeBoardProvider);
    final pushNotifications = ref.watch(pushNotificationCenterProvider);
    final user = ref.watch(authControllerProvider).value?.user;

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(selfAttendanceOptionsProvider(today));
          ref.invalidate(teacherAttendanceHistoryProvider);
          ref.invalidate(noticeBoardProvider);
          ref.invalidate(pushNotificationCenterProvider);
        },
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: _Header(
                name: user?.displayName ?? 'Teacher',
                schoolName: user?.schoolName ?? 'School',
                onChangeSchool: () => showSaaptSchoolSwitchSheet(context, ref),
                notices: notices,
                pushNotifications: pushNotifications,
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
              sliver: SliverToBoxAdapter(
                child: options.when(
                  loading: () => const Padding(
                    padding: EdgeInsets.all(48),
                    child: Center(child: CircularProgressIndicator()),
                  ),
                  error: (error, _) => _ErrorPanel(
                    message: error.toString(),
                    onRetry: () =>
                        ref.invalidate(selfAttendanceOptionsProvider(today)),
                  ),
                  data: (resolved) => history.when(
                    loading: () => const Padding(
                      padding: EdgeInsets.all(48),
                      child: Center(child: CircularProgressIndicator()),
                    ),
                    error: (error, _) => _ErrorPanel(
                      message: error.toString(),
                      onRetry: () =>
                          ref.invalidate(teacherAttendanceHistoryProvider),
                    ),
                    data: (records) => _AttendanceContent(
                      date: today,
                      options: resolved,
                      todayRecords: records
                          .where((record) => _sameDate(record.date, today))
                          .toList(),
                      monthRecords: records,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  static bool _sameDate(DateTime left, DateTime right) =>
      left.year == right.year &&
      left.month == right.month &&
      left.day == right.day;
}

class _Header extends StatelessWidget {
  const _Header({
    required this.name,
    required this.schoolName,
    required this.onChangeSchool,
    required this.notices,
    required this.pushNotifications,
  });
  final String name;
  final String schoolName;
  final VoidCallback onChangeSchool;
  final AsyncValue<NoticeBoardState> notices;
  final AsyncValue<NotificationCenterState> pushNotifications;

  @override
  Widget build(BuildContext context) {
    final unreadNotices = notices.maybeWhen(
      data: (state) =>
          _adminNotices(state).where((notice) => !notice.isRead).length,
      orElse: () => 0,
    );
    final unreadPushNotifications = pushNotifications.maybeWhen(
      data: (state) => _pushNotifications(
        state,
      ).where((notification) => !notification.isRead).length,
      orElse: () => 0,
    );
    return Container(
      color: SaaptTheme.primary,
      padding: const EdgeInsets.fromLTRB(24, 54, 24, 28),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 7,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.14),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.35),
                      ),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.school_outlined,
                          size: 18,
                          color: Colors.white,
                        ),
                        const SizedBox(width: 7),
                        Flexible(
                          child: Text(
                            name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              _PushNotificationAction(unreadCount: unreadPushNotifications),
              const SizedBox(width: 8),
              _NoticeAction(unreadCount: unreadNotices),
            ],
          ),
          const SizedBox(height: 18),
          const Text(
            'My Attendance',
            style: TextStyle(
              color: Colors.white,
              fontSize: 32,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 10),
          _SchoolSelectorPill(schoolName: schoolName, onTap: onChangeSchool),
          const SizedBox(height: 10),
          Text(
            'Record attendance using your assigned daily units.',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.78),
              fontSize: 15,
            ),
          ),
        ],
      ),
    );
  }
}

class _SchoolSelectorPill extends StatelessWidget {
  const _SchoolSelectorPill({required this.schoolName, required this.onTap});

  final String schoolName;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Align(
    alignment: Alignment.centerLeft,
    child: InkWell(
      borderRadius: BorderRadius.circular(20),
      onTap: onTap,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 320),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.14),
          border: Border.all(color: Colors.white.withValues(alpha: 0.35)),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.apartment_rounded, color: Colors.white, size: 17),
            const SizedBox(width: 7),
            Flexible(
              child: Text(
                schoolName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            const SizedBox(width: 4),
            const Icon(
              Icons.keyboard_arrow_down_rounded,
              color: Colors.white,
              size: 20,
            ),
          ],
        ),
      ),
    ),
  );
}

class _PushNotificationAction extends StatelessWidget {
  const _PushNotificationAction({required this.unreadCount});

  final int unreadCount;

  @override
  Widget build(BuildContext context) => Stack(
    clipBehavior: Clip.none,
    children: [
      IconButton(
        style: IconButton.styleFrom(
          backgroundColor: Colors.white.withValues(alpha: 0.14),
          foregroundColor: Colors.white,
          fixedSize: const Size(46, 46),
        ),
        tooltip: 'Push Notifications',
        onPressed: () => Navigator.of(context, rootNavigator: true).push(
          MaterialPageRoute(
            builder: (_) => const SaaptPushNotificationsScreen(),
          ),
        ),
        icon: const Icon(Icons.notifications_active_rounded),
      ),
      if (unreadCount > 0)
        Positioned(
          right: -2,
          top: -4,
          child: Container(
            constraints: const BoxConstraints(minWidth: 20, minHeight: 20),
            padding: const EdgeInsets.symmetric(horizontal: 5),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: const Color(0xFFE94D4D),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.white, width: 1.5),
            ),
            child: Text(
              unreadCount > 9 ? '9+' : unreadCount.toString(),
              style: const TextStyle(
                color: Colors.white,
                fontSize: 11,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
        ),
    ],
  );
}

class _NoticeAction extends StatelessWidget {
  const _NoticeAction({required this.unreadCount});

  final int unreadCount;

  @override
  Widget build(BuildContext context) => Stack(
    clipBehavior: Clip.none,
    children: [
      IconButton(
        style: IconButton.styleFrom(
          backgroundColor: Colors.white.withValues(alpha: 0.14),
          foregroundColor: Colors.white,
          fixedSize: const Size(46, 46),
        ),
        tooltip: 'Notice Board',
        onPressed: () => Navigator.of(context, rootNavigator: true).push(
          MaterialPageRoute(builder: (_) => const SaaptNoticeBoardScreen()),
        ),
        icon: const Icon(Icons.campaign_rounded),
      ),
      if (unreadCount > 0)
        Positioned(
          right: -2,
          top: -4,
          child: Container(
            constraints: const BoxConstraints(minWidth: 20, minHeight: 20),
            padding: const EdgeInsets.symmetric(horizontal: 5),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: const Color(0xFFE94D4D),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.white, width: 1.5),
            ),
            child: Text(
              unreadCount > 9 ? '9+' : unreadCount.toString(),
              style: const TextStyle(
                color: Colors.white,
                fontSize: 11,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
        ),
    ],
  );
}

List<Notice> _adminNotices(NoticeBoardState state) {
  return state.notices;
}

List<StaffNotification> _pushNotifications(NotificationCenterState state) {
  return state.items;
}

class _AttendanceContent extends ConsumerWidget {
  const _AttendanceContent({
    required this.date,
    required this.options,
    required this.todayRecords,
    required this.monthRecords,
  });

  final DateTime date;
  final SelfAttendanceOptions options;
  final List<TeacherAttendanceRecord> todayRecords;
  final List<TeacherAttendanceRecord> monthRecords;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final byUnit = {for (final record in todayRecords) record.unitKey: record};
    final completed = options.units
        .where((unit) => byUnit.containsKey(unit.identityPart))
        .length;
    final pending = options.units.length - completed;
    final firstPending = options.units
        .where((unit) => !byUnit.containsKey(unit.identityPart))
        .firstOrNull;
    final holidayRecord = todayRecords
        .where((record) => record.status == 'HOLIDAY')
        .firstOrNull;

    if (holidayRecord != null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _TodayHolidayCard(date: date, record: holidayRecord),
          const SizedBox(height: 18),
          _MonthlyAttendanceCalendar(
            date: date,
            records: monthRecords,
            teacherName: 'My',
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: const Color(0xFFEDF3FF),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFFD4E1FF)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Today: ${DateFormat('d MMMM yyyy').format(date)}',
                style: const TextStyle(
                  color: SaaptTheme.primary,
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 7),
              Text(
                options.units.isEmpty
                    ? 'No attendance units are configured.'
                    : completed == options.units.length
                    ? 'All attendance units are completed.'
                    : '$completed completed. $pending pending.',
                style: const TextStyle(
                  color: Color(0xFF60708F),
                  fontSize: 16,
                  height: 1.35,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: _Metric(
                value: '$completed/${options.units.length}',
                label: 'My Sessions',
                color: SaaptTheme.success,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _Metric(
                value: '$pending',
                label: 'Pending',
                color: SaaptTheme.warning,
              ),
            ),
          ],
        ),
        const SizedBox(height: 24),
        Row(
          children: [
            const Expanded(
              child: Text(
                'My Attendance',
                style: TextStyle(fontSize: 21, fontWeight: FontWeight.w800),
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: const Color(0xFFE8EFFF),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Text(
                options.configuration.mode.value.replaceAll('_', ' '),
                style: const TextStyle(
                  color: SaaptTheme.primary,
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        for (final unit in options.units) ...[
          _UnitCard(
            unit: unit,
            record: byUnit[unit.identityPart],
            onTap: () => _showStatusSheet(context, ref, unit),
          ),
          const SizedBox(height: 12),
        ],
        if (options.units.isEmpty) const _EmptyPanel(),
        const SizedBox(height: 8),
        FilledButton.icon(
          style: FilledButton.styleFrom(
            minimumSize: const Size.fromHeight(56),
            backgroundColor: SaaptTheme.success,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
          ),
          onPressed: firstPending == null
              ? null
              : () => _showStatusSheet(context, ref, firstPending),
          icon: const Icon(Icons.how_to_reg_outlined),
          label: Text(
            firstPending == null
                ? 'Attendance Completed'
                : 'Mark ${firstPending.label} Attendance',
            style: const TextStyle(fontWeight: FontWeight.w800),
          ),
        ),
        const SizedBox(height: 18),
        _MonthlyAttendanceCalendar(
          date: date,
          records: monthRecords,
          teacherName: 'My',
        ),
      ],
    );
  }

  Future<void> _showStatusSheet(
    BuildContext context,
    WidgetRef ref,
    AttendanceUnit unit,
  ) async {
    final status = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                unit.label,
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Select your attendance status.',
                style: TextStyle(color: Color(0xFF60708F)),
              ),
              const SizedBox(height: 18),
              _StatusChoice(
                label: 'Present',
                icon: Icons.check_circle_outline,
                color: SaaptTheme.success,
                onTap: () => Navigator.pop(context, 'PRESENT'),
              ),
              const SizedBox(height: 10),
              const _StatusChoice(
                label: 'Absent',
                icon: Icons.cancel_outlined,
                color: Color(0xFFD64545),
                enabled: false,
                helper: 'Absent is managed by the school.',
              ),
              const SizedBox(height: 10),
              _StatusChoice(
                label: 'Leave',
                icon: Icons.event_busy_outlined,
                color: SaaptTheme.warning,
                onTap: () => Navigator.pop(context, 'LEAVE'),
              ),
            ],
          ),
        ),
      ),
    );
    if (status == null || !context.mounted) return;
    await ref
        .read(markSelfAttendanceProvider.notifier)
        .mark(status, unit: unit, date: date);
    if (!context.mounted) return;
    final result = ref.read(markSelfAttendanceProvider);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          result.hasError
              ? result.error.toString()
              : '${unit.label} marked ${status.toLowerCase()}.',
        ),
        backgroundColor: result.hasError
            ? Theme.of(context).colorScheme.error
            : SaaptTheme.success,
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({
    required this.value,
    required this.label,
    required this.color,
  });
  final String value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(vertical: 20),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(8),
      border: Border.all(color: const Color(0xFFDDE5F2)),
    ),
    child: Column(
      children: [
        Text(
          value,
          style: TextStyle(
            color: color,
            fontSize: 28,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          label,
          style: const TextStyle(
            color: Color(0xFF91A0BA),
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    ),
  );
}

class _TodayHolidayCard extends StatelessWidget {
  const _TodayHolidayCard({required this.date, required this.record});

  final DateTime date;
  final TeacherAttendanceRecord record;

  @override
  Widget build(BuildContext context) {
    final detail = _holidayDetail(record);
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF7E8),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFFFDFA8)),
      ),
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: SaaptTheme.warning.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(
              Icons.celebration_outlined,
              color: SaaptTheme.warning,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Today is a holiday',
                  style: const TextStyle(
                    color: Color(0xFF102044),
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  detail.isEmpty
                      ? DateFormat('d MMMM yyyy').format(date)
                      : detail,
                  style: const TextStyle(
                    color: Color(0xFF60708F),
                    fontWeight: FontWeight.w600,
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _holidayDetail(TeacherAttendanceRecord record) {
    final parts = <String>[];

    void addPart(String? value) {
      final text = _formatHolidayText(value);
      if (text.isEmpty) return;
      final exists = parts.any(
        (part) => part.toLowerCase() == text.toLowerCase(),
      );
      if (!exists) parts.add(text);
    }

    for (final part in (record.overrideReason ?? '').split(' - ')) {
      addPart(part);
    }
    final periodName = _formatHolidayText(record.periodName);
    if (periodName.isNotEmpty && periodName.toLowerCase() != 'holiday') {
      addPart(periodName);
    }

    return parts.join(' - ');
  }

  String _formatHolidayText(String? value) {
    final trimmed = value?.trim().replaceAll('_', ' ') ?? '';
    if (trimmed.isEmpty) return '';
    return trimmed
        .split(RegExp(r'\s+'))
        .map((word) {
          if (word.isEmpty) return word;
          return word[0].toUpperCase() + word.substring(1).toLowerCase();
        })
        .join(' ');
  }
}

class _UnitCard extends StatelessWidget {
  const _UnitCard({
    required this.unit,
    required this.record,
    required this.onTap,
  });
  final AttendanceUnit unit;
  final TeacherAttendanceRecord? record;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final status = record?.status ?? 'PENDING';
    final color = switch (status) {
      'PRESENT' => SaaptTheme.success,
      'LEAVE' => SaaptTheme.warning,
      _ => const Color(0xFF8A9AB8),
    };
    final icon = switch (unit.unitType) {
      AttendanceUnitType.day => Icons.today_outlined,
      AttendanceUnitType.slot =>
        unit.slotType == AttendanceSlotType.morning
            ? Icons.wb_sunny_outlined
            : Icons.nights_stay_outlined,
      AttendanceUnitType.period => Icons.schedule_outlined,
      AttendanceUnitType.timetableEntry => Icons.menu_book_outlined,
    };
    final detail = [
      unit.startTime,
      unit.endTime,
    ].whereType<String>().where((item) => item.isNotEmpty).join(' - ');
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFFDDE5F2)),
          ),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: const Color(0xFFEDF3FF),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: SaaptTheme.primary),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      unit.label,
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      detail.isEmpty
                          ? (record == null
                                ? 'Check-in pending'
                                : 'Attendance recorded')
                          : detail,
                      style: const TextStyle(color: Color(0xFF60708F)),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 11,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: color.withValues(alpha: 0.25)),
                ),
                child: Text(
                  status,
                  style: TextStyle(
                    color: color,
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
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

class _StatusChoice extends StatelessWidget {
  const _StatusChoice({
    required this.label,
    required this.icon,
    required this.color,
    this.onTap,
    this.enabled = true,
    this.helper,
  });
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback? onTap;
  final bool enabled;
  final String? helper;

  @override
  Widget build(BuildContext context) => ListTile(
    enabled: enabled,
    onTap: enabled ? onTap : null,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(8),
      side: const BorderSide(color: Color(0xFFDDE5F2)),
    ),
    leading: Icon(icon, color: enabled ? color : Colors.grey),
    title: Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
    subtitle: helper == null ? null : Text(helper!),
    trailing: enabled
        ? const Icon(Icons.chevron_right)
        : const Icon(Icons.lock_outline, size: 18),
  );
}

class _MonthlyAttendanceCalendar extends StatelessWidget {
  const _MonthlyAttendanceCalendar({
    required this.date,
    required this.records,
    required this.teacherName,
  });

  final DateTime date;
  final List<TeacherAttendanceRecord> records;
  final String teacherName;

  @override
  Widget build(BuildContext context) {
    final monthStart = DateTime(date.year, date.month);
    final daysInMonth = DateTime(date.year, date.month + 1, 0).day;
    final leadingBlanks = monthStart.weekday % 7;
    final cells = leadingBlanks + daysInMonth;
    final trailingBlanks = (7 - (cells % 7)) % 7;
    final byDay = <int, List<TeacherAttendanceRecord>>{};
    for (final record in records) {
      if (record.date.year != date.year || record.date.month != date.month) {
        continue;
      }
      byDay.putIfAbsent(record.date.day, () => []).add(record);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '$teacherName Attendance - ${DateFormat.yMMMM().format(date)}',
          style: const TextStyle(
            color: Color(0xFF102044),
            fontSize: 21,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.fromLTRB(14, 18, 14, 16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFFDDE5F2)),
          ),
          child: Column(
            children: [
              Row(
                children: [
                  for (final label in ['S', 'M', 'T', 'W', 'T', 'F', 'S'])
                    Expanded(
                      child: Center(
                        child: Text(
                          label,
                          style: const TextStyle(
                            color: Color(0xFF91A0BA),
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 10),
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: leadingBlanks + daysInMonth + trailingBlanks,
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 7,
                  mainAxisSpacing: 10,
                  crossAxisSpacing: 10,
                  childAspectRatio: 1,
                ),
                itemBuilder: (context, index) {
                  final day = index - leadingBlanks + 1;
                  if (day < 1 || day > daysInMonth) {
                    return const SizedBox.shrink();
                  }
                  final dayRecords = byDay[day] ?? const [];
                  final summary = _DayAttendanceSummary.from(dayRecords);
                  final isToday =
                      date.year == DateTime.now().year &&
                      date.month == DateTime.now().month &&
                      day == DateTime.now().day;
                  return Tooltip(
                    message: summary.tooltip(day),
                    child: _CalendarDayCell(
                      day: day,
                      summary: summary,
                      isToday: isToday,
                    ),
                  );
                },
              ),
              const SizedBox(height: 16),
              const Wrap(
                spacing: 12,
                runSpacing: 8,
                children: [
                  _CalendarLegend(color: SaaptTheme.success, label: 'Present'),
                  _CalendarLegend(
                    color: Color(0xFFD64545),
                    label: 'Absent / Leave',
                  ),
                  _CalendarLegend(color: SaaptTheme.warning, label: 'Holiday'),
                  _CalendarLegend(color: Color(0xFF60708F), label: 'Pending'),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _CalendarDayCell extends StatelessWidget {
  const _CalendarDayCell({
    required this.day,
    required this.summary,
    required this.isToday,
  });

  final int day;
  final _DayAttendanceSummary summary;
  final bool isToday;

  @override
  Widget build(BuildContext context) {
    final color = isToday ? SaaptTheme.primary : summary.color;
    final background = isToday
        ? SaaptTheme.primary
        : summary.color.withValues(alpha: summary.isPending ? 0.08 : 0.12);
    return Container(
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(8),
        border: isToday
            ? null
            : Border.all(color: color.withValues(alpha: 0.12)),
      ),
      child: Stack(
        alignment: Alignment.center,
        children: [
          Text(
            '$day',
            style: TextStyle(
              color: isToday ? Colors.white : color,
              fontSize: 16,
              fontWeight: FontWeight.w800,
            ),
          ),
          if (summary.hasMultipleUnits)
            Positioned(
              bottom: 6,
              child: Container(
                width: 18,
                height: 4,
                decoration: BoxDecoration(
                  color: isToday
                      ? Colors.white.withValues(alpha: 0.72)
                      : color.withValues(alpha: 0.55),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _CalendarLegend extends StatelessWidget {
  const _CalendarLegend({required this.color, required this.label});
  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Container(
        width: 10,
        height: 10,
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(3),
        ),
      ),
      const SizedBox(width: 6),
      Text(
        label,
        style: const TextStyle(
          color: Color(0xFF60708F),
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    ],
  );
}

class _DayAttendanceSummary {
  const _DayAttendanceSummary({required this.status, required this.records});

  factory _DayAttendanceSummary.from(List<TeacherAttendanceRecord> records) {
    if (records.isEmpty) {
      return _DayAttendanceSummary(status: 'PENDING', records: records);
    }
    final statuses = records.map((record) => record.status).toSet();
    if (statuses.contains('HOLIDAY')) {
      return _DayAttendanceSummary(status: 'HOLIDAY', records: records);
    }
    if (statuses.contains('ABSENT') ||
        statuses.contains('LEAVE') ||
        statuses.contains('LOP') ||
        statuses.contains('CASUAL_LEAVE')) {
      return _DayAttendanceSummary(status: 'ABSENT', records: records);
    }
    if (statuses.contains('LATE') || statuses.contains('HALF_DAY')) {
      return _DayAttendanceSummary(status: 'PARTIAL', records: records);
    }
    if (statuses.length == 1 && statuses.first == 'PRESENT') {
      return _DayAttendanceSummary(status: 'PRESENT', records: records);
    }
    return _DayAttendanceSummary(status: 'MIXED', records: records);
  }

  final String status;
  final List<TeacherAttendanceRecord> records;

  bool get isPending => status == 'PENDING';
  bool get hasMultipleUnits => records.length > 1;

  Color get color => switch (status) {
    'PRESENT' => SaaptTheme.success,
    'HOLIDAY' => SaaptTheme.warning,
    'ABSENT' => const Color(0xFFD64545),
    'PARTIAL' => SaaptTheme.warning,
    'MIXED' => SaaptTheme.primary,
    _ => const Color(0xFF60708F),
  };

  String tooltip(int day) {
    if (records.isEmpty) return 'Day $day: Attendance pending';
    final units = records
        .map((record) => '${_recordLabel(record)} ${record.status}')
        .join(', ');
    return 'Day $day: $units';
  }

  String _recordLabel(TeacherAttendanceRecord record) {
    if (record.periodName != null && record.periodName!.isNotEmpty) {
      return record.periodName!;
    }
    if (record.slotType == AttendanceSlotType.morning) return 'Morning';
    if (record.slotType == AttendanceSlotType.afternoon) return 'Afternoon';
    return record.unitType.value.replaceAll('_', ' ');
  }
}

class _ErrorPanel extends StatelessWidget {
  const _ErrorPanel({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.errorContainer,
      borderRadius: BorderRadius.circular(8),
    ),
    child: Column(
      children: [
        Text(message),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: onRetry,
          icon: const Icon(Icons.refresh),
          label: const Text('Retry'),
        ),
      ],
    ),
  );
}

class _EmptyPanel extends StatelessWidget {
  const _EmptyPanel();
  @override
  Widget build(BuildContext context) => const Padding(
    padding: EdgeInsets.symmetric(vertical: 32),
    child: Column(
      children: [
        Icon(Icons.event_busy_outlined, size: 44, color: Color(0xFF8A9AB8)),
        SizedBox(height: 10),
        Text('No attendance units available'),
      ],
    ),
  );
}
