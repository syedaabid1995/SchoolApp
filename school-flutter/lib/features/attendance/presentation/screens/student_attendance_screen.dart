import 'package:flutter/material.dart';

import '../../../../core/constants/app_config.dart';
import '../../../../core/widgets/app_scaffold.dart';
import 'student_attendance_capture_screen.dart';
import 'student_attendance_v2_capture_screen.dart';

class StudentAttendanceScreen extends StatelessWidget {
  const StudentAttendanceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const AppScaffold(
      title: 'Student Attendance',
      emoji: '📝',
      breadcrumb: 'Attendance',
      subtitle: 'Capture class-section attendance and holidays.',
      child: AppConfig.attendanceV2
          ? StudentAttendanceV2CaptureScreen()
          : StudentAttendanceCaptureScreen(),
    );
  }
}
