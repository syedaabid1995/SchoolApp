import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../attendance/presentation/providers/attendance_providers.dart';
import '../../../classes/domain/entities/class_assignment.dart';
import '../../../classes/presentation/providers/class_assignment_providers.dart';
import '../../../exams/presentation/providers/exam_providers.dart';
import '../../../homework/presentation/providers/homework_providers.dart';
import '../../../marks/presentation/providers/marks_providers.dart';
import '../../data/repositories/academic_repository_impl.dart';
import '../../domain/entities/academic_overview.dart';
import '../../domain/repositories/academic_repository.dart';

final academicRepositoryProvider = Provider<AcademicRepository>((ref) {
  return AcademicRepositoryImpl(
    classAssignmentRepository: ref.watch(classAssignmentRepositoryProvider),
    homeworkRepository: ref.watch(homeworkRepositoryProvider),
    examRepository: ref.watch(examRepositoryProvider),
    marksRepository: ref.watch(marksRepositoryProvider),
    attendanceRepository: ref.watch(attendanceRepositoryProvider),
  );
});

final classAcademicOverviewProvider = FutureProvider.autoDispose
    .family<ClassAcademicOverview, AssignedClass>((ref, assignedClass) {
      return ref
          .watch(academicRepositoryProvider)
          .getClassOverview(assignedClass);
    });
