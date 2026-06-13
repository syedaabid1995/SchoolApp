import 'package:equatable/equatable.dart';

class Permission extends Equatable {
  const Permission({required this.code, required this.label});

  final String code;
  final String label;

  @override
  List<Object?> get props => [code, label];
}

class PermissionAction extends Equatable {
  const PermissionAction({
    required this.id,
    required this.label,
    required this.requiredPermissions,
    this.requireAll = false,
  });

  final String id;
  final String label;
  final List<String> requiredPermissions;
  final bool requireAll;

  @override
  List<Object?> get props => [id, label, requiredPermissions, requireAll];
}
