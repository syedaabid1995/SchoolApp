import '../../domain/entities/notice.dart';

class NoticeModel extends Notice {
  const NoticeModel({
    required super.id,
    required super.title,
    required super.category,
    required super.isRead,
    super.message,
    super.href,
  });

  factory NoticeModel.fromJson(
    Map<String, dynamic> json, {
    required bool isRead,
  }) {
    return NoticeModel(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      message: json['message']?.toString(),
      category:
          json['category']?.toString() ?? json['type']?.toString() ?? 'notice',
      href: json['href']?.toString(),
      isRead: isRead,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'message': message,
    'category': category,
    'href': href,
    'isRead': isRead,
  };
}
