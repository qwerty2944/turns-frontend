/// Parameters for the in-game WebView route (/game).
class GameRouteArgs {
  const GameRouteArgs({
    required this.game,
    required this.mode, // create | join | spectate
    this.roomId,
    this.roomName,
    this.maxPlayers,
    this.maskNicknames = false,
  });

  final String game;
  final String mode;
  final String? roomId;
  final String? roomName;
  final int? maxPlayers;
  final bool maskNicknames;

  /// Query string for the web /play page (token appended by the page).
  Map<String, String> toQuery(String token) {
    final roomName = this.roomName;
    return {
      'game': game,
      'mode': mode,
      'roomId': ?roomId,
      if (roomName != null && roomName.isNotEmpty) 'name': roomName,
      if (maxPlayers != null) 'max': '$maxPlayers',
      if (maskNicknames) 'mask': '1',
      'tk': token,
    };
  }
}
