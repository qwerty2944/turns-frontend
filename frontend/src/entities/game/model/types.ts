import type { ComponentType } from "react";
import type Phaser from "phaser";

export type GameSessionContext = {
  /** Phaser game instance for this session, if any. */
  scene?: Phaser.Scene;
};

export type GameManifest = {
  id: string;             // matches backend room name
  roomName: string;
  displayName: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  available: boolean;
  /** React component that renders the table for this game session. */
  Table: ComponentType<{ roomId?: string; mode: "create" | "join"; roomName?: string; maxPlayers?: number }>;
};
