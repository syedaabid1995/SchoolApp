import 'permission.dart';
import 'permission_registry.dart';

class PermissionChecker {
  const PermissionChecker(Set<String> codes) : _codes = codes;

  final Set<String> _codes;

  Set<String> get codes => Set.unmodifiable(_codes);

  bool hasPermission(String code) => _codes.contains(code);

  bool hasAnyPermission(Iterable<String> codes) {
    final required = codes.toList(growable: false);
    return required.isEmpty || required.any(_codes.contains);
  }

  bool hasAllPermissions(Iterable<String> codes) =>
      codes.every(_codes.contains);

  bool canAccessModule(StaffModuleDefinition module) {
    if (module.requireAll) return hasAllPermissions(module.requiredPermissions);
    return hasAnyPermission(module.requiredPermissions);
  }

  bool canAccessRoute(String route) {
    final module = PermissionRegistry.moduleForRoute(route);
    if (module == null) return true;
    return canAccessModule(module);
  }

  bool canPerformAction(String actionId) {
    final action = PermissionRegistry.actionForId(actionId);
    if (action == null) return false;
    return canPerform(action);
  }

  bool canPerform(PermissionAction action) {
    if (action.requireAll) return hasAllPermissions(action.requiredPermissions);
    return hasAnyPermission(action.requiredPermissions);
  }

  List<StaffModuleDefinition> visibleModules() {
    return [
      for (final module in PermissionRegistry.modules)
        if (canAccessModule(module)) module,
    ];
  }

  String? missingPermissionForRoute(String route) {
    final module = PermissionRegistry.moduleForRoute(route);
    if (module == null || canAccessModule(module)) return null;
    if (module.requiredPermissions.isEmpty) return null;
    return module.requiredPermissions.join(' or ');
  }

  bool can(String code) => hasPermission(code);
  bool canAny(Iterable<String> codes) => hasAnyPermission(codes);
}
