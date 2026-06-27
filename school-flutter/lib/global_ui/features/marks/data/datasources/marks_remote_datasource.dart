import 'package:dio/dio.dart';

import '../../../../core/constants/api_endpoints.dart';
import '../../../exams/data/models/exam_models.dart';
import '../../domain/entities/marks.dart';
import '../models/marks_models.dart';

class MarksRemoteDatasource {
  const MarksRemoteDatasource(this._dio);

  final Dio _dio;

  Future<List<ExamPaperModel>> listTasks({
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

  Future<List<AssignedStudentModel>> listStudents({
    String? classId,
    String? sectionId,
  }) async {
    final response = await _dio.get<List<dynamic>>(
      ApiEndpoints.assignedStudents,
      queryParameters: {
        if (_filled(classId)) 'classId': classId,
        if (_filled(sectionId)) 'sectionId': sectionId,
      },
    );
    return [
      for (final item in response.data ?? const [])
        if (item is Map) AssignedStudentModel.fromJson(_stringMap(item)),
    ];
  }

  Future<List<MarkRecordModel>> listMarks(String examPaperId) async {
    final response = await _dio.get<List<dynamic>>(
      ApiEndpoints.examMarks,
      queryParameters: {'examPaperId': examPaperId},
    );
    return [
      for (final item in response.data ?? const [])
        if (item is Map) MarkRecordModel.fromJson(_stringMap(item)),
    ];
  }

  Future<MarksUploadResultModel> submitMarks(MarksDraft draft) async {
    final response = await _dio.post<Map<String, dynamic>>(
      ApiEndpoints.uploadMarks,
      data: marksDraftPayload(draft),
    );
    return MarksUploadResultModel.fromJson(response.data ?? const {});
  }

  bool _filled(String? value) => value != null && value.isNotEmpty;

  Map<String, dynamic> _stringMap(Map value) =>
      value.map((key, value) => MapEntry(key.toString(), value));
}
