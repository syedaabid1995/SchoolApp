import '../entities/timetable_entry.dart';

abstract class TimetableRepository {
  Future<TeacherTimetable> getTeacherTimetable({DateTime? date});
}
