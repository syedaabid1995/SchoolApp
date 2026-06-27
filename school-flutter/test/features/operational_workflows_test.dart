import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:school_flutter/global_ui/core/permissions/permission_checker.dart';
import 'package:school_flutter/global_ui/core/permissions/permission_codes.dart';
import 'package:school_flutter/global_ui/core/permissions/permission_registry.dart';
import 'package:school_flutter/global_ui/features/classes/data/models/class_assignment_models.dart';
import 'package:school_flutter/global_ui/features/classes/domain/entities/class_assignment.dart';
import 'package:school_flutter/global_ui/features/classes/domain/repositories/class_assignment_repository.dart';
import 'package:school_flutter/global_ui/features/classes/presentation/providers/class_assignment_providers.dart';
import 'package:school_flutter/global_ui/features/homework/data/models/homework_model.dart';
import 'package:school_flutter/global_ui/features/homework/domain/entities/homework.dart';
import 'package:school_flutter/global_ui/features/homework/domain/repositories/homework_repository.dart';
import 'package:school_flutter/global_ui/features/homework/presentation/providers/homework_providers.dart';
import 'package:school_flutter/global_ui/features/leave/data/models/leave_models.dart';
import 'package:school_flutter/global_ui/features/leave/domain/entities/leave_entities.dart';
import 'package:school_flutter/global_ui/features/leave/domain/repositories/leave_repository.dart';
import 'package:school_flutter/global_ui/features/leave/presentation/providers/leave_providers.dart';
import 'package:school_flutter/global_ui/features/notices/data/models/notice_model.dart';
import 'package:school_flutter/global_ui/features/notices/domain/entities/notice.dart';
import 'package:school_flutter/global_ui/features/notices/domain/repositories/notice_repository.dart';
import 'package:school_flutter/global_ui/features/notices/presentation/providers/notice_providers.dart';

void main() {
  group('leave models', () {
    test('parse leave type', () {
      final type = LeaveTypeModel.fromJson({
        'id': 'type-1',
        'name': 'Casual',
        'totalDays': 12,
      });

      expect(type.name, 'Casual');
      expect(type.totalDays, 12);
    });

    test('parse leave balance', () {
      final balance = LeaveBalanceModel.fromJson({
        'leaveType': {'id': 'type-1', 'name': 'Sick', 'totalDays': 10},
        'totalDays': 10,
        'usedDays': 3,
        'remainingDays': 7,
        'extraTakenDays': 0,
      });

      expect(balance.leaveType.name, 'Sick');
      expect(balance.remainingDays, 7);
    });

    test('parse leave application', () {
      final app = LeaveApplicationModel.fromJson({
        'id': 'leave-1',
        'leaveTypeId': 'type-1',
        'leaveType': {'id': 'type-1', 'name': 'Casual', 'totalDays': 12},
        'fromDate': '2026-06-01',
        'toDate': '2026-06-02',
        'reason': 'Family work',
        'status': 'PENDING',
        'durationDays': 2,
      });

      expect(app.canCancel, isTrue);
      expect(app.durationDays, 2);
    });

    test('parse leave application duration fallback', () {
      final app = LeaveApplicationModel.fromJson({
        'id': 'leave-2',
        'leaveTypeId': 'type-1',
        'fromDate': '2026-06-01',
        'toDate': '2026-06-01',
        'reason': 'Medical',
        'status': 'APPROVED',
        'duration': '1',
      });

      expect(app.durationDays, 1);
      expect(app.canCancel, isFalse);
    });

    test('leave home data counts pending requests', () {
      final data = LeaveHomeData(
        balances: const [],
        types: const [],
        applications: [
          LeaveApplication(
            id: '1',
            leaveTypeId: 'type',
            fromDate: DateTime(2026),
            toDate: DateTime(2026),
            reason: 'A',
            status: 'PENDING',
            durationDays: 1,
          ),
          LeaveApplication(
            id: '2',
            leaveTypeId: 'type',
            fromDate: DateTime(2026),
            toDate: DateTime(2026),
            reason: 'B',
            status: 'APPROVED',
            durationDays: 1,
          ),
        ],
      );

      expect(data.pendingCount, 1);
    });
  });

  group('homework models', () {
    test('parse homework with class section subject includes', () {
      final homework = HomeworkModel.fromJson({
        'id': 'hw-1',
        'classId': 'class-1',
        'sectionId': 'section-1',
        'subjectId': 'subject-1',
        'class': {'id': 'class-1', 'name': 'Grade 8'},
        'section': {'id': 'section-1', 'name': 'A'},
        'subject': {'id': 'subject-1', 'name': 'Science'},
        'homeworkDate': '2026-06-01',
        'submissionDate': '2026-06-03',
        'marks': '10',
        'description': 'Read chapter 1',
        '_count': {'evaluations': 4},
      });

      expect(homework.className, 'Grade 8');
      expect(homework.subjectName, 'Science');
      expect(homework.evaluationCount, 4);
    });

    test('homework serializes back to backend-shaped json', () {
      final homework = HomeworkModel.fromJson({
        'id': 'hw-1',
        'classId': 'class-1',
        'sectionId': 'section-1',
        'subjectId': 'subject-1',
        'homeworkDate': '2026-06-01',
        'submissionDate': '2026-06-03',
        'marks': 10,
        'description': 'Read chapter 1',
      });

      expect(homework.toJson()['classId'], 'class-1');
      expect(homework.toJson()['description'], 'Read chapter 1');
    });

    test('homework draft carries backend mutation fields', () {
      final draft = HomeworkDraft(
        classId: 'class-1',
        sectionId: 'section-1',
        subjectId: 'subject-1',
        homeworkDate: DateTime(2026, 6),
        submissionDate: DateTime(2026, 6, 3),
        marks: 20,
        description: 'Solve worksheet',
      );

      expect(draft.marks, 20);
      expect(draft.subjectId, 'subject-1');
    });

    test('homework filters are stable provider keys', () {
      const first = HomeworkFilter(classId: 'class-1', sectionId: 'section-1');
      const second = HomeworkFilter(classId: 'class-1', sectionId: 'section-1');
      const other = HomeworkFilter(classId: 'class-1', sectionId: 'section-2');

      expect(first, second);
      expect(first, isNot(other));
    });
  });

  group('notice models', () {
    test('parse notice from notification summary item', () {
      final notice = NoticeModel.fromJson({
        'id': 'notice-1',
        'title': 'Holiday',
        'message': 'School closed tomorrow',
        'type': 'announcement',
      }, isRead: false);

      expect(notice.category, 'announcement');
      expect(notice.isRead, isFalse);
    });

    test('notice category takes precedence over notification type', () {
      final notice = NoticeModel.fromJson({
        'id': 'notice-2',
        'title': 'Exam',
        'message': 'Exam schedule published',
        'category': 'exam',
        'type': 'system',
      }, isRead: true);

      expect(notice.category, 'exam');
      expect(notice.isRead, isTrue);
    });

    test('notice board computes unread count', () {
      const board = NoticeBoardState(
        notices: [
          Notice(id: '1', title: 'A', category: 'notice', isRead: false),
          Notice(id: '2', title: 'B', category: 'notice', isRead: true),
        ],
      );

      expect(board.unreadCount, 1);
    });
  });

  group('class assignment models', () {
    test('parse assigned class', () {
      final cls = AssignedClassModel.fromJson({
        'id': 'class-1',
        'name': 'Grade 8',
        'academicYearId': 'year-1',
      });

      expect(cls.name, 'Grade 8');
      expect(cls.academicYearId, 'year-1');
    });

    test('parse assigned section with classSections fallback', () {
      final section = AssignedSectionModel.fromJson({
        'id': 'section-1',
        'name': 'A',
        'classSections': [
          {'classId': 'class-1'},
        ],
      });

      expect(section.classId, 'class-1');
    });

    test('parse assigned section prefers direct classId', () {
      final section = AssignedSectionModel.fromJson({
        'id': 'section-2',
        'name': 'B',
        'classId': 'class-direct',
        'classSections': [
          {'classId': 'class-linked'},
        ],
      });

      expect(section.classId, 'class-direct');
    });

    test('parse assigned subject from teacher profile assignment', () {
      final subject = AssignedSubjectModel.fromJson({
        'subject': {'id': 'subject-1', 'name': 'Math', 'classId': 'class-1'},
      });

      expect(subject.name, 'Math');
      expect(subject.classId, 'class-1');
    });

    test('class assignments filter sections and subjects by class', () {
      const data = ClassAssignments(
        classes: [AssignedClass(id: 'class-1', name: 'Grade 8')],
        sections: [
          AssignedSection(id: 'section-1', name: 'A', classId: 'class-1'),
          AssignedSection(id: 'section-2', name: 'B', classId: 'class-2'),
        ],
        subjects: [
          AssignedSubject(id: 'subject-1', name: 'Math', classId: 'class-1'),
          AssignedSubject(id: 'subject-2', name: 'General'),
        ],
      );

      expect(data.sectionsForClass('class-1'), hasLength(1));
      expect(data.subjectsForClass('class-1'), hasLength(2));
    });
  });

  group('permission visibility', () {
    test('leave route requires leave permission', () {
      const checker = PermissionChecker({PermissionCodes.leaveApplyView});

      expect(checker.canAccessRoute('/leave'), isTrue);
    });

    test('homework action is hidden without homework permission', () {
      const checker = PermissionChecker({});

      expect(
        checker.canPerformAction(PermissionActionIds.createHomework),
        isFalse,
      );
    });

    test('homework action is visible with homework permission', () {
      const checker = PermissionChecker({PermissionCodes.homeworkView});

      expect(
        checker.canPerformAction(PermissionActionIds.createHomework),
        isTrue,
      );
    });

    test('classes module is visible through attendance permission', () {
      const checker = PermissionChecker({PermissionCodes.attendanceView});

      expect(checker.canAccessRoute('/classes'), isTrue);
    });

    test('notices module is authenticated access', () {
      const checker = PermissionChecker({});

      expect(checker.canAccessRoute('/notices'), isTrue);
    });
  });

  group('providers', () {
    test('leaveHomeProvider reads repository override', () async {
      final container = ProviderContainer(
        overrides: [
          leaveRepositoryProvider.overrideWithValue(_FakeLeaveRepository()),
        ],
      );
      addTearDown(container.dispose);

      final data = await container.read(leaveHomeProvider.future);

      expect(data.pendingCount, 1);
    });

    test('homeworkListProvider reads repository override', () async {
      final container = ProviderContainer(
        overrides: [
          homeworkRepositoryProvider.overrideWithValue(
            _FakeHomeworkRepository(),
          ),
        ],
      );
      addTearDown(container.dispose);

      final items = await container.read(
        homeworkListProvider(const HomeworkFilter(classId: 'class-1')).future,
      );

      expect(items.single.subjectName, 'Science');
    });

    test('classAssignmentsProvider reads repository override', () async {
      final container = ProviderContainer(
        overrides: [
          classAssignmentRepositoryProvider.overrideWithValue(
            _FakeClassAssignmentRepository(),
          ),
        ],
      );
      addTearDown(container.dispose);

      final data = await container.read(classAssignmentsProvider.future);

      expect(data.classes.single.name, 'Grade 8');
    });

    test('noticeBoardProvider reads repository override', () async {
      final container = ProviderContainer(
        overrides: [
          noticeRepositoryProvider.overrideWithValue(_FakeNoticeRepository()),
        ],
      );
      addTearDown(container.dispose);

      final data = await container.read(noticeBoardProvider.future);

      expect(data.unreadCount, 1);
    });

    test('homework mutation controller creates through repository', () async {
      final fake = _FakeHomeworkRepository();
      final container = ProviderContainer(
        overrides: [homeworkRepositoryProvider.overrideWithValue(fake)],
      );
      addTearDown(container.dispose);

      await container
          .read(homeworkMutationProvider.notifier)
          .create(
            HomeworkDraft(
              classId: 'class-1',
              sectionId: 'section-1',
              subjectId: 'subject-1',
              homeworkDate: DateTime(2026),
              submissionDate: DateTime(2026, 1, 2),
              marks: 10,
              description: 'Read',
            ),
          );

      expect(fake.createdCount, 1);
    });

    test('leave request controller submits through repository', () async {
      final fake = _FakeLeaveRepository();
      final container = ProviderContainer(
        overrides: [leaveRepositoryProvider.overrideWithValue(fake)],
      );
      addTearDown(container.dispose);

      await container
          .read(leaveRequestControllerProvider.notifier)
          .submit(
            leaveTypeId: 'type-1',
            fromDate: DateTime(2026),
            toDate: DateTime(2026),
            reason: 'Work',
          );

      expect(fake.submittedCount, 1);
    });
  });
}

class _FakeLeaveRepository implements LeaveRepository {
  int submittedCount = 0;

  @override
  Future<LeaveHomeData> getHomeData() async => LeaveHomeData(
    balances: const [],
    types: const [LeaveType(id: 'type-1', name: 'Casual', totalDays: 12)],
    applications: [
      LeaveApplication(
        id: 'leave-1',
        leaveTypeId: 'type-1',
        fromDate: DateTime(2026),
        toDate: DateTime(2026),
        reason: 'Work',
        status: 'PENDING',
        durationDays: 1,
      ),
    ],
  );

  @override
  Future<List<LeaveApplication>> getApplications() async =>
      (await getHomeData()).applications;

  @override
  Future<LeaveApplication> getApplication(String id) async =>
      (await getHomeData()).applications.single;

  @override
  Future<List<LeaveBalance>> getBalances() async => const [];

  @override
  Future<List<LeaveType>> getTypes() async => (await getHomeData()).types;

  @override
  Future<void> cancelApplication(String id) async {}

  @override
  Future<LeaveApplication> submitApplication({
    required String leaveTypeId,
    required DateTime fromDate,
    required DateTime toDate,
    required String reason,
  }) async {
    submittedCount += 1;
    return LeaveApplication(
      id: 'leave-new',
      leaveTypeId: leaveTypeId,
      fromDate: fromDate,
      toDate: toDate,
      reason: reason,
      status: 'PENDING',
      durationDays: 1,
    );
  }
}

class _FakeHomeworkRepository implements HomeworkRepository {
  int createdCount = 0;

  @override
  Future<List<Homework>> list({String? classId, String? sectionId}) async => [
    Homework(
      id: 'hw-1',
      classId: classId ?? 'class-1',
      sectionId: sectionId ?? 'section-1',
      subjectId: 'subject-1',
      className: 'Grade 8',
      sectionName: 'A',
      subjectName: 'Science',
      homeworkDate: DateTime(2026),
      submissionDate: DateTime(2026, 1, 2),
      marks: 10,
      description: 'Read',
    ),
  ];

  @override
  Future<Homework> create(HomeworkDraft draft) async {
    createdCount += 1;
    return (await list(
      classId: draft.classId,
      sectionId: draft.sectionId,
    )).single;
  }

  @override
  Future<void> delete(String id) async {}

  @override
  Future<Homework> update(String id, HomeworkDraft draft) async =>
      (await list(classId: draft.classId, sectionId: draft.sectionId)).single;
}

class _FakeClassAssignmentRepository implements ClassAssignmentRepository {
  @override
  Future<ClassAssignments> getAssignments() async => const ClassAssignments(
    classes: [AssignedClass(id: 'class-1', name: 'Grade 8')],
    sections: [AssignedSection(id: 'section-1', name: 'A', classId: 'class-1')],
    subjects: [
      AssignedSubject(id: 'subject-1', name: 'Science', classId: 'class-1'),
    ],
  );
}

class _FakeNoticeRepository implements NoticeRepository {
  @override
  Future<NoticeBoardState> getNoticeBoard() async => const NoticeBoardState(
    notices: [
      Notice(
        id: 'notice-1',
        title: 'Holiday',
        category: 'notice',
        isRead: false,
      ),
    ],
  );

  @override
  Future<void> markRead(String id) async {}
}
