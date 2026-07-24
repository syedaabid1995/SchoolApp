import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/saapt_theme.dart';
import '../../data/parent_models.dart';
import '../providers/parent_providers.dart';
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
                  data: (children) => _ChildrenContent(children: children),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ChildrenContent extends ConsumerWidget {
  const _ChildrenContent({required this.children});

  final List<ParentChild> children;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (children.isEmpty) {
      return const EmptyPanel(
        message: 'No children are mapped to this parent account.',
      );
    }
    return Column(
      children: [
        for (final child in children) ...[
          _ChildCard(child: child),
          const SizedBox(height: 18),
        ],
        Row(
          children: [
            StatCard(value: children.length.toString(), label: 'Children'),
            const SizedBox(width: 14),
            const StatCard(
              value: 'Active',
              label: 'Status',
              color: SaaptTheme.success,
            ),
          ],
        ),
      ],
    );
  }
}

class _ChildCard extends ConsumerWidget {
  const _ChildCard({required this.child});

  final ParentChild child;

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
              style: const TextStyle(fontSize: 28),
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
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  child.classLabel,
                  style: const TextStyle(
                    color: Color(0xFF586985),
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          OutlinedButton(
            style: OutlinedButton.styleFrom(
              foregroundColor: SaaptTheme.primary,
              backgroundColor: const Color(0xFFF1F6FF),
              side: const BorderSide(color: Color(0xFFD4E2FF)),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(22),
              ),
            ),
            onPressed: () {
              ref.read(selectedChildProvider.notifier).state = child;
              context.go('/attendance');
            },
            child: const Text(
              'Select',
              style: TextStyle(fontWeight: FontWeight.w900),
            ),
          ),
        ],
      ),
    );
  }

  String _avatarFor(String name) {
    final lower = name.toLowerCase();
    return lower.endsWith('a') || lower.contains('ananya') ? '👧' : '👦';
  }
}
