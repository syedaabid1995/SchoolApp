import 'package:flutter_test/flutter_test.dart';
import 'package:school_flutter/global_ui/features/auth/data/models/staff_user_model.dart';

void main() {
  test('StaffUserModel parses backend login user shape', () {
    final user = StaffUserModel.fromJson({
      'id': 'user-1',
      'email': 'teacher@example.com',
      'name': 'Asha Teacher',
      'role': 'TEACHER',
      'permissionCodes': ['attendance.view', 'timetable.view'],
      'schoolId': 'school-1',
      'school': {'name': 'Central School'},
    });

    expect(user.id, 'user-1');
    expect(user.displayName, 'Asha Teacher');
    expect(user.role, 'TEACHER');
    expect(user.schoolName, 'Central School');
    expect(user.permissionCodes, contains('attendance.view'));
  });

  test('StaffUserModel treats role as metadata, not access control', () {
    final user = StaffUserModel.fromJson({
      'id': 'user-2',
      'email': 'parent@example.com',
      'displayName': 'Parent User',
      'role': 'PARENT',
      'permissionCodes': ['notifications.view'],
    });

    expect(user.role, 'PARENT');
    expect(user.permissionCodes, contains('notifications.view'));
  });
}
