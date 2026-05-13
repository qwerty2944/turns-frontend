"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GAME_REGISTRY } from "@/entities/game/model/registry";
import { useAuthStore } from "@/entities/user/model/authStore";
import type { RoomInfo } from "@/entities/room/api/rooms";
import { CreateRoomForm } from "@/features/rooms/create-room/ui/CreateRoomForm";
import { RoomList } from "@/features/rooms/list-rooms/ui/RoomList";
import { LogoutButton } from "@/features/auth/logout/ui/LogoutButton";

export const Lobby = () => {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [selectedId, setSelectedId] = useState(GAME_REGISTRY[0].id);
  const game = GAME_REGISTRY.find((g) => g.id === selectedId) ?? GAME_REGISTRY[0];

  const onJoin = (room: RoomInfo) => {
    const params = new URLSearchParams({
      mode: "join",
      game: room.game,
      roomId: room.roomId,
    });
    router.push(`/play?${params.toString()}`);
  };

  return (
    <div className="container-wide">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
        <h1 className="title" style={{ margin: 0 }}>로비</h1>
        <div className="row">
          <span className="muted">{user?.nickname}</span>
          <LogoutButton />
        </div>
      </div>

      <div className="panel col" style={{ marginBottom: 16 }}>
        <h2 className="title" style={{ margin: 0, fontSize: "1.2rem" }}>게임 선택</h2>
        <div className="row" style={{ flexWrap: "wrap" }}>
          {GAME_REGISTRY.map((g) => (
            <button
              key={g.id}
              onClick={() => setSelectedId(g.id)}
              disabled={!g.available}
              style={{
                borderColor: selectedId === g.id ? "var(--gold-soft)" : undefined,
                boxShadow: selectedId === g.id ? "0 0 0 1px var(--gold-soft)" : undefined,
              }}
            >
              {g.displayName} {!g.available && "(준비중)"}
            </button>
          ))}
        </div>
        <p className="muted" style={{ margin: 0 }}>{game.description}</p>
      </div>

      <div style={{ marginBottom: 16 }}>
        <CreateRoomForm game={game} />
      </div>

      <RoomList gameId={game.id} onJoin={onJoin} />
    </div>
  );
};
