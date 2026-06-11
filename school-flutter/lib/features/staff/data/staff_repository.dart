import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/network/api_client.dart';
import 'staff_models.dart';

final staffRepositoryProvider = Provider<StaffRepository>((ref) {
  return StaffRepository(ref.watch(dioProvider));
});

final staffListProvider = FutureProvider.autoDispose
    .family<StaffListResponse, StaffListQuery>((ref, query) {
      return ref.watch(staffRepositoryProvider).listStaff(query);
    });

final staffOptionsProvider = FutureProvider.autoDispose<StaffOptions>((ref) {
  return ref.watch(staffRepositoryProvider).loadOptions();
});

final staffAttendanceProvider = FutureProvider.autoDispose
    .family<StaffAttendanceDay, StaffAttendanceQuery>((ref, query) {
      return ref.watch(staffRepositoryProvider).loadAttendance(query);
    });

final staffPayrollProvider = FutureProvider.autoDispose
    .family<List<StaffPayrollRow>, StaffPayrollQuery>((ref, query) {
      return ref.watch(staffRepositoryProvider).listPayroll(query);
    });

class StaffListQuery {
  const StaffListQuery({
    this.search = '',
    this.role,
    this.page = 1,
    this.limit = 20,
  });

  final String search;
  final String? role;
  final int page;
  final int limit;

  Map<String, dynamic> toQuery() => {
    'page': page,
    'limit': limit,
    if (search.trim().isNotEmpty) 'search': search.trim(),
    if (role != null && role!.isNotEmpty) 'role': role,
  };

  @override
  bool operator ==(Object other) {
    return other is StaffListQuery &&
        other.search == search &&
        other.role == role &&
        other.page == page &&
        other.limit == limit;
  }

  @override
  int get hashCode => Object.hash(search, role, page, limit);
}

class StaffAttendanceQuery {
  const StaffAttendanceQuery({required this.date, this.role});

  final DateTime date;
  final String? role;

  Map<String, dynamic> toQuery() => {
    'date': DateFormat('yyyy-MM-dd').format(date),
    if (role != null && role!.isNotEmpty) 'role': role,
  };

  @override
  bool operator ==(Object other) {
    return other is StaffAttendanceQuery &&
        DateUtils.isSameDay(other.date, date) &&
        other.role == role;
  }

  @override
  int get hashCode => Object.hash(date.year, date.month, date.day, role);
}

class StaffPayrollQuery {
  const StaffPayrollQuery({required this.month, required this.year, this.role});

  final int month;
  final int year;
  final String? role;

  Map<String, dynamic> toQuery() => {
    'month': month,
    'year': year,
    if (role != null && role!.isNotEmpty) 'role': role,
  };

  @override
  bool operator ==(Object other) {
    return other is StaffPayrollQuery &&
        other.month == month &&
        other.year == year &&
        other.role == role;
  }

  @override
  int get hashCode => Object.hash(month, year, role);
}

class StaffOptions {
  const StaffOptions({required this.departments, required this.designations});

  final List<StaffOption> departments;
  final List<StaffOption> designations;
}

class StaffRepository {
  const StaffRepository(this._dio);

  final Dio _dio;

  Future<StaffListResponse> listStaff(StaffListQuery query) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/staff',
      queryParameters: query.toQuery(),
    );
    return StaffListResponse.fromJson(response.data ?? const {});
  }

  Future<StaffMember> getStaff(String id) async {
    final response = await _dio.get<Map<String, dynamic>>('/staff/$id');
    return StaffMember.fromJson(response.data ?? const {});
  }

  Future<StaffMember> createStaff(StaffPayload payload) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/staff',
      data: payload.toJson(),
    );
    final staff = response.data?['staff'];
    if (staff is Map<String, dynamic>) return StaffMember.fromJson(staff);
    return StaffMember.fromJson(response.data ?? const {});
  }

  Future<StaffMember> updateStaff(String id, StaffPayload payload) async {
    final response = await _dio.patch<Map<String, dynamic>>(
      '/staff/$id',
      data: payload.toJson(includePassword: false),
    );
    return StaffMember.fromJson(response.data ?? const {});
  }

  Future<void> deleteStaff(String id) async {
    await _dio.delete<void>('/staff/$id');
  }

  Future<StaffOptions> loadOptions() async {
    final results = await Future.wait<List<StaffOption>>([
      listDepartments(),
      listDesignations(),
    ]);
    return StaffOptions(departments: results[0], designations: results[1]);
  }

  Future<List<StaffOption>> listDepartments() async {
    final response = await _dio.get<List<dynamic>>('/staff/departments');
    return (response.data ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(StaffOption.fromJson)
        .toList();
  }

  Future<StaffOption> createDepartment(String name) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/staff/departments',
      data: {'name': name},
    );
    return StaffOption.fromJson(response.data ?? const {});
  }

  Future<List<StaffOption>> listDesignations() async {
    final response = await _dio.get<List<dynamic>>('/staff/designations');
    return (response.data ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(StaffOption.fromJson)
        .toList();
  }

  Future<StaffOption> createDesignation(String name) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/staff/designations',
      data: {'name': name},
    );
    return StaffOption.fromJson(response.data ?? const {});
  }

  Future<StaffDefaults> loadPresets() async {
    final response = await _dio.post<Map<String, dynamic>>('/staff/defaults');
    return StaffDefaults.fromJson(response.data ?? const {});
  }

  Future<StaffAttendanceDay> loadAttendance(StaffAttendanceQuery query) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/staff/attendance',
      queryParameters: query.toQuery(),
    );
    return StaffAttendanceDay.fromJson(response.data ?? const {});
  }

  Future<void> saveAttendance({
    required DateTime date,
    String? role,
    required List<StaffMember> staff,
  }) async {
    await _dio.post<void>(
      '/staff/attendance',
      data: {
        'date': DateFormat('yyyy-MM-dd').format(date),
        if (role != null && role.isNotEmpty) 'role': role,
        'records': staff
            .map(
              (item) => {
                'staffId': item.id,
                'status': item.attendanceStatus ?? 'PRESENT',
                if (item.attendanceNote != null) 'note': item.attendanceNote,
              },
            )
            .toList(),
      },
    );
  }

  Future<List<StaffPayrollRow>> listPayroll(StaffPayrollQuery query) async {
    final response = await _dio.get<List<dynamic>>(
      '/staff/payroll',
      queryParameters: query.toQuery(),
    );
    return (response.data ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(StaffPayrollRow.fromJson)
        .toList();
  }
}
