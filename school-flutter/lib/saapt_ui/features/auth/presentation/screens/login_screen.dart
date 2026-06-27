import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../global_ui/features/auth/domain/entities/auth_session.dart';
import '../../../../../global_ui/features/auth/presentation/providers/auth_controller.dart';
import '../../../../app/theme/saapt_theme.dart';

class SaaptLoginScreen extends ConsumerStatefulWidget {
  const SaaptLoginScreen({super.key});

  @override
  ConsumerState<SaaptLoginScreen> createState() => _SaaptLoginScreenState();
}

class _SaaptLoginScreenState extends ConsumerState<SaaptLoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _schoolController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _mfaController = TextEditingController();
  bool _obscurePassword = true;

  @override
  void dispose() {
    _schoolController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _mfaController.dispose();
    super.dispose();
  }

  Future<void> _submit(AuthSession? session) async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (session?.status == AuthSessionStatus.mfaRequired) {
      await ref
          .read(authControllerProvider.notifier)
          .verifyMfa(
            challengeId: session!.challengeId!,
            code: _mfaController.text.trim(),
            rememberMe: true,
          );
      return;
    }
    await ref
        .read(authControllerProvider.notifier)
        .login(
          identifier: _emailController.text.trim(),
          password: _passwordController.text,
          schoolCode: _schoolController.text.trim(),
          rememberMe: true,
        );
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final session = auth.value;
    final isMfa = session?.status == AuthSessionStatus.mfaRequired;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(24, 72, 24, 32),
              children: [
                Align(
                  alignment: Alignment.centerLeft,
                  child: Container(
                    width: 72,
                    height: 72,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: SaaptTheme.primary,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Text(
                      'SA',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 28,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 30),
                Text(
                  isMfa ? 'Verify Login' : 'Teacher Login',
                  style: const TextStyle(
                    fontSize: 34,
                    fontWeight: FontWeight.w800,
                    color: SaaptTheme.navy,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  isMfa
                      ? (session?.message ?? 'Enter your verification code.')
                      : 'Sign in with your school account.',
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
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x140F2C64),
                        blurRadius: 24,
                        offset: Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (!isMfa) ...[
                          _FieldLabel('SCHOOL ID'),
                          TextFormField(
                            controller: _schoolController,
                            textInputAction: TextInputAction.next,
                            decoration: const InputDecoration(
                              prefixIcon: Icon(Icons.school_outlined),
                              hintText: '001',
                            ),
                            validator: _required,
                          ),
                          const SizedBox(height: 16),
                          _FieldLabel('EMAIL ID'),
                          TextFormField(
                            controller: _emailController,
                            keyboardType: TextInputType.emailAddress,
                            textInputAction: TextInputAction.next,
                            decoration: const InputDecoration(
                              prefixIcon: Icon(Icons.mail_outline),
                              hintText: 'teacher@school.com',
                            ),
                            validator: (value) {
                              if (_required(value) case final error?) {
                                return error;
                              }
                              return value!.contains('@')
                                  ? null
                                  : 'Enter a valid email address';
                            },
                          ),
                          const SizedBox(height: 16),
                          _FieldLabel('PASSWORD'),
                          TextFormField(
                            controller: _passwordController,
                            obscureText: _obscurePassword,
                            textInputAction: TextInputAction.done,
                            onFieldSubmitted: (_) => _submit(session),
                            decoration: InputDecoration(
                              prefixIcon: const Icon(Icons.lock_outline),
                              hintText: 'Enter password',
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
                        ] else ...[
                          _FieldLabel('VERIFICATION CODE'),
                          TextFormField(
                            controller: _mfaController,
                            keyboardType: TextInputType.number,
                            textInputAction: TextInputAction.done,
                            onFieldSubmitted: (_) => _submit(session),
                            decoration: const InputDecoration(
                              prefixIcon: Icon(Icons.verified_user_outlined),
                              hintText: '6-digit code',
                            ),
                            validator: _required,
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
                          onPressed: auth.isLoading
                              ? null
                              : () => _submit(session),
                          icon: auth.isLoading
                              ? const SizedBox.square(
                                  dimension: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : Icon(
                                  isMfa
                                      ? Icons.verified_user_outlined
                                      : Icons.login,
                                ),
                          label: Text(
                            isMfa ? 'Verify' : 'Sign In',
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        if (auth.hasError) ...[
                          const SizedBox(height: 14),
                          Text(
                            auth.error.toString(),
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.error,
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
    );
  }

  String? _required(String? value) =>
      value == null || value.trim().isEmpty ? 'This field is required' : null;
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
