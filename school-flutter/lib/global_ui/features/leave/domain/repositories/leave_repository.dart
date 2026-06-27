import '../entities/leave_entities.dart';

abstract class LeaveRepository {
  Future<LeaveHomeData> getHomeData();
  Future<List<LeaveBalance>> getBalances();
  Future<List<LeaveType>> getTypes();
  Future<List<LeaveApplication>> getApplications();
  Future<LeaveApplication> getApplication(String id);
  Future<LeaveApplication> submitApplication({
    required String leaveTypeId,
    required DateTime fromDate,
    required DateTime toDate,
    required String reason,
  });
  Future<void> cancelApplication(String id);
}
