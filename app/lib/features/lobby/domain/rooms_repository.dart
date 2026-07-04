import 'room.dart';

abstract interface class RoomsRepository {
  Future<List<Room>> list({String? game});
}
