import 'package:intl/intl.dart';

import '../../../../core/network/error_handler.dart';
import '../../../../core/network/failures.dart';
import '../../../../core/storage/hive_cache_service.dart';
import '../../../../core/sync/mutation_queue_service.dart';
import '../../domain/entities/leave_entities.dart';
import '../../domain/repositories/leave_repository.dart';
import '../datasources/leave_remote_datasource.dart';
import '../models/leave_models.dart';

class LeaveRepositoryImpl implements LeaveRepository {
  const LeaveRepositoryImpl({
    required LeaveRemoteDatasource remote,
    required HiveCacheService cache,
    MutationQueueService? mutationQueue,
  }) : _remote = remote,
       _cache = cache,
       _mutationQueue = mutationQueue;

  static const _balancesKey = 'leave.balances';
  static const _typesKey = 'leave.types';
  static const _applicationsKey = 'leave.applications';

  final LeaveRemoteDatasource _remote;
  final HiveCacheService _cache;
  final MutationQueueService? _mutationQueue;

  @override
  Future<LeaveHomeData> getHomeData() async {
    final results = await Future.wait<Object>([
      getBalances(),
      getTypes(),
      getApplications(),
    ]);
    return LeaveHomeData(
      balances: results[0] as List<LeaveBalance>,
      types: results[1] as List<LeaveType>,
      applications: results[2] as List<LeaveApplication>,
    );
  }

  @override
  Future<List<LeaveBalance>> getBalances() async {
    try {
      final balances = await _remote.getBalances();
      await _cache.writeCached(
        _balancesKey,
        balances.map((item) => item.toJson()).toList(),
      );
      return balances;
    } catch (error) {
      final cached = _cache.read<List<dynamic>>(_balancesKey);
      if (cached != null) return _balanceList(cached);
      final failure = ErrorHandler.toFailure(error);
      if (_isMissingStaffProfile(failure)) return const [];
      throw failure;
    }
  }

  @override
  Future<List<LeaveType>> getTypes() async {
    try {
      final types = await _remote.getTypes();
      await _cache.writeCached(
        _typesKey,
        types.map((item) => item.toJson()).toList(),
      );
      return types;
    } catch (error) {
      final cached = _cache.read<List<dynamic>>(_typesKey);
      if (cached != null) return _typeList(cached);
      throw ErrorHandler.toFailure(error);
    }
  }

  @override
  Future<List<LeaveApplication>> getApplications() async {
    try {
      final applications = await _remote.getApplications();
      await _cache.writeCached(
        _applicationsKey,
        applications.map((item) => item.toJson()).toList(),
      );
      return applications;
    } catch (error) {
      final cached = _cache.read<List<dynamic>>(_applicationsKey);
      if (cached != null) return _applicationList(cached);
      final failure = ErrorHandler.toFailure(error);
      if (_isMissingStaffProfile(failure)) return const [];
      throw failure;
    }
  }

  @override
  Future<LeaveApplication> getApplication(String id) async {
    try {
      return await _remote.getApplication(id);
    } catch (error) {
      throw ErrorHandler.toFailure(error);
    }
  }

  @override
  Future<LeaveApplication> submitApplication({
    required String leaveTypeId,
    required DateTime fromDate,
    required DateTime toDate,
    required String reason,
  }) async {
    try {
      return await _remote.submitApplication(
        leaveTypeId: leaveTypeId,
        fromDate: fromDate,
        toDate: toDate,
        reason: reason,
      );
    } catch (error) {
      final failure = ErrorHandler.toFailure(error);
      if (failure is NetworkFailure && _mutationQueue != null) {
        await _mutationQueue.enqueue(
          type: 'leave.request',
          payload: {
            'leaveTypeId': leaveTypeId,
            'fromDate': DateFormat('yyyy-MM-dd').format(fromDate),
            'toDate': DateFormat('yyyy-MM-dd').format(toDate),
            'reason': reason,
          },
        );
        return LeaveApplication(
          id: 'queued-${DateTime.now().microsecondsSinceEpoch}',
          leaveTypeId: leaveTypeId,
          fromDate: fromDate,
          toDate: toDate,
          reason: reason,
          status: 'QUEUED',
          durationDays: toDate.difference(fromDate).inDays + 1,
        );
      }
      throw failure;
    }
  }

  @override
  Future<void> cancelApplication(String id) async {
    try {
      await _remote.cancelApplication(id);
    } catch (error) {
      throw ErrorHandler.toFailure(error);
    }
  }

  List<LeaveBalance> _balanceList(List<dynamic> values) => [
    for (final item in values)
      if (item is Map)
        LeaveBalanceModel.fromJson(
          item.map((key, value) => MapEntry(key.toString(), value)),
        ),
  ];

  List<LeaveType> _typeList(List<dynamic> values) => [
    for (final item in values)
      if (item is Map)
        LeaveTypeModel.fromJson(
          item.map((key, value) => MapEntry(key.toString(), value)),
        ),
  ];

  List<LeaveApplication> _applicationList(List<dynamic> values) => [
    for (final item in values)
      if (item is Map)
        LeaveApplicationModel.fromJson(
          item.map((key, value) => MapEntry(key.toString(), value)),
        ),
  ];

  bool _isMissingStaffProfile(AppFailure failure) {
    return failure is ApiFailure &&
        failure.statusCode == 404 &&
        failure.message.toLowerCase().contains('staff profile');
  }
}
