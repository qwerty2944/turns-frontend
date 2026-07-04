import 'package:dio/dio.dart';
import 'package:freezed_annotation/freezed_annotation.dart';

part 'failure.freezed.dart';

@freezed
sealed class Failure with _$Failure {
  const factory Failure.network() = NetworkFailure;
  const factory Failure.unauthorized() = UnauthorizedFailure;
  const factory Failure.server(String message) = ServerFailure;
  const factory Failure.unknown(String message) = UnknownFailure;

  const Failure._();

  String get userMessage => switch (this) {
        NetworkFailure() => '네트워크 연결을 확인해주세요',
        UnauthorizedFailure() => '세션이 만료되었습니다. 다시 로그인해주세요',
        ServerFailure(:final message) => message,
        UnknownFailure(:final message) => message,
      };

  static Failure fromDio(DioException e) {
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.connectionError) {
      return const Failure.network();
    }
    final status = e.response?.statusCode;
    if (status == 401) return const Failure.unauthorized();
    final data = e.response?.data;
    if (data is Map && data['error'] is String) {
      return Failure.server(data['error'] as String);
    }
    if (data is Map && data['message'] is String) {
      return Failure.server(data['message'] as String);
    }
    return Failure.unknown(e.message ?? '알 수 없는 오류');
  }
}
