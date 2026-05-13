import type { ComponentType } from "react";

export type GameTableProps = {
  roomId?: string;
  mode: "create" | "join";
  roomName?: string;
  maxPlayers?: number;
  asSpectator?: boolean;
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
  Table: ComponentType<GameTableProps>;
};
