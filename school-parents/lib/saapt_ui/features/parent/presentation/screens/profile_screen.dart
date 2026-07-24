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

enum _ProfilePanel { menu, viewProfile, editProfile, changePassword, info }

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
      canPop: _panel == _ProfilePanel.menu,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop || _panel == _ProfilePanel.menu) return;
        setState(() => _panel = _ProfilePanel.menu);
      },
      child: Scaffold(
        body: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(parentProfileProvider);
            ref.invalidate(parentPushPreferenceProvider);
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
                    if (_panel == _ProfilePanel.menu) {
                      Navigator.of(context).maybePop();
                    } else {
                      setState(() => _panel = _ProfilePanel.menu);
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
                      _ProfilePanel.menu => _ProfileMenuPanel(
                        profile: profile,
                        pushState: pushState,
                        onOpenProfile: () =>
                            setState(() => _panel = _ProfilePanel.viewProfile),
                        onOpenEdit: () =>
                            setState(() => _panel = _ProfilePanel.editProfile),
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
      _ProfilePanel.changePassword => 'Change Password',
      _ProfilePanel.info => _infoTitle,
      _ProfilePanel.menu => 'Account',
    };
  }

  String _subtitleForPanel() {
    return switch (_panel) {
      _ProfilePanel.editProfile => 'Update parent contact details',
      _ProfilePanel.viewProfile => 'Parent account details',
      _ProfilePanel.changePassword => 'Secure your parent login',
      _ProfilePanel.info => 'Reference information',
      _ProfilePanel.menu => 'Profile, settings, and app information',
    };
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
                    fontSize: 26,
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
                        fontSize: 20,
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
            fontSize: 22,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 12),
        Text(
          body,
          style: const TextStyle(
            color: Color(0xFF60708F),
            fontSize: 16,
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
