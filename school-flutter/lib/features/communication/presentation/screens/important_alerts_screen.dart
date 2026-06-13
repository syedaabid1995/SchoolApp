import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/widgets/app_scaffold.dart';
import '../../../../core/widgets/async_state_view.dart';
import '../../../notices/presentation/providers/notice_providers.dart';
import 'notice_list.dart';

class ImportantAlertsScreen extends ConsumerWidget {
  const ImportantAlertsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final board = ref.watch(noticeBoardProvider);
    return AppScaffold(
      title: 'Important alerts',
      child: AsyncStateView(
        value: board,
        data: (state) => NoticeList(
          notices: state.notices
              .where(
                (notice) =>
                    notice.category.toLowerCase().contains('alert') ||
                    notice.category.toLowerCase().contains('important'),
              )
              .toList(),
        ),
      ),
    );
  }
}
