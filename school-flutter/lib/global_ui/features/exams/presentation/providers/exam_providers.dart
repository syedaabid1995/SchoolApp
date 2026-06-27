import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/dio_client.dart';
import '../../../../core/storage/hive_cache_service.dart';
import '../../data/datasources/exam_remote_datasource.dart';
import '../../data/repositories/exam_repository_impl.dart';
import '../../domain/entities/exam.dart';
import '../../domain/repositories/exam_repository.dart';

final examRemoteDatasourceProvider = Provider<ExamRemoteDatasource>((ref) {
  return ExamRemoteDatasource(ref.watch(dioProvider));
});

final examRepositoryProvider = Provider<ExamRepository>((ref) {
  return ExamRepositoryImpl(
    remote: ref.watch(examRemoteDatasourceProvider),
    cache: ref.watch(hiveCacheServiceProvider),
  );
});

final examHomeProvider = FutureProvider.autoDispose<ExamHomeData>((ref) {
  return ref.watch(examRepositoryProvider).getHomeData();
});

final examDetailProvider = FutureProvider.autoDispose.family<Exam, String>((
  ref,
  id,
) {
  return ref.watch(examRepositoryProvider).getExam(id);
});

final assignedExamPapersProvider = FutureProvider.autoDispose<List<ExamPaper>>((
  ref,
) {
  return ref.watch(examRepositoryProvider).listAssignedPapers();
});

final examDutiesProvider = FutureProvider.autoDispose<List<ExamDuty>>((ref) {
  return ref.watch(examRepositoryProvider).listMyDuties();
});
