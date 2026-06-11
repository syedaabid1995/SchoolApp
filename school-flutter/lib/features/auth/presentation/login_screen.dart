import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/auth_session.dart';
import '../../../core/theme/prototype_colors.dart';
import '../../../core/widgets/prototype_widgets.dart';
import '../data/auth_repository.dart';
import 'auth_controller.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _schoolCodeController = TextEditingController();
  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();
  String _loginType = 'teacher';
  bool _rememberMe = true;

  @override
  void dispose() {
    _schoolCodeController.dispose();
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authControllerProvider);
    final isLoading = authState.status == AuthStatus.checking;

    return PrototypeScaffold(
      centerContent: true,
      children: [
        const PrototypeLogo(),
        const SizedBox(height: 20),
        const Text(
          'Teacher Login',
          style: TextStyle(
            fontSize: 28,
            height: 1.08,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 8),
        const Text(
          'Login with school credentials and verification.',
          style: TextStyle(
            color: PrototypeColors.muted,
            fontSize: 14,
            height: 1.55,
          ),
        ),
        const SizedBox(height: 22),
        PrototypeCard(
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const PrototypeLabel('School ID'),
                TextFormField(
                  controller: _schoolCodeController,
                  textInputAction: TextInputAction.next,
                  decoration: const InputDecoration(hintText: 'SAAPT-SCH-1025'),
                  validator: _required,
                ),
                const SizedBox(height: 12),
                const PrototypeLabel('Login Type'),
                DropdownButtonFormField<String>(
                  initialValue: _loginType,
                  decoration: const InputDecoration(),
                  items: const [
                    DropdownMenuItem(value: 'teacher', child: Text('Teacher')),
                    DropdownMenuItem(value: 'staff', child: Text('Staff')),
                    DropdownMenuItem(
                      value: 'admin',
                      child: Text('School admin'),
                    ),
                  ],
                  onChanged: isLoading
                      ? null
                      : (value) =>
                            setState(() => _loginType = value ?? 'teacher'),
                ),
                const SizedBox(height: 12),
                const PrototypeLabel('Email or Username'),
                TextFormField(
                  controller: _identifierController,
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.next,
                  decoration: const InputDecoration(
                    hintText: 'teacher@school.com',
                  ),
                  validator: _required,
                ),
                const SizedBox(height: 12),
                const PrototypeLabel('Password'),
                TextFormField(
                  controller: _passwordController,
                  obscureText: true,
                  textInputAction: TextInputAction.done,
                  decoration: const InputDecoration(hintText: 'Password'),
                  validator: _required,
                  onFieldSubmitted: (_) => _submit(),
                ),
                const SizedBox(height: 8),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Remember this device'),
                  value: _rememberMe,
                  activeThumbColor: PrototypeColors.blue,
                  onChanged: isLoading
                      ? null
                      : (value) => setState(() => _rememberMe = value),
                ),
                if (authState.errorMessage != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    authState.errorMessage!,
                    style: const TextStyle(color: PrototypeColors.red),
                  ),
                ],
                const SizedBox(height: 18),
                PrototypeButton(
                  label: isLoading ? 'Signing in...' : 'Send OTP / Sign in',
                  icon: Icons.phone_iphone,
                  onPressed: isLoading ? null : _submit,
                ),
                const SizedBox(height: 10),
                TextButton(
                  onPressed: isLoading
                      ? null
                      : () => context.go('/forgot-password'),
                  child: const Text('Forgot password?'),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        const PrototypeCard(
          variant: PrototypeCardVariant.blue,
          child: Text.rich(
            TextSpan(
              text: 'Verification\n',
              style: TextStyle(
                color: PrototypeColors.blue,
                fontWeight: FontWeight.w800,
              ),
              children: [
                TextSpan(
                  text:
                      'If MFA is enabled, the backend will request email OTP or authenticator code.',
                  style: TextStyle(
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
      ],
    );
  }

  String? _required(String? value) {
    if (value == null || value.trim().isEmpty) return 'Required';
    return null;
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    ref
        .read(authControllerProvider.notifier)
        .login(
          LoginRequest(
            schoolCode: _schoolCodeController.text,
            identifier: _identifierController.text,
            password: _passwordController.text,
            loginType: _loginType,
            rememberMe: _rememberMe,
          ),
        );
  }
}
