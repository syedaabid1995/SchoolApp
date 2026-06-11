import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:school_flutter/core/auth/auth_session.dart';
import 'package:school_flutter/core/network/api_client.dart';
import 'package:school_flutter/core/storage/secure_token_store.dart';
import 'package:school_flutter/features/auth/data/auth_repository.dart';

void main() {
  test('auth state restoration hydrates session from /users/me', () async {
    final store = _MemoryTokenStore(
      _session(accessToken: 'access', refreshToken: 'refresh'),
    );
    final dio = Dio(BaseOptions(baseUrl: 'http://test'));
    dio.httpClientAdapter = _FakeAdapter((options, count) {
      expect(options.path, '/users/me');
      return _json(200, {
        'id': 'u1',
        'email': 'teacher@school.test',
        'displayName': 'Teacher One',
        'role': 'TEACHER',
        'schoolId': 's1',
        'permissionCodes': ['attendance.view'],
        'school': {'id': 's1', 'name': 'Demo School', 'code': 'DEMO'},
      });
    });

    final restored = await AuthRepository(
      dio: dio,
      tokenStore: store,
    ).restoreSession();

    expect(restored?.user.name, 'Teacher One');
    expect(restored?.user.school?.name, 'Demo School');
    expect(restored?.user.permissions, contains('attendance.view'));
  });

  test('logout clears secure storage even when backend revoke fails', () async {
    final store = _MemoryTokenStore(
      _session(accessToken: 'access', refreshToken: 'refresh'),
    );
    final dio = Dio(BaseOptions(baseUrl: 'http://test'));
    dio.httpClientAdapter = _FakeAdapter(
      (options, count) => _json(500, {'message': 'failed'}),
    );

    await AuthRepository(dio: dio, tokenStore: store).logout();

    expect(await store.readSession(), isNull);
  });

  test(
    'token refresh on 401 stores rotated tokens and retries request',
    () async {
      final store = _MemoryTokenStore(
        _session(accessToken: 'old-access', refreshToken: 'old-refresh'),
      );
      final container = ProviderContainer(
        overrides: [secureTokenStoreProvider.overrideWithValue(store)],
      );
      addTearDown(container.dispose);
      final dio = container.read(dioProvider);

      var protectedCalls = 0;
      dio.httpClientAdapter = _FakeAdapter((options, count) {
        if (options.path == '/protected') {
          protectedCalls += 1;
          if (protectedCalls == 1) {
            return _json(401, {'message': 'Invalid token'});
          }
          return _json(200, {'ok': true});
        }
        if (options.path == '/auth/refresh') {
          return _json(200, {
            'accessToken': 'new-access',
            'refreshToken': 'new-refresh',
            'refreshTokenExpiresAt': DateTime.now()
                .add(const Duration(days: 1))
                .toIso8601String(),
          });
        }
        return _json(404, {});
      });

      final response = await dio.get<Map<String, dynamic>>('/protected');

      expect(response.data?['ok'], isTrue);
      expect(protectedCalls, 2);
      expect((await store.readSession())?.accessToken, 'new-access');
      expect((await store.readSession())?.refreshToken, 'new-refresh');
    },
  );
}

AuthSession _session({
  required String accessToken,
  required String refreshToken,
}) {
  return AuthSession(
    accessToken: accessToken,
    refreshToken: refreshToken,
    refreshTokenExpiresAt: DateTime.now().add(const Duration(days: 1)),
    user: const AuthUser(
      id: 'u1',
      name: 'Cached User',
      email: 'cached@school.test',
      role: 'TEACHER',
      schoolId: 's1',
      permissions: [],
    ),
  );
}

class _MemoryTokenStore implements TokenStore {
  _MemoryTokenStore(this.session);

  AuthSession? session;
  bool didClear = false;

  @override
  Future<void> clear() async {
    didClear = true;
    session = null;
  }

  @override
  Future<String?> readAccessToken() async => session?.accessToken;

  @override
  Future<String?> readRefreshToken() async => session?.refreshToken;

  @override
  Future<AuthSession?> readSession() async => session;

  @override
  Future<void> writeSession(AuthSession session) async {
    this.session = session;
  }
}

class _FakeAdapter implements HttpClientAdapter {
  _FakeAdapter(this.respond);

  final ResponseBody Function(RequestOptions options, int count) respond;
  int count = 0;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    count += 1;
    return respond(options, count);
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody _json(int statusCode, Object body) {
  return ResponseBody.fromString(
    jsonEncode(body),
    statusCode,
    headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    },
  );
}
