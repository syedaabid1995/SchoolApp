import 'package:flutter_riverpod/flutter_riverpod.dart';

final analyticsServiceProvider = Provider<AnalyticsService>((ref) {
  return InMemoryAnalyticsService();
});

abstract class AnalyticsService {
  void trackScreen(String name, {Map<String, Object?> properties = const {}});
  void trackEvent(String name, {Map<String, Object?> properties = const {}});
  List<AnalyticsEvent> get events;
}

class AnalyticsEvent {
  const AnalyticsEvent({
    required this.name,
    required this.createdAt,
    this.properties = const {},
  });

  final String name;
  final DateTime createdAt;
  final Map<String, Object?> properties;
}

class InMemoryAnalyticsService implements AnalyticsService {
  final List<AnalyticsEvent> _events = [];

  @override
  List<AnalyticsEvent> get events => List.unmodifiable(_events);

  @override
  void trackScreen(String name, {Map<String, Object?> properties = const {}}) {
    trackEvent('screen_opened', properties: {'screen': name, ...properties});
  }

  @override
  void trackEvent(String name, {Map<String, Object?> properties = const {}}) {
    _events.add(
      AnalyticsEvent(
        name: name,
        createdAt: DateTime.now(),
        properties: properties,
      ),
    );
  }
}
