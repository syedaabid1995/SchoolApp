import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../global_ui/core/services/notification_service.dart';
import '../../../../../global_ui/features/attendance/presentation/providers/attendance_providers.dart';
import '../../../../../global_ui/features/auth/domain/entities/auth_session.dart';
import '../../../../../global_ui/features/auth/presentation/providers/auth_controller.dart';
import '../../../../../global_ui/features/auth/presentation/providers/auth_providers.dart';
import '../../../../../global_ui/features/classes/presentation/providers/class_assignment_providers.dart';
import '../../../../../global_ui/features/notices/presentation/providers/notice_providers.dart';
import '../../../../../global_ui/features/notifications/presentation/providers/notification_providers.dart';
import '../../../../../global_ui/features/profile/presentation/providers/profile_providers.dart';
import '../../../../app/theme/saapt_theme.dart';

Future<void> showSaaptSchoolSwitchSheet(
  BuildContext context,
  WidgetRef ref,
) async {
  final schools = await ref
      .read(authRepositoryProvider)
      .listAccessibleSchools();
  if (!context.mounted) return;

  await showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
    ),
    builder: (sheetContext) {
      return _SchoolSwitchSheet(schools: schools, ref: ref);
    },
  );
}

class _SchoolSwitchSheet extends StatefulWidget {
  const _SchoolSwitchSheet({required this.schools, required this.ref});

  final List<SchoolLoginOption> schools;
  final WidgetRef ref;

  @override
  State<_SchoolSwitchSheet> createState() => _SchoolSwitchSheetState();
}

class _SchoolSwitchSheetState extends State<_SchoolSwitchSheet> {
  String? _switchingSchoolId;

  @override
  Widget build(BuildContext context) {
    final currentSchoolId = widget.ref
        .watch(authControllerProvider)
        .value
        ?.user
        ?.schoolId;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 22),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Change School',
              style: TextStyle(
                color: SaaptTheme.navy,
                fontSize: 20,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Select the school workspace for this teacher account.',
              style: TextStyle(
                color: Color(0xFF60708F),
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 16),
            if (widget.schools.isEmpty)
              const _SchoolEmptyState()
            else
              Flexible(
                child: ListView.separated(
                  shrinkWrap: true,
                  itemCount: widget.schools.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (context, index) {
                    final school = widget.schools[index];
                    final selected = school.id == currentSchoolId;
                    final switching = _switchingSchoolId == school.id;
                    return _SchoolOptionTile(
                      school: school,
                      selected: selected,
                      switching: switching,
                      onTap: selected || _switchingSchoolId != null
                          ? null
                          : () => _switchSchool(context, school),
                    );
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _switchSchool(
    BuildContext context,
    SchoolLoginOption school,
  ) async {
    setState(() => _switchingSchoolId = school.id);
    try {
      await widget.ref
          .read(authControllerProvider.notifier)
          .switchSchool(schoolId: school.id);
      _invalidateSchoolScopedProviders(widget.ref);
      unawaited(widget.ref.read(notificationServiceProvider).syncDeviceToken());
      if (!context.mounted) return;
      Navigator.of(context).pop();
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Switched to ${school.name}.')));
    } catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) setState(() => _switchingSchoolId = null);
    }
  }
}

void _invalidateSchoolScopedProviders(WidgetRef ref) {
  ref.invalidate(profileProvider);
  ref.invalidate(staffPushPreferenceProvider);
  ref.invalidate(attendanceSummaryProvider);
  ref.invalidate(teacherAttendanceHistoryProvider);
  ref.invalidate(studentAttendanceOptionsProvider);
  ref.invalidate(classAssignmentsProvider);
  ref.invalidate(noticeBoardProvider);
  ref.invalidate(pushNotificationCenterProvider);
}

class _SchoolOptionTile extends StatelessWidget {
  const _SchoolOptionTile({
    required this.school,
    required this.selected,
    required this.switching,
    required this.onTap,
  });

  final SchoolLoginOption school;
  final bool selected;
  final bool switching;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => InkWell(
    borderRadius: BorderRadius.circular(14),
    onTap: onTap,
    child: Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: selected ? const Color(0xFFEAF1FF) : const Color(0xFFF7FAFF),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: selected ? SaaptTheme.primary : const Color(0xFFDDE5F2),
        ),
      ),
      child: Row(
        children: [
          CircleAvatar(
            backgroundColor: selected ? SaaptTheme.primary : Colors.white,
            foregroundColor: selected ? Colors.white : SaaptTheme.primary,
            child: const Icon(Icons.school_outlined),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  school.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: SaaptTheme.navy,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                if (school.code.trim().isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(
                    school.code,
                    style: const TextStyle(
                      color: Color(0xFF60708F),
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ],
            ),
          ),
          if (switching)
            const SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(strokeWidth: 2.4),
            )
          else if (selected)
            const Icon(Icons.check_circle, color: SaaptTheme.primary)
          else
            const Icon(Icons.chevron_right_rounded, color: Color(0xFF60708F)),
        ],
      ),
    ),
  );
}

class _SchoolEmptyState extends StatelessWidget {
  const _SchoolEmptyState();

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      color: const Color(0xFFF7FAFF),
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: const Color(0xFFDDE5F2)),
    ),
    child: const Text(
      'No other school workspace is available for this account.',
      style: TextStyle(color: Color(0xFF60708F), fontWeight: FontWeight.w700),
    ),
  );
}
