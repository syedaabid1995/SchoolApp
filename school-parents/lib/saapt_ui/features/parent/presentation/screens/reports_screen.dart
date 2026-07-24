import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/saapt_theme.dart';
import '../providers/parent_providers.dart';
import 'parent_screen_widgets.dart';

class SaaptReportsScreen extends ConsumerWidget {
  const SaaptReportsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final childState = ref.watch(effectiveSelectedChildProvider);
    return Scaffold(
      body: childState.when(
        loading: () => const LoadingPanel(),
        error: (error, _) => EmptyPanel(message: error.toString()),
        data: (child) {
          final resultsState = child == null
              ? null
              : ref.watch(parentResultsProvider(child));
          final feesState = child == null
              ? null
              : ref.watch(parentFeeSummaryProvider(child));
          return RefreshIndicator(
            onRefresh: () async {
              if (child != null) {
                ref.invalidate(parentResultsProvider(child));
                ref.invalidate(parentFeeSummaryProvider(child));
              }
            },
            child: ListView(
              padding: EdgeInsets.zero,
              children: [
                ParentHero(
                  badge: '📊 Parent Reports',
                  title: child?.name ?? 'Reports',
                  subtitle: child?.classLabel ?? 'Select a child from Home',
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
                  child: child == null
                      ? const EmptyPanel(
                          message: 'Select a child from Home to view reports.',
                        )
                      : Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            feesState!.when(
                              loading: () => const LoadingPanel(),
                              error: (error, _) =>
                                  EmptyPanel(message: error.toString()),
                              data: (fees) => Row(
                                children: [
                                  StatCard(
                                    value: '₹${fees.total.round()}',
                                    label: 'Total',
                                  ),
                                  const SizedBox(width: 12),
                                  StatCard(
                                    value: '₹${fees.paid.round()}',
                                    label: 'Paid',
                                    color: SaaptTheme.success,
                                  ),
                                  const SizedBox(width: 12),
                                  StatCard(
                                    value: '₹${fees.due.round()}',
                                    label: 'Due',
                                    color: SaaptTheme.warning,
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 26),
                            const Text(
                              'Exam Results',
                              style: TextStyle(
                                color: SaaptTheme.navy,
                                fontSize: 23,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            const SizedBox(height: 14),
                            resultsState!.when(
                              loading: () => const LoadingPanel(),
                              error: (error, _) =>
                                  EmptyPanel(message: error.toString()),
                              data: (results) {
                                if (results.isEmpty) {
                                  return const EmptyPanel(
                                    message:
                                        'No published reports are available yet.',
                                  );
                                }
                                return Column(
                                  children: results
                                      .map(
                                        (result) => Padding(
                                          padding: const EdgeInsets.only(
                                            bottom: 14,
                                          ),
                                          child: ParentCard(
                                            child: Row(
                                              children: [
                                                const Icon(
                                                  Icons.assignment_rounded,
                                                  color: SaaptTheme.primary,
                                                  size: 34,
                                                ),
                                                const SizedBox(width: 16),
                                                Expanded(
                                                  child: Column(
                                                    crossAxisAlignment:
                                                        CrossAxisAlignment
                                                            .start,
                                                    children: [
                                                      Text(
                                                        result.examName,
                                                        style: const TextStyle(
                                                          color:
                                                              SaaptTheme.navy,
                                                          fontSize: 18,
                                                          fontWeight:
                                                              FontWeight.w900,
                                                        ),
                                                      ),
                                                      const SizedBox(height: 4),
                                                      Text(
                                                        '${result.totalMarks}/${result.totalMaxMarks} marks',
                                                        style: const TextStyle(
                                                          color: Color(
                                                            0xFF586985,
                                                          ),
                                                          fontWeight:
                                                              FontWeight.w700,
                                                        ),
                                                      ),
                                                    ],
                                                  ),
                                                ),
                                                Text(
                                                  result.percentage == null
                                                      ? result.resultStatus ??
                                                            '-'
                                                      : '${result.percentage}%',
                                                  style: const TextStyle(
                                                    color: SaaptTheme.success,
                                                    fontSize: 22,
                                                    fontWeight: FontWeight.w900,
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
                          ],
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
