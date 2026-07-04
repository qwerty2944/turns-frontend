// Cross-play E2E driver: logs into the real backend, creates a 여의도 대전
// room, then drives the page INSIDE the WebView (via debugController JS)
// while a browser player on the host machine joins the same room.
//
// Run (host must have backend on :2567 and the host script ready):
//   fvm flutter test integration_test/crossplay_test.dart -d <simulator>
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:turns_app/features/game/presentation/game_webview_page.dart';
import 'package:turns_app/main.dart' as app;

const backend = String.fromEnvironment(
  'BACKEND_URL',
  defaultValue: 'http://localhost:2567',
);
const roomName = String.fromEnvironment('ROOM_NAME', defaultValue: 'APP크로스플레이');
const email = String.fromEnvironment('E2E_EMAIL');
const password = String.fromEnvironment('E2E_PASSWORD', defaultValue: 'test1234');

Future<void> pumpFor(WidgetTester tester, Duration d) async {
  final end = DateTime.now().add(d);
  while (DateTime.now().isBefore(end)) {
    await tester.pump(const Duration(milliseconds: 250));
  }
}

Future<int> roomClients() async {
  try {
    final client = HttpClient();
    final req = await client.getUrl(Uri.parse('$backend/rooms'));
    final res = await req.close();
    final body = await res.transform(utf8.decoder).join();
    client.close();
    final rooms = jsonDecode(body) as List<dynamic>;
    for (final r in rooms) {
      if (r['name'] == roomName) return r['clients'] as int;
    }
  } catch (_) {}
  return -1;
}

Future<String?> restLogin() async {
  try {
    final client = HttpClient();
    final req = await client.postUrl(Uri.parse('$backend/auth/login'));
    req.headers.contentType = ContentType.json;
    req.write(jsonEncode({'email': email, 'password': password}));
    final res = await req.close();
    final body = await res.transform(utf8.decoder).join();
    client.close();
    if (res.statusCode != 200) return null;
    return (jsonDecode(body) as Map<String, dynamic>)['token'] as String?;
  } catch (_) {
    return null;
  }
}

Future<dynamic> js(String source) async {
  final c = GameWebViewPage.debugController;
  if (c == null) return null;
  try {
    return await c.evaluateJavascript(source: source);
  } catch (_) {
    return null;
  }
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('create yeouido room and cross-play with a web user',
      (tester) async {
    expect(email, isNotEmpty, reason: 'pass --dart-define=E2E_EMAIL=...');

    // ── obtain a real JWT via REST and seed the persisted session, so the
    // app boots straight into the session-restore path (→ lobby) ──
    final token = await restLogin();
    expect(token, isNotNull, reason: 'REST login failed for $email');
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('turns_token', token!);

    app.main();
    await tester.pump(const Duration(seconds: 2));

    for (var i = 0; i < 60; i++) {
      await tester.pump(const Duration(milliseconds: 500));
      if (find.text('방 만들기').evaluate().isNotEmpty) break;
    }
    if (find.text('방 만들기').evaluate().isEmpty) {
      final texts = find
          .byType(Text)
          .evaluate()
          .map((e) => (e.widget as Text).data ?? '')
          .where((t) => t.isNotEmpty)
          .toList();
      // ignore: avoid_print
      print('E2E visible texts: $texts');
    }
    expect(find.text('방 만들기'), findsOneWidget, reason: 'lobby not reached');

    // ── create room: FAB → sheet → pick 여의도 대전 → 만들기 ──
    await tester.tap(find.text('방 만들기'));
    await pumpFor(tester, const Duration(seconds: 1));
    await tester.tap(find.text('여의도 대전').last);
    await pumpFor(tester, const Duration(milliseconds: 500));
    await tester.enterText(find.byType(TextField).last, roomName);
    await pumpFor(tester, const Duration(milliseconds: 300));
    await tester.tap(find.text('만들기'));

    // ── webview boots, tk bridge auths, Colyseus room created ──
    await pumpFor(tester, const Duration(seconds: 10));
    expect(GameWebViewPage.debugController, isNotNull,
        reason: 'webview not created');

    // wait for the faction lobby to render inside the webview
    var lobbyUp = false;
    for (var i = 0; i < 40; i++) {
      await pumpFor(tester, const Duration(seconds: 1));
      final r = await js(
          "document.body.innerText.includes('후보 등록') ? 'yes' : 'no'");
      if ('$r'.contains('yes')) {
        lobbyUp = true;
        break;
      }
    }
    expect(lobbyUp, isTrue, reason: 'faction lobby did not render in webview');

    // ── wait for the browser player to join (host script) ──
    var joined = false;
    for (var i = 0; i < 90; i++) {
      await pumpFor(tester, const Duration(seconds: 1));
      if (await roomClients() >= 2) {
        joined = true;
        break;
      }
    }
    expect(joined, isTrue, reason: 'web player never joined the room');

    // ── pick 여당 inside the webview ──
    await js("document.querySelector('.yd-faction--ruling')?.click()");
    await pumpFor(tester, const Duration(seconds: 2));

    // ── press 선거 시작 once it enables (browser picked faction + ready) ──
    var started = false;
    for (var i = 0; i < 60; i++) {
      await pumpFor(tester, const Duration(seconds: 1));
      final r = await js("""
        (() => {
          const b = [...document.querySelectorAll('button')]
            .find(x => x.textContent.includes('선거 시작') && !x.disabled);
          if (b) { b.click(); return 'clicked'; }
          return document.body.innerText.includes('내 차례') ||
                 document.querySelector('.yd-board') ? 'playing' : 'waiting';
        })()
      """);
      final s = '$r';
      if (s.contains('clicked') || s.contains('playing')) {
        started = true;
        break;
      }
    }
    expect(started, isTrue, reason: 'match never started');

    // ── keep the app alive while the browser plays, until victory overlay ──
    var ended = false;
    for (var i = 0; i < 420; i++) {
      await pumpFor(tester, const Duration(seconds: 1));
      final r = await js(
          "document.querySelector('.yd-victory') ? 'end' : 'run'");
      if ('$r'.contains('end')) {
        ended = true;
        break;
      }
    }
    expect(ended, isTrue, reason: 'victory overlay never appeared in webview');

    // hold for the host to take a final screenshot
    await pumpFor(tester, const Duration(seconds: 6));
  }, timeout: const Timeout(Duration(minutes: 15)));
}
