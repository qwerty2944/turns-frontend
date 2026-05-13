import { apiClient } from "@/shared/api/axios";

export type RoomInfo = {
  roomId: string;
  name: string;
  game: string;
  clients: number;
  maxClients: number;
  locked: boolean;
  spectators?: number;
};

export const roomsApi = {
  list: (gameId?: string) =>
    apiClient
      .get<RoomInfo[]>("/rooms", { params: gameId ? { game: gameId } : undefined })
      .then((r) => r.data),
};
