import 'package:dio/dio.dart';
import 'package:intl/intl.dart';

import '../../../../core/constants/api_endpoints.dart';
import '../../domain/entities/homework.dart';
import '../models/homework_model.dart';

class HomeworkRemoteDatasource {
  const HomeworkRemoteDatasource(this._dio);

  final Dio _dio;

  Future<List<HomeworkModel>> list({
    String? classId,
    String? sectionId,
    String? subjectId,
    DateTime? homeworkDate,
  }) async {
    final response = await _dio.get<List<dynamic>>(
      ApiEndpoints.homework,
      queryParameters: {
        if (classId != null && classId.isNotEmpty) 'classId': classId,
        if (sectionId != null && sectionId.isNotEmpty) 'sectionId': sectionId,
        if (subjectId != null && subjectId.isNotEmpty) 'subjectId': subjectId,
        if (homeworkDate != null)
          'homeworkDate': DateFormat('yyyy-MM-dd').format(homeworkDate),
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

  Future<HomeworkAttachmentModel> uploadAttachment({
    required String path,
    required String filename,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '${ApiEndpoints.homework}/attachments',
      data: FormData.fromMap({
        'file': await MultipartFile.fromFile(path, filename: filename),
      }),
      options: Options(contentType: 'multipart/form-data'),
    );
    return HomeworkAttachmentModel.fromJson(response.data ?? const {});
  }

  Future<HomeworkEvaluationDetailModel> getEvaluation(String id) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '${ApiEndpoints.homework}/$id/evaluations',
    );
    return HomeworkEvaluationDetailModel.fromJson(response.data ?? const {});
  }

  Future<HomeworkEvaluationDetailModel> saveEvaluation({
    required String id,
    required DateTime evaluationDate,
    required List<HomeworkEvaluationDraftRow> evaluations,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '${ApiEndpoints.homework}/$id/evaluations',
      data: {
        'evaluationDate': DateFormat('yyyy-MM-dd').format(evaluationDate),
        'evaluations': [
          for (final item in evaluations)
            {
              'studentId': item.studentId,
              'marks': item.marks,
              'comments': item.comments,
              'qualityStatus': qualityStatusValue(item.qualityStatus),
              'completionStatus': completionStatusValue(item.completionStatus),
            },
        ],
      },
    );
    return HomeworkEvaluationDetailModel.fromJson(response.data ?? const {});
  }

  Map<String, dynamic> _payload(HomeworkDraft draft) => {
    'classId': draft.classId,
    'sectionId': draft.sectionId,
    'subjectId': draft.subjectId,
    'homeworkDate': DateFormat('yyyy-MM-dd').format(draft.homeworkDate),
    'submissionDate': DateFormat('yyyy-MM-dd').format(draft.submissionDate),
    'marks': draft.marks,
    'description': draft.description,
    'attachmentUrl': draft.attachmentUrl,
    'attachmentName': draft.attachmentName,
  };
}
