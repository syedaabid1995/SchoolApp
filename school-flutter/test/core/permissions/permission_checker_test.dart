import 'package:flutter_test/flutter_test.dart';
import 'package:school_flutter/core/permissions/permission_checker.dart';

void main() {
  test('permission grants access inside the mobile role surface', () {
    final modules = visibleModules(
      permissions: ['attendance.view', 'academic.routine.view'],
      role: 'TEACHER',
    ).map((module) => module.key);

    expect(
      modules,
      containsAll([
        'my-attendance',
        'my-timetable',
        'student-attendance',
        'profile',
      ]),
    );
  });

  test('role fallback applies only when backend returned no permissions', () {
    final modules = visibleModules(
      permissions: const [],
      role: 'TEACHER',
    ).map((module) => module.key);

    expect(
      modules,
      containsAll([
        'my-attendance',
        'my-timetable',
        'my-classes',
        'student-attendance',
        'exams',
        'marks-entry',
        'results',
        'profile',
      ]),
    );
  });

  test('teacher dashboard visible modules', () {
    final modules = visibleModules(
      permissions: const [],
      role: 'TEACHER',
    ).map((module) => module.title).toList();

    expect(
      modules,
      containsAll([
        'My Attendance',
        'My Timetable',
        'My Classes',
        'Student Attendance',
        'Exams',
        'Marks Entry',
        'Results',
        'Profile',
      ]),
    );
    expect(modules, isNot(contains('Library')));
  });

  test('librarian dashboard visible modules', () {
    final modules = visibleModules(
      permissions: const [],
      role: 'LIBRARIAN',
    ).map((module) => module.title).toList();

    expect(modules, containsAll(['My Attendance', 'Library', 'Profile']));
    expect(modules, isNot(contains('Dormitory')));
  });

  test('warden dashboard visible modules', () {
    final modules = visibleModules(
      permissions: const [],
      role: 'WARDEN',
    ).map((module) => module.title).toList();

    expect(modules, containsAll(['My Attendance', 'Dormitory', 'Profile']));
    expect(modules, isNot(contains('Library')));
  });

  test('driver dashboard visible modules', () {
    final modules = visibleModules(
      permissions: const [],
      role: 'DRIVER',
    ).map((module) => module.title).toList();

    expect(modules, containsAll(['My Attendance', 'Transport', 'Profile']));
    expect(modules, isNot(contains('Dormitory')));
  });

  test(
    'school admin dashboard visible modules exclude out-of-sprint staff modules',
    () {
      final modules = visibleModules(
        permissions: const [],
        role: 'SCHOOL_ADMIN',
      ).map((module) => module.title).toList();

      expect(
        modules,
        containsAll([
          'Dashboard',
          'Academic Setup',
          'Teachers',
          'Students',
          'Attendance',
          'Timetable',
          'Exams',
          'Results',
          'Reports',
          'Profile',
        ]),
      );
      expect(modules, isNot(contains('Library')));
      expect(modules, isNot(contains('Transport')));
    },
  );
}
