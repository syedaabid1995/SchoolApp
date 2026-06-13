import 'package:dio/dio.dart';

import '../../../../core/constants/api_endpoints.dart';
import '../models/class_assignment_models.dart';

class ClassAssignmentRemoteDatasource {
  const ClassAssignmentRemoteDatasource(this._dio);

  final Dio _dio;

  Future<
    ({List<AssignedClassModel> classes, List<AssignedSectionModel> sections})
  >
  getAssignedClasses() async {
    final response = await _dio.get<Map<String, dynamic>>(
      ApiEndpoints.assignedClasses,
    );
    final classes = response.data?['classes'] is List
        ? response.data!['classes'] as List
        : const [];
    final sections = response.data?['sections'] is List
        ? response.data!['sections'] as List
        : const [];
    return (
      classes: [
        for (final item in classes)
          if (item is Map<String, dynamic>) AssignedClassModel.fromJson(item),
      ],
      sections: [
        for (final item in sections)
          if (item is Map<String, dynamic>) AssignedSectionModel.fromJson(item),
      ],
    );
  }

  Future<List<AssignedSubjectModel>> getAssignedSubjectsFromMe() async {
    final response = await _dio.get<Map<String, dynamic>>(ApiEndpoints.me);
    final profile = response.data?['teacherProfile'] is Map<String, dynamic>
        ? response.data!['teacherProfile'] as Map<String, dynamic>
        : const <String, dynamic>{};
    final assignments = profile['subjectAssignments'] is List
        ? profile['subjectAssignments'] as List
        : const [];
    return [
      for (final item in assignments)
        if (item is Map<String, dynamic>) AssignedSubjectModel.fromJson(item),
    ];
  }
}
