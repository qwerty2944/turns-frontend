// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'web_bundle_service.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(webBundleService)
final webBundleServiceProvider = WebBundleServiceProvider._();

final class WebBundleServiceProvider
    extends
        $FunctionalProvider<
          WebBundleService,
          WebBundleService,
          WebBundleService
        >
    with $Provider<WebBundleService> {
  WebBundleServiceProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'webBundleServiceProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$webBundleServiceHash();

  @$internal
  @override
  $ProviderElement<WebBundleService> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  WebBundleService create(Ref ref) {
    return webBundleService(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(WebBundleService value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<WebBundleService>(value),
    );
  }
}

String _$webBundleServiceHash() => r'9eb34f8f148a808af3abce84334860412f8b17f2';
