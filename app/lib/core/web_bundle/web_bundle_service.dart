import 'dart:io';

import 'package:archive/archive_io.dart';
import 'package:flutter/services.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:path_provider/path_provider.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:shelf/shelf_io.dart' as shelf_io;
import 'package:shelf_static/shelf_static.dart';

import '../config/env.dart';

part 'web_bundle_service.g.dart';

/// Extracts the bundled Next.js static export (assets/web.zip) into app
/// support storage and serves it on http://127.0.0.1:8123 so the in-game
/// WebView loads the same client web users get — same Colyseus server,
/// same rooms, cross-play for free.
class WebBundleService {
  HttpServer? _server;

  String get origin => 'http://127.0.0.1:${Env.webBundlePort}';

  Future<void> ensureStarted() async {
    if (_server != null) return;

    final dir = await _ensureExtracted();
    final handler = createStaticHandler(
      dir.path,
      defaultDocument: 'index.html',
    );
    _server = await shelf_io.serve(
      handler,
      InternetAddress.loopbackIPv4,
      Env.webBundlePort,
      shared: true,
    );
  }

  Future<Directory> _ensureExtracted() async {
    final support = await getApplicationSupportDirectory();
    final info = await PackageInfo.fromPlatform();
    final version = '${info.version}+${info.buildNumber}';
    final root = Directory('${support.path}/web/$version');
    final marker = File('${root.path}/.complete');

    if (marker.existsSync()) return root;

    // Wipe older bundle versions.
    final parent = Directory('${support.path}/web');
    if (parent.existsSync()) parent.deleteSync(recursive: true);
    root.createSync(recursive: true);

    final bytes = await rootBundle.load('assets/web.zip');
    final archive = ZipDecoder().decodeBytes(bytes.buffer.asUint8List());
    await extractArchiveToDisk(archive, root.path);

    marker.writeAsStringSync('ok');
    return root;
  }

  Future<void> dispose() async {
    await _server?.close(force: true);
    _server = null;
  }
}

@Riverpod(keepAlive: true)
WebBundleService webBundleService(Ref ref) {
  final service = WebBundleService();
  ref.onDispose(service.dispose);
  return service;
}
