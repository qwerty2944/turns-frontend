import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import 'lobby_bridge.dart';

/// One log/chat line with kind-based color coding — 채팅/시스템/전투/결과가
/// 한눈에 구분된다. (로비·인게임 채팅 공용)
class LogLine extends StatelessWidget {
  const LogLine({super.key, required this.entry, required this.meNickname});

  final LobbyLogEntry entry;
  final String meNickname;

  @override
  Widget build(BuildContext context) {
    // 채팅: "💬 nickname: message" — 닉네임/본문을 분리해 색을 달리 준다.
    if (entry.isChat) {
      final body = entry.text.substring(2).trim();
      final sep = body.indexOf(': ');
      final nick = sep > 0 ? body.substring(0, sep) : entry.actor;
      final msg = sep > 0 ? body.substring(sep + 2) : body;
      final isMe = nick == meNickname;
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: RichText(
          text: TextSpan(
            style: const TextStyle(
                fontFamily: 'Galmuri11', fontSize: 13, height: 1.5),
            children: [
              TextSpan(
                text: '$nick  ',
                style: TextStyle(
                  color: isMe ? AppColors.accent : const Color(0xFF8EC5FF),
                  fontWeight: FontWeight.w700,
                ),
              ),
              TextSpan(
                text: msg,
                style: const TextStyle(color: AppColors.text),
              ),
            ],
          ),
        ),
      );
    }

    final (color, italic) = switch (entry.kind) {
      'system' => (AppColors.muted, true),
      'turn' => (AppColors.gold, false),
      'combat' => (const Color(0xFFFF9B9B), false),
      'result' => (const Color(0xFFF6D36B), false),
      'play' => (AppColors.text, false),
      _ => (AppColors.muted, false),
    };
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Text(
        entry.text,
        style: TextStyle(
          color: color,
          fontSize: 12,
          height: 1.5,
          fontStyle: italic ? FontStyle.italic : FontStyle.normal,
        ),
      ),
    );
  }
}

/// In-game native chat drawer: log list + input, slides over the WebView.
class InGameChatPanel extends StatefulWidget {
  const InGameChatPanel({
    super.key,
    required this.log,
    required this.meNickname,
    required this.onSend,
    required this.onClose,
  });

  final List<LobbyLogEntry> log;
  final String meNickname;
  final ValueChanged<String> onSend;
  final VoidCallback onClose;

  @override
  State<InGameChatPanel> createState() => _InGameChatPanelState();
}

class _InGameChatPanelState extends State<InGameChatPanel> {
  final _input = TextEditingController();
  final _scroll = ScrollController();
  int _lastLen = 0;

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant InGameChatPanel old) {
    super.didUpdateWidget(old);
    if (widget.log.length != _lastLen) {
      _lastLen = widget.log.length;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scroll.hasClients) {
          _scroll.jumpTo(_scroll.position.maxScrollExtent);
        }
      });
    }
  }

  void _send() {
    final msg = _input.text.trim();
    if (msg.isEmpty) return;
    widget.onSend(msg);
    _input.clear();
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    return Align(
      alignment: Alignment.bottomCenter,
      child: Container(
        height: MediaQuery.of(context).size.height * 0.42 + bottomInset,
        padding: EdgeInsets.only(bottom: bottomInset),
        decoration: const BoxDecoration(
          color: AppColors.bg2,
          borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
          border: Border(
            top: BorderSide(color: AppColors.gold, width: 2),
          ),
          boxShadow: [
            BoxShadow(color: Colors.black54, blurRadius: 20, offset: Offset(0, -6)),
          ],
        ),
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 8, 6, 0),
              child: Row(
                children: [
                  const Text(
                    '💬 채팅 · 선거 상황',
                    style: TextStyle(
                      color: AppColors.gold,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.keyboard_arrow_down,
                        color: AppColors.muted),
                    onPressed: widget.onClose,
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView.builder(
                controller: _scroll,
                padding: const EdgeInsets.symmetric(horizontal: 14),
                itemCount: widget.log.length,
                itemBuilder: (context, i) =>
                    LogLine(entry: widget.log[i], meNickname: widget.meNickname),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 4, 12, 10),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _input,
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
                      onSubmitted: (_) => _send(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    style: IconButton.styleFrom(
                      backgroundColor: AppColors.accent,
                      foregroundColor: const Color(0xFF1A1233),
                    ),
                    onPressed: _send,
                    icon: const Icon(Icons.send, size: 18),
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
