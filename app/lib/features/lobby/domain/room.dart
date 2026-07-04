import 'package:freezed_annotation/freezed_annotation.dart';

part 'room.freezed.dart';
part 'room.g.dart';

@freezed
abstract class Room with _$Room {
  const factory Room({
    required String roomId,
    required String name,
    required String game,
    required int clients,
    required int maxClients,
    required bool locked,
    @Default(0) int spectators,
  }) = _Room;

  const Room._();

  factory Room.fromJson(Map<String, dynamic> json) => _$RoomFromJson(json);

  bool get joinable => !locked && clients < maxClients;
}
