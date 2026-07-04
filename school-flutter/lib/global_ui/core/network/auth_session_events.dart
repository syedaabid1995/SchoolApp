import 'package:flutter_riverpod/flutter_riverpod.dart';

final authSessionExpiredProvider =
    NotifierProvider<AuthSessionExpiredNotifier, int>(
      AuthSessionExpiredNotifier.new,
    );

class AuthSessionExpiredNotifier extends Notifier<int> {
  @override
  int build() => 0;

  void notify() => state += 1;
}
