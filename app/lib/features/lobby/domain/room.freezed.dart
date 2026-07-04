// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'room.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$Room {

 String get roomId; String get name; String get game; int get clients; int get maxClients; bool get locked; int get spectators;
/// Create a copy of Room
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$RoomCopyWith<Room> get copyWith => _$RoomCopyWithImpl<Room>(this as Room, _$identity);

  /// Serializes this Room to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is Room&&(identical(other.roomId, roomId) || other.roomId == roomId)&&(identical(other.name, name) || other.name == name)&&(identical(other.game, game) || other.game == game)&&(identical(other.clients, clients) || other.clients == clients)&&(identical(other.maxClients, maxClients) || other.maxClients == maxClients)&&(identical(other.locked, locked) || other.locked == locked)&&(identical(other.spectators, spectators) || other.spectators == spectators));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,roomId,name,game,clients,maxClients,locked,spectators);

@override
String toString() {
  return 'Room(roomId: $roomId, name: $name, game: $game, clients: $clients, maxClients: $maxClients, locked: $locked, spectators: $spectators)';
}


}

/// @nodoc
abstract mixin class $RoomCopyWith<$Res>  {
  factory $RoomCopyWith(Room value, $Res Function(Room) _then) = _$RoomCopyWithImpl;
@useResult
$Res call({
 String roomId, String name, String game, int clients, int maxClients, bool locked, int spectators
});




}
/// @nodoc
class _$RoomCopyWithImpl<$Res>
    implements $RoomCopyWith<$Res> {
  _$RoomCopyWithImpl(this._self, this._then);

  final Room _self;
  final $Res Function(Room) _then;

/// Create a copy of Room
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? roomId = null,Object? name = null,Object? game = null,Object? clients = null,Object? maxClients = null,Object? locked = null,Object? spectators = null,}) {
  return _then(_self.copyWith(
roomId: null == roomId ? _self.roomId : roomId // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,game: null == game ? _self.game : game // ignore: cast_nullable_to_non_nullable
as String,clients: null == clients ? _self.clients : clients // ignore: cast_nullable_to_non_nullable
as int,maxClients: null == maxClients ? _self.maxClients : maxClients // ignore: cast_nullable_to_non_nullable
as int,locked: null == locked ? _self.locked : locked // ignore: cast_nullable_to_non_nullable
as bool,spectators: null == spectators ? _self.spectators : spectators // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [Room].
extension RoomPatterns on Room {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _Room value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _Room() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _Room value)  $default,){
final _that = this;
switch (_that) {
case _Room():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _Room value)?  $default,){
final _that = this;
switch (_that) {
case _Room() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String roomId,  String name,  String game,  int clients,  int maxClients,  bool locked,  int spectators)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _Room() when $default != null:
return $default(_that.roomId,_that.name,_that.game,_that.clients,_that.maxClients,_that.locked,_that.spectators);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String roomId,  String name,  String game,  int clients,  int maxClients,  bool locked,  int spectators)  $default,) {final _that = this;
switch (_that) {
case _Room():
return $default(_that.roomId,_that.name,_that.game,_that.clients,_that.maxClients,_that.locked,_that.spectators);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String roomId,  String name,  String game,  int clients,  int maxClients,  bool locked,  int spectators)?  $default,) {final _that = this;
switch (_that) {
case _Room() when $default != null:
return $default(_that.roomId,_that.name,_that.game,_that.clients,_that.maxClients,_that.locked,_that.spectators);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _Room extends Room {
  const _Room({required this.roomId, required this.name, required this.game, required this.clients, required this.maxClients, required this.locked, this.spectators = 0}): super._();
  factory _Room.fromJson(Map<String, dynamic> json) => _$RoomFromJson(json);

@override final  String roomId;
@override final  String name;
@override final  String game;
@override final  int clients;
@override final  int maxClients;
@override final  bool locked;
@override@JsonKey() final  int spectators;

/// Create a copy of Room
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$RoomCopyWith<_Room> get copyWith => __$RoomCopyWithImpl<_Room>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$RoomToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _Room&&(identical(other.roomId, roomId) || other.roomId == roomId)&&(identical(other.name, name) || other.name == name)&&(identical(other.game, game) || other.game == game)&&(identical(other.clients, clients) || other.clients == clients)&&(identical(other.maxClients, maxClients) || other.maxClients == maxClients)&&(identical(other.locked, locked) || other.locked == locked)&&(identical(other.spectators, spectators) || other.spectators == spectators));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,roomId,name,game,clients,maxClients,locked,spectators);

@override
String toString() {
  return 'Room(roomId: $roomId, name: $name, game: $game, clients: $clients, maxClients: $maxClients, locked: $locked, spectators: $spectators)';
}


}

/// @nodoc
abstract mixin class _$RoomCopyWith<$Res> implements $RoomCopyWith<$Res> {
  factory _$RoomCopyWith(_Room value, $Res Function(_Room) _then) = __$RoomCopyWithImpl;
@override @useResult
$Res call({
 String roomId, String name, String game, int clients, int maxClients, bool locked, int spectators
});




}
/// @nodoc
class __$RoomCopyWithImpl<$Res>
    implements _$RoomCopyWith<$Res> {
  __$RoomCopyWithImpl(this._self, this._then);

  final _Room _self;
  final $Res Function(_Room) _then;

/// Create a copy of Room
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? roomId = null,Object? name = null,Object? game = null,Object? clients = null,Object? maxClients = null,Object? locked = null,Object? spectators = null,}) {
  return _then(_Room(
roomId: null == roomId ? _self.roomId : roomId // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,game: null == game ? _self.game : game // ignore: cast_nullable_to_non_nullable
as String,clients: null == clients ? _self.clients : clients // ignore: cast_nullable_to_non_nullable
as int,maxClients: null == maxClients ? _self.maxClients : maxClients // ignore: cast_nullable_to_non_nullable
as int,locked: null == locked ? _self.locked : locked // ignore: cast_nullable_to_non_nullable
as bool,spectators: null == spectators ? _self.spectators : spectators // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}

// dart format on
