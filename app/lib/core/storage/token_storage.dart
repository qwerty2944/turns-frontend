import 'dart:convert';

import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:shared_preferences/shared_preferences.dart';

part 'token_storage.g.dart';

/// JWT + cached user JSON. Keys mirror the web app's localStorage keys.
class TokenStorage {
  TokenStorage(this._prefs);

  final SharedPreferences _prefs;

  static const _tokenKey = 'turns_token';
  static const _userKey = 'turns_user';

  String? get token => _prefs.getString(_tokenKey);

  Map<String, dynamic>? get user {
    final raw = _prefs.getString(_userKey);
    if (raw == null) return null;
    try {
      return jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  Future<void> saveSession(String token, Map<String, dynamic> user) async {
    await _prefs.setString(_tokenKey, token);
    await _prefs.setString(_userKey, jsonEncode(user));
  }

  Future<void> clear() async {
    await _prefs.remove(_tokenKey);
    await _prefs.remove(_userKey);
  }
}

@Riverpod(keepAlive: true)
Future<TokenStorage> tokenStorage(Ref ref) async {
  final prefs = await SharedPreferences.getInstance();
  return TokenStorage(prefs);
}
