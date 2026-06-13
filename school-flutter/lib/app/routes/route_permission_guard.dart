import '../../core/permissions/permission_checker.dart';

class RoutePermissionDecision {
  const RoutePermissionDecision({
    required this.allowed,
    this.missingPermission,
  });

  final bool allowed;
  final String? missingPermission;
}

RoutePermissionDecision evaluateRoutePermission({
  required PermissionChecker checker,
  required String location,
}) {
  if (checker.canAccessRoute(location)) {
    return const RoutePermissionDecision(allowed: true);
  }
  return RoutePermissionDecision(
    allowed: false,
    missingPermission: checker.missingPermissionForRoute(location),
  );
}
