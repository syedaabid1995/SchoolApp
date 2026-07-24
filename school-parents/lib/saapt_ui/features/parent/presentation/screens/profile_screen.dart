import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/saapt_theme.dart';
import '../../../../core/config/parent_app_config.dart';
import '../../../../core/network/parent_api_client.dart';
import '../../../../core/notifications/parent_notification_service.dart';
import '../../data/parent_models.dart';
import '../providers/parent_providers.dart';
import 'parent_screen_widgets.dart';

enum _ProfilePanel {
  menu,
  viewProfile,
  editProfile,
  children,
  changePassword,
  info,
}

class ParentProfileScreen extends ConsumerStatefulWidget {
  const ParentProfileScreen({super.key});

  @override
  ConsumerState<ParentProfileScreen> createState() =>
      _ParentProfileScreenState();
}

class _ParentProfileScreenState extends ConsumerState<ParentProfileScreen> {
  _ProfilePanel _panel = _ProfilePanel.menu;
  String _infoTitle = '';
  String _infoBody = '';
  String? _selectedChildId;
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _currentPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _savingProfile = false;
  bool _changingPassword = false;
  bool _profileSeeded = false;

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final profileState = ref.watch(parentProfileProvider);
    final pushState = ref.watch(parentPushPreferenceProvider);
    return PopScope(
      canPop: _panel == _ProfilePanel.menu && _selectedChildId == null,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        _handleBack();
      },
      child: Scaffold(
        body: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(parentProfileProvider);
            ref.invalidate(parentPushPreferenceProvider);
            if (_selectedChildId != null) {
              ref.invalidate(parentChildDetailProvider(_selectedChildId!));
            }
            await ref.read(parentProfileProvider.future);
          },
          child: ListView(
            padding: EdgeInsets.zero,
            children: [
              ParentHero(
                badge: '👤 Parent Profile',
                title: _titleForPanel(),
                subtitle: _subtitleForPanel(),
                trailing: IconButton(
                  tooltip: 'Back',
                  style: IconButton.styleFrom(
                    backgroundColor: Colors.white.withValues(alpha: 0.16),
                    foregroundColor: Colors.white,
                  ),
                  onPressed: () {
                    if (_panel == _ProfilePanel.menu &&
                        _selectedChildId == null) {
                      Navigator.of(context).maybePop();
                    } else {
                      _handleBack();
                    }
                  },
                  icon: const Icon(Icons.arrow_back_rounded),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 22, 20, 32),
                child: profileState.when(
                  loading: () => const LoadingPanel(),
                  error: (error, _) =>
                      EmptyPanel(message: parentApiError(error)),
                  data: (profile) {
                    _seedProfile(profile);
                    return switch (_panel) {
                      _ProfilePanel.viewProfile => _ViewProfilePanel(
                        profile: profile,
                      ),
                      _ProfilePanel.editProfile => _EditProfilePanel(
                        firstNameController: _firstNameController,
                        lastNameController: _lastNameController,
                        emailController: _emailController,
                        phoneController: _phoneController,
                        saving: _savingProfile,
                        onSave: _saveProfile,
                      ),
                      _ProfilePanel.changePassword => _ChangePasswordPanel(
                        currentPasswordController: _currentPasswordController,
                        newPasswordController: _newPasswordController,
                        confirmPasswordController: _confirmPasswordController,
                        saving: _changingPassword,
                        onSave: _changePassword,
                      ),
                      _ProfilePanel.info => _InfoPanel(
                        title: _infoTitle,
                        body: _infoBody,
                      ),
                      _ProfilePanel.children => _ChildrenPanel(
                        profile: profile,
                        selectedChildId: _selectedChildId,
                        onSelectChild: (childId) =>
                            setState(() => _selectedChildId = childId),
                      ),
                      _ProfilePanel.menu => _ProfileMenuPanel(
                        profile: profile,
                        pushState: pushState,
                        onOpenProfile: () =>
                            setState(() => _panel = _ProfilePanel.viewProfile),
                        onOpenEdit: () =>
                            setState(() => _panel = _ProfilePanel.editProfile),
                        onOpenChildren: () => setState(() {
                          _selectedChildId = null;
                          _panel = _ProfilePanel.children;
                        }),
                        onOpenPassword: () => setState(
                          () => _panel = _ProfilePanel.changePassword,
                        ),
                        onTogglePush: _togglePush,
                        onOpenInfo: _openInfo,
                        onLogout: () => ref
                            .read(parentAuthControllerProvider.notifier)
                            .logout(),
                      ),
                    };
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _titleForPanel() {
    return switch (_panel) {
      _ProfilePanel.editProfile => 'Edit Profile',
      _ProfilePanel.viewProfile => 'Profile',
      _ProfilePanel.children =>
        _selectedChildId == null ? 'Children' : 'Child Profile',
      _ProfilePanel.changePassword => 'Change Password',
      _ProfilePanel.info => _infoTitle,
      _ProfilePanel.menu => 'Account',
    };
  }

  String _subtitleForPanel() {
    return switch (_panel) {
      _ProfilePanel.editProfile => 'Update parent contact details',
      _ProfilePanel.viewProfile => 'Parent account details',
      _ProfilePanel.children =>
        _selectedChildId == null
            ? 'Mapped child profiles'
            : 'Student details and school records',
      _ProfilePanel.changePassword => 'Secure your parent login',
      _ProfilePanel.info => 'Reference information',
      _ProfilePanel.menu => 'Profile, settings, and app information',
    };
  }

  void _handleBack() {
    if (_panel == _ProfilePanel.children && _selectedChildId != null) {
      setState(() => _selectedChildId = null);
      return;
    }
    if (_panel != _ProfilePanel.menu) {
      setState(() {
        _panel = _ProfilePanel.menu;
        _selectedChildId = null;
      });
    }
  }

  void _seedProfile(ParentProfile profile) {
    if (_profileSeeded) return;
    final nameParts = profile.name.trim().split(RegExp(r'\s+'));
    _firstNameController.text = profile.firstName?.trim().isNotEmpty == true
        ? profile.firstName!.trim()
        : nameParts.firstOrNull ?? '';
    _lastNameController.text = profile.lastName?.trim().isNotEmpty == true
        ? profile.lastName!.trim()
        : nameParts.skip(1).join(' ');
    _emailController.text = profile.email;
    _phoneController.text = profile.phone ?? '';
    _profileSeeded = true;
  }

  Future<void> _saveProfile() async {
    if (_savingProfile) return;
    final firstName = _firstNameController.text.trim();
    final lastName = _lastNameController.text.trim();
    final email = _emailController.text.trim();
    final phone = _phoneController.text.trim();
    if (firstName.isEmpty || lastName.isEmpty || !email.contains('@')) {
      _showSnack('Enter first name, last name, and valid email.');
      return;
    }
    setState(() => _savingProfile = true);
    try {
      await ref
          .read(parentRepositoryProvider)
          .updateProfile(
            firstName: firstName,
            lastName: lastName,
            email: email,
            phone: phone.isEmpty ? null : phone,
          );
      _profileSeeded = false;
      ref.invalidate(parentProfileProvider);
      if (!mounted) return;
      setState(() => _panel = _ProfilePanel.menu);
      _showSnack('Profile updated.');
    } catch (error) {
      if (mounted) {
        _showSnack(parentApiError(error, 'Unable to update profile'));
      }
    } finally {
      if (mounted) setState(() => _savingProfile = false);
    }
  }

  Future<void> _changePassword() async {
    if (_changingPassword) return;
    setState(() => _changingPassword = true);
    try {
      await ref
          .read(parentRepositoryProvider)
          .changePassword(
            currentPassword: _currentPasswordController.text,
            newPassword: _newPasswordController.text,
            confirmPassword: _confirmPasswordController.text,
          );
      _currentPasswordController.clear();
      _newPasswordController.clear();
      _confirmPasswordController.clear();
      if (!mounted) return;
      setState(() => _panel = _ProfilePanel.menu);
      _showSnack('Password changed.');
    } catch (error) {
      if (mounted) {
        _showSnack(parentApiError(error, 'Unable to change password'));
      }
    } finally {
      if (mounted) setState(() => _changingPassword = false);
    }
  }

  Future<void> _togglePush(bool enabled) async {
    try {
      await ref.read(parentRepositoryProvider).updatePushEnabled(enabled);
      if (enabled) {
        unawaited(
          ref.read(parentNotificationServiceProvider).syncDeviceToken(),
        );
      }
      ref.invalidate(parentPushPreferenceProvider);
      _showSnack(
        enabled
            ? 'Push notifications enabled.'
            : 'Push notifications disabled.',
      );
    } catch (error) {
      _showSnack(parentApiError(error, 'Unable to update push notifications'));
    }
  }

  void _openInfo(String title, String body) {
    setState(() {
      _infoTitle = title;
      _infoBody = body;
      _panel = _ProfilePanel.info;
    });
  }

  void _showSnack(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }
}

class _ProfileMenuPanel extends StatelessWidget {
  const _ProfileMenuPanel({
    required this.profile,
    required this.pushState,
    required this.onOpenProfile,
    required this.onOpenEdit,
    required this.onOpenChildren,
    required this.onOpenPassword,
    required this.onTogglePush,
    required this.onOpenInfo,
    required this.onLogout,
  });

  final ParentProfile profile;
  final AsyncValue<bool> pushState;
  final VoidCallback onOpenProfile;
  final VoidCallback onOpenEdit;
  final VoidCallback onOpenChildren;
  final VoidCallback onOpenPassword;
  final ValueChanged<bool> onTogglePush;
  final void Function(String title, String body) onOpenInfo;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    final initial = profile.name.trim().isEmpty
        ? 'P'
        : profile.name.trim()[0].toUpperCase();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ParentCard(
          child: Row(
            children: [
              CircleAvatar(
                radius: 32,
                backgroundColor: const Color(0xFFEAF1FF),
                child: Text(
                  initial,
                  style: const TextStyle(
                    color: SaaptTheme.primary,
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      profile.name,
                      style: const TextStyle(
                        color: SaaptTheme.navy,
                        fontSize: 17,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      profile.email,
                      style: const TextStyle(
                        color: Color(0xFF60708F),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    if (profile.phone?.isNotEmpty == true) ...[
                      const SizedBox(height: 2),
                      Text(
                        profile.phone!,
                        style: const TextStyle(
                          color: Color(0xFF60708F),
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        ParentCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              _MenuTile(
                icon: Icons.person_outline,
                title: 'Profile',
                subtitle: 'View parent account details',
                onTap: onOpenProfile,
              ),
              _MenuTile(
                icon: Icons.edit_outlined,
                title: 'Edit Profile',
                subtitle: 'Name, email, and mobile number',
                onTap: onOpenEdit,
              ),
              _MenuTile(
                icon: Icons.family_restroom_outlined,
                title: 'Children',
                subtitle: '${profile.children.length} mapped child profiles',
                onTap: onOpenChildren,
              ),
              _MenuTile(
                icon: Icons.lock_outline,
                title: 'Change Password',
                subtitle: 'Update parent login password',
                onTap: onOpenPassword,
              ),
              _SwitchTile(
                title: 'Push Notifications',
                subtitle: 'Receive absence, exam, and school alerts',
                value: pushState.value ?? false,
                loading: pushState.isLoading,
                onChanged: onTogglePush,
              ),
              _MenuTile(
                icon: Icons.settings_outlined,
                title: 'Settings',
                subtitle: 'Notification and account preferences',
                onTap: () => onOpenInfo(
                  'Settings',
                  'Push notifications can be enabled or disabled from this screen. More parent app settings will be added as modules are enabled.',
                ),
              ),
              _MenuTile(
                icon: Icons.help_outline,
                title: 'Frequently Asked Questions',
                subtitle: 'Common parent app questions',
                onTap: () => onOpenInfo(
                  'Frequently Asked Questions',
                  'Use Home to select a child, Attend to view attendance, Leave to submit leave requests, Reports for marks and attendance reports, and Alerts for school notifications.',
                ),
              ),
              _MenuTile(
                icon: Icons.privacy_tip_outlined,
                title: 'Privacy Policy',
                subtitle: 'How parent and student data is handled',
                onTap: () => onOpenInfo(
                  'Privacy Policy',
                  'Akademifyy uses parent and student data only for school communication, attendance, reports, fees, and related school operations.',
                ),
              ),
              _MenuTile(
                icon: Icons.description_outlined,
                title: 'Terms of Service',
                subtitle: 'Parent app usage terms',
                onTap: () => onOpenInfo(
                  'Terms of Service',
                  'Use of this app is subject to your school account access and Akademifyy platform terms.',
                ),
              ),
              const _StaticTile(
                icon: Icons.info_outline,
                title: 'App Version',
                subtitle: ParentAppConfig.appVersion,
              ),
              _MenuTile(
                icon: Icons.logout_rounded,
                title: 'Logout',
                subtitle: 'Sign out from this device',
                danger: true,
                onTap: onLogout,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ChildrenPanel extends StatelessWidget {
  const _ChildrenPanel({
    required this.profile,
    required this.selectedChildId,
    required this.onSelectChild,
  });

  final ParentProfile profile;
  final String? selectedChildId;
  final ValueChanged<String> onSelectChild;

  @override
  Widget build(BuildContext context) {
    if (selectedChildId != null) {
      return _ChildDetailPanel(childId: selectedChildId!);
    }
    if (profile.children.isEmpty) {
      return const EmptyPanel(
        message: 'No children are mapped to this account.',
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ParentCard(
          child: Row(
            children: [
              const Icon(
                Icons.family_restroom_rounded,
                color: SaaptTheme.primary,
                size: 34,
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Children',
                      style: TextStyle(
                        color: SaaptTheme.navy,
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${profile.children.length} child profiles mapped to this parent account',
                      style: const TextStyle(
                        color: Color(0xFF60708F),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        ...profile.children.map(
          (child) => Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: ParentCard(
              padding: const EdgeInsets.all(16),
              child: InkWell(
                borderRadius: BorderRadius.circular(14),
                onTap: () => onSelectChild(child.id),
                child: Row(
                  children: [
                    _ChildAvatar(child: child, size: 56),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            child.name,
                            style: const TextStyle(
                              color: SaaptTheme.navy,
                              fontSize: 16,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 5),
                          Text(
                            [
                              if (child.schoolName?.trim().isNotEmpty == true)
                                child.schoolName!,
                              child.classLabel,
                            ].join(' • '),
                            style: const TextStyle(
                              color: Color(0xFF60708F),
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          if (child.rollNo?.trim().isNotEmpty == true) ...[
                            const SizedBox(height: 4),
                            Text(
                              'Roll / Admission: ${child.rollNo}',
                              style: const TextStyle(
                                color: Color(0xFF91A1BB),
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    const Icon(
                      Icons.chevron_right_rounded,
                      color: SaaptTheme.primary,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _ChildDetailPanel extends ConsumerWidget {
  const _ChildDetailPanel({required this.childId});

  final String childId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detailState = ref.watch(parentChildDetailProvider(childId));
    return detailState.when(
      loading: () => const LoadingPanel(),
      error: (error, _) => EmptyPanel(
        message: parentApiError(error, 'Unable to load child profile'),
      ),
      data: (detail) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _ChildSummaryCard(child: detail.child),
          const SizedBox(height: 16),
          _ChildDetailTabs(tabs: detail.tabs),
        ],
      ),
    );
  }
}

class _ChildSummaryCard extends StatelessWidget {
  const _ChildSummaryCard({required this.child});

  final ParentChild child;

  @override
  Widget build(BuildContext context) => ParentCard(
    child: Row(
      children: [
        _ChildAvatar(child: child, size: 72),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                child.name,
                style: const TextStyle(
                  color: SaaptTheme.navy,
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                [
                  if (child.schoolName?.trim().isNotEmpty == true)
                    child.schoolName!,
                  child.classLabel,
                ].join(' • '),
                style: const TextStyle(
                  color: Color(0xFF60708F),
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 6),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  if (child.rollNo?.trim().isNotEmpty == true)
                    _InfoChip(label: 'Roll', value: child.rollNo!),
                  if (child.status?.trim().isNotEmpty == true)
                    _InfoChip(label: 'Status', value: child.status!),
                  if (child.gender?.trim().isNotEmpty == true)
                    _InfoChip(label: 'Gender', value: child.gender!),
                ],
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

class _ChildAvatar extends StatelessWidget {
  const _ChildAvatar({required this.child, required this.size});

  final ParentChild child;
  final double size;

  @override
  Widget build(BuildContext context) {
    final photoUrl = child.photoUrl;
    return ClipRRect(
      borderRadius: BorderRadius.circular(18),
      child: Container(
        width: size,
        height: size,
        color: const Color(0xFFEAF1FF),
        child: photoUrl?.trim().isNotEmpty == true
            ? Image.network(
                photoUrl!,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) => _fallbackAvatar(),
              )
            : _fallbackAvatar(),
      ),
    );
  }

  Widget _fallbackAvatar() => Center(
    child: Text(
      child.name.trim().isEmpty ? 'S' : child.name.trim()[0].toUpperCase(),
      style: TextStyle(
        color: SaaptTheme.primary,
        fontSize: size * 0.36,
        fontWeight: FontWeight.w900,
      ),
    ),
  );
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
    decoration: BoxDecoration(
      color: const Color(0xFFEAF1FF),
      borderRadius: BorderRadius.circular(999),
      border: Border.all(color: const Color(0xFFD9E6FF)),
    ),
    child: Text(
      '$label: ${_displayValue(value)}',
      style: const TextStyle(
        color: SaaptTheme.primary,
        fontSize: 12,
        fontWeight: FontWeight.w900,
      ),
    ),
  );
}

const _childDetailTabs = [
  _ChildTabConfig('profile', 'Profile', Icons.person_outline),
  _ChildTabConfig('parents', 'Parents', Icons.supervisor_account_outlined),
  _ChildTabConfig('fees', 'Fees', Icons.receipt_long_outlined),
  _ChildTabConfig('transport', 'Transport', Icons.directions_bus_outlined),
  _ChildTabConfig('library', 'Library', Icons.local_library_outlined),
  _ChildTabConfig('dormitory', 'Dormitory', Icons.bed_outlined),
  _ChildTabConfig('exam', 'Exam', Icons.assignment_outlined),
  _ChildTabConfig('documents', 'Documents', Icons.folder_outlined),
  _ChildTabConfig('timeline', 'Timeline', Icons.timeline_outlined),
];

class _ChildTabConfig {
  const _ChildTabConfig(this.key, this.label, this.icon);

  final String key;
  final String label;
  final IconData icon;
}

class _ChildDetailTabs extends StatefulWidget {
  const _ChildDetailTabs({required this.tabs});

  final Map<String, dynamic> tabs;

  @override
  State<_ChildDetailTabs> createState() => _ChildDetailTabsState();
}

class _ChildDetailTabsState extends State<_ChildDetailTabs> {
  int _selectedIndex = 0;

  @override
  Widget build(BuildContext context) {
    final selectedTab = _childDetailTabs[_selectedIndex];
    return DefaultTabController(
      length: _childDetailTabs.length,
      initialIndex: _selectedIndex,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ParentCard(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
            child: TabBar(
              isScrollable: true,
              tabAlignment: TabAlignment.start,
              labelColor: SaaptTheme.primary,
              unselectedLabelColor: const Color(0xFF60708F),
              indicatorColor: SaaptTheme.primary,
              labelStyle: const TextStyle(fontWeight: FontWeight.w900),
              onTap: (index) => setState(() => _selectedIndex = index),
              tabs: _childDetailTabs
                  .map(
                    (tab) =>
                        Tab(icon: Icon(tab.icon, size: 20), text: tab.label),
                  )
                  .toList(),
            ),
          ),
          const SizedBox(height: 14),
          _DataPanel(
            title: selectedTab.label,
            data: widget.tabs[selectedTab.key],
          ),
        ],
      ),
    );
  }
}

class _DataPanel extends StatelessWidget {
  const _DataPanel({required this.title, required this.data});

  final String title;
  final Object? data;

  @override
  Widget build(BuildContext context) {
    final cards = _buildCards(data, fallbackTitle: title);
    if (cards.isEmpty) {
      return EmptyPanel(message: 'No $title records available.');
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: cards
          .map(
            (card) => Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: card,
            ),
          )
          .toList(),
    );
  }
}

List<Widget> _buildCards(Object? data, {required String fallbackTitle}) {
  if (_isEmptyData(data)) return const [];
  if (data is List) {
    return data
        .where((item) => !_isEmptyData(item))
        .map(
          (item) =>
              _RecordCard(title: _recordTitle(item, fallbackTitle), data: item),
        )
        .toList();
  }
  if (data is Map) {
    final map = data.map((key, value) => MapEntry(key.toString(), value));
    final cards = <Widget>[];
    final scalarMap = <String, dynamic>{};
    map.forEach((key, value) {
      if (_shouldHideKey(key) || _isEmptyData(value)) return;
      if (_isScalar(value)) {
        scalarMap[key] = value;
      } else if (value is List) {
        cards.addAll(
          value
              .where((item) => !_isEmptyData(item))
              .map(
                (item) => _RecordCard(
                  title: _recordTitle(item, _labelForKey(key)),
                  data: item,
                ),
              ),
        );
      } else {
        cards.add(_RecordCard(title: _labelForKey(key), data: value));
      }
    });
    if (scalarMap.isNotEmpty) {
      cards.insert(0, _RecordCard(title: fallbackTitle, data: scalarMap));
    }
    return cards;
  }
  return [_RecordCard(title: fallbackTitle, data: data)];
}

class _RecordCard extends StatelessWidget {
  const _RecordCard({required this.title, required this.data});

  final String title;
  final Object? data;

  @override
  Widget build(BuildContext context) {
    final rows = _rowsForData(data);
    if (rows.isEmpty) return const SizedBox.shrink();
    return ParentCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              color: SaaptTheme.navy,
              fontSize: 16,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 12),
          ...rows,
        ],
      ),
    );
  }
}

List<Widget> _rowsForData(Object? data) {
  if (data is Map) {
    final entries = data.entries
        .where((entry) => !_shouldHideKey(entry.key.toString()))
        .where((entry) => !_isEmptyData(entry.value))
        .toList();
    return entries.asMap().entries.map((entry) {
      final isLast = entry.key == entries.length - 1;
      final key = entry.value.key.toString();
      final value = entry.value.value;
      return _DetailRow(
        label: _labelForKey(key),
        value: _displayValue(value),
        last: isLast,
      );
    }).toList();
  }
  return [_DetailRow(label: 'Value', value: _displayValue(data), last: true)];
}

bool _isScalar(Object? value) {
  return value == null || value is String || value is num || value is bool;
}

bool _isEmptyData(Object? value) {
  if (value == null) return true;
  if (value is String) return value.trim().isEmpty;
  if (value is List) return value.isEmpty;
  if (value is Map) {
    return value.entries.every(
      (entry) =>
          _shouldHideKey(entry.key.toString()) || _isEmptyData(entry.value),
    );
  }
  return false;
}

bool _shouldHideKey(String key) {
  const hidden = {
    'id',
    'schoolId',
    'studentId',
    'parentId',
    'classId',
    'sectionId',
    'academicSessionId',
    'feeTypeId',
    'feeGroupId',
    'feeStructureId',
    'invoiceId',
    'paymentId',
    'createdById',
    'updatedById',
    'deletedById',
    'reviewedById',
    'uploadedById',
  };
  return hidden.contains(key);
}

String _recordTitle(Object? data, String fallback) {
  if (data is Map) {
    for (final key in const [
      'title',
      'name',
      'fullName',
      'invoiceNumber',
      'paymentNumber',
      'receiptNumber',
      'leaveType',
      'status',
      'memberCode',
    ]) {
      final value = data[key];
      if (value != null && value.toString().trim().isNotEmpty) {
        return _displayValue(value);
      }
    }
  }
  return fallback;
}

String _labelForKey(String key) {
  final spaced = key
      .replaceAllMapped(RegExp(r'([a-z0-9])([A-Z])'), (m) => '${m[1]} ${m[2]}')
      .replaceAll('_', ' ')
      .replaceAll('-', ' ')
      .trim();
  if (spaced.isEmpty) return key;
  return spaced
      .split(RegExp(r'\s+'))
      .map(
        (part) => part.isEmpty
            ? part
            : '${part[0].toUpperCase()}${part.substring(1)}',
      )
      .join(' ');
}

String _displayValue(Object? value) {
  if (value == null) return '-';
  if (value is bool) return value ? 'Yes' : 'No';
  if (value is List) return value.isEmpty ? '-' : '${value.length} record(s)';
  if (value is Map) {
    final preferred = _recordTitle(value, '');
    if (preferred.isNotEmpty) return preferred;
    return '${value.length} field(s)';
  }
  final text = value.toString();
  final date = DateTime.tryParse(text);
  if (date != null && text.length >= 10) {
    return [
      date.day.toString().padLeft(2, '0'),
      date.month.toString().padLeft(2, '0'),
      date.year.toString().padLeft(4, '0'),
    ].join('-');
  }
  return text.replaceAll('_', ' ');
}

class _EditProfilePanel extends StatelessWidget {
  const _EditProfilePanel({
    required this.firstNameController,
    required this.lastNameController,
    required this.emailController,
    required this.phoneController,
    required this.saving,
    required this.onSave,
  });

  final TextEditingController firstNameController;
  final TextEditingController lastNameController;
  final TextEditingController emailController;
  final TextEditingController phoneController;
  final bool saving;
  final VoidCallback onSave;

  @override
  Widget build(BuildContext context) => ParentCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _TextField(label: 'First Name', controller: firstNameController),
        _TextField(label: 'Last Name', controller: lastNameController),
        _TextField(
          label: 'Email',
          controller: emailController,
          keyboardType: TextInputType.emailAddress,
        ),
        _TextField(
          label: 'Mobile Number',
          controller: phoneController,
          keyboardType: TextInputType.phone,
        ),
        const SizedBox(height: 8),
        ElevatedButton(
          style: ElevatedButton.styleFrom(
            minimumSize: const Size.fromHeight(52),
            backgroundColor: SaaptTheme.primary,
            foregroundColor: Colors.white,
          ),
          onPressed: saving ? null : onSave,
          child: Text(saving ? 'Saving...' : 'Save Profile'),
        ),
      ],
    ),
  );
}

class _ViewProfilePanel extends StatelessWidget {
  const _ViewProfilePanel({required this.profile});

  final ParentProfile profile;

  @override
  Widget build(BuildContext context) => ParentCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _DetailRow(label: 'Name', value: profile.name),
        _DetailRow(
          label: 'First Name',
          value: profile.firstName?.trim().isNotEmpty == true
              ? profile.firstName!
              : '-',
        ),
        _DetailRow(
          label: 'Last Name',
          value: profile.lastName?.trim().isNotEmpty == true
              ? profile.lastName!
              : '-',
        ),
        _DetailRow(label: 'Email', value: profile.email),
        _DetailRow(
          label: 'Mobile Number',
          value: profile.phone?.trim().isNotEmpty == true
              ? profile.phone!
              : '-',
        ),
        _DetailRow(
          label: 'School',
          value: profile.schoolName?.trim().isNotEmpty == true
              ? profile.schoolName!
              : '-',
        ),
        _DetailRow(
          label: 'Mapped Children',
          value: profile.children.length.toString(),
          last: true,
        ),
      ],
    ),
  );
}

class _ChangePasswordPanel extends StatelessWidget {
  const _ChangePasswordPanel({
    required this.currentPasswordController,
    required this.newPasswordController,
    required this.confirmPasswordController,
    required this.saving,
    required this.onSave,
  });

  final TextEditingController currentPasswordController;
  final TextEditingController newPasswordController;
  final TextEditingController confirmPasswordController;
  final bool saving;
  final VoidCallback onSave;

  @override
  Widget build(BuildContext context) => ParentCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _TextField(
          label: 'Current Password',
          controller: currentPasswordController,
          obscureText: true,
        ),
        _TextField(
          label: 'New Password',
          controller: newPasswordController,
          obscureText: true,
        ),
        _TextField(
          label: 'Confirm Password',
          controller: confirmPasswordController,
          obscureText: true,
        ),
        const SizedBox(height: 8),
        ElevatedButton(
          style: ElevatedButton.styleFrom(
            minimumSize: const Size.fromHeight(52),
            backgroundColor: SaaptTheme.primary,
            foregroundColor: Colors.white,
          ),
          onPressed: saving ? null : onSave,
          child: Text(saving ? 'Changing...' : 'Change Password'),
        ),
      ],
    ),
  );
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.label,
    required this.value,
    this.last = false,
  });

  final String label;
  final String value;
  final bool last;

  @override
  Widget build(BuildContext context) => Container(
    padding: EdgeInsets.only(bottom: last ? 0 : 14),
    margin: EdgeInsets.only(bottom: last ? 0 : 14),
    decoration: BoxDecoration(
      border: last
          ? null
          : const Border(bottom: BorderSide(color: Color(0xFFE2EAF7))),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 120,
          child: Text(
            label,
            style: const TextStyle(
              color: Color(0xFF91A1BB),
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(
              color: SaaptTheme.navy,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
      ],
    ),
  );
}

class _InfoPanel extends StatelessWidget {
  const _InfoPanel({required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) => ParentCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            color: SaaptTheme.navy,
            fontSize: 18,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 12),
        Text(
          body,
          style: const TextStyle(
            color: Color(0xFF60708F),
            fontSize: 14,
            height: 1.5,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    ),
  );
}

class _TextField extends StatelessWidget {
  const _TextField({
    required this.label,
    required this.controller,
    this.keyboardType,
    this.obscureText = false,
  });

  final String label;
  final TextEditingController controller;
  final TextInputType? keyboardType;
  final bool obscureText;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 14),
    child: TextField(
      controller: controller,
      keyboardType: keyboardType,
      obscureText: obscureText,
      decoration: InputDecoration(labelText: label),
    ),
  );
}

class _MenuTile extends StatelessWidget {
  const _MenuTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.danger = false,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final bool danger;

  @override
  Widget build(BuildContext context) => ListTile(
    leading: Icon(
      icon,
      color: danger ? const Color(0xFFEF4444) : SaaptTheme.primary,
    ),
    title: Text(
      title,
      style: TextStyle(
        fontWeight: FontWeight.w900,
        color: danger ? const Color(0xFFEF4444) : SaaptTheme.navy,
      ),
    ),
    subtitle: Text(subtitle),
    trailing: const Icon(Icons.chevron_right_rounded),
    onTap: onTap,
  );
}

class _StaticTile extends StatelessWidget {
  const _StaticTile({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) => ListTile(
    leading: Icon(icon, color: SaaptTheme.primary),
    title: Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
    subtitle: Text(subtitle),
  );
}

class _SwitchTile extends StatelessWidget {
  const _SwitchTile({
    required this.title,
    required this.subtitle,
    required this.value,
    required this.loading,
    required this.onChanged,
  });

  final String title;
  final String subtitle;
  final bool value;
  final bool loading;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) => SwitchListTile(
    secondary: const Icon(
      Icons.notifications_active_outlined,
      color: SaaptTheme.primary,
    ),
    title: Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
    subtitle: Text(loading ? 'Loading preference...' : subtitle),
    value: value,
    onChanged: loading ? null : onChanged,
  );
}
