import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../../global_ui/core/network/error_handler.dart';
import '../../../../../global_ui/features/auth/presentation/providers/auth_providers.dart';
import '../../../../app/theme/saapt_theme.dart';

enum _ForgotPasswordStep { email, otp, password }

class SaaptForgotPasswordScreen extends ConsumerStatefulWidget {
  const SaaptForgotPasswordScreen({super.key});

  @override
  ConsumerState<SaaptForgotPasswordScreen> createState() =>
      _SaaptForgotPasswordScreenState();
}

class _SaaptForgotPasswordScreenState
    extends ConsumerState<SaaptForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _otpController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  _ForgotPasswordStep _step = _ForgotPasswordStep.email;
  bool _saving = false;
  bool _obscurePassword = true;
  String? _message;
  String? _error;

  @override
  void dispose() {
    _emailController.dispose();
    _otpController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_saving || !(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _saving = true;
      _error = null;
      _message = null;
    });

    try {
      final repository = ref.read(authRepositoryProvider);
      if (_step == _ForgotPasswordStep.email) {
        await repository.requestPasswordResetOtp(
          email: _emailController.text.trim(),
        );
        if (!mounted) return;
        setState(() {
          _step = _ForgotPasswordStep.otp;
          _message = 'OTP sent to your email.';
        });
        return;
      }
      if (_step == _ForgotPasswordStep.otp) {
        if (!mounted) return;
        setState(() => _step = _ForgotPasswordStep.password);
        return;
      }
      await repository.resetPasswordWithOtp(
        email: _emailController.text.trim(),
        otp: _otpController.text.trim(),
        newPassword: _newPasswordController.text,
        confirmPassword: _confirmPasswordController.text,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Password updated. Please sign in.')),
      );
      context.go('/login');
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = ErrorHandler.fromDio(error).message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  String? _required(String? value) =>
      value == null || value.trim().isEmpty ? 'This field is required' : null;

  String? _emailValidator(String? value) {
    if (_required(value) case final error?) return error;
    return value!.contains('@') ? null : 'Enter a valid email address';
  }

  String? _otpValidator(String? value) {
    if (_required(value) case final error?) return error;
    return RegExp(r'^\d{6}$').hasMatch(value!.trim())
        ? null
        : 'Enter the 6-digit OTP';
  }

  String? _confirmValidator(String? value) {
    if (_required(value) case final error?) return error;
    return value == _newPasswordController.text
        ? null
        : 'Passwords do not match';
  }

  @override
  Widget build(BuildContext context) {
    final title = switch (_step) {
      _ForgotPasswordStep.email => 'Forgot Password',
      _ForgotPasswordStep.otp => 'Enter OTP',
      _ForgotPasswordStep.password => 'Set New Password',
    };
    final subtitle = switch (_step) {
      _ForgotPasswordStep.email => 'Enter your registered teacher email.',
      _ForgotPasswordStep.otp => 'Check your email for the 6-digit OTP.',
      _ForgotPasswordStep.password => 'Create a new teacher login password.',
    };
    final buttonLabel = switch (_step) {
      _ForgotPasswordStep.email => 'Send OTP',
      _ForgotPasswordStep.otp => 'Continue',
      _ForgotPasswordStep.password => 'Update Password',
    };

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/login'),
        ),
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(24, 32, 24, 32),
              children: [
                const Icon(
                  Icons.lock_reset_outlined,
                  size: 56,
                  color: SaaptTheme.primary,
                ),
                const SizedBox(height: 24),
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 30,
                    fontWeight: FontWeight.w900,
                    color: SaaptTheme.navy,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 16,
                    height: 1.45,
                    color: Color(0xFF60708F),
                  ),
                ),
                const SizedBox(height: 28),
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFDCE5F5)),
                  ),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (_step == _ForgotPasswordStep.email) ...[
                          const _FieldLabel('EMAIL ID'),
                          TextFormField(
                            controller: _emailController,
                            keyboardType: TextInputType.emailAddress,
                            textInputAction: TextInputAction.done,
                            decoration: const InputDecoration(
                              prefixIcon: Icon(Icons.mail_outline),
                              hintText: 'teacher@school.com',
                            ),
                            validator: _emailValidator,
                          ),
                        ],
                        if (_step == _ForgotPasswordStep.otp) ...[
                          const _FieldLabel('OTP'),
                          TextFormField(
                            controller: _otpController,
                            keyboardType: TextInputType.number,
                            textInputAction: TextInputAction.done,
                            decoration: const InputDecoration(
                              prefixIcon: Icon(Icons.pin_outlined),
                              hintText: '6-digit OTP',
                            ),
                            validator: _otpValidator,
                          ),
                        ],
                        if (_step == _ForgotPasswordStep.password) ...[
                          const _FieldLabel('NEW PASSWORD'),
                          TextFormField(
                            controller: _newPasswordController,
                            obscureText: _obscurePassword,
                            textInputAction: TextInputAction.next,
                            decoration: InputDecoration(
                              prefixIcon: const Icon(Icons.lock_outline),
                              hintText: 'Enter new password',
                              suffixIcon: IconButton(
                                tooltip: _obscurePassword
                                    ? 'Show password'
                                    : 'Hide password',
                                onPressed: () => setState(
                                  () => _obscurePassword = !_obscurePassword,
                                ),
                                icon: Icon(
                                  _obscurePassword
                                      ? Icons.visibility_outlined
                                      : Icons.visibility_off_outlined,
                                ),
                              ),
                            ),
                            validator: _required,
                          ),
                          const SizedBox(height: 16),
                          const _FieldLabel('CONFIRM PASSWORD'),
                          TextFormField(
                            controller: _confirmPasswordController,
                            obscureText: _obscurePassword,
                            textInputAction: TextInputAction.done,
                            decoration: const InputDecoration(
                              prefixIcon: Icon(Icons.lock_outline),
                              hintText: 'Confirm new password',
                            ),
                            validator: _confirmValidator,
                          ),
                        ],
                        if (_message != null) ...[
                          const SizedBox(height: 14),
                          Text(
                            _message!,
                            style: const TextStyle(
                              color: SaaptTheme.success,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                        if (_error != null) ...[
                          const SizedBox(height: 14),
                          Text(
                            _error!,
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.error,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                        const SizedBox(height: 22),
                        FilledButton.icon(
                          style: FilledButton.styleFrom(
                            minimumSize: const Size.fromHeight(54),
                            backgroundColor: SaaptTheme.primary,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                          ),
                          onPressed: _saving ? null : _submit,
                          icon: _saving
                              ? const SizedBox.square(
                                  dimension: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : const Icon(Icons.arrow_forward),
                          label: Text(
                            buttonLabel,
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.label);
  final String label;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(left: 2, bottom: 7),
    child: Text(
      label,
      style: const TextStyle(
        color: Color(0xFF8A9AB8),
        fontWeight: FontWeight.w700,
        fontSize: 12,
      ),
    ),
  );
}
