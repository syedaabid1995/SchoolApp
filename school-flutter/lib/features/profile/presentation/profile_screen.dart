import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/prototype_colors.dart';
import '../../../core/widgets/prototype_widgets.dart';
import '../../auth/data/auth_repository.dart';
import '../../auth/presentation/auth_controller.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final _currentPassword = TextEditingController();
  final _newPassword = TextEditingController();
  final _confirmPassword = TextEditingController();
  var _showChangePassword = false;
  var _savingPassword = false;
  String? _passwordError;

  @override
  void dispose() {
    _currentPassword.dispose();
    _newPassword.dispose();
    _confirmPassword.dispose();
    super.dispose();
  }

  Future<void> _submitPasswordChange() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _savingPassword = true;
      _passwordError = null;
    });

    try {
      await ref
          .read(authRepositoryProvider)
          .changePassword(
            currentPassword: _currentPassword.text,
            newPassword: _newPassword.text,
            confirmPassword: _confirmPassword.text,
          );
      _currentPassword.clear();
      _newPassword.clear();
      _confirmPassword.clear();
      if (!mounted) return;
      setState(() {
        _showChangePassword = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Password changed successfully.')),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _passwordError =
            'Unable to change password. Check your current password and try again.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _savingPassword = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(authControllerProvider).session;
    final user = session?.user;
    final profile = user?.employeeProfile;
    final school = user?.school;

    return PrototypeScaffold(
      hero: PrototypeHero(
        label: 'Profile',
        title: user?.name ?? 'Profile',
        subtitle:
            '${school?.name ?? 'School ERP'} - ${(user?.effectiveRole ?? 'USER').replaceAll('_', ' ')}',
        icon: Icons.person_outline,
      ),
      bottomNavigation: const SessionBottomNav(activeIndex: 3),
      children: [
        PrototypeCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const PrototypeLabel('User'),
              FieldPreview(
                text: user?.name ?? '-',
                selected: true,
                trailing: Icons.check,
              ),
              const PrototypeLabel('Email'),
              FieldPreview(text: user?.email ?? '-'),
              const PrototypeLabel('Role'),
              FieldPreview(
                text: (user?.effectiveRole ?? user?.role ?? 'USER').replaceAll(
                  '_',
                  ' ',
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        PrototypeCard(
          variant: PrototypeCardVariant.blue,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const PrototypeLabel('School'),
              FieldPreview(text: school?.name ?? 'Unavailable', selected: true),
              const PrototypeLabel('School Code'),
              FieldPreview(text: school?.code ?? 'Unavailable'),
            ],
          ),
        ),
        const SizedBox(height: 12),
        if (profile == null)
          const PrototypeCard(
            child: Text(
              'No employee profile details are available for this user.',
            ),
          )
        else
          PrototypeCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const PrototypeLabel('Employee No'),
                FieldPreview(text: profile.employeeNo ?? '-'),
                const PrototypeLabel('Phone'),
                FieldPreview(text: profile.phone ?? '-'),
                const PrototypeLabel('Designation'),
                FieldPreview(text: profile.designationName ?? '-'),
                const PrototypeLabel('Department'),
                FieldPreview(text: profile.departmentName ?? '-'),
              ],
            ),
          ),
        const SizedBox(height: 12),
        if (session?.mustChangePassword == true)
          const PrototypeCard(
            variant: PrototypeCardVariant.orange,
            child: Text(
              'Password change is required before continuing regular work.',
              style: TextStyle(color: PrototypeColors.muted),
            ),
          ),
        const SizedBox(height: 12),
        PrototypeCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              PrototypeButton(
                label: _showChangePassword
                    ? 'Hide Change Password'
                    : 'Change Password',
                icon: Icons.lock_reset_outlined,
                onPressed: _savingPassword
                    ? null
                    : () => setState(() {
                        _showChangePassword = !_showChangePassword;
                        _passwordError = null;
                      }),
              ),
              if (_showChangePassword) ...[
                const SizedBox(height: 12),
                Form(
                  key: _formKey,
                  child: Column(
                    children: [
                      _PasswordField(
                        controller: _currentPassword,
                        label: 'Current password',
                      ),
                      const SizedBox(height: 10),
                      _PasswordField(
                        controller: _newPassword,
                        label: 'New password',
                        validator: _validateNewPassword,
                      ),
                      const SizedBox(height: 10),
                      _PasswordField(
                        controller: _confirmPassword,
                        label: 'Confirm password',
                        validator: (value) {
                          if ((value ?? '').isEmpty) {
                            return 'Confirm password is required.';
                          }
                          if (value != _newPassword.text) {
                            return 'Passwords do not match.';
                          }
                          return null;
                        },
                      ),
                      if (_passwordError != null) ...[
                        const SizedBox(height: 10),
                        Text(
                          _passwordError!,
                          style: const TextStyle(color: PrototypeColors.red),
                        ),
                      ],
                      const SizedBox(height: 12),
                      PrototypeButton(
                        label: _savingPassword
                            ? 'Changing Password...'
                            : 'Save Password',
                        icon: Icons.check_circle_outline,
                        green: true,
                        onPressed: _savingPassword
                            ? null
                            : _submitPasswordChange,
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 12),
        PrototypeButton(
          label: 'Logout',
          icon: Icons.logout,
          onPressed: () => ref.read(authControllerProvider.notifier).logout(),
        ),
      ],
    );
  }

  String? _validateNewPassword(String? value) {
    final password = value ?? '';
    if (password.length < 8) return 'Use at least 8 characters.';
    if (!RegExp('[A-Z]').hasMatch(password)) {
      return 'Include at least one uppercase letter.';
    }
    if (!RegExp('[a-z]').hasMatch(password)) {
      return 'Include at least one lowercase letter.';
    }
    if (!RegExp('[0-9]').hasMatch(password)) {
      return 'Include at least one number.';
    }
    if (!RegExp(r'[^A-Za-z0-9]').hasMatch(password)) {
      return 'Include at least one special character.';
    }
    if (password == _currentPassword.text) {
      return 'New password must be different.';
    }
    return null;
  }
}

class _PasswordField extends StatelessWidget {
  const _PasswordField({
    required this.controller,
    required this.label,
    this.validator,
  });

  final TextEditingController controller;
  final String label;
  final String? Function(String?)? validator;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      obscureText: true,
      decoration: InputDecoration(labelText: label),
      validator:
          validator ??
          (value) => (value ?? '').isEmpty ? '$label is required.' : null,
    );
  }
}
