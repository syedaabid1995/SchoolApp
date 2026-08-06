import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../app/theme/saapt_theme.dart';
import '../../../../core/config/parent_app_config.dart';
import '../../../../core/network/parent_api_client.dart';
import '../../../../core/notifications/parent_notification_service.dart';
import '../../data/parent_models.dart';
import '../providers/parent_providers.dart';
import 'parent_fee_payment_screen.dart';
import 'parent_screen_widgets.dart';

enum _ProfilePanel {
  menu,
  viewProfile,
  editProfile,
  schoolProfile,
  children,
  changePassword,
  info,
}

class ParentProfileScreen extends ConsumerStatefulWidget {
  const ParentProfileScreen({
    super.key,
    this.initialChildId,
    this.initialTabKey,
  });

  final String? initialChildId;
  final String? initialTabKey;

  @override
  ConsumerState<ParentProfileScreen> createState() =>
      _ParentProfileScreenState();
}

class _ParentProfileScreenState extends ConsumerState<ParentProfileScreen> {
  _ProfilePanel _panel = _ProfilePanel.menu;
  String _infoTitle = '';
  String _infoBody = '';
  String? _selectedChildId;
  String? _selectedSchoolProfileId;
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
  void initState() {
    super.initState();
    if (widget.initialChildId?.trim().isNotEmpty == true) {
      _panel = _ProfilePanel.children;
      _selectedChildId = widget.initialChildId!.trim();
    }
  }

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
    final childDetailId = _panel == _ProfilePanel.children
        ? _selectedChildId
        : null;
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
            if (childDetailId == null) {
              await ref.read(parentProfileProvider.future);
            }
          },
          child: childDetailId != null
              ? _ChildDetailScroll(
                  childId: childDetailId,
                  initialTabKey: widget.initialTabKey,
                  hero: ParentHero(
                    badge: '👤 Parent Profile',
                    title: _titleForPanel(),
                    subtitle: _subtitleForPanel(),
                    showDefaultTrailing: false,
                    leading: IconButton(
                      tooltip: 'Back',
                      style: IconButton.styleFrom(
                        backgroundColor: Colors.white.withValues(alpha: 0.16),
                        foregroundColor: Colors.white,
                      ),
                      onPressed: _handleBack,
                      icon: const Icon(Icons.arrow_back_rounded),
                    ),
                  ),
                )
              : ListView(
                  padding: EdgeInsets.zero,
                  children: [
                    ParentHero(
                      badge: '👤 Parent Profile',
                      title: _titleForPanel(),
                      subtitle: _subtitleForPanel(),
                      showDefaultTrailing: false,
                      leading: IconButton(
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
                            _ProfilePanel.schoolProfile => _SchoolProfilePanel(
                              profile: profile,
                              selectedSchoolId: _selectedSchoolProfileId,
                              onSelectSchool: (schoolId) => setState(
                                () => _selectedSchoolProfileId = schoolId,
                              ),
                            ),
                            _ProfilePanel.changePassword =>
                              _ChangePasswordPanel(
                                currentPasswordController:
                                    _currentPasswordController,
                                newPasswordController: _newPasswordController,
                                confirmPasswordController:
                                    _confirmPasswordController,
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
                              onOpenProfile: () => setState(
                                () => _panel = _ProfilePanel.viewProfile,
                              ),
                              onOpenEdit: () => setState(
                                () => _panel = _ProfilePanel.editProfile,
                              ),
                              onOpenSchoolProfile: () => setState(() {
                                _selectedSchoolProfileId =
                                    profile.schoolProfiles.isNotEmpty
                                    ? profile.schoolProfiles.first.id
                                    : null;
                                _panel = _ProfilePanel.schoolProfile;
                              }),
                              onOpenChildren: () => setState(() {
                                _selectedChildId = null;
                                _panel = _ProfilePanel.children;
                              }),
                              onOpenOnlineFees: () =>
                                  context.push('/fees/online'),
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
      _ProfilePanel.schoolProfile => 'School Profile',
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
      _ProfilePanel.schoolProfile => 'School contact information',
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
        _selectedSchoolProfileId = null;
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
    required this.onOpenSchoolProfile,
    required this.onOpenChildren,
    required this.onOpenOnlineFees,
    required this.onOpenPassword,
    required this.onTogglePush,
    required this.onOpenInfo,
    required this.onLogout,
  });

  final ParentProfile profile;
  final AsyncValue<bool> pushState;
  final VoidCallback onOpenProfile;
  final VoidCallback onOpenEdit;
  final VoidCallback onOpenSchoolProfile;
  final VoidCallback onOpenChildren;
  final VoidCallback onOpenOnlineFees;
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
                icon: Icons.apartment_outlined,
                title: 'School Profile',
                subtitle: profile.schoolProfiles.length > 1
                    ? '${profile.schoolProfiles.length} school contact profiles'
                    : 'School address and contact information',
                onTap: onOpenSchoolProfile,
              ),
              _MenuTile(
                icon: Icons.family_restroom_outlined,
                title: 'Children',
                subtitle: '${profile.children.length} mapped child profiles',
                onTap: onOpenChildren,
              ),
              _MenuTile(
                icon: Icons.payments_outlined,
                title: 'Online Fee Payment',
                subtitle: 'Fee breakdown, select items, and pay online',
                onTap: onOpenOnlineFees,
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

Future<void> _launchEmail(String email) async {
  final trimmed = email.trim();
  if (trimmed.isEmpty) return;
  await launchUrl(Uri(scheme: 'mailto', path: trimmed));
}

Future<void> _launchPhone(String phone) async {
  final trimmed = phone.trim();
  if (trimmed.isEmpty) return;
  await launchUrl(Uri(scheme: 'tel', path: trimmed));
}

class _ContactActionButton extends StatelessWidget {
  const _ContactActionButton({
    required this.icon,
    required this.label,
    required this.value,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final String value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final enabled = value.trim().isNotEmpty;
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: enabled ? onTap : null,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: enabled ? const Color(0xFFEAF1FF) : const Color(0xFFF7FAFF),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFDDE5F2)),
        ),
        child: Row(
          children: [
            Icon(
              icon,
              color: enabled ? SaaptTheme.primary : const Color(0xFF91A1BB),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: const TextStyle(
                      color: Color(0xFF91A1BB),
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    enabled ? value : '-',
                    style: const TextStyle(
                      color: SaaptTheme.navy,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SchoolProfilePanel extends StatelessWidget {
  const _SchoolProfilePanel({
    required this.profile,
    required this.selectedSchoolId,
    required this.onSelectSchool,
  });

  final ParentProfile profile;
  final String? selectedSchoolId;
  final ValueChanged<String> onSelectSchool;

  @override
  Widget build(BuildContext context) {
    if (profile.schoolProfiles.isEmpty) {
      return const EmptyPanel(message: 'No school profile details available.');
    }

    final selected = profile.schoolProfiles.firstWhere(
      (school) => school.id == selectedSchoolId,
      orElse: () => profile.schoolProfiles.first,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (profile.schoolProfiles.length > 1) ...[
          ParentCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Select School',
                  style: TextStyle(
                    color: SaaptTheme.navy,
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 12),
                ...profile.schoolProfiles.map((school) {
                  final active = school.id == selected.id;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(12),
                      onTap: () => onSelectSchool(school.id),
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: active
                              ? const Color(0xFFEAF1FF)
                              : const Color(0xFFF7FAFF),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: active
                                ? SaaptTheme.primary
                                : const Color(0xFFDDE5F2),
                          ),
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.school_outlined,
                              color: SaaptTheme.primary,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    school.name,
                                    style: const TextStyle(
                                      color: SaaptTheme.navy,
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                  if (school.code.isNotEmpty)
                                    Text(
                                      school.code,
                                      style: const TextStyle(
                                        color: Color(0xFF60708F),
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                ],
                              ),
                            ),
                            if (active)
                              const Icon(
                                Icons.check_circle,
                                color: SaaptTheme.primary,
                              ),
                          ],
                        ),
                      ),
                    ),
                  );
                }),
              ],
            ),
          ),
          const SizedBox(height: 14),
        ],
        ParentCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _DetailRow(label: 'School Name', value: selected.name),
              _DetailRow(
                label: 'School Code',
                value: selected.code.isNotEmpty ? selected.code : '-',
              ),
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _ContactActionButton(
                  icon: Icons.mail_outline,
                  label: 'Email',
                  value: selected.email ?? '',
                  onTap: () => _launchEmail(selected.email ?? ''),
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: _ContactActionButton(
                  icon: Icons.call_outlined,
                  label: 'Mobile Number',
                  value: selected.mobileNumber ?? '',
                  onTap: () => _launchPhone(selected.mobileNumber ?? ''),
                ),
              ),
              _DetailRow(
                label: 'Address',
                value: selected.address ?? '-',
                last: selected.contacts.isEmpty,
              ),
              if (selected.contacts.isNotEmpty) ...[
                const Text(
                  'Contact Information',
                  style: TextStyle(
                    color: SaaptTheme.navy,
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 12),
                ...selected.contacts.map(
                  (contact) => Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF7FAFF),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFDDE5F2)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          contact.department,
                          style: const TextStyle(
                            color: SaaptTheme.primary,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          contact.name,
                          style: const TextStyle(
                            color: SaaptTheme.navy,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 12),
                        _ContactActionButton(
                          icon: Icons.mail_outline,
                          label: 'Email',
                          value: contact.email,
                          onTap: () => _launchEmail(contact.email),
                        ),
                        const SizedBox(height: 8),
                        _ContactActionButton(
                          icon: Icons.call_outlined,
                          label: 'Mobile Number',
                          value: contact.contactNumber,
                          onTap: () => _launchPhone(contact.contactNumber),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ],
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
          _DataPanel(
            tabKey: 'profile',
            title: 'Profile',
            data: detail.tabs['profile'],
          ),
        ],
      ),
    );
  }
}

class _ChildDetailScroll extends ConsumerStatefulWidget {
  const _ChildDetailScroll({
    required this.childId,
    required this.hero,
    this.initialTabKey,
  });

  final String childId;
  final Widget hero;
  final String? initialTabKey;

  @override
  ConsumerState<_ChildDetailScroll> createState() => _ChildDetailScrollState();
}

class _ChildDetailScrollState extends ConsumerState<_ChildDetailScroll> {
  int _selectedIndex = 0;

  @override
  void initState() {
    super.initState();
    _selectedIndex = _tabIndexForKey(widget.initialTabKey);
  }

  @override
  void didUpdateWidget(covariant _ChildDetailScroll oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.childId != widget.childId ||
        oldWidget.initialTabKey != widget.initialTabKey) {
      _selectedIndex = _tabIndexForKey(widget.initialTabKey);
    }
  }

  int _tabIndexForKey(String? key) {
    final normalized = key?.trim().toLowerCase();
    final index = _childDetailTabs.indexWhere((tab) => tab.key == normalized);
    return index < 0 ? 0 : index;
  }

  @override
  Widget build(BuildContext context) {
    final detailState = ref.watch(parentChildDetailProvider(widget.childId));
    return detailState.when(
      loading: () => CustomScrollView(
        slivers: [
          SliverToBoxAdapter(child: widget.hero),
          const SliverPadding(
            padding: EdgeInsets.fromLTRB(20, 22, 20, 32),
            sliver: SliverToBoxAdapter(child: LoadingPanel()),
          ),
        ],
      ),
      error: (error, _) => CustomScrollView(
        slivers: [
          SliverToBoxAdapter(child: widget.hero),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 22, 20, 32),
            sliver: SliverToBoxAdapter(
              child: EmptyPanel(
                message: parentApiError(error, 'Unable to load child profile'),
              ),
            ),
          ),
        ],
      ),
      data: (detail) {
        final selectedTab = _childDetailTabs[_selectedIndex];
        return CustomScrollView(
          slivers: [
            SliverToBoxAdapter(child: widget.hero),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 22, 20, 14),
              sliver: SliverToBoxAdapter(
                child: _ChildSummaryCard(child: detail.child),
              ),
            ),
            SliverPersistentHeader(
              pinned: true,
              delegate: _ChildTabsHeaderDelegate(
                selectedIndex: _selectedIndex,
                onTap: (index) => setState(() => _selectedIndex = index),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 14, 20, 32),
              sliver: SliverToBoxAdapter(
                child: _DataPanel(
                  tabKey: selectedTab.key,
                  title: selectedTab.label,
                  data: detail.tabs[selectedTab.key],
                  childId: widget.childId,
                ),
              ),
            ),
          ],
        );
      },
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

class _ChildTabsHeaderDelegate extends SliverPersistentHeaderDelegate {
  const _ChildTabsHeaderDelegate({
    required this.selectedIndex,
    required this.onTap,
  });

  final int selectedIndex;
  final ValueChanged<int> onTap;

  @override
  double get minExtent => 64;

  @override
  double get maxExtent => 64;

  @override
  Widget build(
    BuildContext context,
    double shrinkOffset,
    bool overlapsContent,
  ) {
    return SizedBox.expand(
      child: Container(
        color: SaaptTheme.canvas,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
        child: _ChildTabBar(selectedIndex: selectedIndex, onTap: onTap),
      ),
    );
  }

  @override
  bool shouldRebuild(covariant _ChildTabsHeaderDelegate oldDelegate) {
    return oldDelegate.selectedIndex != selectedIndex;
  }
}

class _ChildTabBar extends StatelessWidget {
  const _ChildTabBar({required this.selectedIndex, required this.onTap});

  final int selectedIndex;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    return ParentCard(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            for (var index = 0; index < _childDetailTabs.length; index++)
              _ChildTabButton(
                tab: _childDetailTabs[index],
                selected: selectedIndex == index,
                onTap: () => onTap(index),
              ),
          ],
        ),
      ),
    );
  }
}

class _ChildTabButton extends StatelessWidget {
  const _ChildTabButton({
    required this.tab,
    required this.selected,
    required this.onTap,
  });

  final _ChildTabConfig tab;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
          decoration: BoxDecoration(
            color: selected ? SaaptTheme.primary : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              Icon(
                tab.icon,
                size: 16,
                color: selected ? Colors.white : const Color(0xFF60708F),
              ),
              const SizedBox(width: 6),
              Text(
                tab.label,
                style: TextStyle(
                  color: selected ? Colors.white : SaaptTheme.navy,
                  fontSize: 12,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DataPanel extends StatelessWidget {
  const _DataPanel({
    required this.tabKey,
    required this.title,
    required this.data,
    this.childId,
  });

  final String tabKey;
  final String title;
  final Object? data;
  final String? childId;

  @override
  Widget build(BuildContext context) {
    if (tabKey == 'profile') {
      return _ProfileTabPanel(data: data);
    }
    if (tabKey == 'library') {
      return _LibraryTabPanel(data: data);
    }
    if (tabKey == 'fees') {
      return _FeesTabPanel(data: data, childId: childId);
    }
    final records = _recordsForTab(tabKey, data);
    if (records.isEmpty) {
      return EmptyPanel(message: 'No $title records available.');
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: records
          .map(
            (record) => Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: _SummaryRecordTile(record: record),
            ),
          )
          .toList(),
    );
  }
}

class _ProfileTabPanel extends StatelessWidget {
  const _ProfileTabPanel({required this.data});

  final Object? data;

  @override
  Widget build(BuildContext context) {
    final map = _asMap(data);
    final sections = <Widget>[];
    for (final key in const ['admission', 'personal', 'address', 'medical']) {
      final section = _asMap(map[key]);
      if (!_isEmptyData(section)) {
        sections.add(_RecordCard(title: _labelForKey(key), data: section));
      }
    }

    final siblings = _recordsFromGroup('Siblings', map['siblings']);
    if (siblings.isNotEmpty) {
      sections.add(
        _SimpleSection(
          title: 'Siblings',
          children: siblings
              .map((record) => _SummaryRecordTile(record: record))
              .toList(),
        ),
      );
    }

    if (sections.isEmpty) {
      return const EmptyPanel(message: 'No profile records available.');
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: sections
          .map(
            (section) => Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: section,
            ),
          )
          .toList(),
    );
  }
}

class _SimpleSection extends StatelessWidget {
  const _SimpleSection({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
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
          ...children,
        ],
      ),
    );
  }
}

class _FeesTabPanel extends StatelessWidget {
  const _FeesTabPanel({required this.data, required this.childId});

  final Object? data;
  final String? childId;

  @override
  Widget build(BuildContext context) {
    final map = _asMap(data);
    final invoices = _asList(
      map['invoices'],
    ).map(_asMap).where((item) => !_isEmptyData(item)).toList();

    if (invoices.isEmpty) {
      return const EmptyPanel(
        message: 'No fee invoices found for this student.',
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ParentCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Fees',
                style: TextStyle(
                  color: SaaptTheme.navy,
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 14),
              _FeeTotalsGrid(invoices: invoices),
            ],
          ),
        ),
        const SizedBox(height: 14),
        ...invoices.map(
          (invoice) => Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: _FeeInvoiceCard(invoice: invoice, childId: childId),
          ),
        ),
      ],
    );
  }
}

class _FeeTotalsGrid extends StatelessWidget {
  const _FeeTotalsGrid({required this.invoices});

  final List<Map<String, dynamic>> invoices;

  @override
  Widget build(BuildContext context) {
    final totalBilled = invoices.fold<num>(
      0,
      (sum, invoice) => sum + _netFeeAmount(invoice),
    );
    final discount = invoices.fold<num>(
      0,
      (sum, invoice) => sum + _numberValue(invoice['discountAmount']),
    );
    final paid = invoices.fold<num>(
      0,
      (sum, invoice) => sum + _numberValue(invoice['paidAmount']),
    );
    final due = invoices.fold<num>(
      0,
      (sum, invoice) => sum + _numberValue(invoice['dueAmount']),
    );

    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 620 ? 4 : 2;
        return GridView.count(
          crossAxisCount: columns,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisSpacing: 10,
          mainAxisSpacing: 10,
          childAspectRatio: columns == 4 ? 1.55 : 1.75,
          children: [
            _FeeStatTile(
              label: 'Total billed',
              value: _moneyValue(totalBilled),
            ),
            _FeeStatTile(
              label: 'Discount',
              value: _moneyValue(discount),
              valueColor: const Color(0xFF059669),
            ),
            _FeeStatTile(
              label: 'Paid',
              value: _moneyValue(paid),
              valueColor: SaaptTheme.navy,
            ),
            _FeeStatTile(
              label: 'Balance due',
              value: _moneyValue(due),
              valueColor: due > 0
                  ? const Color(0xFFDC2626)
                  : const Color(0xFF8EA0BA),
            ),
          ],
        );
      },
    );
  }
}

class _FeeStatTile extends StatelessWidget {
  const _FeeStatTile({
    required this.label,
    required this.value,
    this.valueColor = SaaptTheme.primary,
  });

  final String label;
  final String value;
  final Color valueColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF7FAFF),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5ECF7)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            label.toUpperCase(),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: Color(0xFF8EA0BA),
              fontSize: 10,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 6),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              value,
              style: TextStyle(
                color: valueColor,
                fontSize: 18,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FeeInvoiceCard extends StatelessWidget {
  const _FeeInvoiceCard({required this.invoice, required this.childId});

  final Map<String, dynamic> invoice;
  final String? childId;

  @override
  Widget build(BuildContext context) {
    final feeType = _asMap(invoice['feeType']);
    final feeStructure = _asMap(invoice['feeStructure']);
    final title =
        _firstString(feeType, ['name']) ??
        _firstString(feeStructure, ['name']) ??
        _firstString(invoice, ['invoiceNumber']) ??
        'Fee Invoice';
    final invoiceNumber = _firstString(invoice, ['invoiceNumber']) ?? '-';
    final feeMonth = _firstString(invoice, ['feeMonth']);
    final status = _firstString(invoice, ['status']) ?? 'ISSUED';
    final dueDate = _firstString(invoice, ['dueDate']);
    final payments = _asList(
      invoice['payments'],
    ).map(_asMap).where((item) => !_isEmptyData(item)).toList();
    final receipts = _asList(
      invoice['receipts'],
    ).map(_asMap).where((item) => !_isEmptyData(item)).toList();
    final isUpcoming =
        !_isPastDate(invoice['dueDate']) &&
        !status.toUpperCase().contains('PAID') &&
        status.toUpperCase() != 'CANCELLED';
    final dueAmount = _numberValue(invoice['dueAmount']);
    final normalizedStatus = status.toUpperCase();
    final canPay =
        childId?.trim().isNotEmpty == true &&
        dueAmount > 0 &&
        normalizedStatus != 'PAID' &&
        normalizedStatus != 'CANCELLED';

    return ParentCard(
      padding: EdgeInsets.zero,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              color: const Color(0xFFF7FAFF),
              padding: const EdgeInsets.all(14),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          feeMonth == null ? title : '$title ($feeMonth)',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: SaaptTheme.navy,
                            fontSize: 15,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          invoiceNumber,
                          style: const TextStyle(
                            color: Color(0xFF8EA0BA),
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    alignment: WrapAlignment.end,
                    children: [
                      if (isUpcoming)
                        const _FeeStatusChip(
                          label: 'Upcoming',
                          background: Color(0xFFF1ECFF),
                          foreground: SaaptTheme.primary,
                        ),
                      _FeeStatusChip.forStatus(status),
                      _FeeStatusChip(
                        label: 'Due ${_dateValue(dueDate)}',
                        background: Colors.white,
                        foreground: const Color(0xFF60708F),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            _FeeAmountGrid(invoice: invoice),
            if (canPay)
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 14, 14, 0),
                child: _PayFeeButton(
                  childId: childId!,
                  invoice: invoice,
                  balanceAmount: dueAmount,
                ),
              ),
            if (payments.isEmpty)
              const Padding(
                padding: EdgeInsets.all(14),
                child: Text(
                  'No payments recorded yet.',
                  style: TextStyle(
                    color: Color(0xFF8EA0BA),
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              )
            else
              Column(
                children: payments
                    .map(
                      (payment) => _FeePaymentRow(
                        payment: payment,
                        receipt: _receiptForPayment(payment, receipts),
                      ),
                    )
                    .toList(),
              ),
          ],
        ),
      ),
    );
  }
}

class _FeeAmountGrid extends StatelessWidget {
  const _FeeAmountGrid({required this.invoice});

  final Map<String, dynamic> invoice;

  @override
  Widget build(BuildContext context) {
    final cells = [
      _FeeAmountCell('Billed', _netFeeAmount(invoice)),
      _FeeAmountCell(
        'Discount',
        invoice['discountAmount'],
        valueColor: const Color(0xFF059669),
      ),
      _FeeAmountCell(
        'Paid',
        invoice['paidAmount'],
        valueColor: SaaptTheme.navy,
      ),
      _FeeAmountCell(
        'Balance',
        invoice['dueAmount'],
        valueColor: _numberValue(invoice['dueAmount']) > 0
            ? const Color(0xFFDC2626)
            : const Color(0xFF8EA0BA),
      ),
    ];

    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      childAspectRatio: 2.65,
      children: cells,
    );
  }
}

class _PayFeeButton extends ConsumerStatefulWidget {
  const _PayFeeButton({
    required this.childId,
    required this.invoice,
    required this.balanceAmount,
  });

  final String childId;
  final Map<String, dynamic> invoice;
  final num balanceAmount;

  @override
  ConsumerState<_PayFeeButton> createState() => _PayFeeButtonState();
}

class _PayFeeButtonState extends ConsumerState<_PayFeeButton> {
  bool _processing = false;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: FilledButton.icon(
        onPressed: _processing ? null : _chooseAmountAndPay,
        icon: _processing
            ? const SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : const Icon(Icons.payment_rounded),
        label: Text(_processing ? 'Opening payment...' : 'Pay fees'),
        style: FilledButton.styleFrom(
          backgroundColor: SaaptTheme.primary,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
      ),
    );
  }

  Future<void> _chooseAmountAndPay() async {
    final amount = await showModalBottomSheet<num>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (_) =>
          _FeePaymentAmountSheet(balanceAmount: widget.balanceAmount),
    );
    if (amount == null || amount <= 0) return;
    await _startPayment(amount);
  }

  Future<void> _startPayment(num amount) async {
    setState(() => _processing = true);
    try {
      final repository = ref.read(parentRepositoryProvider);
      final invoiceId = widget.invoice['id']?.toString() ?? '';
      final checkout = await repository.createFeeCheckoutOrder(
        childId: widget.childId,
        invoiceId: invoiceId,
        amount: amount,
      );
      if (checkout.paymentLinkId.isEmpty || checkout.paymentUrl.isEmpty) {
        throw StateError('Payment Link details are missing');
      }
      if (!mounted) return;
      final paid = await Navigator.of(context).push<bool>(
        MaterialPageRoute(
          builder: (_) => ParentFeePaymentScreen(
            paymentUrl: checkout.paymentUrl,
            paymentLinkId: checkout.paymentLinkId,
          ),
        ),
      );
      if (paid != true) return;
      ref.invalidate(parentChildDetailProvider(widget.childId));
      final childState = ref.read(effectiveSelectedChildProvider);
      final child = childState.asData?.value;
      if (child != null && child.id == widget.childId) {
        ref.invalidate(parentFeeSummaryProvider(child));
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Payment completed successfully.')),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(parentApiError(error, 'Unable to start payment')),
        ),
      );
    } finally {
      if (mounted) setState(() => _processing = false);
    }
  }
}

class _FeePaymentAmountSheet extends StatefulWidget {
  const _FeePaymentAmountSheet({required this.balanceAmount});

  final num balanceAmount;

  @override
  State<_FeePaymentAmountSheet> createState() => _FeePaymentAmountSheetState();
}

class _FeePaymentAmountSheetState extends State<_FeePaymentAmountSheet> {
  late final TextEditingController _amountController;
  bool _custom = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _amountController = TextEditingController(
      text: widget.balanceAmount.toStringAsFixed(0),
    );
  }

  @override
  void dispose() {
    _amountController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(22, 4, 22, 22 + bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Pay fees',
              style: TextStyle(
                color: SaaptTheme.navy,
                fontSize: 20,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Balance due: ${_moneyValue(widget.balanceAmount)}',
              style: const TextStyle(
                color: Color(0xFF60708F),
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 18),
            SegmentedButton<bool>(
              segments: const [
                ButtonSegment(value: false, label: Text('Full balance')),
                ButtonSegment(value: true, label: Text('Custom amount')),
              ],
              selected: {_custom},
              onSelectionChanged: (value) {
                setState(() {
                  _custom = value.first;
                  _error = null;
                  if (!_custom) {
                    _amountController.text = widget.balanceAmount
                        .toStringAsFixed(0);
                  }
                });
              },
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _amountController,
              enabled: _custom,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: InputDecoration(
                labelText: 'Amount',
                prefixText: '₹ ',
                errorText: _error,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
            const SizedBox(height: 18),
            FilledButton(
              onPressed: _submit,
              style: FilledButton.styleFrom(
                backgroundColor: SaaptTheme.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              child: const Text('Continue to Razorpay'),
            ),
          ],
        ),
      ),
    );
  }

  void _submit() {
    final amount = num.tryParse(_amountController.text.trim());
    if (amount == null || amount <= 0) {
      setState(() => _error = 'Enter a valid amount.');
      return;
    }
    if (amount > widget.balanceAmount) {
      setState(() => _error = 'Amount cannot exceed the balance.');
      return;
    }
    Navigator.of(context).pop(amount);
  }
}

class _FeeAmountCell extends StatelessWidget {
  const _FeeAmountCell(this.label, this.value, {this.valueColor});

  final String label;
  final Object? value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: const BoxDecoration(
        border: Border(
          right: BorderSide(color: Color(0xFFE5ECF7)),
          bottom: BorderSide(color: Color(0xFFE5ECF7)),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            label.toUpperCase(),
            style: const TextStyle(
              color: Color(0xFF8EA0BA),
              fontSize: 10,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            _moneyValue(_numberValue(value)),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: valueColor ?? const Color(0xFF60708F),
              fontSize: 13,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}

class _FeePaymentRow extends StatelessWidget {
  const _FeePaymentRow({required this.payment, required this.receipt});

  final Map<String, dynamic> payment;
  final Map<String, dynamic>? receipt;

  @override
  Widget build(BuildContext context) {
    final paymentNumber = _firstString(payment, ['paymentNumber']) ?? 'Payment';
    final paymentMode = _firstString(payment, ['paymentMode']) ?? 'Payment';
    final paidAt = _firstString(payment, ['paidAt']);
    final receiptNumber = receipt == null
        ? null
        : _firstString(receipt!, ['receiptNumber']);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: Color(0xFFE5ECF7))),
      ),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: const Color(0xFFE9F8EF),
              borderRadius: BorderRadius.circular(999),
            ),
            child: const Icon(
              Icons.check_rounded,
              color: Color(0xFF059669),
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  paymentNumber,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: SaaptTheme.navy,
                    fontSize: 13,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  '$paymentMode • ${_dateValue(paidAt)}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Color(0xFF60708F),
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '+${_moneyValue(_numberValue(payment['amount']))}',
                style: const TextStyle(
                  color: Color(0xFF059669),
                  fontSize: 13,
                  fontWeight: FontWeight.w900,
                ),
              ),
              if (receiptNumber != null) ...[
                const SizedBox(height: 3),
                Text(
                  'Receipt $receiptNumber',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Color(0xFF8EA0BA),
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _FeeStatusChip extends StatelessWidget {
  const _FeeStatusChip({
    required this.label,
    required this.background,
    required this.foreground,
  });

  factory _FeeStatusChip.forStatus(String status) {
    final normalized = status.toUpperCase();
    if (normalized == 'PAID') {
      return _FeeStatusChip(
        label: _labelForKey(status),
        background: const Color(0xFFE9F8EF),
        foreground: const Color(0xFF059669),
      );
    }
    if (normalized == 'PARTIALLY_PAID') {
      return _FeeStatusChip(
        label: _labelForKey(status),
        background: const Color(0xFFFFF4DF),
        foreground: const Color(0xFFF59E0B),
      );
    }
    if (normalized == 'OVERDUE') {
      return _FeeStatusChip(
        label: _labelForKey(status),
        background: const Color(0xFFFFE8E8),
        foreground: const Color(0xFFDC2626),
      );
    }
    if (normalized == 'ISSUED') {
      return _FeeStatusChip(
        label: _labelForKey(status),
        background: const Color(0xFFEAF1FF),
        foreground: SaaptTheme.primary,
      );
    }
    return _FeeStatusChip(
      label: _labelForKey(status),
      background: const Color(0xFFF1F5F9),
      foreground: const Color(0xFF60708F),
    );
  }

  final String label;
  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0xFFE5ECF7)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: foreground,
          fontSize: 11,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

class _LibraryTabPanel extends StatelessWidget {
  const _LibraryTabPanel({required this.data});

  final Object? data;

  @override
  Widget build(BuildContext context) {
    final memberships = _asList(
      _asMap(data)['memberships'],
    ).map(_asMap).where((item) => !_isEmptyData(item)).toList();
    if (memberships.isEmpty) {
      return const EmptyPanel(message: 'No library records available.');
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: memberships
          .map(
            (membership) => Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: _LibraryMembershipPanel(membership: membership),
            ),
          )
          .toList(),
    );
  }
}

class _LibraryMembershipPanel extends StatelessWidget {
  const _LibraryMembershipPanel({required this.membership});

  final Map<String, dynamic> membership;

  @override
  Widget build(BuildContext context) {
    final membershipDetails = Map<String, dynamic>.from(membership)
      ..remove('issues');
    final issues = _libraryIssueRecords(membership);
    return ParentCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Icon(
                Icons.local_library_outlined,
                color: SaaptTheme.primary,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  _firstString(membership, ['fullName', 'memberCode']) ??
                      'Library Membership',
                  style: const TextStyle(
                    color: SaaptTheme.navy,
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ..._rowsForData(membershipDetails),
          const SizedBox(height: 14),
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Issued Books',
                  style: TextStyle(
                    color: SaaptTheme.navy,
                    fontSize: 15,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFEAF1FF),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  '${issues.length}',
                  style: const TextStyle(
                    color: SaaptTheme.primary,
                    fontSize: 12,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (issues.isEmpty)
            const Text(
              'No issued books.',
              style: TextStyle(
                color: Color(0xFF60708F),
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            )
          else
            ...issues.map(
              (record) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _LibraryIssueTile(record: record),
              ),
            ),
        ],
      ),
    );
  }
}

class _LibraryIssueTile extends StatelessWidget {
  const _LibraryIssueTile({required this.record});

  final _DisplayRecord record;

  @override
  Widget build(BuildContext context) {
    final status = _displayValue(record.data['status']);
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () => _showRecordDetailSheet(context, record),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFFF7FAFF),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFDDE7F7)),
        ),
        child: Row(
          children: [
            const Icon(
              Icons.menu_book_outlined,
              color: SaaptTheme.primary,
              size: 22,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    record.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: SaaptTheme.navy,
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    record.subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Color(0xFF60708F),
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            _StatusBadge(status: status),
          ],
        ),
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final isReturned = status.toLowerCase().contains('return');
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: isReturned ? const Color(0xFFE9F8EF) : const Color(0xFFFFF4DF),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        status,
        style: TextStyle(
          color: isReturned ? const Color(0xFF05A66B) : const Color(0xFFF59E0B),
          fontSize: 11,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

class _DisplayRecord {
  const _DisplayRecord({
    required this.title,
    required this.subtitle,
    required this.category,
    required this.data,
    required this.icon,
    this.imageUrl,
  });

  final String title;
  final String subtitle;
  final String category;
  final Map<String, dynamic> data;
  final IconData icon;
  final String? imageUrl;
}

List<_DisplayRecord> _recordsForTab(String tabKey, Object? data) {
  if (_isEmptyData(data)) return const [];
  if (tabKey == 'parents') return _parentRecords(data);
  if (tabKey == 'documents') return _documentRecords(data);

  final map = _asMap(data);
  if (map.isEmpty) return _recordsFromGroup(_labelForKey(tabKey), data);

  final records = <_DisplayRecord>[];
  map.forEach((key, value) {
    if (_isEmptyData(value)) return;
    records.addAll(_recordsFromGroup(_labelForKey(key), value));
  });
  return records;
}

List<_DisplayRecord> _parentRecords(Object? data) {
  final map = _asMap(data);
  final records = <_DisplayRecord>[];
  final seen = <String>{};

  void addPerson(String type, Map<String, dynamic> person) {
    final name = _firstString(person, ['name', 'fullName', 'firstName']);
    if (name == null) return;
    final details = <String, dynamic>{'type': type, ...person};
    final key = [
      name.toLowerCase(),
      type.toLowerCase(),
      _firstString(details, ['phone', 'email']) ?? '',
    ].join('|');
    if (!seen.add(key)) return;
    records.add(
      _DisplayRecord(
        title: name,
        subtitle: [
          type,
          _firstString(details, ['occupation', 'relationship', 'relation']),
        ].whereType<String>().join(' • '),
        category: type,
        data: details,
        icon: Icons.person_outline,
        imageUrl: _imageUrlFrom(details),
      ),
    );
  }

  addPerson('Father', _asMap(map['father']));
  addPerson('Mother', _asMap(map['mother']));
  addPerson('Guardian', _asMap(map['guardian']));
  for (final guardian in _asList(map['guardians'])) {
    final guardianMap = _asMap(guardian);
    addPerson(
      _firstString(guardianMap, ['type', 'relation']) ?? 'Guardian',
      guardianMap,
    );
  }
  for (final link in _asList(map['linkedParents'])) {
    final parent = _asMap(_asMap(link)['parent']);
    addPerson('Linked Parent', parent);
  }
  return records;
}

List<_DisplayRecord> _documentRecords(Object? data) {
  final map = _asMap(data);
  final records = <_DisplayRecord>[];
  records.addAll(
    _recordsFromGroup('Uploaded Documents', map['uploadedDocuments']),
  );
  records.addAll(_recordsFromGroup('Student Photos', map['studentPhotos']));

  final admissionDocs = _asMap(map['admissionDocuments']);
  admissionDocs.forEach((key, value) {
    if (_isEmptyData(value)) return;
    records.add(
      _DisplayRecord(
        title: _labelForKey(key),
        subtitle: 'Admission document',
        category: 'Document',
        data: {'type': _labelForKey(key), 'url': value},
        icon: Icons.description_outlined,
        imageUrl: value.toString(),
      ),
    );
  });

  final faceProfile = _asMap(map['faceProfile']);
  if (!_isEmptyData(faceProfile)) {
    records.add(
      _DisplayRecord(
        title: 'Face Profile',
        subtitle: _displayValue(faceProfile['status']),
        category: 'Face Profile',
        data: faceProfile,
        icon: Icons.face_retouching_natural_outlined,
        imageUrl: _imageUrlFrom(faceProfile),
      ),
    );
  }
  return records;
}

List<_DisplayRecord> _recordsFromGroup(String group, Object? value) {
  if (_isEmptyData(value)) return const [];
  final icon = _iconForGroup(group);
  if (value is List) {
    return value
        .map(_asMap)
        .where((item) => !_isEmptyData(item))
        .map(
          (item) => _DisplayRecord(
            title: _titleForRecord(group, item),
            subtitle: _subtitleForRecord(group, item),
            category: group,
            data: item,
            icon: icon,
            imageUrl: _imageUrlFrom(item),
          ),
        )
        .toList();
  }
  final map = _asMap(value);
  if (map.isEmpty) {
    return [
      _DisplayRecord(
        title: group,
        subtitle: _displayValue(value),
        category: group,
        data: {'value': value},
        icon: icon,
      ),
    ];
  }
  return [
    _DisplayRecord(
      title: _titleForRecord(group, map),
      subtitle: _subtitleForRecord(group, map),
      category: group,
      data: map,
      icon: icon,
      imageUrl: _imageUrlFrom(map),
    ),
  ];
}

class _SummaryRecordTile extends StatelessWidget {
  const _SummaryRecordTile({required this.record});

  final _DisplayRecord record;

  @override
  Widget build(BuildContext context) {
    return ParentCard(
      padding: const EdgeInsets.all(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => _showRecordSheet(context, record),
        child: Row(
          children: [
            _RecordThumb(imageUrl: record.imageUrl, icon: record.icon),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    record.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: SaaptTheme.navy,
                      fontSize: 15,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    record.subtitle.isEmpty ? record.category : record.subtitle,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Color(0xFF60708F),
                      fontSize: 13,
                      height: 1.3,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            const Icon(Icons.chevron_right_rounded, color: Color(0xFF8EA0BA)),
          ],
        ),
      ),
    );
  }

  void _showRecordSheet(BuildContext context, _DisplayRecord record) {
    _showRecordDetailSheet(context, record);
  }
}

void _showRecordDetailSheet(BuildContext context, _DisplayRecord record) {
  showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (context) => _RecordDetailSheet(record: record),
  );
}

class _RecordThumb extends StatelessWidget {
  const _RecordThumb({required this.icon, this.imageUrl});

  final IconData icon;
  final String? imageUrl;

  @override
  Widget build(BuildContext context) {
    final url = imageUrl;
    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: Container(
        width: 48,
        height: 48,
        color: const Color(0xFFEAF1FF),
        child: url?.trim().isNotEmpty == true
            ? Image.network(
                url!,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) =>
                    Icon(icon, color: SaaptTheme.primary),
              )
            : Icon(icon, color: SaaptTheme.primary),
      ),
    );
  }
}

class _RecordDetailSheet extends StatelessWidget {
  const _RecordDetailSheet({required this.record});

  final _DisplayRecord record;

  @override
  Widget build(BuildContext context) {
    final nested = _nestedLists(record.data);
    final scalarData = _withoutNestedLists(record.data);
    final imageUrls = _imageUrlsFrom(record.data);
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          4,
          20,
          20 + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  _RecordThumb(imageUrl: record.imageUrl, icon: record.icon),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          record.title,
                          style: const TextStyle(
                            color: SaaptTheme.navy,
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          record.category,
                          style: const TextStyle(
                            color: Color(0xFF60708F),
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              if (imageUrls.isNotEmpty) ...[
                const SizedBox(height: 16),
                _ImageStrip(urls: imageUrls),
              ],
              const SizedBox(height: 16),
              _RecordCard(title: 'Details', data: scalarData),
              for (final entry in nested.entries) ...[
                const SizedBox(height: 14),
                _SimpleSection(
                  title: _labelForKey(entry.key),
                  children: entry.value
                      .map(
                        (item) => _RecordCard(
                          title: _recordTitle(item, _labelForKey(entry.key)),
                          data: item,
                        ),
                      )
                      .toList(),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _ImageStrip extends StatelessWidget {
  const _ImageStrip({required this.urls});

  final List<String> urls;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 88,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: urls.length,
        separatorBuilder: (_, _) => const SizedBox(width: 10),
        itemBuilder: (context, index) => ClipRRect(
          borderRadius: BorderRadius.circular(14),
          child: Container(
            width: 88,
            height: 88,
            color: const Color(0xFFEAF1FF),
            child: Image.network(
              urls[index],
              fit: BoxFit.cover,
              errorBuilder: (context, error, stackTrace) => const Icon(
                Icons.image_not_supported_outlined,
                color: SaaptTheme.primary,
              ),
            ),
          ),
        ),
      ),
    );
  }
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

Map<String, dynamic> _asMap(Object? value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) {
    return value.map((key, item) => MapEntry(key.toString(), item));
  }
  return const <String, dynamic>{};
}

List<Object?> _asList(Object? value) {
  return value is List ? value : const [];
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
    'createdAt',
    'updatedAt',
    'deletedAt',
    'createdById',
    'updatedById',
    'deletedById',
    'reviewedById',
    'uploadedById',
    'returnedById',
  };
  return hidden.contains(key) || key.endsWith('Id');
}

String _recordTitle(Object? data, String fallback) {
  if (data is Map) {
    for (final key in const [
      'title',
      'name',
      'fullName',
      'studentName',
      'leaveType',
      'invoiceNumber',
      'paymentNumber',
      'receiptNumber',
      'memberCode',
      'bookNumber',
      'status',
    ]) {
      final value = data[key];
      if (value != null && value.toString().trim().isNotEmpty) {
        return _displayValue(value);
      }
    }
  }
  return fallback;
}

String _titleForRecord(String group, Map<String, dynamic> data) {
  final student = _asMap(data['student']);
  final book = _asMap(data['book']);
  final examPaper = _asMap(data['examPaper']);
  final exam = _asMap(examPaper['exam']);
  final subject = _asMap(examPaper['subject']);
  if (student.isNotEmpty) {
    return _firstString(student, ['fullName', 'name']) ?? group;
  }
  if (book.isNotEmpty) {
    return _firstString(book, ['title', 'bookNumber']) ?? group;
  }
  if (exam.isNotEmpty || subject.isNotEmpty) {
    return [
      _firstString(exam, ['name']),
      _firstString(subject, ['name', 'code']),
    ].whereType<String>().join(' • ');
  }
  return _recordTitle(data, group);
}

String _subtitleForRecord(String group, Map<String, dynamic> data) {
  final route = _asMap(data['route']);
  final vehicle = _asMap(data['vehicle']);
  final dormitory = _asMap(data['dormitory']);
  final room = _asMap(data['room']);
  final book = _asMap(data['book']);
  final examPaper = _asMap(data['examPaper']);
  final exam = _asMap(examPaper['exam']);
  final subject = _asMap(examPaper['subject']);
  final student = _asMap(data['student']);
  final parts = <String?>[
    group,
    _firstString(data, [
      'status',
      'type',
      'targetType',
      'source',
      'paymentMode',
      'memberType',
      'relation',
    ]),
    _firstString(data, ['feeMonth', 'leaveType']),
    _firstString(data, ['totalAmount', 'amount', 'dueAmount', 'marks']),
    _firstString(route, ['title']),
    _firstString(vehicle, ['vehicleNumber']),
    _firstString(dormitory, ['name']),
    _firstString(room, ['roomNumber']),
    _firstString(book, ['authorName', 'bookNumber']),
    _firstString(exam, ['name', 'status']),
    _firstString(subject, ['name']),
    _firstString(student, ['rollNo', 'admissionNo']),
    _firstString(data, ['issueDate', 'returnDate', 'entryDate']),
  ];
  return parts.whereType<String>().take(4).join(' • ');
}

List<_DisplayRecord> _libraryIssueRecords(Map<String, dynamic> membership) {
  final memberCode = _firstString(membership, ['memberCode']);
  final memberName = _firstString(membership, ['fullName', 'name']);
  return _asList(
    membership['issues'],
  ).map(_asMap).where((issue) => !_isEmptyData(issue)).map((issue) {
    final book = _asMap(issue['book']);
    final category = _asMap(book['category']);
    final subject = _asMap(book['subject']);
    final title = _firstString(book, ['title', 'bookNumber']) ?? 'Book';
    final status = _firstString(issue, ['status']) ?? 'Issued';
    final returnDate = _firstString(issue, ['returnDate', 'returnedAt']);
    final issueDate = _firstString(issue, ['issueDate']);
    final details = <String, dynamic>{
      'bookNumber': book['bookNumber'],
      'bookName': book['title'],
      'category': category['name'],
      'subject': subject['name'],
      'author': book['authorName'],
      'isbnNumber': book['isbnNumber'],
      'publisherName': book['publisherName'],
      'rackNumber': book['rackNumber'],
      'memberCode': memberCode,
      'memberName': memberName,
      'issueDate': issue['issueDate'],
      'returnDate': issue['returnDate'],
      'returnedAt': issue['returnedAt'],
      'status': status,
      'issuedBy': _userDisplayName(_asMap(issue['createdBy'])),
      'returnedBy': _userDisplayName(_asMap(issue['returnedBy'])),
      'note': issue['note'],
    };
    return _DisplayRecord(
      title: title,
      subtitle: [
        if (!_isEmptyData(category['name'])) _displayValue(category['name']),
        if (returnDate != null) 'Return: $returnDate',
        if (returnDate == null && issueDate != null) 'Issued: $issueDate',
      ].join(' • '),
      category: 'Issued Book',
      data: details,
      icon: Icons.menu_book_outlined,
    );
  }).toList();
}

String? _userDisplayName(Map<String, dynamic> user) {
  if (user.isEmpty) return null;
  final firstName = user['firstName']?.toString().trim() ?? '';
  final lastName = user['lastName']?.toString().trim() ?? '';
  final name = [firstName, lastName].where((part) => part.isNotEmpty).join(' ');
  if (name.isNotEmpty) return name;
  return _firstString(user, ['name', 'fullName', 'email']);
}

String? _firstString(Map<String, dynamic> data, List<String> keys) {
  for (final key in keys) {
    final value = data[key];
    if (!_isEmptyData(value)) return _displayValue(value);
  }
  return null;
}

IconData _iconForGroup(String group) {
  final normalized = group.toLowerCase();
  if (normalized.contains('invoice') ||
      normalized.contains('fee') ||
      normalized.contains('ledger')) {
    return Icons.receipt_long_outlined;
  }
  if (normalized.contains('transport')) return Icons.directions_bus_outlined;
  if (normalized.contains('library') ||
      normalized.contains('book') ||
      normalized.contains('issue')) {
    return Icons.local_library_outlined;
  }
  if (normalized.contains('dormitory')) return Icons.bed_outlined;
  if (normalized.contains('exam') || normalized.contains('mark')) {
    return Icons.assignment_outlined;
  }
  if (normalized.contains('document') || normalized.contains('photo')) {
    return Icons.folder_outlined;
  }
  if (normalized.contains('timeline') ||
      normalized.contains('status') ||
      normalized.contains('leave')) {
    return Icons.timeline_outlined;
  }
  if (normalized.contains('sibling')) return Icons.family_restroom_outlined;
  return Icons.info_outline;
}

String? _imageUrlFrom(Map<String, dynamic> data) {
  for (final key in const ['photoUrl', 'url', 'imageUrl', 'fileUrl']) {
    final value = data[key];
    if (value is String && value.trim().isNotEmpty) return value;
  }
  final parent = _asMap(data['parent']);
  if (parent.isNotEmpty) return _imageUrlFrom(parent);
  final student = _asMap(data['student']);
  if (student.isNotEmpty) return _imageUrlFrom(student);
  return null;
}

List<String> _imageUrlsFrom(Object? data) {
  final urls = <String>{};

  void collect(Object? value, [String key = '']) {
    if (value is String && value.trim().isNotEmpty) {
      final normalizedKey = key.toLowerCase();
      final lower = value.toLowerCase();
      if (normalizedKey.contains('photo') ||
          normalizedKey.contains('image') ||
          lower.endsWith('.jpg') ||
          lower.endsWith('.jpeg') ||
          lower.endsWith('.png') ||
          lower.endsWith('.webp')) {
        urls.add(value);
      }
      return;
    }
    if (value is Map) {
      value.forEach(
        (entryKey, entryValue) => collect(entryValue, entryKey.toString()),
      );
    }
    if (value is List) {
      for (final item in value) {
        collect(item, key);
      }
    }
  }

  collect(data);
  return urls.toList();
}

Map<String, List<Map<String, dynamic>>> _nestedLists(
  Map<String, dynamic> data,
) {
  final result = <String, List<Map<String, dynamic>>>{};
  data.forEach((key, value) {
    if (value is List && value.isNotEmpty) {
      final records = value
          .map(_asMap)
          .where((item) => !_isEmptyData(item))
          .toList();
      if (records.isNotEmpty) result[key] = records;
    }
  });
  return result;
}

Map<String, dynamic> _withoutNestedLists(Map<String, dynamic> data) {
  return Map.fromEntries(data.entries.where((entry) => entry.value is! List));
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

num _numberValue(Object? value) {
  if (value is num) return value;
  return num.tryParse(value?.toString() ?? '') ?? 0;
}

num _netFeeAmount(Map<String, dynamic> invoice) {
  final amount =
      _numberValue(invoice['totalAmount']) -
      _numberValue(invoice['discountAmount']);
  return amount < 0 ? 0 : amount;
}

String _moneyValue(num value) {
  final formatter = NumberFormat.currency(
    locale: 'en_IN',
    symbol: '₹',
    decimalDigits: value % 1 == 0 ? 0 : 2,
  );
  return formatter.format(value);
}

String _dateValue(Object? value) {
  if (value == null) return '-';
  final date = DateTime.tryParse(value.toString());
  if (date == null) return _displayValue(value);
  return DateFormat('dd-MM-yyyy').format(date);
}

bool _isPastDate(Object? value) {
  final date = DateTime.tryParse(value?.toString() ?? '');
  if (date == null) return false;
  final today = DateTime.now();
  final todayStart = DateTime(today.year, today.month, today.day);
  return DateTime(date.year, date.month, date.day).isBefore(todayStart);
}

Map<String, dynamic>? _receiptForPayment(
  Map<String, dynamic> payment,
  List<Map<String, dynamic>> receipts,
) {
  final paymentId = payment['id']?.toString();
  for (final receipt in receipts) {
    if (paymentId != null && receipt['paymentId']?.toString() == paymentId) {
      return receipt;
    }
  }
  return receipts.isEmpty ? null : receipts.first;
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
