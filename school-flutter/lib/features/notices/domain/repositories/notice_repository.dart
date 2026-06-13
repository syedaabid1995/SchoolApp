import '../entities/notice.dart';

abstract class NoticeRepository {
  Future<NoticeBoardState> getNoticeBoard();
  Future<void> markRead(String id);
}
