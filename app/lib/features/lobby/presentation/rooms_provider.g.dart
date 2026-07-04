// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'rooms_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
/// Room list with 4s auto-refresh while watched (matches the web lobby).

@ProviderFor(Rooms)
final roomsProvider = RoomsProvider._();

/// Room list with 4s auto-refresh while watched (matches the web lobby).
final class RoomsProvider extends $AsyncNotifierProvider<Rooms, List<Room>> {
  /// Room list with 4s auto-refresh while watched (matches the web lobby).
  RoomsProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'roomsProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$roomsHash();

  @$internal
  @override
  Rooms create() => Rooms();
}

String _$roomsHash() => r'1c1dcecad6a3e505cc3864df4b2a8f7d598caea6';

/// Room list with 4s auto-refresh while watched (matches the web lobby).

abstract class _$Rooms extends $AsyncNotifier<List<Room>> {
  FutureOr<List<Room>> build();
  @$mustCallSuper
  @override
  WhenComplete runBuild() {
    final ref = this.ref as $Ref<AsyncValue<List<Room>>, List<Room>>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<AsyncValue<List<Room>>, List<Room>>,
              AsyncValue<List<Room>>,
              Object?,
              Object?
            >;
    return element.handleCreate(ref, build);
  }
}
