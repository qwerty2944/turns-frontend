import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../auth/presentation/auth_notifier.dart';
import '../../game/presentation/game_route_args.dart';
import '../domain/game_meta.dart';
import '../domain/room.dart';
import 'create_room_sheet.dart';
import 'rooms_provider.dart';

class LobbyPage extends ConsumerWidget {
  const LobbyPage({super.key});

  void _openGame(BuildContext context, GameRouteArgs args) {
    context.push('/game', extra: args);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final roomsAsync = ref.watch(roomsProvider);
    final auth = ref.watch(authProvider);
    final nickname = switch (auth) {
      AuthAuthenticated(:final user) => user.nickname,
      _ => '',
    };

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          '로비',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 4),
            child: Center(
              child: Text(
                nickname,
                style: const TextStyle(color: AppColors.muted, fontSize: 13),
              ),
            ),
          ),
          IconButton(
            tooltip: '로그아웃',
            icon: const Icon(Icons.logout, size: 20),
            onPressed: () =>
                ref.read(authProvider.notifier).logout(),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.accent,
        foregroundColor: const Color(0xFF1A1233),
        icon: const Icon(Icons.add),
        label: const Text('방 만들기', style: TextStyle(fontWeight: FontWeight.w700)),
        onPressed: () async {
          final args = await showCreateRoomSheet(context);
          if (args != null && context.mounted) _openGame(context, args);
        },
      ),
      body: RefreshIndicator(
        color: AppColors.accent,
        onRefresh: () => ref.read(roomsProvider.notifier).refreshNow(),
        child: roomsAsync.when(
          data: (rooms) => _RoomListView(
            rooms: rooms,
            onJoin: (room) => _openGame(
              context,
              GameRouteArgs(game: room.game, mode: 'join', roomId: room.roomId),
            ),
            onSpectate: (room) => _openGame(
              context,
              GameRouteArgs(
                  game: room.game, mode: 'spectate', roomId: room.roomId),
            ),
          ),
          loading: () =>
              const Center(child: CircularProgressIndicator(color: AppColors.accent)),
          error: (e, _) => ListView(
            children: [
              const SizedBox(height: 120),
              const Icon(Icons.wifi_off, color: AppColors.muted, size: 40),
              const SizedBox(height: 12),
              Center(
                child: Text(
                  '방 목록을 불러오지 못했습니다\n당겨서 새로고침',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.muted),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RoomListView extends StatelessWidget {
  const _RoomListView({
    required this.rooms,
    required this.onJoin,
    required this.onSpectate,
  });

  final List<Room> rooms;
  final void Function(Room) onJoin;
  final void Function(Room) onSpectate;

  @override
  Widget build(BuildContext context) {
    if (rooms.isEmpty) {
      return ListView(
        children: const [
          SizedBox(height: 140),
          Icon(Icons.meeting_room_outlined, color: AppColors.muted, size: 44),
          SizedBox(height: 12),
          Center(
            child: Text(
              '아직 열린 방이 없습니다\n방을 만들어보세요!',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.muted),
            ),
          ),
        ],
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
      itemCount: rooms.length,
      separatorBuilder: (_, _) => const SizedBox(height: 10),
      itemBuilder: (context, i) {
        final room = rooms[i];
        final meta = gameById(room.game);
        return Card(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              children: [
                Text(meta?.emoji ?? '🎲', style: const TextStyle(fontSize: 26)),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        room.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.accent,
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${meta?.displayName ?? room.game} · ${room.clients}/${room.maxClients}명'
                        '${room.spectators > 0 ? ' · 👁 ${room.spectators}' : ''}'
                        '${room.locked ? ' · 시작됨' : ''}',
                        style: const TextStyle(
                            color: AppColors.muted, fontSize: 12),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                if (room.joinable)
                  FilledButton(
                    style: FilledButton.styleFrom(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 8),
                      minimumSize: Size.zero,
                    ),
                    onPressed: () => onJoin(room),
                    child: const Text('입장'),
                  )
                else
                  OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 8),
                      minimumSize: Size.zero,
                    ),
                    onPressed: () => onSpectate(room),
                    child: const Text('관전'),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}
