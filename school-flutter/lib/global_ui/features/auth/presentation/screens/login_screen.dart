import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/constants/app_config.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_text_field.dart';
import '../../domain/entities/auth_session.dart';
import '../providers/auth_controller.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();
  final _schoolCodeController = TextEditingController();
  final _mfaController = TextEditingController();
  bool _rememberMe = false;

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    _schoolCodeController.dispose();
    _mfaController.dispose();
    super.dispose();
  }

  Future<void> _submitLogin() async {
    await ref
        .read(authControllerProvider.notifier)
        .login(
          identifier: _identifierController.text.trim(),
          password: _passwordController.text,
          schoolCode: _schoolCodeController.text.trim(),
          rememberMe: _rememberMe,
        );
  }

  Future<void> _submitMfa(String challengeId) async {
    await ref
        .read(authControllerProvider.notifier)
        .verifyMfa(
          challengeId: challengeId,
          code: _mfaController.text.trim(),
          rememberMe: _rememberMe,
        );
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final session = auth.hasValue ? auth.value : null;
    final isMfa =
        session?.status == AuthSessionStatus.mfaRequired &&
        session?.challengeId != null;

    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              colorScheme.primary.withOpacity(0.12),
              colorScheme.surface,
              colorScheme.secondary.withOpacity(0.08),
            ],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: ListView(
                shrinkWrap: true,
                padding: const EdgeInsets.all(AppSpacing.lg),
                children: [
                  // Icon + branding header
                  Center(
                    child: Container(
                      width: 72,
                      height: 72,
                      decoration: BoxDecoration(
                        color: colorScheme.primary,
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: colorScheme.primary.withOpacity(0.30),
                            blurRadius: 16,
                            offset: const Offset(0, 6),
                          ),
                        ],
                      ),
                      child: Icon(
                        isMfa ? Icons.verified_user_outlined : Icons.school_outlined,
                        color: colorScheme.onPrimary,
                        size: 36,
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Center(
                    child: Text(
                      AppConfig.appName,
                      style: textTheme.headlineMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.5,
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Center(
                    child: Text(
                      isMfa ? 'Two-factor verification' : 'Sign in with your staff account.',
                      style: textTheme.bodyLarge?.copyWith(
                        color: colorScheme.onSurface.withOpacity(0.60),
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  // Card
                  Container(
                    decoration: BoxDecoration(
                      color: colorScheme.surface,
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: colorScheme.shadow.withOpacity(0.08),
                          blurRadius: 24,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(AppSpacing.lg),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          if (!isMfa) ...[
                            AppTextField(
                              controller: _identifierController,
                              label: 'Email or username',
                              keyboardType: TextInputType.emailAddress,
                              textInputAction: TextInputAction.next,
                            ),
                            const SizedBox(height: AppSpacing.md),
                            AppTextField(
                              controller: _passwordController,
                              label: 'Password',
                              obscureText: true,
                              textInputAction: TextInputAction.next,
                            ),
                            const SizedBox(height: AppSpacing.md),
                            AppTextField(
                              controller: _schoolCodeController,
                              label: 'School code',
                              textInputAction: TextInputAction.done,
                            ),
                          ] else ...[
                            Text(
                              session?.message ?? 'Enter your verification code.',
                            ),
                            const SizedBox(height: AppSpacing.md),
                            AppTextField(
                              controller: _mfaController,
                              label: 'Verification code',
                              keyboardType: TextInputType.number,
                              textInputAction: TextInputAction.done,
                            ),
                          ],
                          const SizedBox(height: AppSpacing.xs),
                          CheckboxListTile(
                            contentPadding: EdgeInsets.zero,
                            value: _rememberMe,
                            onChanged: (value) =>
                                setState(() => _rememberMe = value ?? false),
                            title: const Text('Keep me signed in'),
                          ),
                          const SizedBox(height: AppSpacing.md),
                          AppButton(
                            label: isMfa ? 'Verify' : 'Sign in',
                            icon: isMfa
                                ? Icons.verified_user_outlined
                                : Icons.login,
                            isLoading: auth.isLoading,
                            onPressed: auth.isLoading
                                ? null
                                : () => isMfa
                                      ? _submitMfa(session!.challengeId!)
                                      : _submitLogin(),
                          ),
                          if (auth.hasError) ...[
                            const SizedBox(height: AppSpacing.md),
                            Container(
                              padding: const EdgeInsets.all(AppSpacing.sm),
                              decoration: BoxDecoration(
                                color: colorScheme.errorContainer,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Row(
                                children: [
                                  Icon(
                                    Icons.error_outline,
                                    color: colorScheme.error,
                                    size: 18,
                                  ),
                                  const SizedBox(width: AppSpacing.xs),
                                  Expanded(
                                    child: Text(
                                      auth.error.toString(),
                                      style: textTheme.bodySmall?.copyWith(
                                        color: colorScheme.onErrorContainer,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
