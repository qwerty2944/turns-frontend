import 'package:flutter/foundation.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/network/dio_provider.dart';
import '../../../core/storage/token_storage.dart';
import '../domain/auth_repository.dart';
import '../domain/user.dart';
import 'auth_api.dart';
import 'auth_dtos.dart';

part 'auth_repository_impl.g.dart';

class AuthRepositoryImpl implements AuthRepository {
  AuthRepositoryImpl(this._api, this._storage);

  final AuthApi _api;
  final TokenStorage _storage;

  @override
  String? get currentToken => _storage.token;

  @override
  Future<({String token, User user})?> restoreSession() async {
    final token = _storage.token;
    if (token == null) return null;
    try {
      final me = await _api.me();
      await _storage.saveSession(token, me.user.toJson());
      return (token: token, user: me.user);
    } catch (e) {
      debugPrint('[auth] restoreSession failed: $e');
      await _storage.clear();
      return null;
    }
  }

  @override
  Future<({String token, User user})> login({
    required String email,
    required String password,
  }) async {
    final res =
        await _api.login(LoginRequest(email: email, password: password));
    await _storage.saveSession(res.token, res.user.toJson());
    return (token: res.token, user: res.user);
  }

  @override
  Future<({String token, User user})> signup({
    required String email,
    required String password,
    required String passwordConfirm,
    String? nickname,
  }) async {
    final res = await _api.signup(SignupRequest(
      email: email,
      password: password,
      passwordConfirm: passwordConfirm,
      nickname: (nickname == null || nickname.isEmpty) ? null : nickname,
    ));
    await _storage.saveSession(res.token, res.user.toJson());
    return (token: res.token, user: res.user);
  }

  @override
  Future<void> logout() => _storage.clear();
}

@Riverpod(keepAlive: true)
Future<AuthRepository> authRepository(Ref ref) async {
  final storage = await ref.watch(tokenStorageProvider.future);
  return AuthRepositoryImpl(AuthApi(ref.watch(dioProvider)), storage);
}
