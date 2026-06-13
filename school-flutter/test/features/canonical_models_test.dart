import 'package:flutter_test/flutter_test.dart';
import 'package:school_flutter/core/network/api_exception.dart';
import 'package:school_flutter/core/network/error_handler.dart';
import 'package:school_flutter/core/network/failures.dart';
import 'package:school_flutter/features/attendance/data/models/attendance_summary_model.dart';
import 'package:school_flutter/features/notifications/data/models/staff_notification_model.dart';
import 'package:school_flutter/features/settings/domain/entities/settings_state.dart';
import 'package:school_flutter/features/timetable/data/models/timetable_model.dart';

void main() {
  group('canonical attendance models', () {
    test('parse P1 summary totals and sessions', () {
      final summary = AttendanceSummaryModel.fromJson({
        'totals': {
          'sessions': 2,
          'records': 40,
          'present': 35,
          'absent': 3,
          'late': 1,
          'halfDay': 1,
        },
        'sessions': [
          {
            'id': 'session-1',
            'date': '2026-02-05',
            'status': 'LOCKED',
            'classId': 'class-1',
            'className': 'Grade 10',
            'sectionId': 'section-1',
            'sectionName': 'A',
            'recordCount': 20,
          },
        ],
      });

      expect(summary.totals.records, 40);
      expect(summary.totals.presentRate, 0.875);
      expect(summary.sessions.single.className, 'Grade 10');
    });

    test('parse empty summary defensively', () {
      final summary = AttendanceSummaryModel.fromJson({});

      expect(summary.totals.records, 0);
      expect(summary.sessions, isEmpty);
    });

    test('parse teacher self-attendance records', () {
      final record = TeacherAttendanceRecordModel.fromJson({
        'id': 'staff-att-1',
        'date': '2026-03-01',
        'status': 'PRESENT',
        'teacherId': 'teacher-1',
      });

      expect(record.id, 'staff-att-1');
      expect(record.status, 'PRESENT');
      expect(record.teacherId, 'teacher-1');
    });
  });

  group('canonical timetable models', () {
    test('parse teacher timetable response with modern entry fields', () {
      final timetable = TeacherTimetableModel.fromJson({
        'date': '2026-03-02',
        'dayOfWeek': 1,
        'version': {'id': 'version-1', 'name': 'Published'},
        'periods': [
          {
            'id': 'entry-1',
            'timetableVersionId': 'version-1',
            'dayOfWeek': 1,
            'class': {'id': 'class-1', 'name': 'Grade 9'},
            'section': {'id': 'section-1', 'name': 'B'},
            'subject': {'id': 'subject-1', 'name': 'Mathematics'},
            'teacher': {
              'id': 'teacher-1',
              'firstName': 'Asha',
              'lastName': 'Rao',
            },
            'period': {
              'id': 'period-1',
              'name': 'Period 1',
              'type': 'CLASS_TIME',
              'startTime': '09:00',
              'endTime': '09:45',
            },
            'classRoom': {'id': 'room-1', 'roomNumber': '201', 'capacity': 45},
          },
        ],
      });

      expect(timetable.versionName, 'Published');
      expect(timetable.entries.single.period.type, 'CLASS_TIME');
      expect(timetable.entries.single.classRoom?.capacity, 45);
    });

    test('sort timetable entries by attendance period start time', () {
      final timetable = TeacherTimetableModel.fromJson({
        'date': '2026-03-02',
        'dayOfWeek': 1,
        'periods': [
          {
            'id': 'entry-2',
            'period': {'startTime': '10:00', 'endTime': '10:45'},
          },
          {
            'id': 'entry-1',
            'period': {'startTime': '09:00', 'endTime': '09:45'},
          },
        ],
      });

      expect(timetable.entries.first.id, 'entry-1');
    });
  });

  group('notifications and settings', () {
    test('parse notification center item read state', () {
      final item = StaffNotificationModel.fromJson({
        'id': 'attendance-pending',
        'title': 'Attendance pending',
        'message': '2 sessions',
        'type': 'info',
      }, isRead: true);

      expect(item.isRead, isTrue);
      expect(item.message, '2 sessions');
    });

    test('notification entity marks item read without changing identity', () {
      final item = const StaffNotificationModel(
        id: 'n1',
        title: 'Alert',
        type: 'warning',
        isRead: false,
      ).markRead();

      expect(item.id, 'n1');
      expect(item.isRead, isTrue);
    });

    test('settings state carries package metadata', () {
      const state = SettingsState(
        themeMode: 'system',
        languageCode: 'en',
        notificationsEnabled: true,
        appVersion: '1.0.0',
        buildNumber: '1',
      );

      expect(state.appVersion, '1.0.0');
      expect(state.notificationsEnabled, isTrue);
    });
  });

  group('failure mapping', () {
    test('map 401 to UnauthorizedFailure', () {
      final failure = ErrorHandler.toFailure(
        const ApiException(message: 'Unauthorized', statusCode: 401),
      );

      expect(failure, isA<UnauthorizedFailure>());
    });

    test('map validation status to ValidationFailure', () {
      final failure = ErrorHandler.toFailure(
        const ApiException(message: 'Validation failed', statusCode: 422),
      );

      expect(failure, isA<ValidationFailure>());
    });

    test('map missing status to NetworkFailure', () {
      final failure = ErrorHandler.toFailure(
        const ApiException(message: 'No connection'),
      );

      expect(failure, isA<NetworkFailure>());
    });
  });
}
