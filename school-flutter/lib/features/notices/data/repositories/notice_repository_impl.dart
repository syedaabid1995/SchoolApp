import '../../../../core/network/error_handler.dart';
import '../../../../core/storage/hive_cache_service.dart';
import '../../domain/entities/notice.dart';
import '../../domain/repositories/notice_repository.dart';
import '../datasources/notice_remote_datasource.dart';
import '../models/notice_model.dart';

class NoticeRepositoryImpl implements NoticeRepository {
  const NoticeRepositoryImpl({
    required NoticeRemoteDatasource remote,
    required HiveCacheService cache,
  }) : _remote = remote,
       _cache = cache;

  static const _readIdsKey = 'notices.readIds';
  static const _cacheKey = 'notices.items';

  final NoticeRemoteDatasource _remote;
  final HiveCacheService _cache;

  @override
  Future<NoticeBoardState> getNoticeBoard() async {
    try {
      final notices = await _remote.getNotices(readIds: _readIds());
      await _cache.writeCached(
        _cacheKey,
        notices.map((item) => item.toJson()).toList(),
      );
      return NoticeBoardState(notices: notices);
    } catch (error) {
      final cached = _cache.read<List<dynamic>>(_cacheKey);
      if (cached != null) {
        return NoticeBoardState(notices: _fromCache(cached));
      }
      throw ErrorHandler.toFailure(error);
    }
  }

  @override
  Future<void> markRead(String id) async {
    final readIds = _readIds()..add(id);
    await _cache.write(_readIdsKey, readIds.toList());
  }

  Set<String> _readIds() {
    final value = _cache.read<List<dynamic>>(_readIdsKey) ?? const [];
    return value.map((item) => item.toString()).toSet();
  }

  List<Notice> _fromCache(List<dynamic> values) => [
    for (final item in values)
      if (item is Map)
        NoticeModel.fromJson(
          item.map((key, value) => MapEntry(key.toString(), value)),
          isRead:
              item['isRead'] == true ||
              _readIds().contains(item['id']?.toString()),
        ),
  ];
}
