import 'package:dio/dio.dart';

import '../../../../core/constants/api_endpoints.dart';
import '../models/exam_models.dart';

class ExamRemoteDatasource {
  const ExamRemoteDatasource(this._dio);

  final Dio _dio;

  Future<List<ExamModel>> listExams() async {
    final response = await _dio.get<List<dynamic>>(ApiEndpoints.exams);
    return [
      for (final item in response.data ?? const [])
        if (item is Map) ExamModel.fromJson(_stringMap(item)),
    ];
  }

  Future<ExamModel> getExam(String id) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '${ApiEndpoints.exams}/$id',
    );
    return ExamModel.fromJson(response.data ?? const {});
  }

  Future<List<ExamPaperModel>> listAssignedPapers({
    String? examId,
    String? classId,
    String? sectionId,
    String? subjectId,
  }) async {
    final response = await _dio.get<List<dynamic>>(
      ApiEndpoints.myExamPapers,
      queryParameters: {
        if (_filled(examId)) 'examId': examId,
        if (_filled(classId)) 'classId': classId,
        if (_filled(sectionId)) 'sectionId': sectionId,
        if (_filled(subjectId)) 'subjectId': subjectId,
      },
    );
    return [
      for (final item in response.data ?? const [])
        if (item is Map) ExamPaperModel.fromJson(_stringMap(item)),
    ];
  }

  Future<List<ExamDutyModel>> listInvigilators(String examId) async {
    final response = await _dio.get<List<dynamic>>(
      '${ApiEndpoints.exams}/$examId/invigilators',
    );
    return [
      for (final item in response.data ?? const [])
        if (item is Map) ExamDutyModel.fromJson(_stringMap(item)),
    ];
  }

  Future<String?> getCurrentTeacherProfileId() async {
    final response = await _dio.get<Map<String, dynamic>>(ApiEndpoints.me);
    final teacherProfile = response.data?['teacherProfile'];
    if (teacherProfile is Map) return teacherProfile['id']?.toString();
    return null;
  }

  bool _filled(String? value) => value != null && value.isNotEmpty;

  Map<String, dynamic> _stringMap(Map value) =>
      value.map((key, value) => MapEntry(key.toString(), value));
}
