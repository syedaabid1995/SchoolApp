import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_session.dart';
import '../../../core/theme/prototype_colors.dart';
import '../../../core/widgets/prototype_widgets.dart';
import 'auth_controller.dart';

class MfaScreen extends ConsumerStatefulWidget {
  const MfaScreen({super.key});

  @override
  ConsumerState<MfaScreen> createState() => _MfaScreenState();
}

class _MfaScreenState extends ConsumerState<MfaScreen> {
  final _codeController = TextEditingController();

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authControllerProvider);
    final isLoading = authState.status == AuthStatus.checking;
    final challenge = authState.challenge;

    return PrototypeScaffold(
      centerContent: true,
      children: [
        const PrototypeLogo(icon: Icons.lock_outline),
        const SizedBox(height: 20),
        const Text(
          'Verify OTP',
          style: TextStyle(
            fontSize: 28,
            height: 1.08,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          challenge?.method == 'totp'
              ? 'Enter the code from your authenticator app.'
              : 'Enter OTP sent to your email.',
          style: const TextStyle(
            color: PrototypeColors.muted,
            fontSize: 14,
            height: 1.55,
          ),
        ),
        const SizedBox(height: 22),
        PrototypeCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const PrototypeLabel('Verification Code'),
              TextField(
                controller: _codeController,
                keyboardType: TextInputType.number,
                maxLength: 6,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 8,
                ),
                decoration: const InputDecoration(
                  counterText: '',
                  hintText: '------',
                ),
                onSubmitted: (_) => _submit(),
              ),
              const SizedBox(height: 14),
              if (authState.errorMessage != null) ...[
                Text(
                  authState.errorMessage!,
                  style: const TextStyle(color: PrototypeColors.red),
                ),
                const SizedBox(height: 14),
              ],
              PrototypeButton(
                label: isLoading ? 'Verifying...' : 'Verify & Continue',
                icon: Icons.verified_outlined,
                onPressed: isLoading ? null : _submit,
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        PrototypeCard(
          variant: PrototypeCardVariant.blue,
          child: Text(
            challenge?.message ?? 'Verification required.',
            style: const TextStyle(
              color: PrototypeColors.muted,
              fontSize: 13,
              height: 1.55,
            ),
          ),
        ),
      ],
    );
  }

  void _submit() {
    final code = _codeController.text.trim();
    if (code.isEmpty) return;
    ref.read(authControllerProvider.notifier).verifyMfa(code);
  }
}
