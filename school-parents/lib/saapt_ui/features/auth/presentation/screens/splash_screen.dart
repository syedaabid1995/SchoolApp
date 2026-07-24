import 'package:flutter/material.dart';

import '../../../../app/theme/saapt_theme.dart';

class SaaptSplashScreen extends StatelessWidget {
  const SaaptSplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _SaaptMark(),
            SizedBox(height: 24),
            CircularProgressIndicator(color: SaaptTheme.primary),
          ],
        ),
      ),
    );
  }
}

class _SaaptMark extends StatelessWidget {
  const _SaaptMark();

  @override
  Widget build(BuildContext context) {
    return Container(
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
    );
  }
}
