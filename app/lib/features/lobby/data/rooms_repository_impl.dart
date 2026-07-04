import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/network/dio_provider.dart';
import '../domain/room.dart';
import '../domain/rooms_repository.dart';
import 'rooms_api.dart';

part 'rooms_repository_impl.g.dart';

class RoomsRepositoryImpl implements RoomsRepository {
  RoomsRepositoryImpl(this._api);

  final RoomsApi _api;

  @override
  Future<List<Room>> list({String? game}) => _api.list(game);
}

@Riverpod(keepAlive: true)
RoomsRepository roomsRepository(Ref ref) =>
    RoomsRepositoryImpl(RoomsApi(ref.watch(dioProvider)));
