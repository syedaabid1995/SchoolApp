import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../global_ui/features/classes/domain/entities/class_assignment.dart';
import '../../../../../global_ui/features/classes/presentation/providers/class_assignment_providers.dart';
import '../../../../../global_ui/features/exams/domain/entities/exam.dart';
import '../../../../../global_ui/features/marks/domain/entities/marks.dart';
import '../../../../../global_ui/features/marks/presentation/providers/marks_providers.dart';
import '../../../../app/theme/saapt_theme.dart';

class ClassPerformanceScreen extends ConsumerStatefulWidget {
  const ClassPerformanceScreen({super.key});

  @override
  ConsumerState<ClassPerformanceScreen> createState() =>
      _ClassPerformanceScreenState();
}

class _ClassPerformanceScreenState
    extends ConsumerState<ClassPerformanceScreen> {
  String? _classId;
  String? _sectionId;
  String? _examId;
  String? _studentId;

  @override
  Widget build(BuildContext context) {
    final assignmentsState = ref.watch(classAssignmentsProvider);
    return Scaffold(
      body: assignmentsState.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => _FullScreenMessage(message: error.toString()),
        data: (assignments) {
          final classes = assignments.classes;
          _applyClassSectionDefaults(assignments);
          final sections = assignments.sectionsForClass(_classId);
          final tasksState = ref.watch(
            marksTasksProvider(
              MarksTaskFilter(classId: _classId, sectionId: _sectionId),
            ),
          );
          final studentsState = ref.watch(
            assignedStudentsForMarksProvider(
              StudentFilter(classId: _classId, sectionId: _sectionId),
            ),
          );

          return CustomScrollView(
            slivers: [
              SliverToBoxAdapter(child: _PerformanceHeader(onBack: _pop)),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
                sliver: SliverToBoxAdapter(
                  child: _PerformanceContent(
                    classes: classes,
                    sections: sections,
                    selectedClassId: _classId,
                    selectedSectionId: _sectionId,
                    tasksState: tasksState,
                    studentsState: studentsState,
                    examId: _examId,
                    studentId: _studentId,
                    onClassChanged: (value) => _selectClass(assignments, value),
                    onSectionChanged: _selectSection,
                    onExamChanged: (value) => setState(() => _examId = value),
                    onStudentChanged: (value) =>
                        setState(() => _studentId = value),
                    applyDerivedDefaults: _applyDerivedDefaults,
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  void _pop() => Navigator.of(context).maybePop();

  void _applyClassSectionDefaults(ClassAssignments assignments) {
    if (assignments.classes.isEmpty) return;
    if (!assignments.classes.any((item) => item.id == _classId)) {
      _classId = assignments.classes.first.id;
      _sectionId = null;
      _examId = null;
      _studentId = null;
    }

    final sections = assignments.sectionsForClass(_classId);
    if (sections.isEmpty) {
      _sectionId = null;
      return;
    }
    if (!sections.any((item) => item.id == _sectionId)) {
      _sectionId = sections.first.id;
      _examId = null;
      _studentId = null;
    }
  }

  void _applyDerivedDefaults({
    required List<_ExamChoice> exams,
    required List<AssignedStudent> students,
  }) {
    if (exams.isEmpty) {
      _examId = null;
    } else if (!exams.any((exam) => exam.id == _examId)) {
      _examId = exams.first.id;
    }

    if (students.isEmpty) {
      _studentId = null;
    } else if (!students.any((student) => student.id == _studentId)) {
      _studentId = students.first.id;
    }
  }

  void _selectClass(ClassAssignments assignments, String? classId) {
    setState(() {
      _classId = classId;
      _sectionId = assignments.sectionsForClass(classId).firstOrNull?.id;
      _examId = null;
      _studentId = null;
    });
  }

  void _selectSection(String? sectionId) {
    setState(() {
      _sectionId = sectionId;
      _examId = null;
      _studentId = null;
    });
  }
}

class _PerformanceHeader extends StatelessWidget {
  const _PerformanceHeader({required this.onBack});
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) => Container(
    color: SaaptTheme.primary,
    padding: const EdgeInsets.fromLTRB(20, 48, 20, 28),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            IconButton(
              style: IconButton.styleFrom(
                backgroundColor: Colors.white.withValues(alpha: 0.14),
                foregroundColor: Colors.white,
              ),
              onPressed: onBack,
              icon: const Icon(Icons.arrow_back_rounded),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: Colors.white.withValues(alpha: 0.32)),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.track_changes, size: 18, color: Colors.white),
                  SizedBox(width: 7),
                  Text(
                    'Performance',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 18),
        const Text(
          'Class Performance',
          style: TextStyle(
            color: Colors.white,
            fontSize: 32,
            fontWeight: FontWeight.w800,
            height: 1.05,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Student-wise graphical marks performance',
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.82),
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    ),
  );
}

class _PerformanceContent extends StatelessWidget {
  const _PerformanceContent({
    required this.classes,
    required this.sections,
    required this.selectedClassId,
    required this.selectedSectionId,
    required this.tasksState,
    required this.studentsState,
    required this.examId,
    required this.studentId,
    required this.onClassChanged,
    required this.onSectionChanged,
    required this.onExamChanged,
    required this.onStudentChanged,
    required this.applyDerivedDefaults,
  });

  final List<AssignedClass> classes;
  final List<AssignedSection> sections;
  final String? selectedClassId;
  final String? selectedSectionId;
  final AsyncValue<List<ExamPaper>> tasksState;
  final AsyncValue<List<AssignedStudent>> studentsState;
  final String? examId;
  final String? studentId;
  final ValueChanged<String?> onClassChanged;
  final ValueChanged<String?> onSectionChanged;
  final ValueChanged<String?> onExamChanged;
  final ValueChanged<String?> onStudentChanged;
  final void Function({
    required List<_ExamChoice> exams,
    required List<AssignedStudent> students,
  })
  applyDerivedDefaults;

  @override
  Widget build(BuildContext context) {
    final tasks = tasksState.asData?.value ?? const <ExamPaper>[];
    final students = studentsState.asData?.value ?? const <AssignedStudent>[];
    final exams = _examChoices(tasks);
    applyDerivedDefaults(exams: exams, students: students);

    final selectedExamId = exams.any((exam) => exam.id == examId)
        ? examId
        : exams.firstOrNull?.id;
    final selectedStudentId = students.any((student) => student.id == studentId)
        ? studentId
        : students.firstOrNull?.id;
    final selectedStudent = students
        .where((student) => student.id == selectedStudentId)
        .firstOrNull;
    final selectedPapers = tasks
        .where((paper) => paper.examId == selectedExamId)
        .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _SelectionCard(
          classes: classes,
          sections: sections,
          selectedClassId: selectedClassId,
          selectedSectionId: selectedSectionId,
          exams: exams,
          selectedExamId: selectedExamId,
          students: students,
          selectedStudentId: selectedStudentId,
          loadingExams: tasksState.isLoading,
          loadingStudents: studentsState.isLoading,
          onClassChanged: onClassChanged,
          onSectionChanged: onSectionChanged,
          onExamChanged: onExamChanged,
          onStudentChanged: onStudentChanged,
        ),
        if (tasksState.hasError) ...[
          const SizedBox(height: 12),
          _MessageCard(message: tasksState.error.toString()),
        ],
        if (studentsState.hasError) ...[
          const SizedBox(height: 12),
          _MessageCard(message: studentsState.error.toString()),
        ],
        const SizedBox(height: 18),
        if (selectedExamId == null)
          const _MessageCard(
            message: 'No examination papers are assigned for this class.',
          )
        else if (selectedStudent == null)
          const _MessageCard(message: 'No students are available.')
        else
          _StudentPerformancePanel(
            student: selectedStudent,
            papers: selectedPapers,
          ),
      ],
    );
  }
}

class _SelectionCard extends StatelessWidget {
  const _SelectionCard({
    required this.classes,
    required this.sections,
    required this.selectedClassId,
    required this.selectedSectionId,
    required this.exams,
    required this.selectedExamId,
    required this.students,
    required this.selectedStudentId,
    required this.loadingExams,
    required this.loadingStudents,
    required this.onClassChanged,
    required this.onSectionChanged,
    required this.onExamChanged,
    required this.onStudentChanged,
  });

  final List<AssignedClass> classes;
  final List<AssignedSection> sections;
  final String? selectedClassId;
  final String? selectedSectionId;
  final List<_ExamChoice> exams;
  final String? selectedExamId;
  final List<AssignedStudent> students;
  final String? selectedStudentId;
  final bool loadingExams;
  final bool loadingStudents;
  final ValueChanged<String?> onClassChanged;
  final ValueChanged<String?> onSectionChanged;
  final ValueChanged<String?> onExamChanged;
  final ValueChanged<String?> onStudentChanged;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(8),
      border: Border.all(color: const Color(0xFFDDE5F2)),
    ),
    child: Column(
      children: [
        _SelectField(
          label: 'CLASS',
          value: selectedClassId,
          items: [
            for (final cls in classes)
              DropdownMenuItem(value: cls.id, child: Text(cls.name)),
          ],
          hint: 'Select class',
          onChanged: classes.isEmpty ? null : onClassChanged,
        ),
        const SizedBox(height: 14),
        _SelectField(
          label: 'SECTION',
          value: sections.any((section) => section.id == selectedSectionId)
              ? selectedSectionId
              : null,
          items: [
            for (final section in sections)
              DropdownMenuItem(
                value: section.id,
                child: Text(_sectionLabel(section)),
              ),
          ],
          hint: sections.isEmpty ? 'No sections assigned' : 'Select section',
          onChanged: sections.isEmpty ? null : onSectionChanged,
        ),
        const SizedBox(height: 14),
        _SelectField(
          label: 'EXAMINATION',
          value: selectedExamId,
          items: [
            for (final exam in exams)
              DropdownMenuItem(value: exam.id, child: Text(exam.name)),
          ],
          hint: loadingExams ? 'Loading examinations' : 'Select examination',
          onChanged: exams.isEmpty ? null : onExamChanged,
        ),
        const SizedBox(height: 14),
        _SelectField(
          label: 'SELECT STUDENT',
          value: selectedStudentId,
          items: [
            for (final student in students)
              DropdownMenuItem(
                value: student.id,
                child: Text(student.fullName),
              ),
          ],
          hint: loadingStudents ? 'Loading students' : 'Select student',
          onChanged: students.isEmpty ? null : onStudentChanged,
        ),
      ],
    ),
  );
}

class _StudentPerformancePanel extends ConsumerWidget {
  const _StudentPerformancePanel({required this.student, required this.papers});

  final AssignedStudent student;
  final List<ExamPaper> papers;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (papers.isEmpty) {
      return const _MessageCard(
        message: 'No subjects are configured for the selected examination.',
      );
    }

    final markStates = [
      for (final paper in papers) ref.watch(marksRecordsProvider(paper.id)),
    ];
    final loading = markStates.any((state) => state.isLoading);
    final blockingError = markStates
        .where((state) => state.hasError && state.asData == null)
        .firstOrNull;
    if (blockingError != null) {
      return _MessageCard(message: blockingError.error.toString());
    }

    final results = <_SubjectResult>[];
    for (var index = 0; index < papers.length; index++) {
      final paper = papers[index];
      final records = markStates[index].asData?.value ?? const <MarkRecord>[];
      final record = records
          .where((item) => item.studentId == student.id)
          .firstOrNull;
      results.add(_SubjectResult(paper: paper, record: record));
    }

    final recorded = results.where((result) => result.record != null).toList();
    final totalMarks = recorded.fold<num>(
      0,
      (sum, result) => sum + (result.record?.marks ?? 0),
    );
    final maxMarks = recorded.fold<num>(
      0,
      (sum, result) => sum + result.maxMarks,
    );
    final average = maxMarks == 0 ? 0.0 : (totalMarks / maxMarks) * 100;
    final grade = _gradeForAverage(average);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (loading) const LinearProgressIndicator(minHeight: 2),
        if (loading) const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _MetricCard(
                value: '${average.round()}%',
                label: 'Student Avg',
                color: SaaptTheme.success,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _MetricCard(
                value: grade,
                label: 'Grade',
                color: SaaptTheme.primary,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _MetricCard(
                value: '${papers.length}',
                label: 'Subjects',
                color: SaaptTheme.warning,
              ),
            ),
          ],
        ),
        const SizedBox(height: 18),
        _SubjectGraph(studentName: student.fullName, results: results),
        const SizedBox(height: 18),
        _LinkedNote(),
      ],
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.value,
    required this.label,
    required this.color,
  });

  final String value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 8),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(8),
      border: Border.all(color: const Color(0xFFDDE5F2)),
    ),
    child: Column(
      children: [
        FittedBox(
          fit: BoxFit.scaleDown,
          child: Text(
            value,
            style: TextStyle(
              color: color,
              fontSize: 31,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        const SizedBox(height: 5),
        Text(
          label,
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: Color(0xFF91A0BA),
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    ),
  );
}

class _SubjectGraph extends StatelessWidget {
  const _SubjectGraph({required this.studentName, required this.results});

  final String studentName;
  final List<_SubjectResult> results;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.fromLTRB(18, 18, 18, 20),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(8),
      border: Border.all(color: const Color(0xFFDDE5F2)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '$studentName - Subject-wise Performance',
          style: const TextStyle(
            color: Color(0xFF102044),
            fontSize: 19,
            fontWeight: FontWeight.w800,
            height: 1.25,
          ),
        ),
        const SizedBox(height: 18),
        SizedBox(
          height: 190,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              for (final result in results) ...[
                Expanded(child: _SubjectBar(result: result)),
                if (result != results.last) const SizedBox(width: 8),
              ],
            ],
          ),
        ),
      ],
    ),
  );
}

class _SubjectBar extends StatelessWidget {
  const _SubjectBar({required this.result});
  final _SubjectResult result;

  @override
  Widget build(BuildContext context) {
    final percent = result.percent.clamp(0, 1).toDouble();
    final color = percent >= 0.85
        ? SaaptTheme.success
        : percent >= 0.7
        ? SaaptTheme.primary
        : SaaptTheme.warning;
    final height = result.record == null ? 24.0 : 32 + (112 * percent);
    return Column(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        Tooltip(
          message: result.record == null
              ? 'Marks pending'
              : '${result.record!.marks} / ${result.maxMarks}',
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 250),
            height: height,
            width: double.infinity,
            constraints: const BoxConstraints(maxWidth: 56),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [color, color.withValues(alpha: 0.55)],
              ),
              borderRadius: BorderRadius.circular(8),
            ),
          ),
        ),
        const SizedBox(height: 9),
        Text(
          result.subjectLabel,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: Color(0xFF60708F),
            fontWeight: FontWeight.w800,
            fontSize: 12,
          ),
        ),
      ],
    );
  }
}

class _LinkedNote extends StatelessWidget {
  const _LinkedNote();

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      color: const Color(0xFFEAF1FF),
      borderRadius: BorderRadius.circular(8),
      border: Border.all(color: const Color(0xFFD5E2FF)),
    ),
    child: const Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Linked with Student Selection',
          style: TextStyle(
            color: SaaptTheme.primary,
            fontSize: 20,
            fontWeight: FontWeight.w800,
          ),
        ),
        SizedBox(height: 8),
        Text(
          'Performance view changes based on the selected class, examination, and student.',
          style: TextStyle(
            color: Color(0xFF60708F),
            fontSize: 15,
            fontWeight: FontWeight.w600,
            height: 1.35,
          ),
        ),
      ],
    ),
  );
}

class _SelectField extends StatelessWidget {
  const _SelectField({
    required this.label,
    required this.value,
    required this.items,
    required this.onChanged,
    this.hint,
  });

  final String label;
  final String? value;
  final List<DropdownMenuItem<String>> items;
  final ValueChanged<String?>? onChanged;
  final String? hint;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Text(
        label,
        style: const TextStyle(
          color: Color(0xFF91A0BA),
          fontSize: 12,
          fontWeight: FontWeight.w800,
        ),
      ),
      const SizedBox(height: 7),
      DropdownButtonFormField<String>(
        key: ValueKey('$label:$value:${items.length}'),
        initialValue: items.any((item) => item.value == value) ? value : null,
        isExpanded: true,
        hint: hint == null ? null : Text(hint!),
        items: items,
        onChanged: items.isEmpty ? null : onChanged,
      ),
    ],
  );
}

class _MessageCard extends StatelessWidget {
  const _MessageCard({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(8),
      border: Border.all(color: const Color(0xFFDDE5F2)),
    ),
    child: Text(
      message,
      textAlign: TextAlign.center,
      style: const TextStyle(
        color: Color(0xFF60708F),
        fontWeight: FontWeight.w600,
      ),
    ),
  );
}

class _FullScreenMessage extends StatelessWidget {
  const _FullScreenMessage({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Text(message, textAlign: TextAlign.center),
    ),
  );
}

class _ExamChoice {
  const _ExamChoice({required this.id, required this.name});

  final String id;
  final String name;
}

class _SubjectResult {
  const _SubjectResult({required this.paper, this.record});

  final ExamPaper paper;
  final MarkRecord? record;

  num get maxMarks => paper.maxMarks <= 0 ? 100 : paper.maxMarks;

  double get percent {
    if (record == null || maxMarks == 0) return 0;
    return (record!.marks / maxMarks).toDouble();
  }

  String get subjectLabel {
    final raw = paper.subjectName?.trim();
    if (raw == null || raw.isEmpty) return 'Subject';
    if (raw.length <= 4) return raw;
    return raw.substring(0, 4);
  }
}

List<_ExamChoice> _examChoices(List<ExamPaper> papers) {
  final choices = <_ExamChoice>[];
  final seen = <String>{};
  final sorted = [...papers]
    ..sort((a, b) {
      final dateCompare = (b.scheduledAt ?? DateTime(0)).compareTo(
        a.scheduledAt ?? DateTime(0),
      );
      if (dateCompare != 0) return dateCompare;
      return (a.examName ?? '').compareTo(b.examName ?? '');
    });
  for (final paper in sorted) {
    if (paper.examId.isEmpty || !seen.add(paper.examId)) continue;
    choices.add(
      _ExamChoice(id: paper.examId, name: paper.examName ?? 'Examination'),
    );
  }
  return choices;
}

String _sectionLabel(AssignedSection section) {
  return section.name.length <= 2 ? 'Section ${section.name}' : section.name;
}

String _gradeForAverage(double average) {
  if (average >= 90) return 'A';
  if (average >= 75) return 'B';
  if (average >= 60) return 'C';
  if (average >= 40) return 'D';
  return 'E';
}
