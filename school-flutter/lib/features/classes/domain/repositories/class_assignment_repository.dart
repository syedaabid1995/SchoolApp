import '../entities/class_assignment.dart';

abstract class ClassAssignmentRepository {
  Future<ClassAssignments> getAssignments();
}
