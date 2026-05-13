"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { getGame } from "@/entities/game/model/registry";
import { useAuthStore } from "@/entities/user/model/authStore";

export const GameTable = () => {
  const router = useRouter();
  const sp = useSearchParams();
  const hydrated = useAuthStore((s) => s.hydrated);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (hydrated && !token) router.replace("/login");
  }, [hydrated, token, router]);

  if (!hydrated) {
    return (
      <div className="play-shell">
        <div className="panel"><p className="muted">불러오는 중…</p></div>
      </div>
    );
  }

  const gameId = sp.get("game") || "love_letter";
  const game = getGame(gameId);
  if (!game) {
    return (
      <div className="play-shell">
        <div className="panel">
          <p className="error">알 수 없는 게임: {gameId}</p>
        </div>
      </div>
    );
  }

  const mode = (sp.get("mode") as "create" | "join") || "join";
  const roomId = sp.get("roomId") || undefined;
  const roomName = sp.get("name") || undefined;
  const maxPlayers = Number(sp.get("max")) || undefined;
  const Table = game.Table;

  return (
    <Table
      mode={mode}
      roomId={roomId}
      roomName={roomName}
      maxPlayers={maxPlayers}
    />
  );
};
