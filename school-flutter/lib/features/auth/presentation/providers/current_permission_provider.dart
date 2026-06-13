import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/permissions/permission_checker.dart';
import 'auth_controller.dart';

final currentPermissionCheckerProvider = Provider<PermissionChecker>((ref) {
  final auth = ref.watch(authControllerProvider);
  final session = auth.hasValue ? auth.value : null;
  return PermissionChecker(session?.user?.permissionCodes ?? const {});
});
