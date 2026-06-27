import '../entities/dashboard_snapshot.dart';

abstract class DashboardRepository {
  Future<DashboardSnapshot> getDashboard();
}
