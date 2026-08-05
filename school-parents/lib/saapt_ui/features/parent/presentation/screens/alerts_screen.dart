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
    final childState = ref.watch(effectiveSelectedChildProvider);
    return Scaffold(
      body: childState.when(
        loading: () => const LoadingPanel(),
        error: (error, _) => EmptyPanel(message: error.toString()),
        data: (child) {
          final noticesState = ref.watch(parentNoticesProvider(child));
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(parentNoticesProvider(child)),
            child: ListView(
              padding: EdgeInsets.zero,
              children: [
                ParentHero(
                  badge: '🔔 Notifications',
                  title: 'Alerts Center',
                  subtitle: 'Attendance & performance updates',
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 22, 20, 32),
                  child: noticesState.when(
                    loading: () => const LoadingPanel(),
                    error: (error, _) => EmptyPanel(message: error.toString()),
                    data: (notices) {
                      if (notices.isEmpty) {
                        return const EmptyPanel(
                          message: 'No alerts are available right now.',
                        );
                      }
                      return Column(
                        children: notices
                            .map(
                              (notice) => Padding(
                                padding: const EdgeInsets.only(bottom: 16),
                                child: _AlertCard(
                                  display: _AlertDisplay.fromNotice(notice),
                                ),
                              ),
                            )
                            .toList(),
                      );
                    },
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _AlertCard extends StatelessWidget {
  const _AlertCard({required this.display});

  final _AlertDisplay display;

  @override
  Widget build(BuildContext context) {
    return InkWell(
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
      child: ParentCard(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Container(
              width: 48,
              height: 48,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: const Color(0xFFEAF1FF),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: const Color(0xFFD1E0FF)),
              ),
              child: Text(display.icon, style: const TextStyle(fontSize: 22)),
            ),
            const SizedBox(width: 18),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    display.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: SaaptTheme.navy,
                      fontSize: 17,
                      height: 1.18,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    display.summary,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Color(0xFF586985),
                      fontSize: 14,
                      height: 1.45,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Column(
              children: [
                _AlertBadge(
                  style: display.badgeStyle,
                  label: display.badgeLabel,
                ),
                const SizedBox(height: 10),
                const Icon(
                  Icons.info_outline_rounded,
                  color: Color(0xFF8CA0BF),
                  size: 22,
                ),
              ],
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

class _AlertDetailsSheet extends StatelessWidget {
  const _AlertDetailsSheet({required this.display});

  final _AlertDisplay display;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          22,
          4,
          22,
          22 + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: const Color(0xFFEAF1FF),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: const Color(0xFFD1E0FF)),
                    ),
                    child: Text(
                      display.icon,
                      style: const TextStyle(fontSize: 22),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          display.title,
                          style: const TextStyle(
                            color: SaaptTheme.navy,
                            fontSize: 18,
                            height: 1.15,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          DateFormat('d MMM y, h:mm a').format(display.date),
                          style: const TextStyle(
                            color: Color(0xFF7D8DA8),
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Text(
                display.summary,
                style: const TextStyle(
                  color: Color(0xFF586985),
                  fontSize: 14,
                  height: 1.45,
                  fontWeight: FontWeight.w700,
                ),
              ),
              if (display.detailRows.isNotEmpty) ...[
                const SizedBox(height: 22),
                ParentCard(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: display.detailRows
                        .map(
                          (row) => Padding(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                SizedBox(
                                  width: 112,
                                  child: Text(
                                    row.label,
                                    style: const TextStyle(
                                      color: Color(0xFF91A1BB),
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    row.value,
                                    style: const TextStyle(
                                      color: SaaptTheme.navy,
                                      fontWeight: FontWeight.w800,
                                      height: 1.35,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        )
                        .toList(),
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
      constraints: const BoxConstraints(minWidth: 68),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: style.background,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: style.border),
      ),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          color: style.foreground,
          fontSize: 12,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

class _AlertDisplay {
  const _AlertDisplay({
    required this.icon,
    required this.title,
    required this.summary,
    required this.date,
    required this.badgeLabel,
    required this.badgeStyle,
    required this.detailRows,
    this.targetChildId,
    this.targetTabKey,
  });

  final String icon;
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
        icon: '💳',
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
        icon: '📅',
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
        icon: '📝',
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
        icon: '📊',
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
        icon: '🏆',
        title: notice.title,
        summary: _summaryFor(notice),
        date: notice.date,
        badgeLabel: 'Success',
        badgeStyle: _AlertBadgeStyle.green,
        detailRows: _detailRowsFor(notice),
      );
    }
    return _AlertDisplay(
      icon: '🔔',
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
