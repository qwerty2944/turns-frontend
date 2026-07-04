/// Game registry — mirrors frontend/src/entities/game/model/registry.ts.
/// All games run inside the in-game WebView, so everything is playable.
class GameMeta {
  const GameMeta({
    required this.id,
    required this.displayName,
    required this.description,
    required this.minPlayers,
    required this.maxPlayers,
    required this.emoji,
  });

  final String id;
  final String displayName;
  final String description;
  final int minPlayers;
  final int maxPlayers;
  final String emoji;
}

const games = <GameMeta>[
  GameMeta(
    id: 'love_letter',
    displayName: '러브레터',
    description: '16장의 카드, 마지막까지 살아남거나 가장 큰 카드를 든 자가 공주의 마음을 얻는다.',
    minPlayers: 2,
    maxPlayers: 4,
    emoji: '💌',
  ),
  GameMeta(
    id: 'yeouido',
    displayName: '여의도 대전',
    description: '대한민국 정치 풍자 카드 배틀. 상대 후보의 지지율을 0으로 만들어 당선되세요.',
    minPlayers: 2,
    maxPlayers: 2,
    emoji: '🏛️',
  ),
  GameMeta(
    id: 'mafia',
    displayName: '타뷸라의 늑대',
    description: '어둠 속 늑대를 색출하라. 매 밤 누군가 사라지고, 낮의 투표로 처형이 결정된다.',
    minPlayers: 4,
    maxPlayers: 10,
    emoji: '🐺',
  ),
  GameMeta(
    id: 'tetris',
    displayName: '테트리스 배틀',
    description: '줄을 지워 상대를 공격하는 실시간 대전 테트리스.',
    minPlayers: 1,
    maxPlayers: 4,
    emoji: '🧱',
  ),
  GameMeta(
    id: 'multitask',
    displayName: '멀티태스크',
    description: '세 가지 미니게임을 동시에! 마지막까지 버티는 자가 승리.',
    minPlayers: 1,
    maxPlayers: 6,
    emoji: '🤹',
  ),
];

GameMeta? gameById(String id) {
  for (final g in games) {
    if (g.id == id) return g;
  }
  return null;
}
