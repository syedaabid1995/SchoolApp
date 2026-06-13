import 'package:dio/dio.dart';
import 'package:intl/intl.dart';

import '../../../../core/constants/api_endpoints.dart';
import '../models/timetable_model.dart';

class TimetableRemoteDatasource {
  const TimetableRemoteDatasource(this._dio);

  final Dio _dio;

  Future<TeacherTimetableModel> getTeacherTimetable({DateTime? date}) async {
    final response = await _dio.get<Map<String, dynamic>>(
      ApiEndpoints.teacherTimetable,
      queryParameters: {
        if (date != null) 'date': DateFormat('yyyy-MM-dd').format(date),
      },
    );
    return TeacherTimetableModel.fromJson(
      response.data ?? const <String, dynamic>{},
    );
  }
}
