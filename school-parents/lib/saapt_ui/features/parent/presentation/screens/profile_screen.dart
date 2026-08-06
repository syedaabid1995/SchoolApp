import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
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
    this.initialPanel,
  });

  final String? initialChildId;
  final String? initialTabKey;
  final String? initialPanel;

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
  bool _openedViaPanel = false;

  @override
  void initState() {
    super.initState();
    if (widget.initialChildId?.trim().isNotEmpty == true) {
      _panel = _ProfilePanel.children;
      _selectedChildId = widget.initialChildId!.trim();
      _openedViaPanel = true;
      return;
    }
    final panel = widget.initialPanel?.trim().toLowerCase();
    if (panel == 'school' || panel == 'schoolprofile') {
      _panel = _ProfilePanel.schoolProfile;
      _openedViaPanel = true;
    } else if (panel == 'children') {
      _panel = _ProfilePanel.children;
      _openedViaPanel = true;
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
    final profile = profileState.asData?.value;
    final selectedChild = _selectedChildFrom(profile);
    final childDetailId = _panel == _ProfilePanel.children
        ? _selectedChildId
        : null;

    return PopScope(
      // When opened from the drawer (school/children), allow route pop unless
      // a child detail is open. Using maybePop() while canPop is false caused
      // an infinite onPopInvoked → ANR freeze on the back button.
      canPop: _openedViaPanel
          ? !(_panel == _ProfilePanel.children && _selectedChildId != null)
          : (_panel == _ProfilePanel.menu && _selectedChildId == null),
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        _handleBack();
      },
      child: ParentStickyScaffold(
        badge: selectedChild != null
            ? 'Student Profile'
            : (_panel == _ProfilePanel.menu ? 'Account' : 'Parent Profile'),
        title: selectedChild?.name.trim().isNotEmpty == true
            ? selectedChild!.name.trim()
            : _titleForPanel(),
        subtitle: selectedChild != null
            ? [
                if (selectedChild.classLabel.trim().isNotEmpty)
                  selectedChild.classLabel.trim(),
                if (selectedChild.schoolName?.trim().isNotEmpty == true)
                  selectedChild.schoolName!.trim(),
              ].join(' · ')
            : _subtitleForPanel(),
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
        onRefresh: childDetailId != null
            ? null
            : () async {
                ref.invalidate(parentProfileProvider);
                ref.invalidate(parentPushPreferenceProvider);
                await ref.read(parentProfileProvider.future);
              },
        wrapBody: childDetailId == null,
        body: childDetailId != null
            ? _ChildDetailScroll(
                childId: childDetailId,
                initialTabKey: widget.initialTabKey,
              )
            : profileState.when(
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
                      onSelectChild: (childId) =>
                          setState(() => _selectedChildId = childId),
                    ),
                    _ProfilePanel.menu => _ProfileMenuPanel(
                      profile: profile,
                      pushState: pushState,
                      onOpenProfile: () => setState(
                        () => _panel = _ProfilePanel.viewProfile,
                      ),
                      onOpenEdit: () =>
                          setState(() => _panel = _ProfilePanel.editProfile),
                      onOpenPassword: () => setState(
                        () => _panel = _ProfilePanel.changePassword,
                      ),
                      onTogglePush: _togglePush,
                      onOpenInfo: _openInfo,
                      onLogout: () => confirmParentLogout(context, ref),
                    ),
                  };
                },
              ),
      ),
    );
  }

  ParentChild? _selectedChildFrom(ParentProfile? profile) {
    final childId = _selectedChildId;
    if (childId == null || profile == null) return null;
    for (final child in profile.children) {
      if (child.id == childId) return child;
    }
    return null;
  }

  String _titleForPanel() {
    return switch (_panel) {
      _ProfilePanel.editProfile => 'Edit Profile',
      _ProfilePanel.viewProfile => 'Profile',
      _ProfilePanel.schoolProfile => 'School Profile',
      _ProfilePanel.children => 'Children',
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
      _ProfilePanel.children => 'Mapped child profiles',
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
    if (_openedViaPanel) {
      // Force pop — do not use maybePop() while this route may still report
      // canPop=false for nested panels (that loops with PopScope).
      if (Navigator.of(context).canPop()) {
        Navigator.of(context).pop();
      }
      return;
    }
    if (_panel != _ProfilePanel.menu) {
      setState(() {
        _panel = _ProfilePanel.menu;
        _selectedChildId = null;
        _selectedSchoolProfileId = null;
      });
      return;
    }
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
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
    required this.onOpenPassword,
    required this.onTogglePush,
    required this.onOpenInfo,
    required this.onLogout,
  });

  final ParentProfile profile;
  final AsyncValue<bool> pushState;
  final VoidCallback onOpenProfile;
  final VoidCallback onOpenEdit;
  final VoidCallback onOpenPassword;
  final ValueChanged<bool> onTogglePush;
  final void Function(String title, String body) onOpenInfo;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    final name = profile.name.trim().isEmpty ? 'Parent' : profile.name.trim();
    final initial = name[0].toUpperCase();
    final phone = profile.phone?.trim() ?? '';
    final school = profile.schoolName?.trim() ?? '';
    final childrenCount = profile.children.length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ParentCard(
          padding: EdgeInsets.zero,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                padding: const EdgeInsets.fromLTRB(16, 18, 16, 16),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Color(0xFF1E4FE8), Color(0xFF3A72FF)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
                ),
                child: Stack(
                  children: [
                    Positioned(
                      right: -24,
                      top: -36,
                      child: Container(
                        width: 110,
                        height: 110,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.18),
                            width: 2,
                          ),
                        ),
                      ),
                    ),
                    Row(
                      children: [
                        Container(
                          width: 64,
                          height: 64,
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(20),
                            boxShadow: const [
                              BoxShadow(
                                color: Color(0x33000000),
                                blurRadius: 16,
                                offset: Offset(0, 8),
                              ),
                            ],
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            initial,
                            style: const TextStyle(
                              color: SaaptTheme.primary,
                              fontSize: 26,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 20,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: -0.3,
                                ),
                              ),
                              const SizedBox(height: 5),
                              Text(
                                profile.email,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  color: Colors.white.withValues(alpha: 0.88),
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              if (phone.isNotEmpty) ...[
                                const SizedBox(height: 3),
                                Text(
                                  phone,
                                  style: TextStyle(
                                    color: Colors.white.withValues(alpha: 0.8),
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 14),
                child: Row(
                  children: [
                    Expanded(
                      child: _AccountStatChip(
                        label: 'Children',
                        value: '$childrenCount',
                        icon: Icons.groups_rounded,
                        accent: SaaptTheme.primary,
                        soft: const Color(0xFFEAF1FF),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _AccountStatChip(
                        label: 'School',
                        value: school.isEmpty ? '—' : school,
                        icon: Icons.school_outlined,
                        accent: const Color(0xFF0F766E),
                        soft: const Color(0xFFE7F7F4),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        const _AccountSectionLabel(title: 'Account'),
        const SizedBox(height: 10),
        ParentCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              _MenuTile(
                icon: Icons.person_outline_rounded,
                accent: SaaptTheme.primary,
                soft: const Color(0xFFEAF1FF),
                title: 'Profile',
                subtitle: 'View parent account details',
                onTap: onOpenProfile,
              ),
              const _MenuDivider(),
              _MenuTile(
                icon: Icons.edit_outlined,
                accent: const Color(0xFF0F766E),
                soft: const Color(0xFFE7F7F4),
                title: 'Edit Profile',
                subtitle: 'Name, email, and mobile number',
                onTap: onOpenEdit,
              ),
              const _MenuDivider(),
              _MenuTile(
                icon: Icons.lock_outline_rounded,
                accent: const Color(0xFFB45309),
                soft: const Color(0xFFFFF4E5),
                title: 'Change Password',
                subtitle: 'Update parent login password',
                onTap: onOpenPassword,
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        const _AccountSectionLabel(title: 'Preferences'),
        const SizedBox(height: 10),
        ParentCard(
          padding: EdgeInsets.zero,
          child: _SwitchTile(
            title: 'Push Notifications',
            subtitle: 'Absence, exam, and school alerts',
            value: pushState.value ?? false,
            loading: pushState.isLoading,
            onChanged: onTogglePush,
          ),
        ),
        const SizedBox(height: 18),
        const _AccountSectionLabel(title: 'Support & legal'),
        const SizedBox(height: 10),
        ParentCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              _MenuTile(
                icon: Icons.settings_outlined,
                accent: const Color(0xFF0369A1),
                soft: const Color(0xFFE0F2FE),
                title: 'Settings',
                subtitle: 'Notification and account preferences',
                onTap: () => onOpenInfo(
                  'Settings',
                  'Push notifications can be enabled or disabled from this screen. More parent app settings will be added as modules are enabled.',
                ),
              ),
              const _MenuDivider(),
              _MenuTile(
                icon: Icons.help_outline_rounded,
                accent: const Color(0xFF7C3AED),
                soft: const Color(0xFFF3E8FF),
                title: 'Frequently Asked Questions',
                subtitle: 'Common parent app questions',
                onTap: () => onOpenInfo(
                  'Frequently Asked Questions',
                  'Use Home to select a child, Attend to view attendance, Leave to submit leave requests, Reports for marks and attendance reports, and Alerts for school notifications.',
                ),
              ),
              const _MenuDivider(),
              _MenuTile(
                icon: Icons.privacy_tip_outlined,
                accent: const Color(0xFFDB2777),
                soft: const Color(0xFFFCE7F3),
                title: 'Privacy Policy',
                subtitle: 'How parent and student data is handled',
                onTap: () => onOpenInfo(
                  'Privacy Policy',
                  'Akademifyy uses parent and student data only for school communication, attendance, reports, fees, and related school operations.',
                ),
              ),
              const _MenuDivider(),
              _MenuTile(
                icon: Icons.description_outlined,
                accent: const Color(0xFF0F766E),
                soft: const Color(0xFFE7F7F4),
                title: 'Terms of Service',
                subtitle: 'Parent app usage terms',
                onTap: () => onOpenInfo(
                  'Terms of Service',
                  'Use of this app is subject to your school account access and Akademifyy platform terms.',
                ),
              ),
              const _MenuDivider(),
              const _StaticTile(
                icon: Icons.info_outline_rounded,
                accent: SaaptTheme.primary,
                soft: Color(0xFFEAF1FF),
                title: 'App Version',
                subtitle: ParentAppConfig.appVersion,
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        ParentCard(
          padding: EdgeInsets.zero,
          child: _MenuTile(
            icon: Icons.logout_rounded,
            accent: const Color(0xFFDC2626),
            soft: const Color(0xFFFFEDED),
            title: 'Logout',
            subtitle: 'Sign out from this device',
            danger: true,
            onTap: onLogout,
          ),
        ),
      ],
    );
  }
}

class _AccountSectionLabel extends StatelessWidget {
  const _AccountSectionLabel({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Text(
      title,
      style: const TextStyle(
        color: SaaptTheme.navy,
        fontSize: 14,
        fontWeight: FontWeight.w900,
      ),
    );
  }
}

class _AccountStatChip extends StatelessWidget {
  const _AccountStatChip({
    required this.label,
    required this.value,
    required this.icon,
    required this.accent,
    required this.soft,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color accent;
  final Color soft;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      decoration: BoxDecoration(
        color: soft,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: accent.withValues(alpha: 0.12)),
      ),
      child: Row(
        children: [
          Icon(icon, color: accent, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label.toUpperCase(),
                  style: TextStyle(
                    color: accent.withValues(alpha: 0.75),
                    fontSize: 9.5,
                    letterSpacing: 0.4,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: SaaptTheme.navy,
                    fontSize: 13,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MenuDivider extends StatelessWidget {
  const _MenuDivider();

  @override
  Widget build(BuildContext context) {
    return const Divider(
      height: 1,
      thickness: 0.7,
      indent: 68,
      color: Color(0xFFE6EBF3),
    );
  }
}

class _ChildrenPanel extends StatelessWidget {
  const _ChildrenPanel({
    required this.profile,
    required this.onSelectChild,
  });

  final ParentProfile profile;
  final ValueChanged<String> onSelectChild;

  @override
  Widget build(BuildContext context) {
    if (profile.children.isEmpty) {
      return const _ChildEmptyState(
        icon: Icons.family_restroom_rounded,
        title: 'No children mapped',
        message: 'No children are mapped to this account yet.',
      );
    }

    final children = profile.children;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ParentCard(
          padding: EdgeInsets.zero,
          child: Container(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFFEAF1FF), Colors.white],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.all(Radius.circular(16)),
            ),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: SaaptTheme.primary.withValues(alpha: 0.18),
                    ),
                  ),
                  child: const Icon(
                    Icons.groups_rounded,
                    color: SaaptTheme.primary,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${children.length} child${children.length == 1 ? '' : 'ren'} linked',
                        style: const TextStyle(
                          color: SaaptTheme.navy,
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                          letterSpacing: -0.2,
                        ),
                      ),
                      const SizedBox(height: 3),
                      const Text(
                        'Open a profile for fees, documents, exams and more',
                        style: TextStyle(
                          color: Color(0xFF60708F),
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 18),
        Row(
          children: [
            const Expanded(
              child: Text(
                'Your children',
                style: TextStyle(
                  color: SaaptTheme.navy,
                  fontSize: 14,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFFEAF1FF),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                '${children.length}',
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
        for (var i = 0; i < children.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: _ChildProfileCard(
              child: children[i],
              accentIndex: i,
              onTap: () => onSelectChild(children[i].id),
            ),
          ),
      ],
    );
  }
}

class _ChildProfileCard extends StatelessWidget {
  const _ChildProfileCard({
    required this.child,
    required this.accentIndex,
    required this.onTap,
  });

  final ParentChild child;
  final int accentIndex;
  final VoidCallback onTap;

  static const _accents = <(Color, Color)>[
    (Color(0xFF2054E8), Color(0xFFEAF1FF)),
    (Color(0xFF0F766E), Color(0xFFE7F7F4)),
    (Color(0xFFB45309), Color(0xFFFFF4E5)),
    (Color(0xFF7C3AED), Color(0xFFF3E8FF)),
    (Color(0xFFDB2777), Color(0xFFFCE7F3)),
    (Color(0xFF0369A1), Color(0xFFE0F2FE)),
  ];

  @override
  Widget build(BuildContext context) {
    final accent = _accents[accentIndex % _accents.length];
    final name = child.name.trim().isEmpty ? 'Student' : child.name.trim();
    final classLabel = child.classLabel.trim();
    final school = child.schoolName?.trim() ?? '';
    final roll = child.rollNo?.trim() ?? '';
    final admission = child.admissionNo?.trim() ?? '';
    final status = child.status?.trim().isNotEmpty == true
        ? child.status!.trim()
        : 'Active';
    final statusActive = !status.toLowerCase().contains('inactive') &&
        !status.toLowerCase().contains('left');

    final facts = <(String, String)>[
      if (classLabel.isNotEmpty) ('Class', classLabel),
      if (roll.isNotEmpty) ('Roll', roll),
      if (admission.isNotEmpty && admission != roll) ('Admission', admission),
      if (school.isNotEmpty) ('School', school),
    ];

    return ParentCard(
      padding: EdgeInsets.zero,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [accent.$2, Colors.white],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(16),
                ),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 58,
                    height: 58,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(
                        color: accent.$1.withValues(alpha: 0.2),
                        width: 2,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: accent.$1.withValues(alpha: 0.16),
                          blurRadius: 12,
                          offset: const Offset(0, 5),
                        ),
                      ],
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: _ChildAvatar(
                        child: child,
                        size: 58,
                        circular: true,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: SaaptTheme.navy,
                                  fontSize: 16,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: -0.2,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 9,
                                vertical: 5,
                              ),
                              decoration: BoxDecoration(
                                color: statusActive
                                    ? const Color(0xFFE9F8EF)
                                    : const Color(0xFFFFF4DF),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(
                                status,
                                style: TextStyle(
                                  color: statusActive
                                      ? const Color(0xFF059669)
                                      : const Color(0xFFB45309),
                                  fontSize: 11,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ),
                          ],
                        ),
                        if (classLabel.isNotEmpty || school.isNotEmpty) ...[
                          const SizedBox(height: 6),
                          Text(
                            [
                              if (classLabel.isNotEmpty) classLabel,
                              if (school.isNotEmpty) school,
                            ].join(' · '),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Color(0xFF60708F),
                              fontSize: 13,
                              height: 1.3,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
            if (facts.isNotEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final gap = 8.0;
                    final half = (constraints.maxWidth - gap) / 2;
                    return Wrap(
                      spacing: gap,
                      runSpacing: gap,
                      children: [
                        for (final fact in facts)
                          SizedBox(
                            width: facts.length == 1 || fact.$2.length > 26
                                ? constraints.maxWidth
                                : half,
                            child: Container(
                              width: double.infinity,
                              padding: const EdgeInsets.fromLTRB(
                                12,
                                10,
                                12,
                                10,
                              ),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF7FAFF),
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(
                                  color: const Color(0xFFE5ECF7),
                                ),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    fact.$1.toUpperCase(),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: Color(0xFF8EA0BA),
                                      fontSize: 10,
                                      letterSpacing: 0.4,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    fact.$2,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: SaaptTheme.navy,
                                      fontSize: 13.5,
                                      height: 1.25,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                      ],
                    );
                  },
                ),
              ),
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
              child: Row(
                children: [
                  Icon(
                    Icons.person_outline_rounded,
                    size: 16,
                    color: accent.$1.withValues(alpha: 0.8),
                  ),
                  const SizedBox(width: 6),
                  const Expanded(
                    child: Text(
                      'View full student profile',
                      style: TextStyle(
                        color: Color(0xFF8EA0BA),
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  Text(
                    'Open',
                    style: TextStyle(
                      color: accent.$1,
                      fontSize: 12.5,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  Icon(
                    Icons.chevron_right_rounded,
                    size: 18,
                    color: accent.$1,
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
        _SchoolDetailCard(school: selected),
        if (selected.contacts.isNotEmpty) ...[
          const SizedBox(height: 14),
          _SchoolContactChatList(contacts: selected.contacts),
        ],
      ],
    );
  }
}

class _SchoolDetailCard extends StatelessWidget {
  const _SchoolDetailCard({required this.school});

  final SchoolProfileDetails school;

  @override
  Widget build(BuildContext context) {
    final name = school.name.trim().isEmpty ? 'School' : school.name.trim();
    final code = school.code.trim();
    final email = school.email?.trim() ?? '';
    final phone = school.mobileNumber?.trim() ?? '';
    final address = school.address?.trim() ?? '';

    return ParentCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 14, 16, 8),
            child: Text(
              'School Details',
              style: TextStyle(
                color: SaaptTheme.navy,
                fontSize: 15,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 6, 14, 16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: const Color(0xFF0288D1),
                  child: Text(
                    _schoolInitials(name),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        style: const TextStyle(
                          color: Color(0xFF111B21),
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 8),
                      _SchoolDetailLine(
                        icon: Icons.tag_rounded,
                        label: 'School Code',
                        value: code.isEmpty ? '-' : code,
                      ),
                      _SchoolDetailLine(
                        icon: Icons.mail_outline_rounded,
                        label: 'Email',
                        value: email.isEmpty ? '-' : email,
                        onTap: email.isEmpty ? null : () => _launchEmail(email),
                      ),
                      _SchoolDetailLine(
                        icon: Icons.call_outlined,
                        label: 'Mobile Number',
                        value: phone.isEmpty ? '-' : phone,
                        onTap: phone.isEmpty ? null : () => _launchPhone(phone),
                      ),
                      _SchoolDetailLine(
                        icon: Icons.location_on_outlined,
                        label: 'Address',
                        value: address.isEmpty ? '-' : address,
                        last: true,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static String _schoolInitials(String name) {
    final parts = name
        .trim()
        .split(RegExp(r'\s+'))
        .where((part) => part.isNotEmpty)
        .toList();
    if (parts.isEmpty) return 'S';
    if (parts.length == 1) {
      final value = parts.first;
      return value.substring(0, value.length >= 2 ? 2 : 1).toUpperCase();
    }
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }
}

class _SchoolDetailLine extends StatelessWidget {
  const _SchoolDetailLine({
    required this.icon,
    required this.label,
    required this.value,
    this.onTap,
    this.last = false,
  });

  final IconData icon;
  final String label;
  final String value;
  final VoidCallback? onTap;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final child = Padding(
      padding: EdgeInsets.only(bottom: last ? 0 : 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: const Color(0xFF667781)),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    color: Color(0xFF667781),
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: TextStyle(
                    color: onTap == null
                        ? const Color(0xFF111B21)
                        : SaaptTheme.primary,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );

    if (onTap == null) return child;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: child,
    );
  }
}

class _SchoolContactChatList extends StatelessWidget {
  const _SchoolContactChatList({required this.contacts});

  final List<SchoolContactDetail> contacts;

  @override
  Widget build(BuildContext context) {
    return ParentCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 14, 16, 8),
            child: Text(
              'Contact Information',
              style: TextStyle(
                color: SaaptTheme.navy,
                fontSize: 15,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
          for (var i = 0; i < contacts.length; i++) ...[
            if (i > 0)
              const Divider(
                height: 1,
                thickness: 0.6,
                indent: 72,
                color: Color(0xFFE6EBF3),
              ),
            _SchoolContactChatTile(contact: contacts[i]),
          ],
        ],
      ),
    );
  }
}

class _SchoolContactChatTile extends StatelessWidget {
  const _SchoolContactChatTile({required this.contact});

  final SchoolContactDetail contact;

  @override
  Widget build(BuildContext context) {
    final subtitle = [
      if (contact.department.trim().isNotEmpty) contact.department.trim(),
      if (contact.contactNumber.trim().isNotEmpty) contact.contactNumber.trim(),
    ].join(' · ');

    return InkWell(
      onTap: () => _showContactActions(context, contact),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 11, 14, 11),
        child: Row(
          children: [
            CircleAvatar(
              radius: 24,
              backgroundColor: _avatarColor(contact.name),
              child: Text(
                _initials(contact.name),
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    contact.name.trim().isEmpty
                        ? 'Contact'
                        : contact.name.trim(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Color(0xFF111B21),
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  if (subtitle.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(
                      subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Color(0xFF667781),
                        fontSize: 13.5,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 8),
            const Icon(
              Icons.chevron_right_rounded,
              color: Color(0xFFB0B8C4),
              size: 22,
            ),
          ],
        ),
      ),
    );
  }

  static String _initials(String name) {
    final parts = name
        .trim()
        .split(RegExp(r'\s+'))
        .where((part) => part.isNotEmpty)
        .toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) {
      final value = parts.first;
      return value.substring(0, value.length >= 2 ? 2 : 1).toUpperCase();
    }
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }

  static Color _avatarColor(String name) {
    const palette = [
      Color(0xFF00A884),
      Color(0xFF0288D1),
      Color(0xFF7B61FF),
      Color(0xFFE56717),
      Color(0xFFD84315),
      Color(0xFF00897B),
      Color(0xFF5E35B1),
    ];
    if (name.trim().isEmpty) return palette.first;
    return palette[name.trim().codeUnits.fold(0, (a, b) => a + b) %
        palette.length];
  }

  Future<void> _showContactActions(
    BuildContext context,
    SchoolContactDetail contact,
  ) {
    final email = contact.email.trim();
    final phone = contact.contactNumber.trim();
    return showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  contact.name.trim().isEmpty
                      ? 'Contact'
                      : contact.name.trim(),
                  style: const TextStyle(
                    color: SaaptTheme.navy,
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                if (contact.department.trim().isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    contact.department.trim(),
                    style: const TextStyle(
                      color: Color(0xFF60708F),
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                if (phone.isNotEmpty)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const CircleAvatar(
                      backgroundColor: Color(0xFFE8F8F1),
                      child: Icon(Icons.call_rounded, color: Color(0xFF00A884)),
                    ),
                    title: const Text(
                      'Call',
                      style: TextStyle(fontWeight: FontWeight.w800),
                    ),
                    subtitle: Text(phone),
                    onTap: () {
                      Navigator.of(context).pop();
                      _launchPhone(phone);
                    },
                  ),
                if (email.isNotEmpty)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const CircleAvatar(
                      backgroundColor: Color(0xFFEAF1FF),
                      child: Icon(
                        Icons.mail_outline,
                        color: SaaptTheme.primary,
                      ),
                    ),
                    title: const Text(
                      'Email',
                      style: TextStyle(fontWeight: FontWeight.w800),
                    ),
                    subtitle: Text(email),
                    onTap: () {
                      Navigator.of(context).pop();
                      _launchEmail(email);
                    },
                  ),
                if (phone.isEmpty && email.isEmpty)
                  const EmptyPanel(message: 'No contact actions available.'),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _ChildDetailScroll extends ConsumerStatefulWidget {
  const _ChildDetailScroll({
    required this.childId,
    this.initialTabKey,
  });

  final String childId;
  final String? initialTabKey;

  @override
  ConsumerState<_ChildDetailScroll> createState() => _ChildDetailScrollState();
}

class _ChildDetailScrollState extends ConsumerState<_ChildDetailScroll>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _tabScrollController = ScrollController();
  final _tabKeys = List<GlobalKey>.generate(
    _childDetailTabs.length,
    (_) => GlobalKey(),
  );

  @override
  void initState() {
    super.initState();
    _tabController = TabController(
      length: _childDetailTabs.length,
      vsync: this,
      initialIndex: _tabIndexForKey(widget.initialTabKey),
    );
    _tabController.addListener(_onTabChanged);
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => _scrollTabIntoView(_tabController.index),
    );
  }

  @override
  void didUpdateWidget(covariant _ChildDetailScroll oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.childId != widget.childId ||
        oldWidget.initialTabKey != widget.initialTabKey) {
      final index = _tabIndexForKey(widget.initialTabKey);
      if (_tabController.index != index) {
        _tabController.animateTo(index);
      }
    }
  }

  @override
  void dispose() {
    _tabController.removeListener(_onTabChanged);
    _tabController.dispose();
    _tabScrollController.dispose();
    super.dispose();
  }

  void _onTabChanged() {
    if (_tabController.indexIsChanging) return;
    setState(() {});
    _scrollTabIntoView(_tabController.index);
  }

  int _tabIndexForKey(String? key) {
    final normalized = key?.trim().toLowerCase();
    final index = _childDetailTabs.indexWhere((tab) => tab.key == normalized);
    return index < 0 ? 0 : index;
  }

  void _scrollTabIntoView(int index) {
    final keyContext = _tabKeys[index].currentContext;
    if (keyContext == null) return;
    Scrollable.ensureVisible(
      keyContext,
      duration: const Duration(milliseconds: 280),
      curve: Curves.easeOutCubic,
      alignment: 0.35,
    );
  }

  Future<void> _refresh() async {
    ref.invalidate(parentChildDetailProvider(widget.childId));
    await ref.read(parentChildDetailProvider(widget.childId).future);
  }

  @override
  Widget build(BuildContext context) {
    final detailState = ref.watch(parentChildDetailProvider(widget.childId));
    return detailState.when(
      loading: () => const Center(child: LoadingPanel()),
      error: (error, _) => ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 28, 20, 32),
        children: [
          _ChildEmptyState(
            icon: Icons.error_outline_rounded,
            title: 'Unable to load',
            message: parentApiError(error, 'Unable to load child profile'),
          ),
        ],
      ),
      data: (detail) {
        return Column(
          children: [
            _ChildTabStrip(
              selectedIndex: _tabController.index,
              scrollController: _tabScrollController,
              tabKeys: _tabKeys,
              onTap: (index) => _tabController.animateTo(index),
            ),
            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: [
                  for (final tab in _childDetailTabs)
                    RefreshIndicator(
                      color: SaaptTheme.primary,
                      onRefresh: _refresh,
                      child: ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.fromLTRB(20, 18, 20, 36),
                        children: [
                          _ChildTabIntro(tab: tab),
                          const SizedBox(height: 16),
                          _DataPanel(
                            tabKey: tab.key,
                            title: tab.label,
                            data: detail.tabs[tab.key],
                            childId: widget.childId,
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

class _ChildAvatar extends StatelessWidget {
  const _ChildAvatar({
    required this.child,
    required this.size,
    this.circular = false,
  });

  final ParentChild child;
  final double size;
  final bool circular;

  @override
  Widget build(BuildContext context) {
    final photoUrl = child.photoUrl;
    final radius = circular ? size / 2 : 18.0;
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
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
  _ChildTabConfig(
    'profile',
    'Profile',
    Icons.person_outline_rounded,
    'Admission, personal and medical details',
  ),
  _ChildTabConfig(
    'parents',
    'Parents',
    Icons.family_restroom_rounded,
    'Guardian and family contacts',
  ),
  _ChildTabConfig(
    'fees',
    'Fees',
    Icons.receipt_long_outlined,
    'Invoices, payments and balance',
  ),
  _ChildTabConfig(
    'transport',
    'Transport',
    Icons.directions_bus_outlined,
    'Routes, pickup and drop details',
  ),
  _ChildTabConfig(
    'library',
    'Library',
    Icons.local_library_outlined,
    'Membership and issued books',
  ),
  _ChildTabConfig(
    'dormitory',
    'Dormitory',
    Icons.bed_outlined,
    'Hostel room and stay details',
  ),
  _ChildTabConfig(
    'exam',
    'Exam',
    Icons.assignment_outlined,
    'Schedules and exam records',
  ),
  _ChildTabConfig(
    'documents',
    'Documents',
    Icons.folder_outlined,
    'Certificates and uploaded files',
  ),
  _ChildTabConfig(
    'timeline',
    'Timeline',
    Icons.timeline_outlined,
    'Recent school activity',
  ),
];

class _ChildTabConfig {
  const _ChildTabConfig(this.key, this.label, this.icon, this.caption);

  final String key;
  final String label;
  final IconData icon;
  final String caption;
}

class _ChildTabStrip extends StatelessWidget {
  const _ChildTabStrip({
    required this.selectedIndex,
    required this.scrollController,
    required this.tabKeys,
    required this.onTap,
  });

  final int selectedIndex;
  final ScrollController scrollController;
  final List<GlobalKey> tabKeys;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      elevation: 0,
      child: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(
            bottom: BorderSide(color: Color(0xFFE4ECF8)),
          ),
          boxShadow: [
            BoxShadow(
              color: Color(0x0A113B7A),
              blurRadius: 16,
              offset: Offset(0, 6),
            ),
          ],
        ),
        child: SingleChildScrollView(
          controller: scrollController,
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          child: Row(
            children: [
              for (var index = 0; index < _childDetailTabs.length; index++)
                Padding(
                  key: tabKeys[index],
                  padding: EdgeInsets.only(
                    right: index == _childDetailTabs.length - 1 ? 0 : 8,
                  ),
                  child: _ChildTabChip(
                    tab: _childDetailTabs[index],
                    selected: selectedIndex == index,
                    onTap: () => onTap(index),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ChildTabChip extends StatelessWidget {
  const _ChildTabChip({
    required this.tab,
    required this.selected,
    required this.onTap,
  });

  final _ChildTabConfig tab;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOutCubic,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            gradient: selected
                ? const LinearGradient(
                    colors: [Color(0xFF1E4FE8), Color(0xFF3A72FF)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  )
                : null,
            color: selected ? null : const Color(0xFFF4F7FD),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: selected
                  ? Colors.transparent
                  : const Color(0xFFE0E8F5),
            ),
            boxShadow: selected
                ? const [
                    BoxShadow(
                      color: Color(0x332054E8),
                      blurRadius: 14,
                      offset: Offset(0, 6),
                    ),
                  ]
                : null,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                tab.icon,
                size: 17,
                color: selected ? Colors.white : const Color(0xFF60708F),
              ),
              const SizedBox(width: 7),
              Text(
                tab.label,
                style: TextStyle(
                  color: selected ? Colors.white : SaaptTheme.navy,
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.1,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ChildTabIntro extends StatelessWidget {
  const _ChildTabIntro({required this.tab});

  final _ChildTabConfig tab;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            gradient: const LinearGradient(
              colors: [Color(0xFFEAF1FF), Color(0xFFF4F7FD)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            border: Border.all(color: const Color(0xFFDDE7F7)),
          ),
          child: Icon(tab.icon, color: SaaptTheme.primary, size: 22),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                tab.label,
                style: const TextStyle(
                  color: SaaptTheme.navy,
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.3,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                tab.caption,
                style: const TextStyle(
                  color: Color(0xFF60708F),
                  fontSize: 13,
                  height: 1.35,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ChildEmptyState extends StatelessWidget {
  const _ChildEmptyState({
    required this.icon,
    required this.title,
    required this.message,
  });

  final IconData icon;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return ParentCard(
      padding: const EdgeInsets.fromLTRB(22, 28, 22, 28),
      child: Column(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: const Color(0xFFEAF1FF),
              border: Border.all(color: const Color(0xFFD5E2F8)),
            ),
            child: Icon(icon, color: SaaptTheme.primary, size: 28),
          ),
          const SizedBox(height: 16),
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: SaaptTheme.navy,
              fontSize: 16,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Color(0xFF60708F),
              fontSize: 13.5,
              height: 1.4,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
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
    if (tabKey == 'parents') {
      return _ParentsTabPanel(data: data);
    }
    if (tabKey == 'documents') {
      return _DocumentsTabPanel(data: data);
    }
    if (tabKey == 'library') {
      return _LibraryTabPanel(data: data);
    }
    if (tabKey == 'fees') {
      return _FeesTabPanel(data: data, childId: childId);
    }
    final records = _recordsForTab(tabKey, data);
    if (records.isEmpty) {
      final tab = _childDetailTabs.firstWhere(
        (item) => item.key == tabKey,
        orElse: () => _childDetailTabs.first,
      );
      return _ChildEmptyState(
        icon: tab.icon,
        title: 'No $title yet',
        message: 'Nothing to show here for this student right now.',
      );
    }
    return _GroupedRecordsTabPanel(
      tabKey: tabKey,
      title: title,
      records: records,
    );
  }
}

class _TabVisual {
  const _TabVisual(this.icon, this.accent, this.soft);

  final IconData icon;
  final Color accent;
  final Color soft;

  static _TabVisual forKey(String tabKey) {
    switch (tabKey) {
      case 'fees':
        return const _TabVisual(
          Icons.receipt_long_outlined,
          Color(0xFF2054E8),
          Color(0xFFEAF1FF),
        );
      case 'transport':
        return const _TabVisual(
          Icons.directions_bus_outlined,
          Color(0xFF0369A1),
          Color(0xFFE0F2FE),
        );
      case 'library':
        return const _TabVisual(
          Icons.local_library_outlined,
          Color(0xFF7C3AED),
          Color(0xFFF3E8FF),
        );
      case 'dormitory':
        return const _TabVisual(
          Icons.bed_outlined,
          Color(0xFF0F766E),
          Color(0xFFE7F7F4),
        );
      case 'exam':
        return const _TabVisual(
          Icons.assignment_outlined,
          Color(0xFFB45309),
          Color(0xFFFFF4E5),
        );
      case 'documents':
        return const _TabVisual(
          Icons.folder_outlined,
          Color(0xFF2054E8),
          Color(0xFFEAF1FF),
        );
      case 'timeline':
        return const _TabVisual(
          Icons.timeline_outlined,
          Color(0xFFDB2777),
          Color(0xFFFCE7F3),
        );
      default:
        return const _TabVisual(
          Icons.info_outline_rounded,
          SaaptTheme.primary,
          Color(0xFFEAF1FF),
        );
    }
  }
}

class _GroupedRecordsTabPanel extends StatelessWidget {
  const _GroupedRecordsTabPanel({
    required this.tabKey,
    required this.title,
    required this.records,
  });

  final String tabKey;
  final String title;
  final List<_DisplayRecord> records;

  @override
  Widget build(BuildContext context) {
    final visual = _TabVisual.forKey(tabKey);
    final groups = <String, List<_DisplayRecord>>{};
    for (final record in records) {
      final key = record.category.trim().isEmpty ? title : record.category;
      groups.putIfAbsent(key, () => []).add(record);
    }

    final isTimeline = tabKey == 'timeline';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final entry in groups.entries) ...[
          if (groups.length > 1 || entry.key != title) ...[
            _DocumentGroupHeader(
              title: entry.key,
              count: entry.value.length,
            ),
            const SizedBox(height: 10),
          ],
          if (isTimeline)
            _TimelineList(records: entry.value, visual: visual)
          else
            for (final record in entry.value)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _ContentRecordCard(
                  record: record,
                  visual: visual,
                ),
              ),
          const SizedBox(height: 6),
        ],
      ],
    );
  }
}

class _TimelineList extends StatelessWidget {
  const _TimelineList({required this.records, required this.visual});

  final List<_DisplayRecord> records;
  final _TabVisual visual;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (var i = 0; i < records.length; i++)
          _TimelineRecordCard(
            record: records[i],
            visual: visual,
            isFirst: i == 0,
            isLast: i == records.length - 1,
          ),
      ],
    );
  }
}

class _TimelineRecordCard extends StatelessWidget {
  const _TimelineRecordCard({
    required this.record,
    required this.visual,
    required this.isFirst,
    required this.isLast,
  });

  final _DisplayRecord record;
  final _TabVisual visual;
  final bool isFirst;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final facts = _previewFacts(record.data, limit: 3);
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 28,
            child: Column(
              children: [
                Expanded(
                  child: Container(
                    width: 2,
                    color: isFirst
                        ? Colors.transparent
                        : visual.accent.withValues(alpha: 0.25),
                  ),
                ),
                Container(
                  width: 14,
                  height: 14,
                  decoration: BoxDecoration(
                    color: visual.accent,
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 2),
                    boxShadow: [
                      BoxShadow(
                        color: visual.accent.withValues(alpha: 0.35),
                        blurRadius: 8,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: Container(
                    width: 2,
                    color: isLast
                        ? Colors.transparent
                        : visual.accent.withValues(alpha: 0.25),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(
                top: isFirst ? 0 : 6,
                bottom: isLast ? 0 : 12,
              ),
              child: ParentCard(
                padding: EdgeInsets.zero,
                child: InkWell(
                  borderRadius: BorderRadius.circular(16),
                  onTap: () => _showRecordDetailSheet(context, record),
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                color: visual.soft,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Icon(
                                record.icon,
                                color: visual.accent,
                                size: 20,
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    record.title,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: SaaptTheme.navy,
                                      fontSize: 14.5,
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                  if (record.subtitle.trim().isNotEmpty) ...[
                                    const SizedBox(height: 3),
                                    Text(
                                      record.subtitle,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        color: Color(0xFF60708F),
                                        fontSize: 12.5,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ],
                        ),
                        if (facts.isNotEmpty) ...[
                          const SizedBox(height: 12),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              for (final fact in facts)
                                _MiniFactChip(
                                  label: fact.$1,
                                  value: fact.$2,
                                ),
                            ],
                          ),
                        ],
                      ],
                    ),
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

List<(String, String)> _previewFacts(
  Map<String, dynamic> data, {
  int limit = 4,
  Set<String> skipValues = const {},
}) {
  final facts = <(String, String)>[];
  for (final entry in data.entries) {
    if (facts.length >= limit) break;
    final key = entry.key.toString();
    if (_shouldHideKey(key)) continue;
    if (entry.value is Map || entry.value is List) continue;
    if (_isEmptyData(entry.value)) continue;
    final value = _displayValue(entry.value);
    if (value.trim().isEmpty) continue;
    if (skipValues.any((skip) => skip.toLowerCase() == value.toLowerCase())) {
      continue;
    }
    facts.add((_labelForKey(key), value));
  }
  return facts;
}

class _ProfileTabPanel extends StatelessWidget {
  const _ProfileTabPanel({required this.data});

  final Object? data;

  static const _sectionMeta = <String, (IconData, Color, Color)>{
    'admission': (Icons.badge_outlined, Color(0xFF2054E8), Color(0xFFEAF1FF)),
    'personal': (Icons.person_outline_rounded, Color(0xFF0F766E), Color(0xFFE7F7F4)),
    'address': (Icons.home_outlined, Color(0xFFB45309), Color(0xFFFFF4E5)),
    'medical': (Icons.medical_services_outlined, Color(0xFFDC2626), Color(0xFFFFEDED)),
  };

  @override
  Widget build(BuildContext context) {
    final map = _asMap(data);
    final sections = <Widget>[];
    for (final key in const ['admission', 'personal', 'address', 'medical']) {
      final section = _asMap(map[key]);
      if (_isEmptyData(section)) continue;
      final meta = _sectionMeta[key]!;
      sections.add(
        _InfoSectionCard(
          title: _labelForKey(key),
          icon: meta.$1,
          accent: meta.$2,
          soft: meta.$3,
          data: section,
        ),
      );
    }

    final siblings = _recordsFromGroup('Siblings', map['siblings']);
    if (siblings.isNotEmpty) {
      sections.add(
        _SiblingSection(records: siblings),
      );
    }

    if (sections.isEmpty) {
      return const _ChildEmptyState(
        icon: Icons.person_outline_rounded,
        title: 'No profile records',
        message: 'Profile details for this student are not available yet.',
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final section in sections)
          Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: section,
          ),
      ],
    );
  }
}

class _InfoSectionCard extends StatelessWidget {
  const _InfoSectionCard({
    required this.title,
    required this.icon,
    required this.accent,
    required this.soft,
    required this.data,
  });

  final String title;
  final IconData icon;
  final Color accent;
  final Color soft;
  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    final entries = data.entries
        .where((entry) => !_shouldHideKey(entry.key.toString()))
        .where((entry) => !_isEmptyData(entry.value))
        .toList();
    if (entries.isEmpty) return const SizedBox.shrink();

    return ParentCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [soft, Colors.white],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
            ),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: accent.withValues(alpha: 0.18)),
                  ),
                  child: Icon(icon, color: accent, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                      color: SaaptTheme.navy,
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.2,
                    ),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
            child: LayoutBuilder(
              builder: (context, constraints) {
                final gap = 8.0;
                final half = (constraints.maxWidth - gap) / 2;
                return Wrap(
                  spacing: gap,
                  runSpacing: gap,
                  children: [
                    for (final entry in entries)
                      SizedBox(
                        width: _displayValue(entry.value).length > 28 ||
                                entries.length == 1
                            ? constraints.maxWidth
                            : half,
                        child: _FactChip(
                          label: _labelForKey(entry.key.toString()),
                          value: _displayValue(entry.value),
                        ),
                      ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _FactChip extends StatelessWidget {
  const _FactChip({
    required this.label,
    required this.value,
  });

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF7FAFF),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE5ECF7)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: Color(0xFF8EA0BA),
              fontSize: 10,
              letterSpacing: 0.5,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 5),
          Text(
            value,
            style: const TextStyle(
              color: SaaptTheme.navy,
              fontSize: 14,
              height: 1.3,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _SiblingSection extends StatelessWidget {
  const _SiblingSection({required this.records});

  final List<_DisplayRecord> records;

  @override
  Widget build(BuildContext context) {
    return ParentCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
            decoration: const BoxDecoration(
              color: Color(0xFFF4F7FD),
              borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
            ),
            child: const Row(
              children: [
                Icon(Icons.people_outline_rounded, color: SaaptTheme.primary),
                SizedBox(width: 10),
                Text(
                  'Siblings',
                  style: TextStyle(
                    color: SaaptTheme.navy,
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ],
            ),
          ),
          for (var i = 0; i < records.length; i++) ...[
            if (i > 0)
              const Divider(
                height: 1,
                thickness: 0.7,
                indent: 72,
                color: Color(0xFFE6EBF3),
              ),
            _SummaryRecordTile(record: records[i], embedded: true),
          ],
        ],
      ),
    );
  }
}

class _ParentsTabPanel extends StatelessWidget {
  const _ParentsTabPanel({required this.data});

  final Object? data;

  @override
  Widget build(BuildContext context) {
    final records = _parentRecords(data);
    if (records.isEmpty) {
      return const _ChildEmptyState(
        icon: Icons.family_restroom_rounded,
        title: 'No parent records',
        message: 'Guardian details are not available for this student yet.',
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final record in records)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: _ParentPersonCard(record: record),
          ),
      ],
    );
  }
}

class _ParentPersonCard extends StatelessWidget {
  const _ParentPersonCard({required this.record});

  final _DisplayRecord record;

  Color get _roleColor {
    final role = record.category.toLowerCase();
    if (role.contains('father')) return const Color(0xFF2054E8);
    if (role.contains('mother')) return const Color(0xFFDB2777);
    if (role.contains('guardian')) return const Color(0xFF0F766E);
    return SaaptTheme.primary;
  }

  Color get _roleSoft {
    final role = record.category.toLowerCase();
    if (role.contains('father')) return const Color(0xFFEAF1FF);
    if (role.contains('mother')) return const Color(0xFFFCE7F3);
    if (role.contains('guardian')) return const Color(0xFFE7F7F4);
    return const Color(0xFFEAF1FF);
  }

  @override
  Widget build(BuildContext context) {
    final phone = _firstString(record.data, [
      'phone',
      'mobile',
      'contactNumber',
      'phoneNumber',
    ]);
    final email = _firstString(record.data, ['email', 'emailAddress']);
    final occupation = _firstString(record.data, [
      'occupation',
      'relationship',
      'relation',
    ]);
    final initials = _initialsFor(record.title);

    return ParentCard(
      padding: EdgeInsets.zero,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => _showRecordDetailSheet(context, record),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _PersonAvatar(
                    imageUrl: record.imageUrl,
                    initials: initials,
                    color: _roleColor,
                    soft: _roleSoft,
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                record.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: SaaptTheme.navy,
                                  fontSize: 16,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: -0.2,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 5,
                              ),
                              decoration: BoxDecoration(
                                color: _roleSoft,
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(
                                record.category,
                                style: TextStyle(
                                  color: _roleColor,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ),
                          ],
                        ),
                        if (occupation != null &&
                            occupation.toLowerCase() !=
                                record.category.toLowerCase()) ...[
                          const SizedBox(height: 6),
                          Text(
                            occupation,
                            style: const TextStyle(
                              color: Color(0xFF60708F),
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
            if (phone != null || email != null) ...[
              const Divider(height: 1, thickness: 0.7, color: Color(0xFFE6EBF3)),
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 6, 8, 8),
                child: Column(
                  children: [
                    if (phone != null)
                      _ContactActionRow(
                        icon: Icons.call_rounded,
                        label: phone,
                        tint: const Color(0xFF00A884),
                        soft: const Color(0xFFE8F8F1),
                        onTap: () => _launchPhone(phone),
                      ),
                    if (email != null)
                      _ContactActionRow(
                        icon: Icons.mail_outline_rounded,
                        label: email,
                        tint: SaaptTheme.primary,
                        soft: const Color(0xFFEAF1FF),
                        onTap: () => _launchEmail(email),
                      ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _PersonAvatar extends StatelessWidget {
  const _PersonAvatar({
    required this.initials,
    required this.color,
    required this.soft,
    this.imageUrl,
  });

  final String initials;
  final Color color;
  final Color soft;
  final String? imageUrl;

  @override
  Widget build(BuildContext context) {
    final url = imageUrl?.trim();
    return ClipRRect(
      borderRadius: BorderRadius.circular(18),
      child: Container(
        width: 56,
        height: 56,
        color: soft,
        child: url != null && url.isNotEmpty
            ? Image.network(
                url,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => Center(
                  child: Text(
                    initials,
                    style: TextStyle(
                      color: color,
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              )
            : Center(
                child: Text(
                  initials,
                  style: TextStyle(
                    color: color,
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
      ),
    );
  }
}

class _ContactActionRow extends StatelessWidget {
  const _ContactActionRow({
    required this.icon,
    required this.label,
    required this.tint,
    required this.soft,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final Color tint;
  final Color soft;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        child: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: soft,
                borderRadius: BorderRadius.circular(11),
              ),
              child: Icon(icon, color: tint, size: 18),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: SaaptTheme.navy,
                  fontSize: 13.5,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            Icon(Icons.chevron_right_rounded, color: tint.withValues(alpha: 0.55)),
          ],
        ),
      ),
    );
  }
}

class _DocumentsTabPanel extends StatelessWidget {
  const _DocumentsTabPanel({required this.data});

  final Object? data;

  @override
  Widget build(BuildContext context) {
    final records = _documentRecords(data);
    if (records.isEmpty) {
      return const _ChildEmptyState(
        icon: Icons.folder_outlined,
        title: 'No documents',
        message: 'No documents or face profile files for this student yet.',
      );
    }

    final groups = <String, List<_DisplayRecord>>{};
    for (final record in records) {
      groups.putIfAbsent(record.category, () => []).add(record);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final entry in groups.entries) ...[
          _DocumentGroupHeader(
            title: entry.key,
            count: entry.value.length,
          ),
          const SizedBox(height: 10),
          for (final record in entry.value)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: record.category.toLowerCase().contains('face')
                  ? _FaceProfileCard(record: record)
                  : _DocumentFileCard(record: record),
            ),
          const SizedBox(height: 8),
        ],
      ],
    );
  }
}

class _DocumentGroupHeader extends StatelessWidget {
  const _DocumentGroupHeader({required this.title, required this.count});

  final String title;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: const TextStyle(
              color: SaaptTheme.navy,
              fontSize: 14,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
          decoration: BoxDecoration(
            color: const Color(0xFFEAF1FF),
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            '$count',
            style: const TextStyle(
              color: SaaptTheme.primary,
              fontSize: 12,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
      ],
    );
  }
}

class _DocumentFileCard extends StatelessWidget {
  const _DocumentFileCard({required this.record});

  final _DisplayRecord record;

  (IconData, Color, Color) get _style {
    final title = '${record.title} ${record.subtitle}'.toLowerCase();
    if (title.contains('photo') || title.contains('image')) {
      return (Icons.image_outlined, const Color(0xFF7C3AED), const Color(0xFFF3E8FF));
    }
    if (title.contains('pdf')) {
      return (Icons.picture_as_pdf_outlined, const Color(0xFFDC2626), const Color(0xFFFFEDED));
    }
    if (title.contains('certificate') || title.contains('birth')) {
      return (Icons.workspace_premium_outlined, const Color(0xFFB45309), const Color(0xFFFFF4E5));
    }
    return (Icons.description_outlined, SaaptTheme.primary, const Color(0xFFEAF1FF));
  }

  @override
  Widget build(BuildContext context) {
    final style = _style;
    final url = _firstString(record.data, ['url', 'fileUrl', 'documentUrl']) ??
        record.imageUrl;
    final facts = _previewFacts(
      record.data,
      limit: 3,
      skipValues: {record.title, record.subtitle, url ?? ''},
    );

    return ParentCard(
      padding: EdgeInsets.zero,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => _showRecordDetailSheet(context, record),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [style.$3, Colors.white],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(16),
                ),
              ),
              child: Row(
                children: [
                  Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: style.$2.withValues(alpha: 0.18),
                      ),
                    ),
                    child: Icon(style.$1, color: style.$2, size: 24),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          record.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: SaaptTheme.navy,
                            fontSize: 14.5,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          record.subtitle.isEmpty
                              ? record.category
                              : record.subtitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Color(0xFF60708F),
                            fontSize: 12.5,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  if (url != null && url.trim().isNotEmpty)
                    TextButton(
                      onPressed: () => launchUrl(
                        Uri.parse(url.trim()),
                        mode: LaunchMode.externalApplication,
                      ),
                      style: TextButton.styleFrom(
                        foregroundColor: style.$2,
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                      ),
                      child: const Text(
                        'Open',
                        style: TextStyle(fontWeight: FontWeight.w900),
                      ),
                    )
                  else
                    Icon(
                      Icons.chevron_right_rounded,
                      color: style.$2.withValues(alpha: 0.7),
                    ),
                ],
              ),
            ),
            if (facts.isNotEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final fact in facts)
                      _MiniFactChip(label: fact.$1, value: fact.$2),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _FaceProfileCard extends StatelessWidget {
  const _FaceProfileCard({required this.record});

  final _DisplayRecord record;

  @override
  Widget build(BuildContext context) {
    final status = _displayValue(record.data['status']);
    final imageUrl = record.imageUrl ?? _imageUrlFrom(record.data);

    return ParentCard(
      padding: EdgeInsets.zero,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => _showRecordDetailSheet(context, record),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              height: 148,
              decoration: const BoxDecoration(
                borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
                gradient: LinearGradient(
                  colors: [Color(0xFF1E4FE8), Color(0xFF5B8CFF)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              child: Stack(
                children: [
                  Positioned(
                    right: -20,
                    top: -30,
                    child: Container(
                      width: 120,
                      height: 120,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.18),
                          width: 2,
                        ),
                      ),
                    ),
                  ),
                  Center(
                    child: Container(
                      width: 88,
                      height: 88,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 3),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x33000000),
                            blurRadius: 18,
                            offset: Offset(0, 8),
                          ),
                        ],
                      ),
                      child: ClipOval(
                        child: imageUrl?.trim().isNotEmpty == true
                            ? Image.network(
                                imageUrl!,
                                fit: BoxFit.cover,
                                errorBuilder: (_, _, _) => const ColoredBox(
                                  color: Color(0xFFEAF1FF),
                                  child: Icon(
                                    Icons.face_retouching_natural_outlined,
                                    color: SaaptTheme.primary,
                                    size: 36,
                                  ),
                                ),
                              )
                            : const ColoredBox(
                                color: Color(0xFFEAF1FF),
                                child: Icon(
                                  Icons.face_retouching_natural_outlined,
                                  color: SaaptTheme.primary,
                                  size: 36,
                                ),
                              ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
              child: Row(
                children: [
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Face Profile',
                          style: TextStyle(
                            color: SaaptTheme.navy,
                            fontSize: 15,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        SizedBox(height: 3),
                        Text(
                          'Attendance recognition profile',
                          style: TextStyle(
                            color: Color(0xFF60708F),
                            fontSize: 12.5,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (status.trim().isNotEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE9F8EF),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        status,
                        style: const TextStyle(
                          color: Color(0xFF059669),
                          fontSize: 11,
                          fontWeight: FontWeight.w900,
                        ),
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

class _ContentRecordCard extends StatelessWidget {
  const _ContentRecordCard({
    required this.record,
    this.visual = const _TabVisual(
      Icons.info_outline_rounded,
      SaaptTheme.primary,
      Color(0xFFEAF1FF),
    ),
  });

  final _DisplayRecord record;
  final _TabVisual visual;

  @override
  Widget build(BuildContext context) {
    final facts = _previewFacts(
      record.data,
      limit: 4,
      skipValues: {record.title, record.subtitle},
    );

    return ParentCard(
      padding: EdgeInsets.zero,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => _showRecordDetailSheet(context, record),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [visual.soft, Colors.white],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(16),
                ),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: visual.accent.withValues(alpha: 0.18),
                      ),
                    ),
                    child: record.imageUrl?.trim().isNotEmpty == true
                        ? ClipRRect(
                            borderRadius: BorderRadius.circular(15),
                            child: Image.network(
                              record.imageUrl!,
                              fit: BoxFit.cover,
                              errorBuilder: (_, _, _) => Icon(
                                record.icon,
                                color: visual.accent,
                              ),
                            ),
                          )
                        : Icon(record.icon, color: visual.accent),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.85),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            record.category,
                            style: TextStyle(
                              color: visual.accent,
                              fontSize: 10.5,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          record.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: SaaptTheme.navy,
                            fontSize: 15,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.2,
                          ),
                        ),
                        if (record.subtitle.trim().isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(
                            record.subtitle,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Color(0xFF60708F),
                              fontSize: 12.5,
                              height: 1.3,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    width: 30,
                    height: 30,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      Icons.chevron_right_rounded,
                      color: visual.accent.withValues(alpha: 0.7),
                      size: 18,
                    ),
                  ),
                ],
              ),
            ),
            if (facts.isNotEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final gap = 8.0;
                    final half = (constraints.maxWidth - gap) / 2;
                    return Wrap(
                      spacing: gap,
                      runSpacing: gap,
                      children: [
                        for (final fact in facts)
                          SizedBox(
                            width: facts.length == 1 || fact.$2.length > 24
                                ? constraints.maxWidth
                                : half,
                            child: _FactChip(
                              label: fact.$1,
                              value: fact.$2,
                            ),
                          ),
                      ],
                    );
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _MiniFactChip extends StatelessWidget {
  const _MiniFactChip({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: const Color(0xFFF7FAFF),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5ECF7)),
      ),
      child: Text.rich(
        TextSpan(
          children: [
            TextSpan(
              text: '${label.toUpperCase()}  ',
              style: const TextStyle(
                color: Color(0xFF8EA0BA),
                fontSize: 10,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.3,
              ),
            ),
            TextSpan(
              text: value,
              style: const TextStyle(
                color: SaaptTheme.navy,
                fontSize: 12,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

String _initialsFor(String name) {
  final parts = name
      .trim()
      .split(RegExp(r'\s+'))
      .where((part) => part.isNotEmpty)
      .toList();
  if (parts.isEmpty) return '?';
  if (parts.length == 1) {
    final value = parts.first;
    return value.substring(0, value.length >= 2 ? 2 : 1).toUpperCase();
  }
  return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
}

class _SimpleSection extends StatelessWidget {
  const _SimpleSection({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return ParentCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
            child: Row(
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(
                    color: SaaptTheme.primary,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 10),
                Text(
                  title,
                  style: const TextStyle(
                    color: SaaptTheme.navy,
                    fontSize: 15,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1, thickness: 0.7, color: Color(0xFFE6EBF3)),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
            child: Column(children: children),
          ),
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
    final visual = _TabVisual.forKey('fees');

    if (invoices.isEmpty) {
      return const _ChildEmptyState(
        icon: Icons.receipt_long_outlined,
        title: 'No fee invoices',
        message: 'No fee invoices found for this student yet.',
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ParentCard(
          padding: EdgeInsets.zero,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [visual.soft, Colors.white],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(16),
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: visual.accent.withValues(alpha: 0.18),
                        ),
                      ),
                      child: Icon(visual.icon, color: visual.accent, size: 20),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Fee overview',
                            style: TextStyle(
                              color: SaaptTheme.navy,
                              fontSize: 16,
                              fontWeight: FontWeight.w900,
                              letterSpacing: -0.2,
                            ),
                          ),
                          SizedBox(height: 3),
                          Text(
                            'Totals across all invoices',
                            style: TextStyle(
                              color: Color(0xFF60708F),
                              fontSize: 12.5,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 4, 12, 14),
                child: _FeeTotalsGrid(invoices: invoices),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        _DocumentGroupHeader(title: 'Invoices', count: invoices.length),
        const SizedBox(height: 10),
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
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFFF4F7FD), Color(0xFFFFFFFF)],
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                ),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 46,
                    height: 46,
                    decoration: BoxDecoration(
                      color: const Color(0xFFEAF1FF),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: const Icon(
                      Icons.receipt_long_outlined,
                      color: SaaptTheme.primary,
                    ),
                  ),
                  const SizedBox(width: 12),
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
                            letterSpacing: -0.2,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          invoiceNumber,
                          style: const TextStyle(
                            color: Color(0xFF8EA0BA),
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
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
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 4),
              child: _FeeAmountGrid(invoice: invoice),
            ),
            if (canPay)
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 10, 14, 0),
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
      return const _ChildEmptyState(
        icon: Icons.local_library_outlined,
        title: 'No library records',
        message: 'No library memberships or issues for this student yet.',
      );
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
    final visual = _TabVisual.forKey('library');
    final title =
        _firstString(membership, ['fullName', 'memberCode']) ??
        'Library Membership';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _InfoSectionCard(
          title: title,
          icon: visual.icon,
          accent: visual.accent,
          soft: visual.soft,
          data: membershipDetails,
        ),
        const SizedBox(height: 12),
        _DocumentGroupHeader(title: 'Issued books', count: issues.length),
        const SizedBox(height: 10),
        if (issues.isEmpty)
          ParentCard(
            padding: const EdgeInsets.all(16),
            child: Text(
              'No issued books right now.',
              style: TextStyle(
                color: const Color(0xFF60708F).withValues(alpha: 0.95),
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          )
        else
          for (final record in issues)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _ContentRecordCard(record: record, visual: visual),
            ),
      ],
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
        category: 'Admission Documents',
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
  const _SummaryRecordTile({
    required this.record,
    this.embedded = false,
  });

  final _DisplayRecord record;
  final bool embedded;

  @override
  Widget build(BuildContext context) {
    final tile = InkWell(
      borderRadius: BorderRadius.circular(embedded ? 0 : 12),
      onTap: () => _showRecordDetailSheet(context, record),
      child: Padding(
        padding: EdgeInsets.all(embedded ? 14 : 12),
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
                      fontWeight: FontWeight.w800,
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
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                color: const Color(0xFFF4F7FD),
                borderRadius: BorderRadius.circular(9),
              ),
              child: const Icon(
                Icons.chevron_right_rounded,
                color: Color(0xFF8EA0BA),
                size: 18,
              ),
            ),
          ],
        ),
      ),
    );

    if (embedded) return tile;
    return ParentCard(padding: EdgeInsets.zero, child: tile);
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
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
            child: Row(
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(
                    color: SaaptTheme.primary,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                      color: SaaptTheme.navy,
                      fontSize: 15,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1, thickness: 0.7, color: Color(0xFFE6EBF3)),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
            child: Column(children: rows),
          ),
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
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _AccountFormHeader(
          icon: Icons.edit_outlined,
          accent: Color(0xFF0F766E),
          soft: Color(0xFFE7F7F4),
          title: 'Edit profile',
          subtitle: 'Keep your contact details up to date for school communication.',
        ),
        const SizedBox(height: 14),
        ParentCard(
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
              const SizedBox(height: 4),
              FilledButton(
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(52),
                  backgroundColor: SaaptTheme.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                onPressed: saving ? null : onSave,
                child: Text(
                  saving ? 'Saving...' : 'Save Profile',
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ViewProfilePanel extends StatelessWidget {
  const _ViewProfilePanel({required this.profile});

  final ParentProfile profile;

  @override
  Widget build(BuildContext context) {
    final facts = <(String, String)>[
      ('Name', profile.name.trim().isEmpty ? '-' : profile.name.trim()),
      (
        'First Name',
        profile.firstName?.trim().isNotEmpty == true
            ? profile.firstName!.trim()
            : '-',
      ),
      (
        'Last Name',
        profile.lastName?.trim().isNotEmpty == true
            ? profile.lastName!.trim()
            : '-',
      ),
      ('Email', profile.email.trim().isEmpty ? '-' : profile.email.trim()),
      (
        'Mobile',
        profile.phone?.trim().isNotEmpty == true ? profile.phone!.trim() : '-',
      ),
      (
        'School',
        profile.schoolName?.trim().isNotEmpty == true
            ? profile.schoolName!.trim()
            : '-',
      ),
      ('Children', profile.children.length.toString()),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _AccountFormHeader(
          icon: Icons.person_outline_rounded,
          accent: SaaptTheme.primary,
          soft: Color(0xFFEAF1FF),
          title: 'Your profile',
          subtitle: 'Parent account details linked to this school login.',
        ),
        const SizedBox(height: 14),
        ParentCard(
          padding: EdgeInsets.zero,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
            child: LayoutBuilder(
              builder: (context, constraints) {
                final gap = 8.0;
                final half = (constraints.maxWidth - gap) / 2;
                return Wrap(
                  spacing: gap,
                  runSpacing: gap,
                  children: [
                    for (final fact in facts)
                      SizedBox(
                        width: fact.$2.length > 28 || facts.length == 1
                            ? constraints.maxWidth
                            : half,
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF7FAFF),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: const Color(0xFFE5ECF7)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                fact.$1.toUpperCase(),
                                style: const TextStyle(
                                  color: Color(0xFF8EA0BA),
                                  fontSize: 10,
                                  letterSpacing: 0.4,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              const SizedBox(height: 5),
                              Text(
                                fact.$2,
                                style: const TextStyle(
                                  color: SaaptTheme.navy,
                                  fontSize: 14,
                                  height: 1.3,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                  ],
                );
              },
            ),
          ),
        ),
      ],
    );
  }
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
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _AccountFormHeader(
          icon: Icons.lock_outline_rounded,
          accent: Color(0xFFB45309),
          soft: Color(0xFFFFF4E5),
          title: 'Change password',
          subtitle: 'Use a strong password you do not reuse elsewhere.',
        ),
        const SizedBox(height: 14),
        ParentCard(
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
              const SizedBox(height: 4),
              FilledButton(
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(52),
                  backgroundColor: SaaptTheme.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                onPressed: saving ? null : onSave,
                child: Text(
                  saving ? 'Changing...' : 'Change Password',
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _AccountFormHeader extends StatelessWidget {
  const _AccountFormHeader({
    required this.icon,
    required this.accent,
    required this.soft,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final Color accent;
  final Color soft;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return ParentCard(
      padding: EdgeInsets.zero,
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [soft, Colors.white],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: accent.withValues(alpha: 0.18)),
              ),
              child: Icon(icon, color: accent),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      color: SaaptTheme.navy,
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.2,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      color: Color(0xFF60708F),
                      fontSize: 12.5,
                      height: 1.35,
                      fontWeight: FontWeight.w600,
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
    padding: EdgeInsets.only(bottom: last ? 0 : 12),
    margin: EdgeInsets.only(bottom: last ? 0 : 12),
    decoration: BoxDecoration(
      border: last
          ? null
          : const Border(bottom: BorderSide(color: Color(0xFFF0F4FA))),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: const TextStyle(
            color: Color(0xFF91A1BB),
            fontSize: 11,
            letterSpacing: 0.4,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 5),
        Text(
          value,
          style: const TextStyle(
            color: SaaptTheme.navy,
            fontSize: 14.5,
            height: 1.35,
            fontWeight: FontWeight.w800,
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
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _AccountFormHeader(
          icon: Icons.article_outlined,
          accent: SaaptTheme.primary,
          soft: const Color(0xFFEAF1FF),
          title: title,
          subtitle: 'Reference information for parents',
        ),
        const SizedBox(height: 14),
        ParentCard(
          child: Text(
            body,
            style: const TextStyle(
              color: Color(0xFF586985),
              fontSize: 14.5,
              height: 1.55,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
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
    this.accent = SaaptTheme.primary,
    this.soft = const Color(0xFFEAF1FF),
    this.danger = false,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final Color accent;
  final Color soft;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final color = danger ? const Color(0xFFDC2626) : accent;
    final softColor = danger ? const Color(0xFFFFEDED) : soft;
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: softColor,
                borderRadius: BorderRadius.circular(13),
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      color: danger ? const Color(0xFFDC2626) : SaaptTheme.navy,
                      fontSize: 14.5,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      color: Color(0xFF60708F),
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                color: const Color(0xFFF4F7FD),
                borderRadius: BorderRadius.circular(9),
              ),
              child: Icon(
                Icons.chevron_right_rounded,
                color: color.withValues(alpha: 0.7),
                size: 18,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StaticTile extends StatelessWidget {
  const _StaticTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.accent = SaaptTheme.primary,
    this.soft = const Color(0xFFEAF1FF),
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Color accent;
  final Color soft;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: soft,
              borderRadius: BorderRadius.circular(13),
            ),
            child: Icon(icon, color: accent, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: SaaptTheme.navy,
                    fontSize: 14.5,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  style: const TextStyle(
                    color: Color(0xFF60708F),
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
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
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 12, 10, 12),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: const Color(0xFFEAF1FF),
              borderRadius: BorderRadius.circular(13),
            ),
            child: const Icon(
              Icons.notifications_active_outlined,
              color: SaaptTheme.primary,
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: SaaptTheme.navy,
                    fontSize: 14.5,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  loading ? 'Loading preference...' : subtitle,
                  style: const TextStyle(
                    color: Color(0xFF60708F),
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          Switch.adaptive(
            value: value,
            onChanged: loading ? null : onChanged,
            activeThumbColor: Colors.white,
            activeTrackColor: SaaptTheme.primary,
          ),
        ],
      ),
    );
  }
}
