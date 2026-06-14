import '../../../../core/network/error_handler.dart';
import '../../../../core/storage/hive_cache_service.dart';
import '../../domain/entities/class_assignment.dart';
import '../../domain/repositories/class_assignment_repository.dart';
import '../datasources/class_assignment_remote_datasource.dart';
import '../models/class_assignment_models.dart';

class ClassAssignmentRepositoryImpl implements ClassAssignmentRepository {
  const ClassAssignmentRepositoryImpl({
    required ClassAssignmentRemoteDatasource remote,
    required HiveCacheService cache,
  }) : _remote = remote,
       _cache = cache;

  static const _cacheKey = 'classes.assignments';

  final ClassAssignmentRemoteDatasource _remote;
  final HiveCacheService _cache;

  @override
  Future<ClassAssignments> getAssignments() async {
    try {
      final assigned = await _remote.getAssignedClasses();
      final data = ClassAssignments(
        classes: assigned.classes,
        sections: assigned.sections,
        subjects: assigned.subjects,
      );
      await _cache.write(_cacheKey, {
        'classes': assigned.classes.map((item) => item.toJson()).toList(),
        'sections': assigned.sections.map((item) => item.toJson()).toList(),
        'subjects': assigned.subjects.map((item) => item.toJson()).toList(),
      });
      return data;
    } catch (error) {
      final cached = _cache.read<Map<dynamic, dynamic>>(_cacheKey);
      if (cached != null) return _fromCache(cached);
      throw ErrorHandler.toFailure(error);
    }
  }

  ClassAssignments _fromCache(Map<dynamic, dynamic> json) {
    final data = json.map((key, value) => MapEntry(key.toString(), value));
    final classes = data['classes'] is List
        ? data['classes'] as List
        : const [];
    final sections = data['sections'] is List
        ? data['sections'] as List
        : const [];
    final subjects = data['subjects'] is List
        ? data['subjects'] as List
        : const [];
    return ClassAssignments(
      classes: [
        for (final item in classes)
          if (item is Map)
            AssignedClassModel.fromJson(
              item.map((key, value) => MapEntry(key.toString(), value)),
            ),
      ],
      sections: [
        for (final item in sections)
          if (item is Map)
            AssignedSectionModel.fromJson(
              item.map((key, value) => MapEntry(key.toString(), value)),
            ),
      ],
      subjects: [
        for (final item in subjects)
          if (item is Map)
            AssignedSubjectModel.fromJson(
              item.map((key, value) => MapEntry(key.toString(), value)),
            ),
      ],
    );
  }
}
