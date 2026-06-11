import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/prototype_colors.dart';
import '../../../core/widgets/prototype_widgets.dart';
import '../data/auth_repository.dart';

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _schoolCodeController = TextEditingController();
  final _emailController = TextEditingController();
  String _loginType = 'teacher';
  bool _isLoading = false;
  String? _message;
  bool _success = false;

  @override
  void dispose() {
    _schoolCodeController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return PrototypeScaffold(
      centerContent: true,
      children: [
        const PrototypeLogo(icon: Icons.lock_reset_outlined),
        const SizedBox(height: 20),
        const Text(
          'Forgot Password',
          style: TextStyle(
            fontSize: 28,
            height: 1.08,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 8),
        const Text(
          'Enter your school code and email to request a reset link.',
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
                  onChanged: _isLoading
                      ? null
                      : (value) =>
                            setState(() => _loginType = value ?? 'teacher'),
                ),
                const SizedBox(height: 12),
                const PrototypeLabel('Email'),
                TextFormField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    hintText: 'teacher@school.com',
                  ),
                  validator: _required,
                ),
                if (_message != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    _message!,
                    style: TextStyle(
                      color: _success
                          ? PrototypeColors.green
                          : PrototypeColors.red,
                    ),
                  ),
                ],
                const SizedBox(height: 18),
                PrototypeButton(
                  label: _isLoading ? 'Sending...' : 'Send Reset Link',
                  icon: Icons.send_outlined,
                  onPressed: _isLoading ? null : _submit,
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

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isLoading = true;
      _message = null;
    });
    try {
      await ref
          .read(authRepositoryProvider)
          .forgotPassword(
            schoolCode: _schoolCodeController.text,
            email: _emailController.text,
            loginType: _loginType,
          );
      setState(() {
        _success = true;
        _message = 'If the account exists, reset instructions have been sent.';
      });
    } catch (error) {
      setState(() {
        _success = false;
        _message = 'Unable to request password reset. Please try again.';
      });
    } finally {
      setState(() => _isLoading = false);
    }
  }
}
