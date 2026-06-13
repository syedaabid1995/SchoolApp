import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../auth/domain/entities/staff_user.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../data/repositories/profile_repository_impl.dart';
import '../../domain/repositories/profile_repository.dart';

final profileRepositoryProvider = Provider<ProfileRepository>((ref) {
  return ProfileRepositoryImpl(ref.watch(authRepositoryProvider));
});

final profileProvider = FutureProvider.autoDispose<StaffUser>((ref) {
  return ref.watch(profileRepositoryProvider).getProfile();
});
