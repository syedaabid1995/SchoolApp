import 'package:equatable/equatable.dart';

enum SyncPhase { idle, syncing, success, failed }

class SyncSnapshot extends Equatable {
  const SyncSnapshot({
    required this.phase,
    required this.pendingOperations,
    this.lastSyncAt,
    this.message,
  });

  const SyncSnapshot.idle()
    : phase = SyncPhase.idle,
      pendingOperations = 0,
      lastSyncAt = null,
      message = null;

  final SyncPhase phase;
  final int pendingOperations;
  final DateTime? lastSyncAt;
  final String? message;

  bool get hasPendingOperations => pendingOperations > 0;

  SyncSnapshot copyWith({
    SyncPhase? phase,
    int? pendingOperations,
    DateTime? lastSyncAt,
    String? message,
  }) {
    return SyncSnapshot(
      phase: phase ?? this.phase,
      pendingOperations: pendingOperations ?? this.pendingOperations,
      lastSyncAt: lastSyncAt ?? this.lastSyncAt,
      message: message,
    );
  }

  @override
  List<Object?> get props => [phase, pendingOperations, lastSyncAt, message];
}

class QueuedMutation extends Equatable {
  const QueuedMutation({
    required this.id,
    required this.type,
    required this.payload,
    required this.createdAt,
    this.attempts = 0,
  });

  final String id;
  final String type;
  final Map<String, dynamic> payload;
  final DateTime createdAt;
  final int attempts;

  QueuedMutation incrementAttempts() {
    return QueuedMutation(
      id: id,
      type: type,
      payload: payload,
      createdAt: createdAt,
      attempts: attempts + 1,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'type': type,
    'payload': payload,
    'createdAt': createdAt.toIso8601String(),
    'attempts': attempts,
  };

  factory QueuedMutation.fromJson(Map<String, dynamic> json) {
    return QueuedMutation(
      id: json['id']?.toString() ?? '',
      type: json['type']?.toString() ?? '',
      payload: json['payload'] is Map
          ? (json['payload'] as Map).map(
              (key, value) => MapEntry(key.toString(), value),
            )
          : const {},
      createdAt:
          DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      attempts: int.tryParse(json['attempts']?.toString() ?? '') ?? 0,
    );
  }

  @override
  List<Object?> get props => [id, type, payload, createdAt, attempts];
}
