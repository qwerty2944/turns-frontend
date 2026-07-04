import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../domain/room.dart';

part 'rooms_api.g.dart';

@RestApi()
abstract class RoomsApi {
  factory RoomsApi(Dio dio) = _RoomsApi;

  @GET('/rooms')
  Future<List<Room>> list(@Query('game') String? game);
}
