import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../app/theme/saapt_theme.dart';
import '../../../../core/network/parent_api_client.dart';
import '../../data/parent_models.dart';
import '../providers/parent_providers.dart';
import 'parent_screen_widgets.dart';

class ParentHomeworkScreen extends ConsumerStatefulWidget {
  const ParentHomeworkScreen({super.key});

  @override
  ConsumerState<ParentHomeworkScreen> createState() =>
      _ParentHomeworkScreenState();
}

class _ParentHomeworkScreenState extends ConsumerState<ParentHomeworkScreen> {
  DateTime _selectedDate = DateTime.now();

  @override
  Widget build(BuildContext context) {
    final selectedChild = ref.watch(effectiveSelectedChildProvider);

    return selectedChild.when(
      loading: () => const LoadingPanel(),
      error: (error, _) => EmptyPanel(message: parentApiError(error)),
      data: (child) {
        if (child == null) {
          return const EmptyPanel(
            message: 'Select a child from Home to view homework.',
          );
        }

        final homeworkState = ref.watch(
          parentHomeworksProvider((child: child, date: _selectedDate)),
        );

        return RefreshIndicator(
          color: SaaptTheme.primary,
          onRefresh: () async {
            ref.invalidate(
              parentHomeworksProvider((child: child, date: _selectedDate)),
            );
            await ref.read(
              parentHomeworksProvider((
                child: child,
                date: _selectedDate,
              )).future,
            );
          },
          child: ListView(
            padding: EdgeInsets.zero,
            children: [
              ParentHero(
                showMenu: true,
                showChildSwitcher: true,
                badge: '📚 Homework',
                title: child.name,
                subtitle:
                    '${child.classLabel} • View assigned homework by date',
              ),
              Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _DateSelector(
                      date: _selectedDate,
                      onChanged: (date) => setState(() {
                        _selectedDate = DateTime(
                          date.year,
                          date.month,
                          date.day,
                        );
                      }),
                    ),
                    const SizedBox(height: 16),
                    homeworkState.when(
                      loading: () => const LoadingPanel(),
                      error: (error, _) => EmptyPanel(
                        message: parentApiError(
                          error,
                          'Unable to load homework',
                        ),
                      ),
                      data: (items) =>
                          _HomeworkList(items: items, date: _selectedDate),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _DateSelector extends StatelessWidget {
  const _DateSelector({required this.date, required this.onChanged});

  final DateTime date;
  final ValueChanged<DateTime> onChanged;

  @override
  Widget build(BuildContext context) {
    return ParentCard(
      child: Row(
        children: [
          IconButton(
            tooltip: 'Previous day',
            icon: const Icon(Icons.chevron_left_rounded),
            onPressed: () => onChanged(date.subtract(const Duration(days: 1))),
          ),
          Expanded(
            child: InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate: date,
                  firstDate: DateTime.now().subtract(const Duration(days: 365)),
                  lastDate: DateTime.now().add(const Duration(days: 365)),
                );
                if (picked != null) onChanged(picked);
              },
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 10),
                child: Column(
                  children: [
                    Text(
                      DateFormat.EEEE().format(date),
                      style: const TextStyle(
                        color: Color(0xFF61718D),
                        fontWeight: FontWeight.w800,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      DateFormat.yMMMd().format(date),
                      style: const TextStyle(
                        color: SaaptTheme.navy,
                        fontWeight: FontWeight.w900,
                        fontSize: 18,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          IconButton(
            tooltip: 'Next day',
            icon: const Icon(Icons.chevron_right_rounded),
            onPressed: () => onChanged(date.add(const Duration(days: 1))),
          ),
        ],
      ),
    );
  }
}

class _HomeworkList extends StatelessWidget {
  const _HomeworkList({required this.items, required this.date});

  final List<ParentHomework> items;
  final DateTime date;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return EmptyPanel(
        message: 'No homework assigned on ${DateFormat.yMMMd().format(date)}.',
      );
    }

    return Column(
      children: [
        for (final item in items) ...[
          _HomeworkCard(homework: item),
          const SizedBox(height: 14),
        ],
      ],
    );
  }
}

class _HomeworkCard extends StatelessWidget {
  const _HomeworkCard({required this.homework});

  final ParentHomework homework;

  @override
  Widget build(BuildContext context) {
    final dueToday = _sameDate(homework.submissionDate, DateTime.now());
    final overdue = homework.submissionDate.isBefore(
      DateTime(DateTime.now().year, DateTime.now().month, DateTime.now().day),
    );
    final statusColor = overdue
        ? const Color(0xFFE5484D)
        : dueToday
        ? SaaptTheme.warning
        : SaaptTheme.success;

    return ParentCard(
      padding: const EdgeInsets.all(0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              color: Color(0xFFF5F8FF),
              borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
            ),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: SaaptTheme.primary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.menu_book_rounded,
                    color: SaaptTheme.primary,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        homework.subjectName ?? 'Homework',
                        style: const TextStyle(
                          color: SaaptTheme.navy,
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${homework.className ?? ''} ${homework.sectionName ?? ''}'
                            .trim(),
                        style: const TextStyle(
                          color: Color(0xFF61718D),
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
                _Badge(
                  label: overdue
                      ? 'Overdue'
                      : dueToday
                      ? 'Due today'
                      : 'Open',
                  color: statusColor,
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: _MetaTile(
                        label: 'Assigned',
                        value: DateFormat.MMMd().format(homework.homeworkDate),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _MetaTile(
                        label: 'Due',
                        value: DateFormat.MMMd().format(
                          homework.submissionDate,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _MetaTile(
                        label: 'Marks',
                        value: homework.marks.toString(),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Text(
                  homework.description,
                  style: const TextStyle(
                    color: Color(0xFF39475F),
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    height: 1.45,
                  ),
                ),
                if (homework.hasAttachment) ...[
                  const SizedBox(height: 14),
                  OutlinedButton.icon(
                    icon: const Icon(Icons.attach_file_rounded),
                    label: Text(homework.attachmentName ?? 'Open attachment'),
                    onPressed: () => launchUrl(
                      Uri.parse(homework.attachmentUrl!),
                      mode: LaunchMode.externalApplication,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MetaTile extends StatelessWidget {
  const _MetaTile({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFF7F9FE),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE1E8F5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              color: Color(0xFF7A89A3),
              fontSize: 11,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: SaaptTheme.navy,
              fontSize: 14,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

bool _sameDate(DateTime a, DateTime b) =>
    a.year == b.year && a.month == b.month && a.day == b.day;
