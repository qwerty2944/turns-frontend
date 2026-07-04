import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import 'auth_dtos.dart';

part 'auth_api.g.dart';

@RestApi()
abstract class AuthApi {
  factory AuthApi(Dio dio) = _AuthApi;

  @POST('/auth/login')
  Future<AuthResponse> login(@Body() LoginRequest body);

  @POST('/auth/signup')
  Future<AuthResponse> signup(@Body() SignupRequest body);

  @GET('/auth/me')
  Future<MeResponse> me();
}
