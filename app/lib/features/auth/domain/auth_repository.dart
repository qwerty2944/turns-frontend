import 'user.dart';

abstract interface class AuthRepository {
  /// Restore a persisted session; null if none or invalid.
  Future<({String token, User user})?> restoreSession();

  Future<({String token, User user})> login({
    required String email,
    required String password,
  });

  Future<({String token, User user})> signup({
    required String email,
    required String password,
    required String passwordConfirm,
    String? nickname,
  });

  Future<void> logout();

  String? get currentToken;
}
