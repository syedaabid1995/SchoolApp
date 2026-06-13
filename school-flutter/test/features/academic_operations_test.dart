import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:school_flutter/core/permissions/permission_checker.dart';
import 'package:school_flutter/core/permissions/permission_codes.dart';
import 'package:school_flutter/core/permissions/permission_registry.dart';
import 'package:school_flutter/features/academic/domain/entities/academic_overview.dart';
import 'package:school_flutter/features/classes/domain/entities/class_assignment.dart';
import 'package:school_flutter/features/exams/data/models/exam_models.dart';
import 'package:school_flutter/features/exams/domain/entities/exam.dart';
import 'package:school_flutter/features/exams/domain/repositories/exam_repository.dart';
import 'package:school_flutter/features/exams/presentation/providers/exam_providers.dart';
import 'package:school_flutter/features/homework/domain/entities/homework.dart';
import 'package:school_flutter/features/marks/data/models/marks_models.dart';
import 'package:school_flutter/features/marks/domain/entities/marks.dart';
import 'package:school_flutter/features/marks/domain/repositories/marks_repository.dart';
import 'package:school_flutter/features/marks/presentation/providers/marks_providers.dart';

void main() {
  group('exam models', () {
    test('parse exam list row', () {
      final exam = ExamModel.fromJson({
        'id': 'exam-1',
        'name': 'Mid Term',
        'type': 'MIDTERM',
        'status': 'PUBLISHED',
        'academicYearId': 'year-1',
        'classId': 'class-1',
        'sectionId': 'section-1',
        'scheduledAt': '2026-07-01T00:00:00.000Z',
      });

      expect(exam.name, 'Mid Term');
      expect(exam.type, 'MIDTERM');
      expect(exam.classId, 'class-1');
    });

    test('parse exam detail papers with subject schedule', () {
      final exam = ExamModel.fromJson({
        'id': 'exam-1',
        'name': 'Final',
        'type': 'FINAL',
        'status': 'DRAFT',
        'papers': [
          {
            'id': 'paper-1',
            'examId': 'exam-1',
            'subjectId': 'subject-1',
            'classId': 'class-1',
            'maxMarks': 100,
            'passMarks': 35,
            'scheduledAt': '2026-07-02T00:00:00.000Z',
            'subject': {'id': 'subject-1', 'name': 'Science'},
          },
        ],
      });

      expect(exam.papers.single.subjectName, 'Science');
      expect(exam.papers.single.maxMarks, 100);
    });

    test('parse assigned exam paper from teacher endpoint', () {
      final paper = ExamPaperModel.fromJson({
        'id': 'paper-1',
        'maxMarks': 80,
        'passMarks': 28,
        'weightage': 1,
        'scheduledAt': '2026-07-02T00:00:00.000Z',
        'class': {'id': 'class-1', 'name': 'Grade 8'},
        'subject': {'id': 'subject-1', 'name': 'Math'},
        'exam': {
          'id': 'exam-1',
          'name': 'Mid Term',
          'type': 'MIDTERM',
          'status': 'PUBLISHED',
          'section': {'id': 'section-1', 'name': 'A'},
        },
        '_count': {'marks': 12},
      });

      expect(paper.examName, 'Mid Term');
      expect(paper.sectionName, 'A');
      expect(paper.marksCount, 12);
    });

    test('parse invigilation duty with center and room', () {
      final duty = ExamDutyModel.fromJson({
        'id': 'duty-1',
        'examId': 'exam-1',
        'teacherId': 'teacher-1',
        'centerId': 'center-1',
        'roomId': 'room-1',
        'center': {'id': 'center-1', 'name': 'Main Center'},
        'room': {'id': 'room-1', 'name': 'Room 101'},
        'examPaper': {
          'id': 'paper-1',
          'scheduledAt': '2026-07-02T00:00:00.000Z',
          'subject': {'id': 'subject-1', 'name': 'Science'},
        },
      });

      expect(duty.subjectName, 'Science');
      expect(duty.centerName, 'Main Center');
      expect(duty.roomName, 'Room 101');
    });

    test('exam home groups active and completed exams', () {
      final home = ExamHomeData(
        exams: [
          Exam(
            id: 'exam-1',
            name: 'Active',
            type: 'MIDTERM',
            status: 'PUBLISHED',
            scheduledAt: DateTime(2099),
          ),
          const Exam(
            id: 'exam-2',
            name: 'Closed',
            type: 'FINAL',
            status: 'CLOSED',
          ),
        ],
        assignedPapers: const [],
        duties: const [],
      );

      expect(home.active, hasLength(1));
      expect(home.completed, hasLength(1));
      expect(home.upcoming, hasLength(1));
    });
  });

  group('marks models and validation', () {
    test('parse student for mark entry', () {
      final student = AssignedStudentModel.fromJson({
        'id': 'student-1',
        'fullName': 'Aarav',
        'rollNo': '12',
        'class': {'id': 'class-1', 'name': 'Grade 8'},
        'section': {'id': 'section-1', 'name': 'A'},
      });

      expect(student.fullName, 'Aarav');
      expect(student.className, 'Grade 8');
      expect(student.sectionName, 'A');
    });

    test('parse mark record', () {
      final mark = MarkRecordModel.fromJson({
        'id': 'mark-1',
        'studentId': 'student-1',
        'marks': 78,
        'grade': 'A',
        'status': 'SUBMITTED',
        'moderated': true,
      });

      expect(mark.marks, 78);
      expect(mark.grade, 'A');
      expect(mark.moderated, isTrue);
    });

    test('marks draft serializes upload payload', () {
      const draft = MarksDraft(
        examPaperId: 'paper-1',
        status: 'SUBMITTED',
        entries: [MarkEntry(studentId: 'student-1', marks: 78)],
      );

      final payload = marksDraftPayload(draft);

      expect(payload['examPaperId'], 'paper-1');
      expect((payload['entries'] as List).single['marks'], 78);
    });

    test('marks draft rejects negative marks', () {
      const paper = ExamPaper(
        id: 'paper-1',
        examId: 'exam-1',
        subjectId: 'subject-1',
        classId: 'class-1',
        maxMarks: 100,
        passMarks: 35,
        weightage: 1,
      );
      const draft = MarksDraft(
        examPaperId: 'paper-1',
        entries: [MarkEntry(studentId: 'student-1', marks: -1)],
      );

      expect(draft.validate(paper).single, contains('negative'));
    });

    test('marks draft rejects marks above paper maximum', () {
      const paper = ExamPaper(
        id: 'paper-1',
        examId: 'exam-1',
        subjectId: 'subject-1',
        classId: 'class-1',
        maxMarks: 50,
        passMarks: 18,
        weightage: 1,
      );
      const draft = MarksDraft(
        examPaperId: 'paper-1',
        entries: [MarkEntry(studentId: 'student-1', marks: 51)],
      );

      expect(draft.validate(paper).single, contains('exceed'));
    });

    test('marks draft rejects duplicate students', () {
      const paper = ExamPaper(
        id: 'paper-1',
        examId: 'exam-1',
        subjectId: 'subject-1',
        classId: 'class-1',
        maxMarks: 100,
        passMarks: 35,
        weightage: 1,
      );
      const draft = MarksDraft(
        examPaperId: 'paper-1',
        entries: [
          MarkEntry(studentId: 'student-1', marks: 40),
          MarkEntry(studentId: 'student-1', marks: 45),
        ],
      );

      expect(draft.validate(paper).single, contains('Duplicate'));
    });

    test('marks summary computes average and status counts', () {
      const paper = ExamPaper(
        id: 'paper-1',
        examId: 'exam-1',
        subjectId: 'subject-1',
        classId: 'class-1',
        maxMarks: 100,
        passMarks: 35,
        weightage: 1,
      );
      const summary = MarksSummary(
        paper: paper,
        records: [
          MarkRecord(
            id: 'mark-1',
            studentId: 'student-1',
            marks: 80,
            status: 'SUBMITTED',
          ),
          MarkRecord(
            id: 'mark-2',
            studentId: 'student-2',
            marks: 60,
            status: 'DRAFT',
          ),
        ],
      );

      expect(summary.averageMarks, 70);
      expect(summary.submittedCount, 1);
      expect(summary.draftCount, 1);
    });

    test('parse marks upload results', () {
      final result = MarksUploadResultModel.fromJson({
        'results': [
          {'studentId': 'student-1', 'grade': 'A'},
        ],
      });

      expect(result.results.single.studentId, 'student-1');
      expect(result.results.single.grade, 'A');
    });
  });

  group('permission visibility', () {
    test('exam route requires exam permission', () {
      const checker = PermissionChecker({PermissionCodes.academicsExams});

      expect(checker.canAccessRoute('/exams'), isTrue);
    });

    test('exam duty route access follows invigilator permission', () {
      const checker = PermissionChecker({PermissionCodes.examInvigilatorView});

      expect(checker.canAccessRoute('/exams'), isTrue);
    });

    test('marks route requires marks permission', () {
      const checker = PermissionChecker({PermissionCodes.academicsMarks});

      expect(checker.canAccessRoute('/marks'), isTrue);
    });

    test('marks route is hidden without marks permission', () {
      const checker = PermissionChecker({});

      expect(checker.canAccessRoute('/marks'), isFalse);
    });

    test('enter marks action requires marks permission', () {
      const checker = PermissionChecker({PermissionCodes.academicsMarks});

      expect(checker.canPerformAction(PermissionActionIds.enterMarks), isTrue);
    });

    test('publish marks action hidden without marks permission', () {
      const checker = PermissionChecker({});

      expect(
        checker.canPerformAction(PermissionActionIds.publishMarks),
        isFalse,
      );
    });
  });

  group('providers', () {
    test('examHomeProvider reads repository override', () async {
      final container = ProviderContainer(
        overrides: [
          examRepositoryProvider.overrideWithValue(_FakeExamRepository()),
        ],
      );
      addTearDown(container.dispose);

      final data = await container.read(examHomeProvider.future);

      expect(data.exams.single.name, 'Mid Term');
    });

    test('examDetailProvider reads repository override', () async {
      final container = ProviderContainer(
        overrides: [
          examRepositoryProvider.overrideWithValue(_FakeExamRepository()),
        ],
      );
      addTearDown(container.dispose);

      final data = await container.read(examDetailProvider('exam-1').future);

      expect(data.id, 'exam-1');
    });

    test('examDutiesProvider reads repository override', () async {
      final container = ProviderContainer(
        overrides: [
          examRepositoryProvider.overrideWithValue(_FakeExamRepository()),
        ],
      );
      addTearDown(container.dispose);

      final duties = await container.read(examDutiesProvider.future);

      expect(duties.single.roomName, 'Room 101');
    });

    test('marksTasksProvider reads repository override', () async {
      final container = ProviderContainer(
        overrides: [
          marksRepositoryProvider.overrideWithValue(_FakeMarksRepository()),
        ],
      );
      addTearDown(container.dispose);

      final tasks = await container.read(
        marksTasksProvider(const MarksTaskFilter(classId: 'class-1')).future,
      );

      expect(tasks.single.subjectName, 'Science');
    });

    test(
      'assignedStudentsForMarksProvider reads repository override',
      () async {
        final container = ProviderContainer(
          overrides: [
            marksRepositoryProvider.overrideWithValue(_FakeMarksRepository()),
          ],
        );
        addTearDown(container.dispose);

        final students = await container.read(
          assignedStudentsForMarksProvider(
            const StudentFilter(classId: 'class-1'),
          ).future,
        );

        expect(students.single.fullName, 'Aarav');
      },
    );

    test('marksRecordsProvider reads repository override', () async {
      final container = ProviderContainer(
        overrides: [
          marksRepositoryProvider.overrideWithValue(_FakeMarksRepository()),
        ],
      );
      addTearDown(container.dispose);

      final marks = await container.read(
        marksRecordsProvider('paper-1').future,
      );

      expect(marks.single.grade, 'A');
    });

    test('marksSummaryProvider computes through repository override', () async {
      final container = ProviderContainer(
        overrides: [
          marksRepositoryProvider.overrideWithValue(_FakeMarksRepository()),
        ],
      );
      addTearDown(container.dispose);

      final summary = await container.read(marksSummaryProvider(_paper).future);

      expect(summary.averageMarks, 78);
    });

    test(
      'marksSubmissionProvider submits through repository override',
      () async {
        final fake = _FakeMarksRepository();
        final container = ProviderContainer(
          overrides: [marksRepositoryProvider.overrideWithValue(fake)],
        );
        addTearDown(container.dispose);

        await container
            .read(marksSubmissionProvider.notifier)
            .submit(
              const MarksDraft(
                examPaperId: 'paper-1',
                entries: [MarkEntry(studentId: 'student-1', marks: 78)],
              ),
            );

        expect(fake.submittedCount, 1);
      },
    );
  });

  group('academic overview entity', () {
    test('computes academic class counts', () {
      final overview = ClassAcademicOverview(
        assignedClass: const AssignedClass(id: 'class-1', name: 'Grade 8'),
        sections: const [
          AssignedSection(id: 'section-1', name: 'A', classId: 'class-1'),
        ],
        subjects: const [AssignedSubject(id: 'subject-1', name: 'Science')],
        homework: [
          Homework(
            id: 'hw-1',
            classId: 'class-1',
            sectionId: 'section-1',
            subjectId: 'subject-1',
            homeworkDate: DateTime(2026),
            submissionDate: DateTime(2026, 1, 2),
            marks: 10,
            description: 'Read',
          ),
        ],
        examPapers: const [_paper],
        marks: const [],
      );

      expect(overview.homeworkCount, 1);
      expect(overview.pendingMarkTasks, 1);
    });

    test('computes submitted marks count', () {
      const overview = ClassAcademicOverview(
        assignedClass: AssignedClass(id: 'class-1', name: 'Grade 8'),
        sections: [],
        subjects: [],
        homework: [],
        examPapers: [],
        marks: [
          MarkRecord(
            id: 'mark-1',
            studentId: 'student-1',
            marks: 78,
            grade: 'A',
            status: 'SUBMITTED',
          ),
        ],
      );

      expect(overview.submittedMarks, 1);
    });
  });
}

const _paper = ExamPaper(
  id: 'paper-1',
  examId: 'exam-1',
  subjectId: 'subject-1',
  classId: 'class-1',
  subjectName: 'Science',
  examName: 'Mid Term',
  maxMarks: 100,
  passMarks: 35,
  weightage: 1,
);

class _FakeExamRepository implements ExamRepository {
  @override
  Future<ExamHomeData> getHomeData() async => ExamHomeData(
    exams: [
      Exam(
        id: 'exam-1',
        name: 'Mid Term',
        type: 'MIDTERM',
        status: 'PUBLISHED',
        scheduledAt: DateTime(2099),
      ),
    ],
    assignedPapers: const [_paper],
    duties: [
      ExamDuty(
        id: 'duty-1',
        examId: 'exam-1',
        examPaperId: 'paper-1',
        teacherId: 'teacher-1',
        centerId: 'center-1',
        roomId: 'room-1',
        roomName: 'Room 101',
      ),
    ],
  );

  @override
  Future<Exam> getExam(String id) async => Exam(
    id: id,
    name: 'Mid Term',
    type: 'MIDTERM',
    status: 'PUBLISHED',
    papers: const [_paper],
  );

  @override
  Future<List<ExamPaper>> listAssignedPapers({
    String? examId,
    String? classId,
    String? sectionId,
    String? subjectId,
  }) async => const [_paper];

  @override
  Future<List<Exam>> listExams() async => (await getHomeData()).exams;

  @override
  Future<List<ExamDuty>> listMyDuties() async => (await getHomeData()).duties;
}

class _FakeMarksRepository implements MarksRepository {
  int submittedCount = 0;

  @override
  Future<MarksSummary> getSummary(ExamPaper paper) async =>
      MarksSummary(paper: paper, records: await listMarks(paper.id));

  @override
  Future<List<MarkRecord>> listMarks(String examPaperId) async => const [
    MarkRecord(
      id: 'mark-1',
      studentId: 'student-1',
      marks: 78,
      grade: 'A',
      status: 'SUBMITTED',
    ),
  ];

  @override
  Future<List<AssignedStudent>> listStudents({
    String? classId,
    String? sectionId,
  }) async => const [AssignedStudent(id: 'student-1', fullName: 'Aarav')];

  @override
  Future<List<ExamPaper>> listTasks({
    String? examId,
    String? classId,
    String? sectionId,
    String? subjectId,
  }) async => const [_paper];

  @override
  Future<MarksUploadResult> submitMarks(MarksDraft draft) async {
    submittedCount += 1;
    return const MarksUploadResult(
      results: [UploadedMarkResult(studentId: 'student-1', grade: 'A')],
    );
  }
}
