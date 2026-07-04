import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/web_bundle/web_bundle_service.dart';
import '../../auth/presentation/auth_notifier.dart';
import '../../lobby/domain/game_meta.dart';
import 'game_route_args.dart';
import 'chat_panel.dart';
import 'lobby_bridge.dart';
import 'native_lobby_view.dart';

/// In-game screen. The bundled web client (Next.js static export, Phaser and
/// all) runs inside an InAppWebView against the same Colyseus server as web
/// users → cross-play.
///
/// Hybrid lobby: for games with a native pre-game lobby (yeouido), the
/// WebView stays HIDDEN behind a native Flutter lobby while phase=lobby —
/// the page pushes state up via the `turnsState` JS handler and native UI
/// sends commands back down (window.__turnsApp.cmd). The WebView is revealed
/// the moment the match starts.
class GameWebViewPage extends ConsumerStatefulWidget {
  const GameWebViewPage({super.key, required this.args});

  final GameRouteArgs args;

  /// Exposed for integration tests to drive the page inside the WebView
  /// (evaluateJavascript). Not used by production code paths.
  static InAppWebViewController? debugController;

  @override
  ConsumerState<GameWebViewPage> createState() => _GameWebViewPageState();
}

class _GameWebViewPageState extends ConsumerState<GameWebViewPage> {
  bool _ready = false;
  bool _pageLoaded = false;
  String? _error;
  Uri? _playUri;
  String _origin = '';
  InAppWebViewController? _controller;
  LobbySnap? _lobby;
  bool _chatOpen = false;
  int _seenLogLen = 0;

  // 게임 시작 전 로직은 전부 네이티브 — 관전만 웹뷰 직행.
  bool get _wantsNativeLobby => widget.args.mode != 'spectate';

  bool get _showNativeLobby =>
      _wantsNativeLobby && _error == null && (_lobby?.phase ?? 'lobby') == 'lobby';

  @override
  void initState() {
    super.initState();
    WakelockPlus.enable();
    _boot();
  }

  @override
  void dispose() {
    WakelockPlus.disable();
    super.dispose();
  }

  Future<void> _boot() async {
    try {
      final bundle = ref.read(webBundleServiceProvider);
      await bundle.ensureStarted();
      final auth = ref.read(authProvider);
      final token = switch (auth) {
        AuthAuthenticated(:final token) => token,
        _ => null,
      };
      if (token == null) {
        setState(() => _error = '로그인이 필요합니다');
        return;
      }
      _origin = bundle.origin;
      setState(() {
        _playUri = Uri.parse('${bundle.origin}/play/')
            .replace(queryParameters: widget.args.toQuery(token));
        _ready = true;
      });
    } catch (e) {
      setState(() => _error = '게임 화면을 준비하지 못했습니다: $e');
    }
  }

  /// Send a command into the page (native lobby → Colyseus room message).
  void _cmd(String name, [Object? payload]) {
    final c = _controller;
    if (c == null) return;
    final args = payload == null
        ? jsonEncode(name)
        : '${jsonEncode(name)}, ${jsonEncode(jsonEncode(payload))}';
    c.evaluateJavascript(
      source: 'window.__turnsApp && window.__turnsApp.cmd($args)',
    );
  }

  Future<bool> _confirmLeave() async {
    // 로비 단계에서는 진행 중인 판이 없으니 바로 나간다.
    if (_showNativeLobby) return true;
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.panel,
        title: const Text('게임에서 나갈까요?',
            style: TextStyle(color: AppColors.text, fontSize: 18)),
        content: const Text(
          '진행 중인 게임에서 나가면 30초 안에 돌아오지 않을 경우 탈락 처리될 수 있습니다.',
          style: TextStyle(color: AppColors.muted, fontSize: 14),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('계속하기'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('나가기'),
          ),
        ],
      ),
    );
    return result ?? false;
  }

  @override
  Widget build(BuildContext context) {
    final meta = gameById(widget.args.game);

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final leave = await _confirmLeave();
        if (leave && mounted && context.mounted) context.pop();
      },
      child: Scaffold(
        backgroundColor: AppColors.bg,
        body: SafeArea(
          child: Stack(
            children: [
              if (_ready && _playUri != null)
                InAppWebView(
                  initialUrlRequest: URLRequest(url: WebUri.uri(_playUri!)),
                  initialSettings: InAppWebViewSettings(
                    javaScriptEnabled: true,
                    domStorageEnabled: true,
                    mediaPlaybackRequiresUserGesture: false,
                    allowsBackForwardNavigationGestures: false,
                    disableLongPressContextMenuOnLinks: true,
                    transparentBackground: true,
                    supportZoom: false,
                    // 127.0.0.1 페이지 → wss/https 백엔드 호출 허용
                    mixedContentMode:
                        MixedContentMode.MIXED_CONTENT_ALWAYS_ALLOW,
                  ),
                  shouldOverrideUrlLoading:
                      (controller, navigationAction) async {
                    final url = navigationAction.request.url;
                    if (url == null) return NavigationActionPolicy.ALLOW;
                    final s = url.toString();
                    // 게임 종료 "로비로" / 401 → 네이티브 로비 복귀
                    if (s.startsWith(_origin) &&
                        (url.path.startsWith('/lobby') ||
                            url.path.startsWith('/login'))) {
                      if (mounted) context.pop();
                      return NavigationActionPolicy.CANCEL;
                    }
                    // 번들 외부 URL 차단
                    if (!s.startsWith(_origin)) {
                      return NavigationActionPolicy.CANCEL;
                    }
                    return NavigationActionPolicy.ALLOW;
                  },
                  onWebViewCreated: (controller) {
                    GameWebViewPage.debugController = controller;
                    _controller = controller;
                    controller.addJavaScriptHandler(
                      handlerName: 'turnsState',
                      callback: (args) {
                        debugPrint('[bridge] turnsState received '
                            '(${args.isNotEmpty ? args.first.runtimeType : 'empty'})');
                        if (!mounted || args.isEmpty) return;
                        final raw = args.first;
                        if (raw is Map) {
                          setState(() {
                            _lobby = LobbySnap.fromJson(
                                Map<String, dynamic>.from(raw));
                          });
                        }
                      },
                    );
                  },
                  onLoadStop: (controller, url) {
                    debugPrint('[webview] loadStop $url');
                    if (mounted) setState(() => _pageLoaded = true);
                  },
                  onConsoleMessage: (controller, msg) {
                    debugPrint('[webview:${msg.messageLevel}] ${msg.message}');
                  },
                  onReceivedError: (controller, request, error) {
                    debugPrint('[webview] error ${request.url}: ${error.description}');
                  },
                ),

              // ── 네이티브 대기실 (웹뷰는 뒤에서 연결 유지) ──
              if (_showNativeLobby)
                _lobby == null
                    ? _Splash(
                        meta: meta,
                        error: _error,
                        stage: !_ready
                            ? '게임 준비 중 (1/3)'
                            : !_pageLoaded
                                ? '화면 불러오는 중 (2/3)'
                                : '서버 접속 중 (3/3)',
                        onLeave: () => context.pop())
                    : NativeLobbyView(
                        snap: _lobby!,
                        meta: meta,
                        onCommand: _cmd,
                        onLeave: () => context.pop(),
                      ),

              if (!_showNativeLobby && !_pageLoaded)
                _Splash(
                    meta: meta,
                    error: _error,
                    stage: _ready ? '화면 불러오는 중' : '게임 준비 중',
                    onLeave: () => context.pop()),

              // ── 인게임 네이티브 채팅 (웹뷰의 채팅 패널은 앱에서 숨김) ──
              if (!_showNativeLobby && _lobby != null && !_chatOpen)
                Positioned(
                  bottom: 12,
                  left: 10,
                  child: Badge(
                    isLabelVisible: _lobby!.log.length > _seenLogLen,
                    backgroundColor: AppColors.danger,
                    child: IconButton.filled(
                      style: IconButton.styleFrom(
                        backgroundColor: AppColors.bg.withValues(alpha: 0.8),
                        foregroundColor: AppColors.gold,
                        side: const BorderSide(color: AppColors.gold, width: 1.5),
                      ),
                      icon: const Icon(Icons.chat_bubble_outline, size: 20),
                      onPressed: () => setState(() {
                        _chatOpen = true;
                        _seenLogLen = _lobby?.log.length ?? 0;
                      }),
                    ),
                  ),
                ),
              if (!_showNativeLobby && _chatOpen && _lobby != null)
                InGameChatPanel(
                  log: _lobby!.log,
                  meNickname: _lobby!.me?.nickname ?? '',
                  onSend: (msg) => _cmd('chat', msg),
                  onClose: () => setState(() {
                    _chatOpen = false;
                    _seenLogLen = _lobby?.log.length ?? 0;
                  }),
                ),

              // 상단 우측 나가기 버튼 — 인게임(웹뷰 노출) 상태에서만
              if (!_showNativeLobby)
                Positioned(
                  top: 4,
                  right: 4,
                  child: IconButton(
                    style: IconButton.styleFrom(
                      backgroundColor: AppColors.bg.withValues(alpha: 0.55),
                    ),
                    icon: const Icon(Icons.close,
                        color: AppColors.muted, size: 20),
                    onPressed: () async {
                      final leave = await _confirmLeave();
                      if (leave && mounted && context.mounted) context.pop();
                    },
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 심즈식 로딩 멘트 — 지루한 스피너 대신 낄낄거리게.
const _loadingQuips = <String>[
  '보좌관이 커피를 타는 중…',
  '유세 차량 시동 거는 중…',
  '공약(空約) 인쇄하는 중…',
  '현수막 삐뚤게 거는 중…',
  '여론조사 오차범위 계산 중…',
  '필리버스터 원고 찾는 중…',
  '내부 총질 말리는 중…',
  '재검표 하는 중…',
  '기자들 도시락 주문하는 중…',
  '늑대 목욕시키는 중…',
  '주사위 모서리 다듬는 중…',
  '카드 뒷면 광내는 중…',
  '테트리스 블록 줄 세우는 중…',
  '서버에게 아부하는 중…',
];

class _Splash extends StatefulWidget {
  const _Splash({
    required this.meta,
    required this.error,
    required this.onLeave,
    this.stage,
  });

  final GameMeta? meta;
  final String? error;
  final VoidCallback onLeave;

  /// 진행 단계 표시 — 실기기에서 어디서 막히는지 눈으로 확인 가능.
  final String? stage;

  @override
  State<_Splash> createState() => _SplashState();
}

class _SplashState extends State<_Splash> {
  late int _quip = DateTime.now().millisecondsSinceEpoch % _loadingQuips.length;
  Timer? _timer;
  bool _slow = false;
  int _elapsed = 0;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 2), (_) {
      if (!mounted) return;
      setState(() {
        _quip = (_quip + 1) % _loadingQuips.length;
        _elapsed += 2;
        if (_elapsed >= 14) _slow = true; // 무한 스피너 방지 — 탈출구 노출
      });
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final error = widget.error;
    return Container(
      color: AppColors.bg,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(widget.meta?.emoji ?? '🎲', style: const TextStyle(fontSize: 52)),
            const SizedBox(height: 16),
            Text(
              widget.meta?.displayName ?? '게임',
              style: const TextStyle(
                color: AppColors.accent,
                fontSize: 20,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 20),
            if (error == null) ...[
              const CircularProgressIndicator(color: AppColors.accent),
              if (widget.stage != null) ...[
                const SizedBox(height: 10),
                Text(
                  widget.stage!,
                  style: const TextStyle(color: AppColors.gold, fontSize: 11),
                ),
              ],
              const SizedBox(height: 14),
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 300),
                child: Text(
                  _loadingQuips[_quip],
                  key: ValueKey(_quip),
                  style: const TextStyle(color: AppColors.muted, fontSize: 13),
                ),
              ),
              if (_slow) ...[
                const SizedBox(height: 18),
                const Text(
                  '연결이 평소보다 오래 걸리네요…',
                  style: TextStyle(color: AppColors.gold, fontSize: 12),
                ),
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: widget.onLeave,
                  child: const Text('로비로 돌아가기'),
                ),
              ],
            ] else ...[
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32),
                child: Text(
                  error,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.danger),
                ),
              ),
              const SizedBox(height: 12),
              OutlinedButton(onPressed: widget.onLeave, child: const Text('로비로')),
            ],
          ],
        ),
      ),
    );
  }
}
