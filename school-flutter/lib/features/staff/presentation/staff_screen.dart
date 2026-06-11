import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/prototype_colors.dart';
import '../../../core/widgets/prototype_widgets.dart';
import '../data/staff_models.dart';
import '../data/staff_repository.dart';

const _staffRoles = [
  'SCHOOL_ADMIN',
  'TEACHER',
  'ACCOUNTANT',
  'LIBRARIAN',
  'STAFF',
];

String _roleLabel(String value) => value.replaceAll('_', ' ');

String _friendlyError(Object error) {
  if (error is DioException) {
    final data = error.response?.data;
    if (data is Map<String, dynamic>) {
      final errorBody = data['error'];
      if (errorBody is Map<String, dynamic> && errorBody['message'] is String) {
        return errorBody['message'] as String;
      }
      if (data['message'] is String) return data['message'] as String;
    }
  }
  return error.toString();
}

class StaffScreen extends ConsumerStatefulWidget {
  const StaffScreen({super.key});

  @override
  ConsumerState<StaffScreen> createState() => _StaffScreenState();
}

class _StaffScreenState extends ConsumerState<StaffScreen> {
  var _tab = 0;
  var _search = '';
  String? _role;
  final _searchController = TextEditingController();
  final _today = DateTime.now();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final query = StaffListQuery(search: _search, role: _role);
    final list = ref.watch(staffListProvider(query));
    final attendance = ref.watch(
      staffAttendanceProvider(StaffAttendanceQuery(date: _today, role: _role)),
    );
    final payroll = ref.watch(
      staffPayrollProvider(
        StaffPayrollQuery(month: _today.month, year: _today.year, role: _role),
      ),
    );

    return PrototypeScaffold(
      hero: const PrototypeHero(
        label: 'Staff Module',
        title: 'Staff Workspace',
        subtitle: 'Directory, setup, attendance, and payroll snapshots',
        icon: Icons.badge_outlined,
      ),
      bottomNavigation: const SessionBottomNav(activeIndex: 0),
      children: [
        _StaffTabs(
          selected: _tab,
          onChanged: (value) => setState(() => _tab = value),
        ),
        const SizedBox(height: 12),
        if (_tab == 0)
          _DirectoryTab(
            query: query,
            list: list,
            searchController: _searchController,
            role: _role,
            onRoleChanged: (value) => setState(() => _role = value),
            onSearchChanged: (value) => setState(() => _search = value),
            onRefresh: () => ref.invalidate(staffListProvider(query)),
          )
        else if (_tab == 1)
          _AttendanceTab(attendance: attendance, role: _role)
        else if (_tab == 2)
          _PayrollTab(payroll: payroll)
        else
          const _SetupTab(),
      ],
    );
  }
}

class _StaffTabs extends StatelessWidget {
  const _StaffTabs({required this.selected, required this.onChanged});

  final int selected;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final tabs = [
      (Icons.people_alt_outlined, 'Directory'),
      (Icons.event_available_outlined, 'Attendance'),
      (Icons.payments_outlined, 'Payroll'),
      (Icons.tune_outlined, 'Setup'),
    ];
    return PrototypeCard(
      padding: const EdgeInsets.all(8),
      child: Row(
        children: [
          for (var index = 0; index < tabs.length; index++)
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 2),
                child: InkWell(
                  borderRadius: BorderRadius.circular(14),
                  onTap: () => onChanged(index),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    decoration: BoxDecoration(
                      color: selected == index
                          ? PrototypeColors.blue
                          : Colors.transparent,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          tabs[index].$1,
                          size: 18,
                          color: selected == index
                              ? Colors.white
                              : PrototypeColors.muted,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          tabs[index].$2,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: selected == index
                                ? Colors.white
                                : PrototypeColors.blueDark,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _DirectoryTab extends ConsumerWidget {
  const _DirectoryTab({
    required this.query,
    required this.list,
    required this.searchController,
    required this.role,
    required this.onRoleChanged,
    required this.onSearchChanged,
    required this.onRefresh,
  });

  final StaffListQuery query;
  final AsyncValue<StaffListResponse> list;
  final TextEditingController searchController;
  final String? role;
  final ValueChanged<String?> onRoleChanged;
  final ValueChanged<String> onSearchChanged;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        PrototypeCard(
          child: Column(
            children: [
              TextField(
                controller: searchController,
                decoration: const InputDecoration(
                  prefixIcon: Icon(Icons.search),
                  labelText: 'Search staff',
                  hintText: 'Name, email, employee number, phone',
                ),
                onChanged: onSearchChanged,
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String?>(
                initialValue: role,
                decoration: const InputDecoration(labelText: 'Role'),
                items: [
                  const DropdownMenuItem<String?>(
                    value: null,
                    child: Text('All roles'),
                  ),
                  ..._staffRoles.map(
                    (item) => DropdownMenuItem<String?>(
                      value: item,
                      child: Text(_roleLabel(item)),
                    ),
                  ),
                ],
                onChanged: onRoleChanged,
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        list.when(
          loading: () => const PrototypeCard(
            child: Center(child: CircularProgressIndicator()),
          ),
          error: (error, stackTrace) => PrototypeCard(
            variant: PrototypeCardVariant.orange,
            child: Text('Unable to load staff: ${_friendlyError(error)}'),
          ),
          data: (value) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              StatGrid(
                children: [
                  StatCard(
                    value: '${value.total}',
                    label: 'Staff',
                    color: PrototypeColors.blue,
                  ),
                  StatCard(
                    value:
                        '${value.items.where((item) => item.isActive).length}',
                    label: 'Active',
                    color: PrototypeColors.green,
                  ),
                ],
              ),
              const SizedBox(height: 12),
              PrototypeButton(
                label: 'Add Staff',
                icon: Icons.person_add_alt_1_outlined,
                green: true,
                onPressed: () async {
                  final changed = await context.push<bool>('/staff/new');
                  if (changed == true) onRefresh();
                },
              ),
              const SizedBox(height: 12),
              if (value.items.isEmpty)
                const PrototypeCard(child: Text('No staff found.'))
              else
                ...value.items.map(
                  (staff) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: PrototypeRow(
                      icon: Icons.badge_outlined,
                      title: staff.fullName.isEmpty
                          ? staff.email
                          : staff.fullName,
                      subtitle:
                          '${_roleLabel(staff.roleName)} - ${staff.department?.name ?? 'No department'}',
                      tag: StatusTag(
                        label: staff.employeeNo ?? 'Staff',
                        color: PrototypeColors.blue,
                      ),
                      onTap: () =>
                          _showStaffDetail(context, ref, staff, onRefresh),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _AttendanceTab extends StatelessWidget {
  const _AttendanceTab({required this.attendance, required this.role});

  final AsyncValue<StaffAttendanceDay> attendance;
  final String? role;

  @override
  Widget build(BuildContext context) {
    return attendance.when(
      loading: () => const PrototypeCard(
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (error, stackTrace) => PrototypeCard(
        variant: PrototypeCardVariant.orange,
        child: Text('Unable to load attendance: ${_friendlyError(error)}'),
      ),
      data: (value) {
        final present = value.staff
            .where((item) => item.attendanceStatus == 'PRESENT')
            .length;
        final absent = value.staff
            .where((item) => item.attendanceStatus == 'ABSENT')
            .length;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            StatGrid(
              children: [
                StatCard(
                  value: '${value.staff.length}',
                  label: role == null ? 'Staff' : _roleLabel(role!),
                  color: PrototypeColors.blue,
                ),
                StatCard(
                  value: '$present',
                  label: 'Present',
                  color: PrototypeColors.green,
                ),
                StatCard(
                  value: '$absent',
                  label: 'Absent',
                  color: PrototypeColors.red,
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (value.holidayReason != null)
              PrototypeCard(
                variant: PrototypeCardVariant.orange,
                child: Text('Holiday: ${value.holidayReason}'),
              ),
            const SizedBox(height: 12),
            if (value.staff.isEmpty)
              const PrototypeCard(
                child: Text('No staff attendance rows found.'),
              )
            else
              ...value.staff
                  .take(30)
                  .map(
                    (staff) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: PrototypeRow(
                        icon: Icons.event_available_outlined,
                        title: staff.fullName,
                        subtitle:
                            '${staff.designation?.name ?? _roleLabel(staff.roleName)} - ${staff.attendanceNote ?? 'No note'}',
                        tag: StatusTag(
                          label: staff.attendanceStatus ?? 'PRESENT',
                          color: staff.attendanceStatus == 'ABSENT'
                              ? PrototypeColors.red
                              : PrototypeColors.green,
                        ),
                      ),
                    ),
                  ),
          ],
        );
      },
    );
  }
}

class _PayrollTab extends StatelessWidget {
  const _PayrollTab({required this.payroll});

  final AsyncValue<List<StaffPayrollRow>> payroll;

  @override
  Widget build(BuildContext context) {
    return payroll.when(
      loading: () => const PrototypeCard(
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (error, stackTrace) => PrototypeCard(
        variant: PrototypeCardVariant.orange,
        child: Text('Unable to load payroll: ${_friendlyError(error)}'),
      ),
      data: (rows) {
        final generated = rows
            .where((row) => row.status != 'NOT_GENERATED')
            .length;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            StatGrid(
              children: [
                StatCard(
                  value: '${rows.length}',
                  label: 'Rows',
                  color: PrototypeColors.blue,
                ),
                StatCard(
                  value: '$generated',
                  label: 'Generated',
                  color: PrototypeColors.green,
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (rows.isEmpty)
              const PrototypeCard(child: Text('No payroll rows found.'))
            else
              ...rows
                  .take(30)
                  .map(
                    (row) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: PrototypeRow(
                        icon: Icons.payments_outlined,
                        title: row.staff.fullName,
                        subtitle:
                            '${row.staff.employeeNo ?? 'Staff'} - ${row.staff.department?.name ?? 'No department'}',
                        tag: StatusTag(
                          label: row.status,
                          color: row.status == 'PAID'
                              ? PrototypeColors.green
                              : PrototypeColors.orange,
                        ),
                      ),
                    ),
                  ),
          ],
        );
      },
    );
  }
}

class _SetupTab extends ConsumerWidget {
  const _SetupTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final options = ref.watch(staffOptionsProvider);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        PrototypeButton(
          label: 'Load Staff Presets',
          icon: Icons.auto_fix_high_outlined,
          green: true,
          onPressed: () async {
            try {
              await ref.read(staffRepositoryProvider).loadPresets();
              ref.invalidate(staffOptionsProvider);
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Staff presets loaded')),
                );
              }
            } catch (error) {
              if (context.mounted) {
                ScaffoldMessenger.of(
                  context,
                ).showSnackBar(SnackBar(content: Text(_friendlyError(error))));
              }
            }
          },
        ),
        const SizedBox(height: 12),
        options.when(
          loading: () => const PrototypeCard(
            child: Center(child: CircularProgressIndicator()),
          ),
          error: (error, stackTrace) => PrototypeCard(
            variant: PrototypeCardVariant.orange,
            child: Text('Unable to load setup: ${_friendlyError(error)}'),
          ),
          data: (value) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _OptionSection(
                title: 'Departments',
                icon: Icons.apartment_outlined,
                items: value.departments,
                onCreate: (name) async {
                  await ref
                      .read(staffRepositoryProvider)
                      .createDepartment(name);
                  ref.invalidate(staffOptionsProvider);
                },
              ),
              const SizedBox(height: 12),
              _OptionSection(
                title: 'Designations',
                icon: Icons.workspace_premium_outlined,
                items: value.designations,
                onCreate: (name) async {
                  await ref
                      .read(staffRepositoryProvider)
                      .createDesignation(name);
                  ref.invalidate(staffOptionsProvider);
                },
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _OptionSection extends StatelessWidget {
  const _OptionSection({
    required this.title,
    required this.icon,
    required this.items,
    required this.onCreate,
  });

  final String title;
  final IconData icon;
  final List<StaffOption> items;
  final Future<void> Function(String name) onCreate;

  @override
  Widget build(BuildContext context) {
    return PrototypeCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(icon, color: PrototypeColors.blue),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
              ),
              TextButton.icon(
                onPressed: () => _showCreateOption(context),
                icon: const Icon(Icons.add, size: 18),
                label: const Text('Add'),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (items.isEmpty)
            const Text('No records yet.')
          else
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: items
                  .map(
                    (item) => Chip(
                      label: Text(item.name),
                      visualDensity: VisualDensity.compact,
                    ),
                  )
                  .toList(),
            ),
        ],
      ),
    );
  }

  Future<void> _showCreateOption(BuildContext context) async {
    final controller = TextEditingController();
    final name = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Add $title'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(labelText: 'Name'),
          textInputAction: TextInputAction.done,
          onSubmitted: (value) => Navigator.of(context).pop(value),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(controller.text),
            child: const Text('Add'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (name == null || name.trim().isEmpty) return;
    try {
      await onCreate(name.trim());
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$title updated')));
      }
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(_friendlyError(error))));
      }
    }
  }
}

void _showStaffDetail(
  BuildContext context,
  WidgetRef ref,
  StaffMember staff,
  VoidCallback onChanged,
) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (context) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.72,
      minChildSize: 0.45,
      maxChildSize: 0.92,
      builder: (context, scrollController) => ListView(
        controller: scrollController,
        padding: const EdgeInsets.all(18),
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 26,
                backgroundColor: PrototypeColors.blueSoft,
                child: Text(
                  staff.fullName.isEmpty
                      ? '?'
                      : staff.fullName.characters.first.toUpperCase(),
                  style: const TextStyle(
                    color: PrototypeColors.blue,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      staff.fullName,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    Text(
                      staff.email,
                      style: const TextStyle(color: PrototypeColors.muted),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          _DetailLine(label: 'Role', value: _roleLabel(staff.roleName)),
          _DetailLine(label: 'Employee No', value: staff.employeeNo),
          _DetailLine(label: 'Department', value: staff.department?.name),
          _DetailLine(label: 'Designation', value: staff.designation?.name),
          _DetailLine(label: 'Phone', value: staff.phone),
          _DetailLine(
            label: 'Joined',
            value: staff.dateOfJoining == null
                ? null
                : DateFormat('yyyy-MM-dd').format(staff.dateOfJoining!),
          ),
          _DetailLine(label: 'Address', value: staff.currentAddress),
          _DetailLine(label: 'Qualification', value: staff.qualifications),
          _DetailLine(label: 'Experience', value: staff.experience),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: () async {
                    Navigator.of(context).pop();
                    final changed = await context.push<bool>(
                      '/staff/${staff.id}/edit',
                      extra: staff,
                    );
                    if (changed == true) onChanged();
                  },
                  icon: const Icon(Icons.edit_outlined),
                  label: const Text('Edit'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () async {
                    final confirm = await showDialog<bool>(
                      context: context,
                      builder: (context) => AlertDialog(
                        title: const Text('Delete staff?'),
                        content: Text(
                          'This will remove ${staff.fullName}. Continue?',
                        ),
                        actions: [
                          TextButton(
                            onPressed: () => Navigator.of(context).pop(false),
                            child: const Text('Cancel'),
                          ),
                          FilledButton(
                            onPressed: () => Navigator.of(context).pop(true),
                            child: const Text('Delete'),
                          ),
                        ],
                      ),
                    );
                    if (confirm != true) return;
                    try {
                      await ref
                          .read(staffRepositoryProvider)
                          .deleteStaff(staff.id);
                      if (context.mounted) Navigator.of(context).pop();
                      onChanged();
                    } catch (error) {
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text(_friendlyError(error))),
                        );
                      }
                    }
                  },
                  icon: const Icon(Icons.delete_outline),
                  label: const Text('Delete'),
                ),
              ),
            ],
          ),
        ],
      ),
    ),
  );
}

class _DetailLine extends StatelessWidget {
  const _DetailLine({required this.label, required this.value});

  final String label;
  final String? value;

  @override
  Widget build(BuildContext context) {
    if (value == null || value!.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 112,
            child: Text(
              label,
              style: const TextStyle(
                color: PrototypeColors.muted,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          Expanded(child: Text(value!)),
        ],
      ),
    );
  }
}
