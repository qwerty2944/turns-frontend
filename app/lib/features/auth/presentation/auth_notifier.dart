import 'package:dio/dio.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/error/failure.dart';
import '../data/auth_repository_impl.dart';
import '../domain/user.dart';

part 'auth_notifier.freezed.dart';
part 'auth_notifier.g.dart';

@freezed
sealed class AuthState with _$AuthState {
  /// Session restore in flight (app boot).
  const factory AuthState.restoring() = AuthRestoring;
  const factory AuthState.unauthenticated() = AuthUnauthenticated;
  const factory AuthState.authenticated({
    required String token,
    required User user,
  }) = AuthAuthenticated;
}

@Riverpod(keepAlive: true)
class AuthNotifier extends _$AuthNotifier {
  @override
  AuthState build() {
    _restore();
    return const AuthState.restoring();
  }

  Future<void> _restore() async {
    final repo = await ref.read(authRepositoryProvider.future);
    final session = await repo.restoreSession();
    state = session == null
        ? const AuthState.unauthenticated()
        : AuthState.authenticated(token: session.token, user: session.user);
  }

  Future<Failure?> login(String email, String password) async {
    try {
      final repo = await ref.read(authRepositoryProvider.future);
      final s = await repo.login(email: email, password: password);
      state = AuthState.authenticated(token: s.token, user: s.user);
      return null;
    } on DioException catch (e) {
      return Failure.fromDio(e);
    } catch (e) {
      return Failure.unknown(e.toString());
    }
  }

  Future<Failure?> signup({
    required String email,
    required String password,
    required String passwordConfirm,
    String? nickname,
  }) async {
    if (password != passwordConfirm) {
      return const Failure.server('비밀번호가 일치하지 않습니다');
    }
    try {
      final repo = await ref.read(authRepositoryProvider.future);
      final s = await repo.signup(
        email: email,
        password: password,
        passwordConfirm: passwordConfirm,
        nickname: nickname,
      );
      state = AuthState.authenticated(token: s.token, user: s.user);
      return null;
    } on DioException catch (e) {
      return Failure.fromDio(e);
    } catch (e) {
      return Failure.unknown(e.toString());
    }
  }

  Future<void> logout() async {
    final repo = await ref.read(authRepositoryProvider.future);
    await repo.logout();
    state = const AuthState.unauthenticated();
  }
}
