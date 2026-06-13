import 'package:flutter/material.dart';

import '../permissions/permission_registry.dart';
import 'app_card.dart';
import 'app_scaffold.dart';

class ModuleLandingScreen extends StatelessWidget {
  const ModuleLandingScreen({required this.module, super.key});

  final StaffModuleDefinition module;

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      title: module.displayName,
      child: AppCard(
        child: Row(
          children: [
            Icon(module.activeIcon, size: 32),
            const SizedBox(width: 16),
            Expanded(
              child: Text(
                module.displayName,
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
