import 'package:flutter/material.dart';

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
      'attendance.view',
      'staff.attendance.view',
      'leave.apply.view',
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
    requiredPermissions: ['academic.routine.view', 'academic.time.view'],
    fallbackRoles: ['TEACHER'],
    description: 'Today and weekly assigned timetable.',
  ),
  MobileModule(
    key: 'my-classes',
    title: 'My Classes',
    icon: Icons.groups_2_outlined,
    requiredPermissions: [
      'academic.class.view',
      'academic.assign_subject.view',
    ],
    fallbackRoles: ['TEACHER'],
    description: 'Assigned classes, sections, and subjects.',
  ),
  MobileModule(
    key: 'student-attendance',
    title: 'Student Attendance',
    icon: Icons.fact_check_outlined,
    requiredPermissions: ['attendance.view', 'attendance.create'],
    fallbackRoles: ['TEACHER', 'SCHOOL_ADMIN', 'PRINCIPAL'],
    description: 'Class attendance by assigned class and section.',
  ),
  MobileModule(
    key: 'dashboard',
    title: 'Dashboard',
    icon: Icons.dashboard_outlined,
    requiredPermissions: ['dashboard.overview'],
    fallbackRoles: ['SCHOOL_ADMIN', 'PRINCIPAL'],
    description: 'School overview and operational shortcuts.',
  ),
  MobileModule(
    key: 'academic-overview',
    title: 'Academic Overview',
    icon: Icons.insights_outlined,
    requiredPermissions: ['reports.academics.view', 'academics.setup'],
    fallbackRoles: ['PRINCIPAL'],
    description: 'Academic status and school-level overview.',
  ),
  MobileModule(
    key: 'academic-setup',
    title: 'Academic Setup',
    icon: Icons.school_outlined,
    requiredPermissions: [
      'academics.setup',
      'academic.class.view',
      'academic.subject.view',
    ],
    fallbackRoles: ['SCHOOL_ADMIN'],
    description: 'Classes, sections, subjects, and setup.',
  ),
  MobileModule(
    key: 'teachers',
    title: 'Teachers',
    icon: Icons.co_present_outlined,
    requiredPermissions: ['teachers.list'],
    fallbackRoles: ['SCHOOL_ADMIN', 'PRINCIPAL'],
    description: 'Teacher directory and assignments.',
  ),
  MobileModule(
    key: 'students',
    title: 'Students',
    icon: Icons.school_outlined,
    requiredPermissions: ['student.view', 'students.list'],
    fallbackRoles: ['SCHOOL_ADMIN', 'PRINCIPAL'],
    description: 'Student directory and details.',
  ),
  MobileModule(
    key: 'attendance',
    title: 'Attendance',
    icon: Icons.calendar_month_outlined,
    requiredPermissions: [
      'attendance.view',
      'attendance.report',
      'staff.attendance.view',
    ],
    fallbackRoles: ['SCHOOL_ADMIN', 'PRINCIPAL'],
    description: 'Attendance summaries and analytics.',
  ),
  MobileModule(
    key: 'timetable',
    title: 'Timetable',
    icon: Icons.view_timeline_outlined,
    requiredPermissions: ['academic.routine.view', 'academic.time.view'],
    fallbackRoles: ['SCHOOL_ADMIN', 'PRINCIPAL'],
    description: 'Class and teacher timetable overview.',
  ),
  MobileModule(
    key: 'exams',
    title: 'Exams',
    icon: Icons.assignment_outlined,
    requiredPermissions: ['academics.exams'],
    fallbackRoles: ['TEACHER', 'SCHOOL_ADMIN', 'PRINCIPAL'],
    description: 'Assigned exams and exam overview.',
  ),
  MobileModule(
    key: 'marks-entry',
    title: 'Marks Entry',
    icon: Icons.edit_note_outlined,
    requiredPermissions: ['academics.marks'],
    fallbackRoles: ['TEACHER'],
    description: 'Enter marks for assigned papers.',
  ),
  MobileModule(
    key: 'results',
    title: 'Results',
    icon: Icons.bar_chart_outlined,
    requiredPermissions: ['academics.marks', 'reports.exams.view'],
    fallbackRoles: ['TEACHER', 'SCHOOL_ADMIN', 'PRINCIPAL'],
    description: 'Marks, results, and rank-card access.',
  ),
  MobileModule(
    key: 'reports',
    title: 'Reports',
    icon: Icons.insert_chart_outlined,
    requiredPermissions: ['reports.view'],
    fallbackRoles: ['SCHOOL_ADMIN', 'PRINCIPAL'],
    description: 'Mobile report summaries.',
  ),
  MobileModule(
    key: 'library',
    title: 'Library',
    icon: Icons.local_library_outlined,
    requiredPermissions: ['library.view'],
    fallbackRoles: ['LIBRARIAN'],
    description: 'Books, issue, return, and borrow history.',
  ),
  MobileModule(
    key: 'dormitory',
    title: 'Dormitory',
    icon: Icons.bed_outlined,
    requiredPermissions: ['dormitory.view'],
    fallbackRoles: ['WARDEN'],
    description: 'Dormitory rooms and residents.',
  ),
  MobileModule(
    key: 'transport',
    title: 'Transport',
    icon: Icons.directions_bus_outlined,
    requiredPermissions: ['transport.view'],
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
