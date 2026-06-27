import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../app/routes/app_routes.dart';
import '../../app/theme/app_spacing.dart';
import 'app_button.dart';
import 'app_card.dart';
import 'app_scaffold.dart';

class AccessDeniedScreen extends StatelessWidget {
  const AccessDeniedScreen({this.missingPermission, super.key});

  final String? missingPermission;

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      title: 'Access denied',
      child: AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              Icons.lock_outline,
              size: 40,
              color: Theme.of(context).colorScheme.error,
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              'You do not have permission to open this area.',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              missingPermission == null || missingPermission!.isEmpty
                  ? 'Contact your administrator if you need access.'
                  : 'Missing permission: $missingPermission. Contact your administrator if you need access.',
            ),
            const SizedBox(height: AppSpacing.lg),
            AppButton(
              label: 'Back to dashboard',
              icon: Icons.arrow_back,
              onPressed: () => context.go(AppRoutes.dashboard),
            ),
          ],
        ),
      ),
    );
  }
}
