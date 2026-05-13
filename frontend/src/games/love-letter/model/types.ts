// Shape of the LoveLetter Colyseus room state as serialized for the client.
export type PlayerView = {
  sessionId: string;
  userId: number;
  nickname: string;
  connected: boolean;
  ready: boolean;
  hand: number[];
  discard: number[];
  protected: boolean;
  eliminated: boolean;
  tokens: number;
};

export type LogEntryView = { ts: number; text: string };

export type RoomStateView = {
  hostSessionId: string;
  roomName: string;
  phase: "lobby" | "playing" | "roundEnd" | "gameEnd";
  maxPlayers: number;
  tokensToWin: number;
  turnOrder: string[];
  turnIndex: number;
  deckRemaining: number;
  publicDiscard: number[];
  lastWinnerId: string;
  roundWinnerId: string;
  gameWinnerId: string;
  players: Record<string, PlayerView>;
  log: LogEntryView[];
};
