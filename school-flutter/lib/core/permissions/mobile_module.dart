import 'package:flutter/material.dart';

import 'permission_codes.dart';

class MobileModule {
  const MobileModule({
    required this.key,
    required this.title,
    required this.icon,
    required this.requiredPermissions,
    this.fallbackRoles = const [],
    this.description,
  });

  final String key;
  final String title;
  final IconData icon;
  final List<String> requiredPermissions;
  final List<String> fallbackRoles;
  final String? description;
}

const mobileModules = <MobileModule>[
  MobileModule(
    key: 'my-attendance',
    title: 'My Attendance',
    icon: Icons.person_pin_circle_outlined,
    requiredPermissions: [
      PermissionCodes.attendanceView,
      PermissionCodes.staffAttendanceView,
      PermissionCodes.leaveApplyView,
    ],
    fallbackRoles: [
      'TEACHER',
      'LIBRARIAN',
      'WARDEN',
      'DRIVER',
      'STAFF',
      'ACCOUNTANT',
    ],
    description: 'Self attendance and attendance history.',
  ),
  MobileModule(
    key: 'my-timetable',
    title: 'My Timetable',
    icon: Icons.schedule_outlined,
    requiredPermissions: [
      PermissionCodes.academicRoutineView,
      PermissionCodes.academicTimeView,
    ],
    fallbackRoles: ['TEACHER'],
    description: 'Today and weekly assigned timetable.',
  ),
  MobileModule(
    key: 'my-classes',
    title: 'My Classes',
    icon: Icons.groups_2_outlined,
    requiredPermissions: [
      PermissionCodes.academicClassView,
      PermissionCodes.academicAssignSubjectView,
    ],
    fallbackRoles: ['TEACHER'],
    description: 'Assigned classes, sections, and subjects.',
  ),
  MobileModule(
    key: 'student-attendance',
    title: 'Student Attendance',
    icon: Icons.fact_check_outlined,
    requiredPermissions: [
      PermissionCodes.attendanceView,
      PermissionCodes.attendanceCreate,
    ],
    fallbackRoles: ['TEACHER', 'SCHOOL_ADMIN', 'PRINCIPAL'],
    description: 'Class attendance by assigned class and section.',
  ),
  MobileModule(
    key: 'dashboard',
    title: 'Dashboard',
    icon: Icons.dashboard_outlined,
    requiredPermissions: [PermissionCodes.dashboardOverview],
    fallbackRoles: ['SCHOOL_ADMIN', 'PRINCIPAL'],
    description: 'School overview and operational shortcuts.',
  ),
  MobileModule(
    key: 'academic-overview',
    title: 'Academic Overview',
    icon: Icons.insights_outlined,
    requiredPermissions: [
      PermissionCodes.reportsAcademicsView,
      PermissionCodes.academicsSetup,
    ],
    fallbackRoles: ['PRINCIPAL'],
    description: 'Academic status and school-level overview.',
  ),
  MobileModule(
    key: 'academic-setup',
    title: 'Academic Setup',
    icon: Icons.school_outlined,
    requiredPermissions: [
      PermissionCodes.academicsSetup,
      PermissionCodes.academicClassView,
      PermissionCodes.academicSubjectView,
    ],
    fallbackRoles: ['SCHOOL_ADMIN'],
    description: 'Classes, sections, subjects, and setup.',
  ),
  MobileModule(
    key: 'staff',
    title: 'Staff',
    icon: Icons.badge_outlined,
    requiredPermissions: [
      PermissionCodes.staffView,
      PermissionCodes.teachersList,
    ],
    fallbackRoles: ['SCHOOL_ADMIN', 'PRINCIPAL'],
    description: 'Staff directory, setup, attendance, and payroll.',
  ),
  MobileModule(
    key: 'teachers',
    title: 'Teachers',
    icon: Icons.co_present_outlined,
    requiredPermissions: [PermissionCodes.teachersList],
    fallbackRoles: ['SCHOOL_ADMIN', 'PRINCIPAL'],
    description: 'Teacher directory and assignments.',
  ),
  MobileModule(
    key: 'students',
    title: 'Students',
    icon: Icons.school_outlined,
    requiredPermissions: [
      PermissionCodes.studentView,
      PermissionCodes.studentsList,
    ],
    fallbackRoles: ['SCHOOL_ADMIN', 'PRINCIPAL'],
    description: 'Student directory and details.',
  ),
  MobileModule(
    key: 'attendance',
    title: 'Attendance',
    icon: Icons.calendar_month_outlined,
    requiredPermissions: [
      PermissionCodes.attendanceView,
      PermissionCodes.attendanceReport,
      PermissionCodes.staffAttendanceView,
    ],
    fallbackRoles: ['SCHOOL_ADMIN', 'PRINCIPAL'],
    description: 'Attendance summaries and analytics.',
  ),
  MobileModule(
    key: 'timetable',
    title: 'Timetable',
    icon: Icons.view_timeline_outlined,
    requiredPermissions: [
      PermissionCodes.academicRoutineView,
      PermissionCodes.academicTimeView,
    ],
    fallbackRoles: ['SCHOOL_ADMIN', 'PRINCIPAL'],
    description: 'Class and teacher timetable overview.',
  ),
  MobileModule(
    key: 'exams',
    title: 'Exams',
    icon: Icons.assignment_outlined,
    requiredPermissions: [PermissionCodes.academicsExams],
    fallbackRoles: ['TEACHER', 'SCHOOL_ADMIN', 'PRINCIPAL'],
    description: 'Assigned exams and exam overview.',
  ),
  MobileModule(
    key: 'marks-entry',
    title: 'Marks Entry',
    icon: Icons.edit_note_outlined,
    requiredPermissions: [PermissionCodes.academicsMarks],
    fallbackRoles: ['TEACHER'],
    description: 'Enter marks for assigned papers.',
  ),
  MobileModule(
    key: 'results',
    title: 'Results',
    icon: Icons.bar_chart_outlined,
    requiredPermissions: [
      PermissionCodes.academicsMarks,
      PermissionCodes.reportsExamsView,
    ],
    fallbackRoles: ['TEACHER', 'SCHOOL_ADMIN', 'PRINCIPAL'],
    description: 'Marks, results, and rank-card access.',
  ),
  MobileModule(
    key: 'reports',
    title: 'Reports',
    icon: Icons.insert_chart_outlined,
    requiredPermissions: [PermissionCodes.reportsView],
    fallbackRoles: ['SCHOOL_ADMIN', 'PRINCIPAL'],
    description: 'Mobile report summaries.',
  ),
  MobileModule(
    key: 'library',
    title: 'Library',
    icon: Icons.local_library_outlined,
    requiredPermissions: [PermissionCodes.libraryView],
    fallbackRoles: ['LIBRARIAN'],
    description: 'Books, issue, return, and borrow history.',
  ),
  MobileModule(
    key: 'dormitory',
    title: 'Dormitory',
    icon: Icons.bed_outlined,
    requiredPermissions: [PermissionCodes.dormitoryView],
    fallbackRoles: ['WARDEN'],
    description: 'Dormitory rooms and residents.',
  ),
  MobileModule(
    key: 'transport',
    title: 'Transport',
    icon: Icons.directions_bus_outlined,
    requiredPermissions: [PermissionCodes.transportView],
    fallbackRoles: ['DRIVER'],
    description: 'Assigned routes and pickup/drop lists.',
  ),
  MobileModule(
    key: 'profile',
    title: 'Profile',
    icon: Icons.person_outline,
    requiredPermissions: [],
    fallbackRoles: [
      'TEACHER',
      'LIBRARIAN',
      'WARDEN',
      'DRIVER',
      'STAFF',
      'ACCOUNTANT',
      'SCHOOL_ADMIN',
      'PRINCIPAL',
    ],
    description: 'Profile, account, and logout.',
  ),
];
