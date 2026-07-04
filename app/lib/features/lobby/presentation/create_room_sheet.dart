import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../game/presentation/game_route_args.dart';
import '../domain/game_meta.dart';

Future<GameRouteArgs?> showCreateRoomSheet(BuildContext context) {
  return showModalBottomSheet<GameRouteArgs>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.panel,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (context) => const _CreateRoomSheet(),
  );
}

class _CreateRoomSheet extends StatefulWidget {
  const _CreateRoomSheet();

  @override
  State<_CreateRoomSheet> createState() => _CreateRoomSheetState();
}

class _CreateRoomSheetState extends State<_CreateRoomSheet> {
  GameMeta _game = games.first;
  final _name = TextEditingController();
  late int _maxPlayers = _game.maxPlayers;
  bool _mask = false;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  void _pickGame(GameMeta g) {
    setState(() {
      _game = g;
      _maxPlayers = g.maxPlayers;
    });
  }

  void _create() {
    Navigator.of(context).pop(GameRouteArgs(
      game: _game.id,
      mode: 'create',
      roomName: _name.text.trim().isEmpty ? _game.displayName : _name.text.trim(),
      maxPlayers: _maxPlayers,
      maskNicknames: _mask,
    ));
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    final playerCounts = [
      for (var n = _game.minPlayers; n <= _game.maxPlayers; n++) n,
    ];

    return Padding(
      padding: EdgeInsets.fromLTRB(20, 16, 20, 20 + bottomInset),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              '방 만들기',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: AppColors.accent,
              ),
            ),
            const SizedBox(height: 14),
            SizedBox(
              height: 96,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: games.length,
                separatorBuilder: (_, _) => const SizedBox(width: 8),
                itemBuilder: (context, i) {
                  final g = games[i];
                  final selected = g.id == _game.id;
                  return GestureDetector(
                    onTap: () => _pickGame(g),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      width: 92,
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: selected ? AppColors.bg2 : AppColors.bg,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: selected
                              ? AppColors.accent
                              : AppColors.panelBorder,
                          width: 2,
                        ),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(g.emoji, style: const TextStyle(fontSize: 26)),
                          const SizedBox(height: 6),
                          Text(
                            g.displayName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: selected
                                  ? AppColors.accent
                                  : AppColors.muted,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _game.description,
              style: const TextStyle(color: AppColors.muted, fontSize: 12),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _name,
              maxLength: 24,
              decoration: InputDecoration(
                labelText: '방 이름',
                hintText: _game.displayName,
                counterText: '',
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                const Text('인원', style: TextStyle(color: AppColors.muted)),
                const SizedBox(width: 12),
                Expanded(
                  child: Wrap(
                    spacing: 8,
                    children: [
                      for (final n in playerCounts)
                        ChoiceChip(
                          label: Text('$n명'),
                          selected: _maxPlayers == n,
                          selectedColor: AppColors.accent,
                          labelStyle: TextStyle(
                            color: _maxPlayers == n
                                ? const Color(0xFF1A1233)
                                : AppColors.text,
                            fontWeight: FontWeight.w700,
                          ),
                          backgroundColor: AppColors.bg2,
                          onSelected: (_) =>
                              setState(() => _maxPlayers = n),
                        ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('닉네임 가리기',
                  style: TextStyle(color: AppColors.text, fontSize: 14)),
              activeThumbColor: AppColors.accent,
              value: _mask,
              onChanged: (v) => setState(() => _mask = v),
            ),
            const SizedBox(height: 8),
            FilledButton(
              onPressed: _create,
              child: const Text('만들기'),
            ),
          ],
        ),
      ),
    );
  }
}
