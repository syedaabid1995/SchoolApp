import 'package:dio/dio.dart';
import 'package:intl/intl.dart';

import '../../../../core/constants/api_endpoints.dart';
import '../../domain/entities/homework.dart';
import '../models/homework_model.dart';

class HomeworkRemoteDatasource {
  const HomeworkRemoteDatasource(this._dio);

  final Dio _dio;

  Future<List<HomeworkModel>> list({String? classId, String? sectionId}) async {
    final response = await _dio.get<List<dynamic>>(
      ApiEndpoints.homework,
      queryParameters: {
        if (classId != null && classId.isNotEmpty) 'classId': classId,
        if (sectionId != null && sectionId.isNotEmpty) 'sectionId': sectionId,
      },
    );
    return [
      for (final item in response.data ?? const [])
        if (item is Map<String, dynamic>) HomeworkModel.fromJson(item),
    ];
  }

  Future<HomeworkModel> create(HomeworkDraft draft) async {
    final response = await _dio.post<Map<String, dynamic>>(
      ApiEndpoints.homework,
      data: _payload(draft),
    );
    return HomeworkModel.fromJson(response.data ?? const {});
  }

  Future<HomeworkModel> update(String id, HomeworkDraft draft) async {
    final response = await _dio.patch<Map<String, dynamic>>(
      '${ApiEndpoints.homework}/$id',
      data: _payload(draft),
    );
    return HomeworkModel.fromJson(response.data ?? const {});
  }

  Future<void> delete(String id) async {
    await _dio.delete('${ApiEndpoints.homework}/$id');
  }

  Map<String, dynamic> _payload(HomeworkDraft draft) => {
    'classId': draft.classId,
    'sectionId': draft.sectionId,
    'subjectId': draft.subjectId,
    'homeworkDate': DateFormat('yyyy-MM-dd').format(draft.homeworkDate),
    'submissionDate': DateFormat('yyyy-MM-dd').format(draft.submissionDate),
    'marks': draft.marks,
    'description': draft.description,
  };
}
