import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../../global_ui/core/constants/app_config.dart';
import '../../../../../global_ui/core/services/notification_service.dart';
import '../../../../../global_ui/features/auth/domain/entities/staff_user.dart';
import '../../../../../global_ui/features/auth/presentation/providers/auth_controller.dart';
import '../../../../../global_ui/features/profile/presentation/providers/profile_providers.dart';
import '../../../../app/theme/saapt_theme.dart';

enum _ProfilePanel {
  menu,
  viewProfile,
  editProfile,
  schoolProfile,
  changePassword,
  info,
}

class SaaptProfileScreen extends ConsumerStatefulWidget {
  const SaaptProfileScreen({super.key});

  @override
  ConsumerState<SaaptProfileScreen> createState() => _SaaptProfileScreenState();
}

class _SaaptProfileScreenState extends ConsumerState<SaaptProfileScreen> {
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
  bool _profileSeeded = false;
  bool _savingProfile = false;
  bool _changingPassword = false;

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
    final profileState = ref.watch(profileProvider);
    final pushState = ref.watch(staffPushPreferenceProvider);
    return PopScope(
      canPop: _panel == _ProfilePanel.menu,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _handleBack();
      },
      child: Scaffold(
        backgroundColor: const Color(0xFFF4F7FC),
        body: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(profileProvider);
            ref.invalidate(staffPushPreferenceProvider);
            await ref.read(profileProvider.future);
          },
          child: ListView(
            padding: EdgeInsets.zero,
            children: [
              _ProfileHero(
                title: _titleForPanel(),
                subtitle: _subtitleForPanel(),
                onBack: _handleBack,
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 22, 20, 32),
                child: profileState.when(
                  loading: () => const _LoadingCard(),
                  error: (error, _) =>
                      _EmptyCard(message: _errorMessage(error)),
                  data: (user) {
                    _seedProfile(user);
                    return switch (_panel) {
                      _ProfilePanel.viewProfile => _ViewProfilePanel(
                        user: user,
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
                        school: user.schoolProfile,
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
                        user: user,
                        pushState: pushState,
                        onOpenProfile: () =>
                            setState(() => _panel = _ProfilePanel.viewProfile),
                        onOpenEdit: () =>
                            setState(() => _panel = _ProfilePanel.editProfile),
                        onOpenSchoolProfile: () => setState(
                          () => _panel = _ProfilePanel.schoolProfile,
                        ),
                        onOpenPassword: () => setState(
                          () => _panel = _ProfilePanel.changePassword,
                        ),
                        onTogglePush: _togglePush,
                        onOpenInfo: _openInfo,
                        onLogout: () =>
                            ref.read(authControllerProvider.notifier).logout(),
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
      _ProfilePanel.viewProfile => 'Profile',
      _ProfilePanel.editProfile => 'Edit Profile',
      _ProfilePanel.schoolProfile => 'School Profile',
      _ProfilePanel.changePassword => 'Change Password',
      _ProfilePanel.info => _infoTitle,
      _ProfilePanel.menu => 'Account',
    };
  }

  String _subtitleForPanel() {
    return switch (_panel) {
      _ProfilePanel.viewProfile => 'Teacher account details',
      _ProfilePanel.editProfile => 'Update your contact details',
      _ProfilePanel.schoolProfile => 'School contact information',
      _ProfilePanel.changePassword => 'Secure your teacher login',
      _ProfilePanel.info => 'Reference information',
      _ProfilePanel.menu => 'Profile, settings, and app information',
    };
  }

  void _seedProfile(StaffUser user) {
    if (_profileSeeded) return;
    final nameParts = user.displayName.trim().split(RegExp(r'\s+'));
    _firstNameController.text = user.firstName?.trim().isNotEmpty == true
        ? user.firstName!.trim()
        : nameParts.firstOrNull ?? '';
    _lastNameController.text = user.lastName?.trim().isNotEmpty == true
        ? user.lastName!.trim()
        : nameParts.length > 1
        ? nameParts.sublist(1).join(' ')
        : '';
    _emailController.text = user.email;
    _phoneController.text = user.phone ?? '';
    _profileSeeded = true;
  }

  Future<void> _saveProfile() async {
    if (_savingProfile) return;
    setState(() => _savingProfile = true);
    try {
      await ref
          .read(profileRepositoryProvider)
          .updateProfile(
            firstName: _firstNameController.text.trim(),
            lastName: _lastNameController.text.trim(),
            email: _emailController.text.trim(),
            phone: _phoneController.text.trim(),
          );
      _profileSeeded = false;
      ref.invalidate(profileProvider);
      ref.invalidate(authControllerProvider);
      if (!mounted) return;
      setState(() => _panel = _ProfilePanel.menu);
      _showSnack('Profile updated.');
    } catch (error) {
      if (mounted) _showSnack(_errorMessage(error, 'Unable to update profile'));
    } finally {
      if (mounted) setState(() => _savingProfile = false);
    }
  }

  Future<void> _changePassword() async {
    if (_changingPassword) return;
    setState(() => _changingPassword = true);
    try {
      await ref
          .read(profileRepositoryProvider)
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
        _showSnack(_errorMessage(error, 'Unable to change password'));
      }
    } finally {
      if (mounted) setState(() => _changingPassword = false);
    }
  }

  Future<void> _togglePush(bool enabled) async {
    try {
      await ref.read(profileRepositoryProvider).updatePushEnabled(enabled);
      if (enabled) {
        unawaited(ref.read(notificationServiceProvider).syncDeviceToken());
      }
      ref.invalidate(staffPushPreferenceProvider);
      _showSnack(
        enabled
            ? 'Push notifications enabled.'
            : 'Push notifications disabled.',
      );
    } catch (error) {
      _showSnack(_errorMessage(error, 'Unable to update push notifications'));
    }
  }

  void _openInfo(String title, String body) {
    setState(() {
      _infoTitle = title;
      _infoBody = body;
      _panel = _ProfilePanel.info;
    });
  }

  void _handleBack() {
    if (_panel != _ProfilePanel.menu) {
      setState(() => _panel = _ProfilePanel.menu);
      return;
    }
    Navigator.of(context).maybePop();
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }
}

class _ProfileHero extends StatelessWidget {
  const _ProfileHero({
    required this.title,
    required this.subtitle,
    required this.onBack,
  });

  final String title;
  final String subtitle;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) => Container(
    padding: EdgeInsets.fromLTRB(
      16,
      MediaQuery.of(context).padding.top + 10,
      20,
      24,
    ),
    decoration: const BoxDecoration(
      color: SaaptTheme.primary,
      borderRadius: BorderRadius.vertical(bottom: Radius.circular(24)),
    ),
    child: Row(
      children: [
        IconButton(
          tooltip: 'Back',
          style: IconButton.styleFrom(
            backgroundColor: Colors.white.withValues(alpha: 0.16),
            foregroundColor: Colors.white,
          ),
          onPressed: onBack,
          icon: const Icon(Icons.arrow_back_rounded),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 24,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                subtitle,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.82),
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

class _ProfileMenuPanel extends StatelessWidget {
  const _ProfileMenuPanel({
    required this.user,
    required this.pushState,
    required this.onOpenProfile,
    required this.onOpenEdit,
    required this.onOpenSchoolProfile,
    required this.onOpenPassword,
    required this.onTogglePush,
    required this.onOpenInfo,
    required this.onLogout,
  });

  final StaffUser user;
  final AsyncValue<bool> pushState;
  final VoidCallback onOpenProfile;
  final VoidCallback onOpenEdit;
  final VoidCallback onOpenSchoolProfile;
  final VoidCallback onOpenPassword;
  final ValueChanged<bool> onTogglePush;
  final void Function(String title, String body) onOpenInfo;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    final initial = user.displayName.trim().isEmpty
        ? 'T'
        : user.displayName.trim()[0].toUpperCase();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _AccountCard(
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
                      user.displayName,
                      style: const TextStyle(
                        color: SaaptTheme.navy,
                        fontSize: 17,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      user.email,
                      style: const TextStyle(
                        color: Color(0xFF60708F),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    if (user.phone?.trim().isNotEmpty == true) ...[
                      const SizedBox(height: 2),
                      Text(
                        user.phone!,
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
        _AccountCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              _MenuTile(
                icon: Icons.person_outline,
                title: 'Profile',
                subtitle: 'View teacher account details',
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
                subtitle: 'School address and contact information',
                onTap: onOpenSchoolProfile,
              ),
              _MenuTile(
                icon: Icons.lock_outline,
                title: 'Change Password',
                subtitle: 'Update teacher login password',
                onTap: onOpenPassword,
              ),
              _SwitchTile(
                title: 'Push Notifications',
                subtitle: 'Receive attendance, student, and school alerts',
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
                  'Push notifications can be enabled or disabled from this screen. More teacher app settings will be added as modules are enabled.',
                ),
              ),
              _MenuTile(
                icon: Icons.help_outline,
                title: 'Frequently Asked Questions',
                subtitle: 'Common teacher app questions',
                onTap: () => onOpenInfo(
                  'Frequently Asked Questions',
                  'Use Home for attendance, Students for assigned class records, Reports for academic summaries, and Profile for account and school contact information.',
                ),
              ),
              _MenuTile(
                icon: Icons.privacy_tip_outlined,
                title: 'Privacy Policy',
                subtitle: 'How teacher and student data is handled',
                onTap: () => onOpenInfo(
                  'Privacy Policy',
                  '${AppConfig.appName} uses teacher and student data only for school operations, communication, attendance, reports, and related workflows.',
                ),
              ),
              _MenuTile(
                icon: Icons.description_outlined,
                title: 'Terms of Service',
                subtitle: 'Teacher app usage terms',
                onTap: () => onOpenInfo(
                  'Terms of Service',
                  'Use of this app is subject to your school account access and ${AppConfig.appName} platform terms.',
                ),
              ),
              const _StaticTile(
                icon: Icons.info_outline,
                title: 'App Version',
                subtitle: AppConfig.appVersion,
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

class _ViewProfilePanel extends StatelessWidget {
  const _ViewProfilePanel({required this.user});

  final StaffUser user;

  @override
  Widget build(BuildContext context) => _AccountCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _DetailRow(label: 'Name', value: user.displayName),
        _DetailRow(label: 'First Name', value: user.firstName ?? '-'),
        _DetailRow(label: 'Last Name', value: user.lastName ?? '-'),
        _DetailRow(label: 'Email', value: user.email),
        _DetailRow(label: 'Mobile Number', value: user.phone ?? '-'),
        _DetailRow(label: 'Role', value: user.role ?? 'Staff'),
        _DetailRow(
          label: 'School',
          value: user.schoolName ?? user.schoolId ?? '-',
          last: true,
        ),
      ],
    ),
  );
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
  Widget build(BuildContext context) => _AccountCard(
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

class _SchoolProfilePanel extends StatelessWidget {
  const _SchoolProfilePanel({required this.school});

  final SchoolProfileDetails? school;

  @override
  Widget build(BuildContext context) {
    final item = school;
    if (item == null) {
      return const _EmptyCard(message: 'No school profile details available.');
    }
    return _AccountCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _DetailRow(label: 'School Name', value: item.name),
          _DetailRow(label: 'School Code', value: item.code),
          _ContactActionButton(
            icon: Icons.mail_outline,
            label: 'Email',
            value: item.email ?? '',
            onTap: () => _launchEmail(item.email ?? ''),
          ),
          const SizedBox(height: 10),
          _ContactActionButton(
            icon: Icons.call_outlined,
            label: 'Mobile Number',
            value: item.mobileNumber ?? '',
            onTap: () => _launchPhone(item.mobileNumber ?? ''),
          ),
          const SizedBox(height: 14),
          _DetailRow(
            label: 'Address',
            value: item.address ?? '-',
            last: item.contacts.isEmpty,
          ),
          if (item.contacts.isNotEmpty) ...[
            const Text(
              'Contact Information',
              style: TextStyle(
                color: SaaptTheme.navy,
                fontSize: 16,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 12),
            ...item.contacts.map((contact) => _SchoolContactCard(contact)),
          ],
        ],
      ),
    );
  }
}

class _SchoolContactCard extends StatelessWidget {
  const _SchoolContactCard(this.contact);

  final SchoolContactDetail contact;

  @override
  Widget build(BuildContext context) => Container(
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
  Widget build(BuildContext context) => _AccountCard(
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

class _InfoPanel extends StatelessWidget {
  const _InfoPanel({required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) => _AccountCard(
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
        const SizedBox(height: 10),
        Text(
          body,
          style: const TextStyle(
            color: Color(0xFF60708F),
            fontWeight: FontWeight.w700,
            height: 1.45,
          ),
        ),
      ],
    ),
  );
}

class _AccountCard extends StatelessWidget {
  const _AccountCard({required this.child, this.padding});

  final Widget child;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: padding ?? const EdgeInsets.all(18),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: const Color(0xFFDDE5F2)),
      boxShadow: [
        BoxShadow(
          color: const Color(0xFF0F2B46).withValues(alpha: 0.05),
          blurRadius: 18,
          offset: const Offset(0, 8),
        ),
      ],
    ),
    child: child,
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
          width: 122,
          child: Text(
            label,
            style: const TextStyle(
              color: Color(0xFF91A1BB),
              fontSize: 12,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        Expanded(
          child: Text(
            value.trim().isNotEmpty ? value : '-',
            style: const TextStyle(
              color: SaaptTheme.navy,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
      ],
    ),
  );
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
      decoration: InputDecoration(
        labelText: label,
        filled: true,
        fillColor: const Color(0xFFF7FAFF),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFDDE5F2)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFDDE5F2)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: SaaptTheme.primary),
        ),
      ),
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
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
      child: Row(
        children: [
          Icon(icon, color: danger ? Colors.redAccent : SaaptTheme.primary),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    color: danger ? Colors.redAccent : SaaptTheme.navy,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  style: const TextStyle(
                    color: Color(0xFF60708F),
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right, color: Color(0xFF91A1BB)),
        ],
      ),
    ),
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
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
    child: Row(
      children: [
        Icon(icon, color: SaaptTheme.primary),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  color: SaaptTheme.navy,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                subtitle,
                style: const TextStyle(
                  color: Color(0xFF60708F),
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ],
    ),
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
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
    child: Row(
      children: [
        const Icon(
          Icons.notifications_active_outlined,
          color: SaaptTheme.primary,
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  color: SaaptTheme.navy,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                subtitle,
                style: const TextStyle(
                  color: Color(0xFF60708F),
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
        loading
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : Switch(value: value, onChanged: onChanged),
      ],
    ),
  );
}

class _LoadingCard extends StatelessWidget {
  const _LoadingCard();

  @override
  Widget build(BuildContext context) =>
      const _AccountCard(child: Center(child: CircularProgressIndicator()));
}

class _EmptyCard extends StatelessWidget {
  const _EmptyCard({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) => _AccountCard(
    child: Text(
      message,
      style: const TextStyle(
        color: Color(0xFF60708F),
        fontWeight: FontWeight.w700,
      ),
    ),
  );
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

String _errorMessage(
  Object error, [
  String fallback = 'Unable to load profile',
]) {
  final text = error.toString();
  if (text.trim().isEmpty) return fallback;
  return text.replaceFirst('Exception: ', '');
}
