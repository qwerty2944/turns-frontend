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

/// In-game screen: the bundled web client (Next.js static export, Phaser and
/// all) served from 127.0.0.1 inside an InAppWebView. Same Colyseus server as
/// web users → cross-play.
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

  Future<bool> _confirmLeave() async {
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
                  },
                  onLoadStop: (controller, url) {
                    if (mounted) setState(() => _pageLoaded = true);
                  },
                ),
              if (!_pageLoaded)
                Container(
                  color: AppColors.bg,
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(meta?.emoji ?? '🎲',
                            style: const TextStyle(fontSize: 52)),
                        const SizedBox(height: 16),
                        Text(
                          meta?.displayName ?? widget.args.game,
                          style: const TextStyle(
                            color: AppColors.accent,
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 20),
                        if (_error == null)
                          const CircularProgressIndicator(
                              color: AppColors.accent)
                        else ...[
                          Padding(
                            padding:
                                const EdgeInsets.symmetric(horizontal: 32),
                            child: Text(
                              _error!,
                              textAlign: TextAlign.center,
                              style:
                                  const TextStyle(color: AppColors.danger),
                            ),
                          ),
                          const SizedBox(height: 12),
                          OutlinedButton(
                            onPressed: () => context.pop(),
                            child: const Text('로비로'),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              // 상단 우측 나가기 버튼 (웹뷰 로드 후에도 항상 접근 가능)
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
