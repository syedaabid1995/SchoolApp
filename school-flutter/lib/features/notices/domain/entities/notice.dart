import 'package:equatable/equatable.dart';

class Notice extends Equatable {
  const Notice({
    required this.id,
    required this.title,
    required this.category,
    required this.isRead,
    this.message,
    this.href,
  });

  final String id;
  final String title;
  final String? message;
  final String category;
  final String? href;
  final bool isRead;

  @override
  List<Object?> get props => [id, title, message, category, href, isRead];
}

class NoticeBoardState extends Equatable {
  const NoticeBoardState({required this.notices});

  final List<Notice> notices;

  int get unreadCount => notices.where((notice) => !notice.isRead).length;
  List<Notice> category(String category) => notices
      .where(
        (notice) => notice.category.toLowerCase() == category.toLowerCase(),
      )
      .toList();

  List<Notice> search(String query) {
    final normalized = query.trim().toLowerCase();
    if (normalized.isEmpty) return notices;
    return notices
        .where(
          (notice) =>
              notice.title.toLowerCase().contains(normalized) ||
              (notice.message ?? '').toLowerCase().contains(normalized) ||
              notice.category.toLowerCase().contains(normalized),
        )
        .toList();
  }

  @override
  List<Object?> get props => [notices];
}
