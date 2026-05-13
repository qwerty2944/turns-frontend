import { useQuery } from "@tanstack/react-query";
import { roomsApi } from "@/entities/room/api/rooms";

export const roomsQueryKey = (gameId?: string) =>
  ["rooms", gameId ?? "all"] as const;

export const useRoomsQuery = (gameId?: string) =>
  useQuery({
    queryKey: roomsQueryKey(gameId),
    queryFn: () => roomsApi.list(gameId),
    refetchInterval: 3000,
  });
