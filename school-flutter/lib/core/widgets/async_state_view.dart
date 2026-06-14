import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../errors/app_error_mapper.dart';
import 'shimmer_box.dart';

class AsyncStateView<T> extends StatelessWidget {
  const AsyncStateView({
    required this.value,
    required this.data,
    this.retry,
    this.shimmerItemCount = 5,
    super.key,
  });

  final AsyncValue<T> value;
  final Widget Function(T data) data;
  final VoidCallback? retry;
  final int shimmerItemCount;

  @override
  Widget build(BuildContext context) {
    return value.when(
      data: data,
      loading: () => ShimmerList(itemCount: shimmerItemCount),
      error: (error, stackTrace) {
        final mapped = AppErrorMapper.map(error);
        return Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(mapped.message, textAlign: TextAlign.center),
              if (mapped.canRetry && retry != null) ...[
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: retry,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Try again'),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}
