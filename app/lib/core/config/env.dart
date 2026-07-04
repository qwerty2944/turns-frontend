/// Backend endpoints. Override for local dev:
///   fvm flutter run --dart-define=BACKEND_URL=http://192.168.0.10:2567
abstract final class Env {
  static const backendUrl = String.fromEnvironment(
    'BACKEND_URL',
    defaultValue: 'https://kr-icn-41b6e883.colyseus.cloud',
  );

  /// Fixed port for the bundled-web local server — the WebView origin
  /// (http://127.0.0.1:8123) must stay stable so localStorage persists.
  static const webBundlePort = 8123;
}
