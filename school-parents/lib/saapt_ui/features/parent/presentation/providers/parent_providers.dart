import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';

import '../../../../core/network/parent_api_client.dart';
import '../../../../core/notifications/parent_notification_service.dart';
import '../../../../core/storage/parent_token_storage.dart';
import '../../data/parent_models.dart';
import '../../data/parent_repository.dart';

final parentRepositoryProvider = Provider<ParentRepository>((ref) {
  return ParentRepository(
    dio: ref.watch(parentDioProvider),
    tokenStorage: ref.watch(parentTokenStorageProvider),
  );
});

final parentAuthControllerProvider =
    AsyncNotifierProvider<ParentAuthController, ParentSession>(
      ParentAuthController.new,
    );

class ParentAuthController extends AsyncNotifier<ParentSession> {
  @override
  Future<ParentSession> build() async {
    final session = await ref.watch(parentRepositoryProvider).restoreSession();
    _syncPush(session);
    return session;
  }

  Future<void> login({required String email, required String password}) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref
          .read(parentRepositoryProvider)
          .login(email: email, password: password),
    );
    _syncPush(state.value);
  }

  Future<void> verifyMfa({
    required String challengeId,
    required String code,
  }) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref
          .read(parentRepositoryProvider)
          .verifyMfa(challengeId: challengeId, code: code),
    );
    _syncPush(state.value);
  }

  Future<void> logout() async {
    state = const AsyncLoading();
    await ref.read(parentRepositoryProvider).logout();
    ref.invalidate(parentProfileProvider);
    ref.invalidate(parentPushPreferenceProvider);
    ref.invalidate(parentChildrenProvider);
    ref.invalidate(selectedChildIdProvider);
    state = const AsyncData(ParentSession.unauthenticated());
  }

  void _syncPush(ParentSession? session) {
    if (session?.isAuthenticated ?? false) {
      unawaited(ref.read(parentNotificationServiceProvider).syncDeviceToken());
    }
  }
}

final parentProfileProvider = FutureProvider.autoDispose<ParentProfile>((ref) {
  return ref.watch(parentRepositoryProvider).getProfile();
});

final parentPushPreferenceProvider = FutureProvider.autoDispose<bool>((ref) {
  return ref.watch(parentRepositoryProvider).getPushEnabled();
});

final parentChildrenProvider = FutureProvider.autoDispose<List<ParentChild>>((
  ref,
) {
  return ref.watch(parentRepositoryProvider).getChildren();
});

final parentChildDetailProvider = FutureProvider.autoDispose
    .family<ParentChildDetail, String>((ref, childId) {
      return ref
          .watch(parentRepositoryProvider)
          .getChildDetail(childId: childId);
    });

final selectedChildIdProvider = StateProvider<String?>((ref) => null);

final effectiveSelectedChildProvider = Provider<AsyncValue<ParentChild?>>((
  ref,
) {
  final selectedChildId = ref.watch(selectedChildIdProvider);
  final children = ref.watch(parentChildrenProvider);
  return children.whenData((items) {
    if (items.isEmpty) return null;
    if (selectedChildId == null || selectedChildId.isEmpty) {
      return items.first;
    }
    for (final child in items) {
      if (child.id == selectedChildId) return child;
    }
    return items.first;
  });
});

final parentAttendanceProvider = FutureProvider.autoDispose
    .family<ParentAttendance, ParentChild>((ref, child) {
      return ref
          .watch(parentRepositoryProvider)
          .getAttendance(childId: child.id, month: DateTime.now());
    });

typedef ParentAttendanceReportQuery = ({
  String childId,
  DateTime month,
  DateTime date,
});

final parentMonthlyAttendanceProvider = FutureProvider.autoDispose
    .family<ParentAttendance, ParentAttendanceReportQuery>((ref, query) {
      final month = DateTime(query.month.year, query.month.month);
      final date = DateTime(query.date.year, query.date.month, query.date.day);
      return ref
          .watch(parentRepositoryProvider)
          .getAttendance(childId: query.childId, month: month, date: date);
    });

final parentResultsProvider = FutureProvider.autoDispose
    .family<List<ParentResult>, ParentChild>((ref, child) {
      return ref.watch(parentRepositoryProvider).getResults(childId: child.id);
    });

final parentFeeSummaryProvider = FutureProvider.autoDispose
    .family<ParentFeeSummary, ParentChild>((ref, child) {
      return ref
          .watch(parentRepositoryProvider)
          .getFeeSummary(childId: child.id);
    });

final parentFeeBreakdownProvider = FutureProvider.autoDispose
    .family<ParentFeeBreakdown, String>((ref, childId) {
      return ref
          .watch(parentRepositoryProvider)
          .getFeeBreakdown(childId: childId);
    });

final parentNoticesProvider = FutureProvider.autoDispose
    .family<List<ParentNotice>, ParentChild?>((ref, child) {
      return ref.watch(parentRepositoryProvider).getNotices(childId: child?.id);
    });

typedef ParentHomeworkQuery = ({ParentChild child, DateTime date});

final parentHomeworksProvider = FutureProvider.autoDispose
    .family<List<ParentHomework>, ParentHomeworkQuery>((ref, query) {
      final date = DateTime(query.date.year, query.date.month, query.date.day);
      return ref
          .watch(parentRepositoryProvider)
          .getHomeworks(childId: query.child.id, date: date);
    });

final parentLeaveCenterProvider = FutureProvider.autoDispose
    .family<ParentLeaveCenter, ParentChild?>((ref, child) {
      return ref
          .watch(parentRepositoryProvider)
          .getLeaveRequests(childId: child?.id);
    });
