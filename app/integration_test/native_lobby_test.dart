// Diagnostic: create a yeouido room against the PROD backend and assert the
// NATIVE lobby appears (turnsState bridge). Console/bridge logs go to the
// flutter test output.
//   fvm flutter test integration_test/native_lobby_test.dart -d <sim> \
//     --dart-define=BACKEND_URL=https://... --dart-define=E2E_EMAIL=...
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:turns_app/features/game/presentation/game_webview_page.dart';
import 'package:turns_app/main.dart' as app;

const backend = String.fromEnvironment(
  'BACKEND_URL',
  defaultValue: 'http://localhost:2567',
);
const email = String.fromEnvironment('E2E_EMAIL');
const password = String.fromEnvironment('E2E_PASSWORD', defaultValue: 'test1234');

Future<void> pumpFor(WidgetTester tester, Duration d) async {
  final end = DateTime.now().add(d);
  while (DateTime.now().isBefore(end)) {
    await tester.pump(const Duration(milliseconds: 250));
  }
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

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('native lobby appears after creating a room', (tester) async {
    final token = await restLogin();
    expect(token, isNotNull, reason: 'REST login failed against $backend');
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('turns_token', token!);

    app.main();
    for (var i = 0; i < 60; i++) {
      await tester.pump(const Duration(milliseconds: 500));
      if (find.text('방 만들기').evaluate().isNotEmpty) break;
    }
    expect(find.text('방 만들기'), findsOneWidget, reason: 'lobby not reached');

    await tester.tap(find.text('방 만들기'));
    await pumpFor(tester, const Duration(seconds: 1));
    await tester.tap(find.text('여의도 대전').last);
    await pumpFor(tester, const Duration(milliseconds: 400));
    await tester.tap(find.text('만들기'));

    // Wait for the NATIVE faction lobby (bridge round-trip).
    var seen = false;
    for (var i = 0; i < 50; i++) {
      await pumpFor(tester, const Duration(seconds: 1));
      if (find.textContaining('후보 등록').evaluate().isNotEmpty) {
        seen = true;
        break;
      }
      if (i % 5 == 4) {
        final c = GameWebViewPage.debugController;
        final probe = c == null
            ? 'controller-null'
            : await c.evaluateJavascript(source: """
                JSON.stringify({
                  ready: typeof window.flutter_inappwebview !== 'undefined',
                  cmd: typeof window.__turnsApp !== 'undefined',
                  body: document.body ? document.body.innerText.slice(0, 120) : 'no-body',
                })
              """);
        // ignore: avoid_print
        print('[probe t=$i] $probe');
      }
    }
    expect(seen, isTrue, reason: 'native faction lobby never appeared');
  }, timeout: const Timeout(Duration(minutes: 5)));
}
