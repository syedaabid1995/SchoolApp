import 'package:equatable/equatable.dart';

import 'permission.dart';

class PermissionGroup extends Equatable {
  const PermissionGroup({
    required this.id,
    required this.label,
    required this.permissions,
  });

  final String id;
  final String label;
  final List<Permission> permissions;

  @override
  List<Object?> get props => [id, label, permissions];
}
