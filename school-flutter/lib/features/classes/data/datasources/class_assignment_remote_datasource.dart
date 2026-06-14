import 'package:dio/dio.dart';

import '../../../../core/constants/api_endpoints.dart';
import '../models/class_assignment_models.dart';

class ClassAssignmentRemoteDatasource {
  const ClassAssignmentRemoteDatasource(this._dio);

  final Dio _dio;

  Future<
    ({
      List<AssignedClassModel> classes,
      List<AssignedSectionModel> sections,
      List<AssignedSubjectModel> subjects,
    })
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
    final subjects = response.data?['subjects'] is List
        ? response.data!['subjects'] as List
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
      subjects: [
        for (final item in subjects)
          if (item is Map<String, dynamic>) AssignedSubjectModel.fromJson(item),
      ],
    );
  }
}
