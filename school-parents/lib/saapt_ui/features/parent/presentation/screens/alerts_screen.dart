import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/saapt_theme.dart';
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
                  badge: '🔔 Parent Alerts',
                  title: 'Alerts',
                  subtitle: child == null
                      ? 'School notifications'
                      : '${child.name} • ${child.classLabel}',
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
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
                                padding: const EdgeInsets.only(bottom: 14),
                                child: ParentCard(
                                  child: Row(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Container(
                                        width: 52,
                                        height: 52,
                                        alignment: Alignment.center,
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFFFF5DF),
                                          borderRadius: BorderRadius.circular(
                                            18,
                                          ),
                                        ),
                                        child: const Text(
                                          '🔔',
                                          style: TextStyle(fontSize: 26),
                                        ),
                                      ),
                                      const SizedBox(width: 14),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              notice.title,
                                              style: const TextStyle(
                                                color: SaaptTheme.navy,
                                                fontSize: 18,
                                                fontWeight: FontWeight.w900,
                                              ),
                                            ),
                                            const SizedBox(height: 4),
                                            Text(
                                              DateFormat(
                                                'd MMM y, h:mm a',
                                              ).format(notice.date),
                                              style: const TextStyle(
                                                color: SaaptTheme.warning,
                                                fontWeight: FontWeight.w800,
                                              ),
                                            ),
                                            const SizedBox(height: 8),
                                            Text(
                                              notice.summary,
                                              style: const TextStyle(
                                                color: Color(0xFF586985),
                                                height: 1.45,
                                                fontWeight: FontWeight.w600,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
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
