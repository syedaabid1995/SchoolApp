import '../../../classes/domain/entities/class_assignment.dart';
import '../entities/academic_overview.dart';

abstract class AcademicRepository {
  Future<ClassAcademicOverview> getClassOverview(AssignedClass assignedClass);
}
