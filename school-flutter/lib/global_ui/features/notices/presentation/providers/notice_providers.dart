import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/dio_client.dart';
import '../../../../core/storage/hive_cache_service.dart';
import '../../data/datasources/notice_remote_datasource.dart';
import '../../data/repositories/notice_repository_impl.dart';
import '../../domain/entities/notice.dart';
import '../../domain/repositories/notice_repository.dart';

final noticeRemoteDatasourceProvider = Provider<NoticeRemoteDatasource>((ref) {
  return NoticeRemoteDatasource(ref.watch(dioProvider));
});

final noticeRepositoryProvider = Provider<NoticeRepository>((ref) {
  return NoticeRepositoryImpl(
    remote: ref.watch(noticeRemoteDatasourceProvider),
    cache: ref.watch(hiveCacheServiceProvider),
  );
});

final noticeBoardProvider =
    AsyncNotifierProvider<NoticeBoardController, NoticeBoardState>(
      NoticeBoardController.new,
    );

class NoticeBoardController extends AsyncNotifier<NoticeBoardState> {
  @override
  Future<NoticeBoardState> build() {
    return ref.watch(noticeRepositoryProvider).getNoticeBoard();
  }

  Future<void> markRead(String id) async {
    await ref.read(noticeRepositoryProvider).markRead(id);
    state = await AsyncValue.guard(
      () => ref.read(noticeRepositoryProvider).getNoticeBoard(),
    );
  }
}
