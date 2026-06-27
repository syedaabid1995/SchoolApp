import 'package:flutter_test/flutter_test.dart';
import 'package:school_flutter/global_ui/app/routes/route_permission_guard.dart';
import 'package:school_flutter/global_ui/core/permissions/permission_checker.dart';
import 'package:school_flutter/global_ui/core/permissions/permission_codes.dart';

void main() {
  test('route guard allows authenticated public staff routes', () {
    const checker = PermissionChecker({});

    final decision = evaluateRoutePermission(
      checker: checker,
      location: '/settings',
    );

    expect(decision.allowed, isTrue);
    expect(decision.missingPermission, isNull);
  });

  test('route guard denies direct module navigation without permission', () {
    const checker = PermissionChecker({PermissionCodes.libraryView});

    final decision = evaluateRoutePermission(
      checker: checker,
      location: '/payroll',
    );

    expect(decision.allowed, isFalse);
    expect(decision.missingPermission, contains(PermissionCodes.payrollView));
  });

  test('route guard allows nested module routes with matching permission', () {
    const checker = PermissionChecker({PermissionCodes.feesView});

    final decision = evaluateRoutePermission(
      checker: checker,
      location: '/fees/collections',
    );

    expect(decision.allowed, isTrue);
  });
}
