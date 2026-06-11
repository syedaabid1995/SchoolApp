import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/permissions/mobile_module.dart';
import '../../../core/theme/prototype_colors.dart';
import '../../../core/widgets/prototype_widgets.dart';
import '../../../shared/models/mobile_dashboard_data.dart';
import '../../../shared/services/mobile_data_repository.dart';

class ModulePlaceholderScreen extends StatelessWidget {
  const ModulePlaceholderScreen({super.key, required this.moduleKey});

  final String moduleKey;

  @override
  Widget build(BuildContext context) {
    return switch (moduleKey) {
      'my-attendance' => const _MyAttendanceScreen(),
      'student-attendance' => const _StudentAttendanceScreen(),
      'my-timetable' || 'timetable' => const _TimetableScreen(),
      'my-classes' => const _MyClassesScreen(),
      'exams' || 'marks-entry' => const _ExamsScreen(),
      'results' || 'reports' => const _ReportsScreen(),
      _ => _GenericModuleScreen(moduleKey: moduleKey),
    };
  }
}

class _ModuleDataScaffold extends ConsumerWidget {
  const _ModuleDataScaffold({
    required this.hero,
    required this.builder,
    this.activeIndex = 0,
  });

  final PrototypeHero hero;
  final int activeIndex;
  final List<Widget> Function(
    BuildContext context,
    WidgetRef ref,
    MobileDashboardData data,
  )
  builder;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(mobileDashboardDataProvider);
    return PrototypeScaffold(
      hero: hero,
      bottomNavigation: SessionBottomNav(activeIndex: activeIndex),
      children: data.when(
        loading: () => const [
          PrototypeCard(child: Center(child: CircularProgressIndicator())),
        ],
        error: (error, stackTrace) => [
          PrototypeCard(
            variant: PrototypeCardVariant.orange,
            child: Text('Unable to load data: $error'),
          ),
        ],
        data: (value) => builder(context, ref, value),
      ),
    );
  }
}

class _MyAttendanceScreen extends StatelessWidget {
  const _MyAttendanceScreen();

  @override
  Widget build(BuildContext context) {
    return _ModuleDataScaffold(
      activeIndex: 3,
      hero: const PrototypeHero(
        label: 'Self Attendance',
        title: 'My Attendance',
        subtitle: 'Live employee attendance from backend',
        icon: Icons.person_pin_circle_outlined,
      ),
      builder: (context, ref, data) => [
        StatGrid(
          children: [
            StatCard(
              value: '${data.selfAttendance.length}',
              label: 'This Month',
              color: PrototypeColors.green,
            ),
            StatCard(
              value: data.selfAttendance.isEmpty ? '0' : '1',
              label: 'Today',
              color: data.selfAttendance.isEmpty
                  ? PrototypeColors.orange
                  : PrototypeColors.green,
            ),
          ],
        ),
        const SizedBox(height: 12),
        PrototypeButton(
          label: data.selfAttendance.isEmpty
              ? 'Mark Present'
              : 'Attendance Marked',
          icon: Icons.location_on_outlined,
          green: data.selfAttendance.isEmpty,
          onPressed: data.selfAttendance.isEmpty
              ? () async {
                  await ref
                      .read(mobileDataRepositoryProvider)
                      .markSelfPresent();
                  ref.invalidate(mobileDashboardDataProvider);
                }
              : null,
        ),
        const SizedBox(height: 12),
        const SectionTitle('Recent Records'),
        const SizedBox(height: 12),
        if (data.selfAttendance.isEmpty)
          const PrototypeCard(
            child: Text('No self-attendance records found for this month.'),
          )
        else
          ...data.selfAttendance
              .take(10)
              .map(
                (record) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: PrototypeRow(
                    icon: Icons.event_available_outlined,
                    title:
                        record.date?.toIso8601String().split('T').first ??
                        'Date unavailable',
                    subtitle: 'Status from backend',
                    tag: StatusTag(
                      label: record.status,
                      color: record.status == 'PRESENT'
                          ? PrototypeColors.green
                          : PrototypeColors.orange,
                    ),
                  ),
                ),
              ),
      ],
    );
  }
}

class _StudentAttendanceScreen extends StatelessWidget {
  const _StudentAttendanceScreen();

  @override
  Widget build(BuildContext context) {
    return _ModuleDataScaffold(
      activeIndex: 1,
      hero: const PrototypeHero(
        label: 'Student Attendance',
        title: 'Class Attendance',
        subtitle: 'Teacher assigned class/section scope',
        icon: Icons.fact_check_outlined,
      ),
      builder: (context, ref, data) {
        final summary = data.attendanceSummary;
        final assignedStudents = ref.watch(assignedStudentsProvider);
        return [
          if (summary == null)
            const PrototypeCard(
              child: Text(
                'Attendance summary is unavailable for this role or plan.',
              ),
            )
          else ...[
            StatGrid(
              children: [
                StatCard(
                  value: '${summary.present}',
                  label: 'Present',
                  color: PrototypeColors.green,
                ),
                StatCard(
                  value: '${summary.absent}',
                  label: 'Absent',
                  color: PrototypeColors.red,
                ),
                StatCard(
                  value: '${summary.sessions}',
                  label: 'Sessions',
                  color: PrototypeColors.blue,
                ),
              ],
            ),
            const SizedBox(height: 12),
            const PrototypeCard(
              variant: PrototypeCardVariant.blue,
              child: Text(
                'Create/update student attendance uses backend assignment checks. The app never passes arbitrary schoolId.',
              ),
            ),
          ],
          const SizedBox(height: 12),
          const SectionTitle('Assigned Classes'),
          const SizedBox(height: 12),
          if (data.user.employeeProfile?.classAssignments.isEmpty ?? true)
            const PrototypeCard(child: Text('No assigned classes found.'))
          else
            ...data.user.employeeProfile!.classAssignments.map(
              (item) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: PrototypeRow(
                  icon: Icons.groups_2_outlined,
                  title: item.className,
                  subtitle: item.sectionName ?? 'All sections',
                  tag: const StatusTag(
                    label: 'Assigned',
                    color: PrototypeColors.blue,
                  ),
                ),
              ),
            ),
          const SectionTitle('Assigned Students'),
          const SizedBox(height: 12),
          assignedStudents.when(
            loading: () => const PrototypeCard(
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (error, stackTrace) => PrototypeCard(
              variant: PrototypeCardVariant.orange,
              child: Text('Unable to load assigned students: $error'),
            ),
            data: (students) {
              if (students.isEmpty) {
                return const PrototypeCard(
                  child: Text('No students found in assigned classes.'),
                );
              }
              return Column(
                children: students
                    .take(30)
                    .map(
                      (student) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: PrototypeRow(
                          icon: Icons.person_outline,
                          title: student.fullName,
                          subtitle:
                              '${student.className ?? 'Class'} ${student.sectionName ?? ''} - ${student.admissionNo}',
                          tag: student.rollNo == null
                              ? null
                              : StatusTag(
                                  label: 'Roll ${student.rollNo}',
                                  color: PrototypeColors.blue,
                                ),
                        ),
                      ),
                    )
                    .toList(),
              );
            },
          ),
        ];
      },
    );
  }
}

class _TimetableScreen extends StatelessWidget {
  const _TimetableScreen();

  @override
  Widget build(BuildContext context) {
    return _ModuleDataScaffold(
      activeIndex: 1,
      hero: const PrototypeHero(
        label: 'Timetable',
        title: 'My Timetable',
        subtitle: 'Today from published timetable',
        icon: Icons.schedule_outlined,
      ),
      builder: (context, ref, data) {
        final periods =
            data.teacherTimetable?.periods ?? const <TimetablePeriodItem>[];
        return [
          if (periods.isEmpty)
            const PrototypeCard(
              child: Text('No timetable periods found for today.'),
            )
          else
            ...periods.map(
              (period) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: PrototypeRow(
                  icon: Icons.schedule_outlined,
                  title:
                      '${period.subjectName} - ${period.className} ${period.sectionName}',
                  subtitle:
                      '${period.periodName} ${period.startTime ?? ''}-${period.endTime ?? ''}',
                  tag: period.room == null
                      ? null
                      : StatusTag(
                          label: period.room!,
                          color: PrototypeColors.blue,
                        ),
                ),
              ),
            ),
        ];
      },
    );
  }
}

class _MyClassesScreen extends StatelessWidget {
  const _MyClassesScreen();

  @override
  Widget build(BuildContext context) {
    return _ModuleDataScaffold(
      activeIndex: 1,
      hero: const PrototypeHero(
        label: 'Class Setup',
        title: 'My Classes',
        subtitle: 'Assigned classes and subjects',
        icon: Icons.groups_2_outlined,
      ),
      builder: (context, ref, data) => [
        StatGrid(
          children: [
            StatCard(
              value: '${data.assignedClassCount}',
              label: 'Classes',
              color: PrototypeColors.blue,
            ),
            StatCard(
              value: '${data.assignedSubjectCount}',
              label: 'Subjects',
              color: PrototypeColors.green,
            ),
          ],
        ),
        const SizedBox(height: 12),
        const SectionTitle('Classes'),
        const SizedBox(height: 12),
        if (data.user.employeeProfile?.classAssignments.isEmpty ?? true)
          const PrototypeCard(child: Text('No classes assigned.'))
        else
          ...data.user.employeeProfile!.classAssignments.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: PrototypeRow(
                icon: Icons.groups_outlined,
                title: item.className,
                subtitle: item.sectionName ?? 'All sections',
              ),
            ),
          ),
        const SectionTitle('Subjects'),
        const SizedBox(height: 12),
        if (data.user.employeeProfile?.subjectAssignments.isEmpty ?? true)
          const PrototypeCard(child: Text('No subjects assigned.'))
        else
          ...data.user.employeeProfile!.subjectAssignments.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: PrototypeRow(
                icon: Icons.menu_book_outlined,
                title: item.subjectName,
                subtitle: item.classId == null
                    ? 'Assigned subject'
                    : 'Class scoped subject',
              ),
            ),
          ),
      ],
    );
  }
}

class _ExamsScreen extends StatelessWidget {
  const _ExamsScreen();

  @override
  Widget build(BuildContext context) {
    return _ModuleDataScaffold(
      activeIndex: 2,
      hero: const PrototypeHero(
        label: 'Exams',
        title: 'Exam Workspace',
        subtitle: 'Assigned exams and marks entry',
        icon: Icons.assignment_outlined,
      ),
      builder: (context, ref, data) {
        final assignedPapers = ref.watch(assignedExamPapersProvider);
        return [
          if (data.exams.isEmpty)
            const PrototypeCard(
              child: Text('No exams found for your current school context.'),
            )
          else
            ...data.exams
                .take(20)
                .map(
                  (exam) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: PrototypeRow(
                      icon: Icons.assignment_outlined,
                      title: exam.name,
                      subtitle: '${exam.type} - ${exam.status}',
                      tag: StatusTag(
                        label: exam.status,
                        color: exam.status == 'PUBLISHED'
                            ? PrototypeColors.green
                            : PrototypeColors.orange,
                      ),
                    ),
                  ),
                ),
          const SectionTitle('Assigned Papers'),
          const SizedBox(height: 12),
          assignedPapers.when(
            loading: () => const PrototypeCard(
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (error, stackTrace) => PrototypeCard(
              variant: PrototypeCardVariant.orange,
              child: Text('Unable to load assigned papers: $error'),
            ),
            data: (papers) {
              if (papers.isEmpty) {
                return const PrototypeCard(
                  child: Text('No assigned exam papers found.'),
                );
              }
              return Column(
                children: papers
                    .take(30)
                    .map(
                      (paper) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: PrototypeRow(
                          icon: Icons.edit_note_outlined,
                          title: '${paper.subjectName} - ${paper.examName}',
                          subtitle:
                              '${paper.className} ${paper.sectionName} - Max ${paper.maxMarks.toStringAsFixed(0)}',
                          tag: StatusTag(
                            label: '${paper.markCount} marks',
                            color: paper.markCount > 0
                                ? PrototypeColors.green
                                : PrototypeColors.orange,
                          ),
                        ),
                      ),
                    )
                    .toList(),
              );
            },
          ),
        ];
      },
    );
  }
}

class _ReportsScreen extends StatelessWidget {
  const _ReportsScreen();

  @override
  Widget build(BuildContext context) {
    return _ModuleDataScaffold(
      activeIndex: 2,
      hero: const PrototypeHero(
        label: 'Reports',
        title: 'Attendance Dashboard',
        subtitle: 'Live summaries where permitted',
        icon: Icons.insert_chart_outlined,
      ),
      builder: (context, ref, data) {
        final summary = data.attendanceSummary;
        return [
          if (summary == null)
            const PrototypeCard(
              child: Text('No report summary is available for this role.'),
            )
          else ...[
            StatGrid(
              children: [
                StatCard(
                  value: '${summary.present}',
                  label: 'Present',
                  color: PrototypeColors.green,
                ),
                StatCard(
                  value: '${summary.absent}',
                  label: 'Absent',
                  color: PrototypeColors.red,
                ),
                StatCard(
                  value: '${summary.records}',
                  label: 'Records',
                  color: PrototypeColors.blue,
                ),
              ],
            ),
            const SizedBox(height: 12),
            const BarChartCard(title: 'Current Attendance Snapshot'),
          ],
        ];
      },
    );
  }
}

class _GenericModuleScreen extends StatelessWidget {
  const _GenericModuleScreen({required this.moduleKey});

  final String moduleKey;

  @override
  Widget build(BuildContext context) {
    final module = mobileModules
        .where((entry) => entry.key == moduleKey)
        .firstOrNull;

    return PrototypeScaffold(
      hero: PrototypeHero(
        label: 'School ERP',
        title: module?.title ?? 'Module',
        subtitle: module?.description ?? 'Ready for feature implementation',
        icon: module?.icon ?? Icons.apps_outlined,
      ),
      bottomNavigation: const SessionBottomNav(activeIndex: 0),
      children: [
        PrototypeCard(
          child: Text(
            'This module is visible based on your backend role/permissions. API wiring will be added when its safe mobile workflow is defined.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
        ),
      ],
    );
  }
}
