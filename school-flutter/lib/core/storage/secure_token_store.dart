import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../auth/auth_session.dart';

final secureTokenStoreProvider = Provider<TokenStore>((ref) {
  return SecureTokenStore(const FlutterSecureStorage());
});

abstract interface class TokenStore {
  Future<AuthSession?> readSession();
  Future<String?> readAccessToken();
  Future<String?> readRefreshToken();
  Future<void> writeSession(AuthSession session);
  Future<void> clear();
}

class SecureTokenStore implements TokenStore {
  const SecureTokenStore(this._storage);

  static const _sessionKey = 'school_erp_auth_session';
  final FlutterSecureStorage _storage;

  @override
  Future<AuthSession?> readSession() async {
    final raw = await _storage.read(key: _sessionKey);
    if (raw == null || raw.isEmpty) return null;
    return AuthSession.fromJson(jsonDecode(raw) as Map<String, dynamic>);
  }

  @override
  Future<String?> readAccessToken() async {
    return (await readSession())?.accessToken;
  }

  @override
  Future<String?> readRefreshToken() async {
    return (await readSession())?.refreshToken;
  }

  @override
  Future<void> writeSession(AuthSession session) {
    return _storage.write(
      key: _sessionKey,
      value: jsonEncode(session.toJson()),
    );
  }

  @override
  Future<void> clear() => _storage.delete(key: _sessionKey);
}
