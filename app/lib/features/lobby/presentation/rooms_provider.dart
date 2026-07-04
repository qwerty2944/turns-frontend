import 'dart:async';

import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../data/rooms_repository_impl.dart';
import '../domain/room.dart';

part 'rooms_provider.g.dart';

/// Room list with 4s auto-refresh while watched (matches the web lobby).
@riverpod
class Rooms extends _$Rooms {
  Timer? _timer;

  @override
  Future<List<Room>> build() async {
    _timer = Timer.periodic(const Duration(seconds: 4), (_) => _refresh());
    ref.onDispose(() => _timer?.cancel());
    return ref.read(roomsRepositoryProvider).list();
  }

  Future<void> _refresh() async {
    try {
      final rooms = await ref.read(roomsRepositoryProvider).list();
      state = AsyncData(rooms);
    } catch (_) {
      // keep last data on transient errors
    }
  }

  Future<void> refreshNow() => _refresh();
}
