import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/auth_session.dart';
import '../../../core/permissions/permission_checker.dart';
import '../../../core/theme/prototype_colors.dart';
import '../../../core/widgets/prototype_widgets.dart';
import '../../../shared/services/mobile_data_repository.dart';
import '../../auth/presentation/auth_controller.dart';

// Backend custom day scheme: 1=Sat, 2=Sun, 3=Mon, 4=Tue, 5=Wed, 6=Thu, 7=Fri
int _backendDayOfWeek(DateTime d) {
  return switch (d.weekday) {
    6 => 1,
    7 => 2,
    1 => 3,
    2 => 4,
    3 => 5,
    4 => 6,
    5 => 7,
    _ => 3,
  };
}

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authControllerProvider);
    final session = authState.session;
    if (authState.status == AuthStatus.checking || session == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final modules = visibleModules(
      permissions: session.user.permissions,
      role: session.user.effectiveRole,
    );
    final dashboardData = ref.watch(mobileDashboardDataProvider);

    return PrototypeScaffold(
      hero: PrototypeHero(
        label: 'Teacher Dashboard',
        title: session.user.school?.name.isNotEmpty == true
            ? session.user.school!.name
            : 'School ERP',
        subtitle:
            '${session.user.name} - ${(session.user.effectiveRole ?? 'USER').replaceAll('_', ' ')}',
        icon: Icons.school_outlined,
      ),
      bottomNavigation: const SessionBottomNav(activeIndex: 0),
      children: [
        PrototypeCard(
          variant: PrototypeCardVariant.blue,
          child: Text.rich(
            TextSpan(
              text: 'Today: 15 May 2026\n',
              style: const TextStyle(
                color: PrototypeColors.blue,
                fontWeight: FontWeight.w800,
              ),
              children: [
                TextSpan(
                  text:
                      'Welcome ${session.user.name}. Your module list is based on backend permissions and role.',
                  style: const TextStyle(
                    color: PrototypeColors.muted,
                    fontSize: 13,
                    fontWeight: FontWeight.w400,
                    height: 1.55,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        dashboardData.when(
          loading: () => const PrototypeCard(
            child: Center(child: CircularProgressIndicator()),
          ),
          error: (error, stackTrace) => PrototypeCard(
            variant: PrototypeCardVariant.orange,
            child: Text('Unable to load live dashboard data: $error'),
          ),
          data: (data) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
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
              const SectionTitle("Today's Timetable"),
              const SizedBox(height: 12),
              const _TodayTimetableWidget(),
              const SectionTitle('Attendance Shortcut'),
              const SizedBox(height: 12),
              PrototypeButton(
                label: data.selfAttendance.isEmpty
                    ? 'Mark My Attendance'
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
            ],
          ),
        ),
        const SizedBox(height: 12),
        const SectionTitle('Allowed Modules'),
        const SizedBox(height: 12),
        if (modules.isEmpty)
          const PrototypeCard(
            child: Text(
              'No mobile modules are available for your current permissions.',
            ),
          )
        else
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: modules.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 1.03,
            ),
            itemBuilder: (context, index) {
              final module = modules[index];
              return PrototypeCard(
                padding: EdgeInsets.zero,
                child: InkWell(
                  borderRadius: BorderRadius.circular(20),
                  onTap: () => context.go('/module/${module.key}'),
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: PrototypeColors.blueSoft,
                            borderRadius: BorderRadius.circular(13),
                            border: Border.all(
                              color: PrototypeColors.blueBorder,
                            ),
                          ),
                          child: Icon(module.icon, color: PrototypeColors.blue),
                        ),
                        const Spacer(),
                        Text(
                          module.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          module.description ?? '',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 11,
                            color: PrototypeColors.muted,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
      ],
    );
  }
}

class _TodayTimetableWidget extends ConsumerWidget {
  const _TodayTimetableWidget();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final timetableAsync = ref.watch(myTimetableProvider);
    return timetableAsync.when(
      loading: () => const PrototypeCard(
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (e, s) => const PrototypeCard(
        child: Text('Could not load timetable.'),
      ),
      data: (tt) {
        final today = _backendDayOfWeek(DateTime.now());
        final todayRoutines =
            tt.routines.where((r) => r.dayOfWeek == today).toList();

        if (todayRoutines.isEmpty) {
          return const PrototypeCard(
            child: Text('No classes scheduled for today.'),
          );
        }

        return Column(
          children: todayRoutines.map((r) {
            final period =
                tt.periods.where((p) => p.id == r.timePeriodId).firstOrNull;
            final time =
                period != null ? '${period.startTime}-${period.endTime}' : '';
            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: PrototypeCard(
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 12,
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${r.className} - ${r.sectionName}',
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 14,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            r.subjectName,
                            style: const TextStyle(
                              color: PrototypeColors.blue,
                              fontSize: 13,
                            ),
                          ),
                          if (r.roomNumber != null)
                            Text(
                              'Room ${r.roomNumber}',
                              style: const TextStyle(
                                color: PrototypeColors.muted,
                                fontSize: 12,
                              ),
                            ),
                        ],
                      ),
                    ),
                    if (time.isNotEmpty)
                      Text(
                        time,
                        style: const TextStyle(
                          color: PrototypeColors.muted,
                          fontSize: 12,
                        ),
                      ),
                  ],
                ),
              ),
            );
          }).toList(),
        );
      },
    );
  }
}
