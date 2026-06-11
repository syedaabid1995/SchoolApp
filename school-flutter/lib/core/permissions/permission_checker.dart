import 'mobile_module.dart';

bool canAccessModule({
  required MobileModule module,
  required Iterable<String> permissions,
  required String? role,
}) {
  if (module.key == 'profile') return true;
  final normalizedRole = role?.toUpperCase();
  final roleCanUseMobileModule =
      normalizedRole != null && module.fallbackRoles.contains(normalizedRole);
  final permissionSet = permissions.toSet();
  final hasPermission =
      module.requiredPermissions.isNotEmpty &&
      module.requiredPermissions.any(permissionSet.contains);
  if (hasPermission && roleCanUseMobileModule) return true;

  if (permissionSet.isNotEmpty) return false;
  return roleCanUseMobileModule;
}

List<MobileModule> visibleModules({
  required Iterable<String> permissions,
  required String? role,
}) {
  return mobileModules
      .where(
        (module) => canAccessModule(
          module: module,
          permissions: permissions,
          role: role,
        ),
      )
      .toList(growable: false);
}
