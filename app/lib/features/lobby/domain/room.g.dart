// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'room.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_Room _$RoomFromJson(Map<String, dynamic> json) => _Room(
  roomId: json['roomId'] as String,
  name: json['name'] as String,
  game: json['game'] as String,
  clients: (json['clients'] as num).toInt(),
  maxClients: (json['maxClients'] as num).toInt(),
  locked: json['locked'] as bool,
  spectators: (json['spectators'] as num?)?.toInt() ?? 0,
);

Map<String, dynamic> _$RoomToJson(_Room instance) => <String, dynamic>{
  'roomId': instance.roomId,
  'name': instance.name,
  'game': instance.game,
  'clients': instance.clients,
  'maxClients': instance.maxClients,
  'locked': instance.locked,
  'spectators': instance.spectators,
};
