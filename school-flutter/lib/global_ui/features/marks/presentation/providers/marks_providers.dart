import 'package:equatable/equatable.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/dio_client.dart';
import '../../../../core/storage/hive_cache_service.dart';
import '../../../../core/sync/mutation_queue_service.dart';
import '../../../../core/sync/sync_manager.dart';
import '../../../exams/domain/entities/exam.dart';
import '../../data/datasources/marks_remote_datasource.dart';
import '../../data/repositories/marks_repository_impl.dart';
import '../../domain/entities/marks.dart';
import '../../domain/repositories/marks_repository.dart';

class MarksTaskFilter extends Equatable {
  const MarksTaskFilter({
    this.examId,
    this.classId,
    this.sectionId,
    this.subjectId,
  });

  final String? examId;
  final String? classId;
  final String? sectionId;
  final String? subjectId;

  @override
  List<Object?> get props => [examId, classId, sectionId, subjectId];
}

class StudentFilter extends Equatable {
  const StudentFilter({this.classId, this.sectionId});

  final String? classId;
  final String? sectionId;

  @override
  List<Object?> get props => [classId, sectionId];
}

final marksRemoteDatasourceProvider = Provider<MarksRemoteDatasource>((ref) {
  return MarksRemoteDatasource(ref.watch(dioProvider));
});

final marksRepositoryProvider = Provider<MarksRepository>((ref) {
  return MarksRepositoryImpl(
    remote: ref.watch(marksRemoteDatasourceProvider),
    cache: ref.watch(hiveCacheServiceProvider),
    mutationQueue: ref.watch(mutationQueueServiceProvider),
  );
});

final marksTasksProvider = FutureProvider.autoDispose
    .family<List<ExamPaper>, MarksTaskFilter>((ref, filter) {
      return ref
          .watch(marksRepositoryProvider)
          .listTasks(
            examId: filter.examId,
            classId: filter.classId,
            sectionId: filter.sectionId,
            subjectId: filter.subjectId,
          );
    });

final assignedStudentsForMarksProvider = FutureProvider.autoDispose
    .family<List<AssignedStudent>, StudentFilter>((ref, filter) {
      return ref
          .watch(marksRepositoryProvider)
          .listStudents(classId: filter.classId, sectionId: filter.sectionId);
    });

final marksRecordsProvider = FutureProvider.autoDispose
    .family<List<MarkRecord>, String>((ref, examPaperId) {
      return ref.watch(marksRepositoryProvider).listMarks(examPaperId);
    });

final marksSummaryProvider = FutureProvider.autoDispose
    .family<MarksSummary, ExamPaper>((ref, paper) {
      return ref.watch(marksRepositoryProvider).getSummary(paper);
    });

final marksSubmissionProvider =
    AsyncNotifierProvider<MarksSubmissionController, MarksUploadResult?>(
      MarksSubmissionController.new,
    );

class MarksSubmissionController extends AsyncNotifier<MarksUploadResult?> {
  @override
  Future<MarksUploadResult?> build() async => null;

  Future<void> submit(MarksDraft draft) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(marksRepositoryProvider).submitMarks(draft),
    );
    try {
      await ref.read(syncManagerProvider.notifier).refreshPendingCount();
    } catch (_) {
      // Pending badges are best-effort and must not fail marks submission.
    }
  }
}
