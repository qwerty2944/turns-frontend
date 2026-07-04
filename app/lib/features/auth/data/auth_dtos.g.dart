// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_dtos.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_LoginRequest _$LoginRequestFromJson(Map<String, dynamic> json) =>
    _LoginRequest(
      email: json['email'] as String,
      password: json['password'] as String,
    );

Map<String, dynamic> _$LoginRequestToJson(_LoginRequest instance) =>
    <String, dynamic>{'email': instance.email, 'password': instance.password};

_SignupRequest _$SignupRequestFromJson(Map<String, dynamic> json) =>
    _SignupRequest(
      email: json['email'] as String,
      password: json['password'] as String,
      passwordConfirm: json['passwordConfirm'] as String,
      nickname: json['nickname'] as String?,
    );

Map<String, dynamic> _$SignupRequestToJson(_SignupRequest instance) =>
    <String, dynamic>{
      'email': instance.email,
      'password': instance.password,
      'passwordConfirm': instance.passwordConfirm,
      'nickname': instance.nickname,
    };

_AuthResponse _$AuthResponseFromJson(Map<String, dynamic> json) =>
    _AuthResponse(
      token: json['token'] as String,
      user: User.fromJson(json['user'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$AuthResponseToJson(_AuthResponse instance) =>
    <String, dynamic>{'token': instance.token, 'user': instance.user};

_MeResponse _$MeResponseFromJson(Map<String, dynamic> json) =>
    _MeResponse(user: User.fromJson(json['user'] as Map<String, dynamic>));

Map<String, dynamic> _$MeResponseToJson(_MeResponse instance) =>
    <String, dynamic>{'user': instance.user};
