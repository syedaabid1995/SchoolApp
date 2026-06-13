import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/dio_client.dart';
import '../../../../core/storage/hive_cache_service.dart';
import '../../data/datasources/class_assignment_remote_datasource.dart';
import '../../data/repositories/class_assignment_repository_impl.dart';
import '../../domain/entities/class_assignment.dart';
import '../../domain/repositories/class_assignment_repository.dart';

final classAssignmentRemoteDatasourceProvider =
    Provider<ClassAssignmentRemoteDatasource>((ref) {
      return ClassAssignmentRemoteDatasource(ref.watch(dioProvider));
    });

final classAssignmentRepositoryProvider = Provider<ClassAssignmentRepository>((
  ref,
) {
  return ClassAssignmentRepositoryImpl(
    remote: ref.watch(classAssignmentRemoteDatasourceProvider),
    cache: ref.watch(hiveCacheServiceProvider),
  );
});

final classAssignmentsProvider = FutureProvider.autoDispose<ClassAssignments>((
  ref,
) {
  return ref.watch(classAssignmentRepositoryProvider).getAssignments();
});
