import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../features/auth/presentation/auth_notifier.dart';
import '../../features/auth/presentation/login_page.dart';
import '../../features/auth/presentation/signup_page.dart';
import '../../features/game/presentation/game_route_args.dart';
import '../../features/game/presentation/game_webview_page.dart';
import '../../features/lobby/presentation/lobby_page.dart';
import '../theme/app_theme.dart';

part 'app_router.g.dart';

@Riverpod(keepAlive: true)
GoRouter appRouter(Ref ref) {
  // Rebuild redirects when auth state changes.
  final listenable = ValueNotifier(0);
  ref.listen(authProvider, (_, _) => listenable.value++);
  ref.onDispose(listenable.dispose);

  return GoRouter(
    initialLocation: '/lobby',
    refreshListenable: listenable,
    redirect: (context, state) {
      final auth = ref.read(authProvider);
      final atAuthPage = state.matchedLocation == '/login' ||
          state.matchedLocation == '/signup';
      return switch (auth) {
        AuthRestoring() => '/splash',
        AuthUnauthenticated() => atAuthPage ? null : '/login',
        AuthAuthenticated() =>
          (atAuthPage || state.matchedLocation == '/splash') ? '/lobby' : null,
      };
    },
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const _SplashPage(),
      ),
      GoRoute(path: '/login', builder: (context, state) => const LoginPage()),
      GoRoute(
          path: '/signup', builder: (context, state) => const SignupPage()),
      GoRoute(path: '/lobby', builder: (context, state) => const LobbyPage()),
      GoRoute(
        path: '/game',
        builder: (context, state) {
          final args = state.extra;
          if (args is! GameRouteArgs) {
            return const LobbyPage();
          }
          return GameWebViewPage(args: args);
        },
      ),
    ],
  );
}

class _SplashPage extends StatelessWidget {
  const _SplashPage();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              '턴즈',
              style: TextStyle(
                fontSize: 40,
                fontWeight: FontWeight.w800,
                color: AppColors.accent,
              ),
            ),
            SizedBox(height: 24),
            CircularProgressIndicator(color: AppColors.accent),
          ],
        ),
      ),
    );
  }
}
