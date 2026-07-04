import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../lobby/domain/game_meta.dart';
import 'chat_panel.dart';
import 'lobby_bridge.dart';

/// Native pre-game lobby for EVERY game — players/ready/start/chat, plus a
/// faction picker for 여의도 대전. Rendered OVER the hidden WebView; commands
/// go back down the JS bridge, so game-start logic stays native and Phaser
/// only takes over once the match begins.
class NativeLobbyView extends StatefulWidget {
  const NativeLobbyView({
    super.key,
    required this.snap,
    required this.meta,
    required this.onCommand,
    required this.onLeave,
  });

  final LobbySnap snap;
  final GameMeta? meta;
  final void Function(String name, [Object? payload]) onCommand;
  final VoidCallback onLeave;

  @override
  State<NativeLobbyView> createState() => _NativeLobbyViewState();
}

class _NativeLobbyViewState extends State<NativeLobbyView> {
  final _chat = TextEditingController();
  final _scroll = ScrollController();
  int _lastLogLen = 0;

  @override
  void dispose() {
    _chat.dispose();
    _scroll.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant NativeLobbyView old) {
    super.didUpdateWidget(old);
    // Stick to the bottom when new chat/log lands.
    if (widget.snap.log.length != _lastLogLen) {
      _lastLogLen = widget.snap.log.length;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scroll.hasClients) {
          _scroll.animateTo(
            _scroll.position.maxScrollExtent,
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeOut,
          );
        }
      });
    }
  }

  void _sendChat() {
    final msg = _chat.text.trim();
    if (msg.isEmpty) return;
    widget.onCommand('chat', msg);
    _chat.clear();
  }

  @override
  Widget build(BuildContext context) {
    final snap = widget.snap;
    final me = snap.me;
    final isYeouido = snap.game == 'yeouido';
    final minPlayers = widget.meta?.minPlayers ?? 2;
    final enoughPlayers = snap.players.length >= minPlayers;
    final bothPicked = !isYeouido ||
        (snap.players.length == 2 &&
            snap.players.every((p) => p.faction.isNotEmpty));
    final allReady =
        snap.players.every((p) => p.ready || p.sid == snap.hostSid);
    final canStart = snap.isHost && enoughPlayers && bothPicked && allReady;

    return Container(
      color: AppColors.bg,
      child: SafeArea(
        child: Column(
          children: [
            // ── header ──
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 8, 4),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      isYeouido
                          ? '🏛️ 후보 등록'
                          : '${widget.meta?.emoji ?? '🎲'} ${widget.meta?.displayName ?? ''} 대기실',
                      style: const TextStyle(
                        color: AppColors.accent,
                        fontSize: 19,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1,
                      ),
                    ),
                  ),
                  TextButton(
                    onPressed: widget.onLeave,
                    child: const Text('나가기',
                        style: TextStyle(color: AppColors.muted)),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  isYeouido
                      ? '진영을 선택하고 준비하세요. 두 후보가 모이면 방장이 선거를 시작합니다.'
                      : '모두 준비되면 방장이 시작합니다. (${snap.players.length}/$minPlayers명 이상)',
                  style: const TextStyle(
                      color: AppColors.muted, fontSize: 12, height: 1.5),
                ),
              ),
            ),
            const SizedBox(height: 10),

            // ── faction cards (여의도 대전 전용) ──
            if (isYeouido)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: Row(
                children: [
                  Expanded(
                    child: _FactionCard(
                      faction: 'ruling',
                      emoji: '🔵',
                      name: '이재믕 후보',
                      label: '여당',
                      power: '여론 조성 — (2) 지지율 2 회복',
                      color: AppColors.ruling,
                      snap: snap,
                      onTap: () =>
                          widget.onCommand('pickFaction', {'faction': 'ruling'}),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _FactionCard(
                      faction: 'opposition',
                      emoji: '🔴',
                      name: '한동훙 후보',
                      label: '야당',
                      power: '국정감사 — (2) 상대에게 1 피해',
                      color: AppColors.opposition,
                      snap: snap,
                      onTap: () => widget
                          .onCommand('pickFaction', {'faction': 'opposition'}),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),

            // ── players ──
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: Column(
                children: [
                  for (final p in snap.players)
                    Container(
                      margin: const EdgeInsets.only(bottom: 6),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 9),
                      decoration: BoxDecoration(
                        color: AppColors.panel,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: p.sid == snap.meSid
                              ? AppColors.gold
                              : AppColors.panelBorder,
                          width: 1.5,
                        ),
                      ),
                      child: Row(
                        children: [
                          Text(
                            p.sid == snap.hostSid ? '👑' : '🎮',
                            style: const TextStyle(fontSize: 15),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              '${p.nickname}${p.sid == snap.meSid ? ' (나)' : ''}'
                              '${!p.connected ? ' ⚡' : ''}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  color: AppColors.text, fontSize: 14),
                            ),
                          ),
                          if (p.faction.isNotEmpty)
                            Container(
                              margin: const EdgeInsets.only(right: 8),
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: (p.faction == 'ruling'
                                        ? AppColors.ruling
                                        : AppColors.opposition)
                                    .withValues(alpha: 0.2),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                p.faction == 'ruling' ? '여당' : '야당',
                                style: TextStyle(
                                  fontSize: 11,
                                  color: p.faction == 'ruling'
                                      ? AppColors.ruling
                                      : AppColors.opposition,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          Text(
                            p.sid == snap.hostSid
                                ? '방장'
                                : (p.ready ? '✅ 준비' : '대기'),
                            style: TextStyle(
                              fontSize: 12,
                              color: p.ready || p.sid == snap.hostSid
                                  ? AppColors.success
                                  : AppColors.muted,
                            ),
                          ),
                        ],
                      ),
                    ),
                  if (snap.players.length < 2)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 4),
                      child: Text(
                        '상대 후보를 기다리는 중…',
                        style:
                            TextStyle(color: AppColors.muted, fontSize: 12),
                      ),
                    ),
                ],
              ),
            ),

            // ── chat / log ──
            Expanded(
              child: Container(
                margin: const EdgeInsets.fromLTRB(14, 6, 14, 8),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.bg2,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.panelBorder, width: 1.5),
                ),
                child: snap.log.isEmpty
                    ? const Center(
                        child: Text('채팅으로 인사를 나눠보세요 👋',
                            style: TextStyle(
                                color: AppColors.muted, fontSize: 12)),
                      )
                    : ListView.builder(
                        controller: _scroll,
                        itemCount: snap.log.length,
                        itemBuilder: (context, i) =>
                            LogLine(entry: snap.log[i], meNickname: me?.nickname ?? ''),
                      ),
              ),
            ),

            // ── chat input ──
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 8),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _chat,
                      maxLength: 120,
                      style: const TextStyle(fontSize: 14),
                      decoration: const InputDecoration(
                        hintText: '채팅 입력…',
                        counterText: '',
                        isDense: true,
                        contentPadding:
                            EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                      ),
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => _sendChat(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    style: IconButton.styleFrom(
                      backgroundColor: AppColors.accent,
                      foregroundColor: const Color(0xFF1A1233),
                    ),
                    onPressed: _sendChat,
                    icon: const Icon(Icons.send, size: 18),
                  ),
                ],
              ),
            ),

            // ── actions ──
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 10),
              child: Row(
                children: [
                  if (!snap.isHost)
                    Expanded(
                      child: FilledButton(
                        style: FilledButton.styleFrom(
                          backgroundColor: (me?.ready ?? false)
                              ? AppColors.panel
                              : AppColors.accent,
                          foregroundColor: (me?.ready ?? false)
                              ? AppColors.success
                              : const Color(0xFF1A1233),
                          side: (me?.ready ?? false)
                              ? const BorderSide(
                                  color: AppColors.success, width: 2)
                              : BorderSide.none,
                        ),
                        onPressed: (!isYeouido || (me?.faction.isNotEmpty ?? false))
                            ? () => widget.onCommand('toggleReady')
                            : null,
                        child: Text(
                            (me?.ready ?? false) ? '✅ 준비 완료' : '준비하기'),
                      ),
                    ),
                  if (snap.isHost)
                    Expanded(
                      child: FilledButton(
                        onPressed: canStart
                            ? () => widget.onCommand('startGame')
                            : null,
                        child: Text(canStart
                            ? (isYeouido ? '▶ 선거 시작' : '▶ 게임 시작')
                            : !enoughPlayers
                                ? '플레이어 대기 중…'
                                : (bothPicked ? '준비 대기 중…' : '진영 선택 대기 중…')),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FactionCard extends StatelessWidget {
  const _FactionCard({
    required this.faction,
    required this.emoji,
    required this.name,
    required this.label,
    required this.power,
    required this.color,
    required this.snap,
    required this.onTap,
  });

  final String faction;
  final String emoji;
  final String name;
  final String label;
  final String power;
  final Color color;
  final LobbySnap snap;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    LobbyPlayer? holder;
    for (final p in snap.players) {
      if (p.faction == faction) holder = p;
    }
    final mine = holder?.sid == snap.meSid;
    final takenByOther = holder != null && !mine;

    return GestureDetector(
      onTap: takenByOther ? null : onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 10),
        decoration: BoxDecoration(
          color: mine ? color.withValues(alpha: 0.14) : AppColors.panel,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: mine ? color : AppColors.panelBorder,
            width: mine ? 2.5 : 1.5,
          ),
          boxShadow: mine
              ? [BoxShadow(color: color.withValues(alpha: 0.35), blurRadius: 14)]
              : const [],
        ),
        child: Opacity(
          opacity: takenByOther ? 0.45 : 1,
          child: Column(
            children: [
              Text(emoji, style: const TextStyle(fontSize: 30)),
              const SizedBox(height: 6),
              Text(
                name,
                style: TextStyle(
                  color: mine ? color : AppColors.text,
                  fontWeight: FontWeight.w700,
                  fontSize: 15,
                ),
              ),
              Text(
                label,
                style: TextStyle(
                    color: color, fontSize: 11, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 6),
              Text(
                power,
                textAlign: TextAlign.center,
                style: const TextStyle(
                    color: AppColors.muted, fontSize: 10.5, height: 1.45),
              ),
              const SizedBox(height: 6),
              Text(
                mine
                    ? '✅ 나의 진영'
                    : takenByOther
                        ? '${holder.nickname} 선택'
                        : '탭해서 선택',
                style: TextStyle(
                  fontSize: 11,
                  color: mine ? AppColors.gold : AppColors.muted,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
