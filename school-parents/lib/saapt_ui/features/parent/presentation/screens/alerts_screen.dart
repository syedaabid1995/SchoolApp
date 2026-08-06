import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/saapt_theme.dart';
import '../../data/parent_models.dart';
import '../providers/parent_providers.dart';
import 'parent_screen_widgets.dart';

class ParentAlertsScreen extends ConsumerWidget {
  const ParentAlertsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedChild =
        ref.watch(effectiveSelectedChildProvider).asData?.value;
    final noticesState = ref.watch(parentNoticesProvider(selectedChild));
    return ParentStickyScaffold(
      showMenu: true,
      showChildSwitcher: true,
      badge: 'Notifications',
      title: selectedChild?.name ?? 'Alerts Center',
      subtitle: selectedChild == null
          ? 'Attendance, fees & school updates'
          : '${selectedChild.classLabel} · Attendance, fees & school updates',
      onRefresh: () async =>
          ref.invalidate(parentNoticesProvider(selectedChild)),
      body: noticesState.when(
        loading: () => const LoadingPanel(),
        error: (error, _) => _AlertsEmptyState(
          icon: Icons.error_outline_rounded,
          title: 'Unable to load alerts',
          message: error.toString(),
        ),
        data: (notices) {
          if (notices.isEmpty) {
            return const _AlertsEmptyState(
              icon: Icons.notifications_none_rounded,
              title: 'All caught up',
              message: 'No alerts are available right now.',
            );
          }

          final displays = notices
              .map(_AlertDisplay.fromNotice)
              .toList(growable: false);
          final groups = _groupByDay(displays);

          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _AlertsSummaryBar(
                total: displays.length,
                attention: displays
                    .where((item) => item.kind == _AlertKind.attendance ||
                        item.kind == _AlertKind.fees)
                    .length,
              ),
              const SizedBox(height: 18),
              for (final group in groups) ...[
                _AlertsDayHeader(
                  label: group.label,
                  count: group.items.length,
                ),
                const SizedBox(height: 10),
                for (final display in group.items)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _AlertCard(display: display),
                  ),
                const SizedBox(height: 8),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _AlertDayGroup {
  const _AlertDayGroup({required this.label, required this.items});

  final String label;
  final List<_AlertDisplay> items;
}

List<_AlertDayGroup> _groupByDay(List<_AlertDisplay> displays) {
  final now = DateTime.now();
  final today = <_AlertDisplay>[];
  final yesterday = <_AlertDisplay>[];
  final earlier = <_AlertDisplay>[];

  for (final display in displays) {
    if (DateUtils.isSameDay(display.date, now)) {
      today.add(display);
    } else if (DateUtils.isSameDay(
      display.date,
      now.subtract(const Duration(days: 1)),
    )) {
      yesterday.add(display);
    } else {
      earlier.add(display);
    }
  }

  return [
    if (today.isNotEmpty) _AlertDayGroup(label: 'Today', items: today),
    if (yesterday.isNotEmpty)
      _AlertDayGroup(label: 'Yesterday', items: yesterday),
    if (earlier.isNotEmpty) _AlertDayGroup(label: 'Earlier', items: earlier),
  ];
}

class _AlertsSummaryBar extends StatelessWidget {
  const _AlertsSummaryBar({required this.total, required this.attention});

  final int total;
  final int attention;

  @override
  Widget build(BuildContext context) {
    return ParentCard(
      padding: EdgeInsets.zero,
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFFEAF1FF), Colors.white],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.all(Radius.circular(16)),
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: SaaptTheme.primary.withValues(alpha: 0.18),
                ),
              ),
              child: const Icon(
                Icons.notifications_active_outlined,
                color: SaaptTheme.primary,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '$total notification${total == 1 ? '' : 's'}',
                    style: const TextStyle(
                      color: SaaptTheme.navy,
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.2,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    attention > 0
                        ? '$attention need attention (fees or attendance)'
                        : 'School updates for your selected student',
                    style: const TextStyle(
                      color: Color(0xFF60708F),
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AlertsDayHeader extends StatelessWidget {
  const _AlertsDayHeader({required this.label, required this.count});

  final String label;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: const TextStyle(
              color: SaaptTheme.navy,
              fontSize: 14,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
          decoration: BoxDecoration(
            color: const Color(0xFFEAF1FF),
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            '$count',
            style: const TextStyle(
              color: SaaptTheme.primary,
              fontSize: 12,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
      ],
    );
  }
}

class _AlertsEmptyState extends StatelessWidget {
  const _AlertsEmptyState({
    required this.icon,
    required this.title,
    required this.message,
  });

  final IconData icon;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return ParentCard(
      padding: const EdgeInsets.fromLTRB(22, 28, 22, 28),
      child: Column(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: const Color(0xFFEAF1FF),
              border: Border.all(color: const Color(0xFFD5E2F8)),
            ),
            child: Icon(icon, color: SaaptTheme.primary, size: 28),
          ),
          const SizedBox(height: 16),
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: SaaptTheme.navy,
              fontSize: 16,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Color(0xFF60708F),
              fontSize: 13.5,
              height: 1.4,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _AlertCard extends StatelessWidget {
  const _AlertCard({required this.display});

  final _AlertDisplay display;

  @override
  Widget build(BuildContext context) {
    final visual = display.visual;
    final previewFacts = display.detailRows.take(3).toList();

    return ParentCard(
      padding: EdgeInsets.zero,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () {
          if (display.targetChildId != null && display.targetTabKey != null) {
            context.go(
              '/profile?childId=${Uri.encodeComponent(display.targetChildId!)}&tab=${Uri.encodeComponent(display.targetTabKey!)}',
            );
            return;
          }
          _showAlertDetails(context, display);
        },
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [visual.soft, Colors.white],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(16),
                ),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(15),
                      border: Border.all(
                        color: visual.accent.withValues(alpha: 0.18),
                      ),
                    ),
                    child: Icon(visual.icon, color: visual.accent, size: 22),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 3,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.9),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(
                                display.kindLabel,
                                style: TextStyle(
                                  color: visual.accent,
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                            const Spacer(),
                            _AlertBadge(
                              style: display.badgeStyle,
                              label: display.badgeLabel,
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          display.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: SaaptTheme.navy,
                            fontSize: 15.5,
                            height: 1.2,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.2,
                          ),
                        ),
                        const SizedBox(height: 5),
                        Text(
                          display.summary,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Color(0xFF60708F),
                            fontSize: 13,
                            height: 1.35,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (previewFacts.isNotEmpty) ...[
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final row in previewFacts)
                          _AlertFactChip(label: row.label, value: row.value),
                      ],
                    ),
                    const SizedBox(height: 12),
                  ],
                  Row(
                    children: [
                      Icon(
                        Icons.schedule_rounded,
                        size: 15,
                        color: visual.accent.withValues(alpha: 0.75),
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          DateFormat('d MMM y · h:mm a').format(display.date),
                          style: const TextStyle(
                            color: Color(0xFF8EA0BA),
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      Text(
                        display.targetTabKey == 'fees' ? 'Pay now' : 'Details',
                        style: TextStyle(
                          color: visual.accent,
                          fontSize: 12.5,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      Icon(
                        Icons.chevron_right_rounded,
                        size: 18,
                        color: visual.accent,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showAlertDetails(BuildContext context, _AlertDisplay display) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (context) => _AlertDetailsSheet(display: display),
    );
  }
}

class _AlertFactChip extends StatelessWidget {
  const _AlertFactChip({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: const Color(0xFFF7FAFF),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5ECF7)),
      ),
      child: Text.rich(
        TextSpan(
          children: [
            TextSpan(
              text: '${label.toUpperCase()}  ',
              style: const TextStyle(
                color: Color(0xFF8EA0BA),
                fontSize: 10,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.3,
              ),
            ),
            TextSpan(
              text: value,
              style: const TextStyle(
                color: SaaptTheme.navy,
                fontSize: 12,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AlertDetailsSheet extends StatelessWidget {
  const _AlertDetailsSheet({required this.display});

  final _AlertDisplay display;

  @override
  Widget build(BuildContext context) {
    final visual = display.visual;
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          4,
          20,
          20 + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              ParentCard(
                padding: EdgeInsets.zero,
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [visual.soft, Colors.white],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 52,
                        height: 52,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: visual.accent.withValues(alpha: 0.18),
                          ),
                        ),
                        child: Icon(visual.icon, color: visual.accent),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    display.kindLabel,
                                    style: TextStyle(
                                      color: visual.accent,
                                      fontSize: 12,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                ),
                                _AlertBadge(
                                  style: display.badgeStyle,
                                  label: display.badgeLabel,
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              display.title,
                              style: const TextStyle(
                                color: SaaptTheme.navy,
                                fontSize: 18,
                                height: 1.2,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              DateFormat('d MMM y, h:mm a').format(display.date),
                              style: const TextStyle(
                                color: Color(0xFF7D8DA8),
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                display.summary,
                style: const TextStyle(
                  color: Color(0xFF586985),
                  fontSize: 14,
                  height: 1.45,
                  fontWeight: FontWeight.w600,
                ),
              ),
              if (display.detailRows.isNotEmpty) ...[
                const SizedBox(height: 18),
                ParentCard(
                  padding: EdgeInsets.zero,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
                        child: Row(
                          children: [
                            Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                color: visual.accent,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 10),
                            const Text(
                              'Details',
                              style: TextStyle(
                                color: SaaptTheme.navy,
                                fontSize: 15,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Divider(
                        height: 1,
                        thickness: 0.7,
                        color: Color(0xFFE6EBF3),
                      ),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(12, 12, 12, 14),
                        child: LayoutBuilder(
                          builder: (context, constraints) {
                            final gap = 8.0;
                            final half = (constraints.maxWidth - gap) / 2;
                            return Wrap(
                              spacing: gap,
                              runSpacing: gap,
                              children: [
                                for (final row in display.detailRows)
                                  SizedBox(
                                    width: row.value.length > 28 ||
                                            display.detailRows.length == 1
                                        ? constraints.maxWidth
                                        : half,
                                    child: Container(
                                      width: double.infinity,
                                      padding: const EdgeInsets.fromLTRB(
                                        12,
                                        10,
                                        12,
                                        10,
                                      ),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFF7FAFF),
                                        borderRadius: BorderRadius.circular(14),
                                        border: Border.all(
                                          color: const Color(0xFFE5ECF7),
                                        ),
                                      ),
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            row.label.toUpperCase(),
                                            style: const TextStyle(
                                              color: Color(0xFF8EA0BA),
                                              fontSize: 10,
                                              letterSpacing: 0.4,
                                              fontWeight: FontWeight.w800,
                                            ),
                                          ),
                                          const SizedBox(height: 5),
                                          Text(
                                            row.value,
                                            style: const TextStyle(
                                              color: SaaptTheme.navy,
                                              fontSize: 14,
                                              height: 1.3,
                                              fontWeight: FontWeight.w800,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                              ],
                            );
                          },
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              if (display.targetChildId != null &&
                  display.targetTabKey != null) ...[
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: () {
                      Navigator.of(context).pop();
                      context.go(
                        '/profile?childId=${Uri.encodeComponent(display.targetChildId!)}&tab=${Uri.encodeComponent(display.targetTabKey!)}',
                      );
                    },
                    icon: const Icon(Icons.payment_rounded),
                    label: const Text('Open fee details'),
                    style: FilledButton.styleFrom(
                      backgroundColor: SaaptTheme.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _AlertBadge extends StatelessWidget {
  const _AlertBadge({required this.style, required this.label});

  final _AlertBadgeStyle style;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minWidth: 64),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: style.background,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: style.border),
      ),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          color: style.foreground,
          fontSize: 11,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

enum _AlertKind { fees, attendance, exam, performance, achievement, info }

class _AlertVisual {
  const _AlertVisual({
    required this.icon,
    required this.accent,
    required this.soft,
  });

  final IconData icon;
  final Color accent;
  final Color soft;
}

class _AlertDisplay {
  const _AlertDisplay({
    required this.kind,
    required this.kindLabel,
    required this.visual,
    required this.title,
    required this.summary,
    required this.date,
    required this.badgeLabel,
    required this.badgeStyle,
    required this.detailRows,
    this.targetChildId,
    this.targetTabKey,
  });

  final _AlertKind kind;
  final String kindLabel;
  final _AlertVisual visual;
  final String title;
  final String summary;
  final DateTime date;
  final String badgeLabel;
  final _AlertBadgeStyle badgeStyle;
  final List<_AlertDetailRow> detailRows;
  final String? targetChildId;
  final String? targetTabKey;

  factory _AlertDisplay.fromNotice(ParentNotice notice) {
    final type = notice.type?.toUpperCase();
    final searchable = '${notice.title} ${notice.summary}'.toLowerCase();
    final isAttendance =
        type == 'ATTENDANCE_ABSENT' ||
        searchable.contains('attendance') ||
        searchable.contains('absent') ||
        searchable.contains('late');
    final isExam =
        type == 'EXAM_CREATED' ||
        type == 'EXAM_PUBLISHED' ||
        searchable.contains('exam');
    final isPerformance =
        searchable.contains('performance') ||
        searchable.contains('report') ||
        searchable.contains('result') ||
        searchable.contains('marks') ||
        searchable.contains('uploaded');
    final isAchievement =
        searchable.contains('achievement') ||
        searchable.contains('secured') ||
        searchable.contains('grade');
    final category = notice.details['category']?.toString().toLowerCase();
    final module = notice.details['module']?.toString().toLowerCase();
    final isFees =
        type == 'FEE_REMINDER' ||
        category == 'fee_reminder' ||
        module == 'fees' ||
        searchable.contains('fee') ||
        searchable.contains('payment');

    if (isFees) {
      final childId = notice.details['childId']?.toString();
      return _AlertDisplay(
        kind: _AlertKind.fees,
        kindLabel: 'Fees',
        visual: const _AlertVisual(
          icon: Icons.receipt_long_outlined,
          accent: Color(0xFF2054E8),
          soft: Color(0xFFEAF1FF),
        ),
        title: notice.title,
        summary: _summaryFor(notice),
        date: notice.date,
        badgeLabel: 'Pay fees',
        badgeStyle: _AlertBadgeStyle.blue,
        detailRows: _detailRowsFor(notice),
        targetChildId: childId?.trim().isEmpty == true ? null : childId,
        targetTabKey: 'fees',
      );
    }

    if (isAttendance) {
      return _AlertDisplay(
        kind: _AlertKind.attendance,
        kindLabel: 'Attendance',
        visual: const _AlertVisual(
          icon: Icons.event_busy_outlined,
          accent: Color(0xFFDC2626),
          soft: Color(0xFFFFEDED),
        ),
        title: notice.title,
        summary: _summaryFor(notice),
        date: notice.date,
        badgeLabel: _relativeDateLabel(notice.date),
        badgeStyle: _AlertBadgeStyle.red,
        detailRows: _detailRowsFor(notice),
      );
    }
    if (isExam) {
      return _AlertDisplay(
        kind: _AlertKind.exam,
        kindLabel: 'Exam',
        visual: const _AlertVisual(
          icon: Icons.assignment_outlined,
          accent: Color(0xFFB45309),
          soft: Color(0xFFFFF4E5),
        ),
        title: notice.title,
        summary: _summaryFor(notice),
        date: notice.date,
        badgeLabel: type == 'EXAM_PUBLISHED' ? 'Published' : 'New',
        badgeStyle: type == 'EXAM_PUBLISHED'
            ? _AlertBadgeStyle.green
            : _AlertBadgeStyle.blue,
        detailRows: _detailRowsFor(notice),
      );
    }
    if (isPerformance) {
      return _AlertDisplay(
        kind: _AlertKind.performance,
        kindLabel: 'Performance',
        visual: const _AlertVisual(
          icon: Icons.insights_outlined,
          accent: Color(0xFF0F766E),
          soft: Color(0xFFE7F7F4),
        ),
        title: notice.title,
        summary: _summaryFor(notice),
        date: notice.date,
        badgeLabel: DateUtils.isSameDay(notice.date, DateTime.now())
            ? 'New'
            : _relativeDateLabel(notice.date),
        badgeStyle: _AlertBadgeStyle.green,
        detailRows: _detailRowsFor(notice),
      );
    }
    if (isAchievement) {
      return _AlertDisplay(
        kind: _AlertKind.achievement,
        kindLabel: 'Achievement',
        visual: const _AlertVisual(
          icon: Icons.emoji_events_outlined,
          accent: Color(0xFF7C3AED),
          soft: Color(0xFFF3E8FF),
        ),
        title: notice.title,
        summary: _summaryFor(notice),
        date: notice.date,
        badgeLabel: 'Success',
        badgeStyle: _AlertBadgeStyle.green,
        detailRows: _detailRowsFor(notice),
      );
    }
    return _AlertDisplay(
      kind: _AlertKind.info,
      kindLabel: 'Update',
      visual: const _AlertVisual(
        icon: Icons.notifications_outlined,
        accent: SaaptTheme.primary,
        soft: Color(0xFFEAF1FF),
      ),
      title: notice.title,
      summary: _summaryFor(notice),
      date: notice.date,
      badgeLabel: 'Info',
      badgeStyle: _AlertBadgeStyle.blue,
      detailRows: _detailRowsFor(notice),
    );
  }

  static String _summaryFor(ParentNotice notice) {
    final summary = notice.summary.trim();
    if (summary.isNotEmpty) return summary;
    return DateFormat('d MMM y, h:mm a').format(notice.date);
  }

  static String _relativeDateLabel(DateTime date) {
    final now = DateTime.now();
    if (DateUtils.isSameDay(date, now)) return 'Today';
    if (DateUtils.isSameDay(date, now.subtract(const Duration(days: 1)))) {
      return 'Yesterday';
    }
    return DateFormat('d MMM').format(date);
  }

  static List<_AlertDetailRow> _detailRowsFor(ParentNotice notice) {
    final details = notice.details;
    final rows = <_AlertDetailRow>[];

    void add(String label, Object? value) {
      final text = value?.toString().trim() ?? '';
      if (text.isNotEmpty) rows.add(_AlertDetailRow(label, text));
    }

    add('Child', details['childName']);
    add(
      'Class',
      [
        details['className']?.toString(),
        details['sectionName']?.toString(),
      ].where((part) => part != null && part.trim().isNotEmpty).join(' '),
    );

    final type = notice.type?.toUpperCase();
    if (type == 'EXAM_CREATED' || type == 'EXAM_PUBLISHED') {
      add('Exam', details['examName']);
      add('Type', details['examType']);
      add('Status', details['examStatus']);
      add('Starts', _formatPayloadDate(details['scheduledAt']));
      add('Result Date', _formatPayloadDate(details['resultPublishAt']));
      add('Subjects', _subjectsLabel(details['subjects']));
    }

    if (type == 'ATTENDANCE_ABSENT') {
      add('Date', _formatPayloadDate(details['attendanceDate']));
      add('Session', details['attendanceUnit']);
      add('Status', details['attendanceStatus']);
      add('Remarks', details['remarks']);
    }

    if ((details['module']?.toString().toLowerCase() == 'fees') ||
        (details['category']?.toString().toLowerCase() == 'fee_reminder') ||
        (type == 'FEE_REMINDER')) {
      add('Due', details['dueAmount']);
      add('Invoice', details['invoiceNumber']);
      add('Invoices', details['invoiceNumbers']);
      add('Count', details['invoiceCount']);
    }

    return rows;
  }

  static String _formatPayloadDate(Object? value) {
    final raw = value?.toString() ?? '';
    if (raw.trim().isEmpty) return '';
    final date = DateTime.tryParse(raw);
    if (date == null) return raw;
    return DateFormat('d MMM y, h:mm a').format(date);
  }

  static String _subjectsLabel(Object? value) {
    if (value is! List) return '';
    final labels = value
        .whereType<Map>()
        .map((subject) {
          final name = subject['name']?.toString() ?? '';
          final date = _formatPayloadDate(subject['date']);
          return date.isEmpty ? name : '$name - $date';
        })
        .where((label) => label.trim().isNotEmpty)
        .toList();
    return labels.join('\n');
  }
}

class _AlertDetailRow {
  const _AlertDetailRow(this.label, this.value);

  final String label;
  final String value;
}

class _AlertBadgeStyle {
  const _AlertBadgeStyle({
    required this.foreground,
    required this.background,
    required this.border,
  });

  final Color foreground;
  final Color background;
  final Color border;

  static const red = _AlertBadgeStyle(
    foreground: Color(0xFFEF4444),
    background: Color(0xFFFFF1F1),
    border: Color(0xFFFFCACA),
  );

  static const green = _AlertBadgeStyle(
    foreground: Color(0xFF08A878),
    background: Color(0xFFEFFDF6),
    border: Color(0xFFBFEFD9),
  );

  static const blue = _AlertBadgeStyle(
    foreground: SaaptTheme.primary,
    background: Color(0xFFF1F6FF),
    border: Color(0xFFD4E2FF),
  );
}
