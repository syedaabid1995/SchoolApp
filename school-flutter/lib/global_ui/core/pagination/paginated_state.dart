import 'package:equatable/equatable.dart';

class PaginatedState<T> extends Equatable {
  const PaginatedState({
    required this.items,
    required this.page,
    this.pageSize = 20,
    required this.hasMore,
    this.isLoading = false,
  });

  const PaginatedState.initial({this.pageSize = 20})
    : items = const [],
      page = 1,
      hasMore = true,
      isLoading = false;

  final List<T> items;
  final int page;
  final int pageSize;
  final bool hasMore;
  final bool isLoading;

  PaginatedState<T> append(List<T> nextItems) {
    return PaginatedState(
      items: [...items, ...nextItems],
      page: page + 1,
      pageSize: pageSize,
      hasMore: nextItems.length >= pageSize,
    );
  }

  PaginatedState<T> loading() {
    return PaginatedState(
      items: items,
      page: page,
      pageSize: pageSize,
      hasMore: hasMore,
      isLoading: true,
    );
  }

  @override
  List<Object?> get props => [items, page, pageSize, hasMore, isLoading];
}
