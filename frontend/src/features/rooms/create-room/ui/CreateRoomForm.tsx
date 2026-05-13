"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { GameManifest } from "@/entities/game/model/types";
import { useAuthStore } from "@/entities/user/model/authStore";

type Props = { game: GameManifest };

export const CreateRoomForm = ({ game }: Props) => {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [roomName, setRoomName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(game.maxPlayers);

  const onCreate = () => {
    const params = new URLSearchParams({
      mode: "create",
      game: game.id,
      name: roomName || `${user?.nickname ?? "Player"}의 방`,
      max: String(maxPlayers),
    });
    router.push(`/play?${params.toString()}`);
  };

  const playerCounts: number[] = [];
  for (let n = game.minPlayers; n <= game.maxPlayers; n++) playerCounts.push(n);

  return (
    <div className="panel col">
      <h2 className="title" style={{ margin: 0, fontSize: "1.2rem" }}>방 만들기</h2>
      <div className="row" style={{ flexWrap: "wrap" }}>
        <input
          placeholder="방 이름"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          maxLength={24}
          style={{ flex: "1 1 240px" }}
        />
        <label className="row muted" style={{ gap: 6 }}>
          인원
          <select
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(Number(e.target.value))}
            style={{
              background: "rgba(13,10,31,0.6)",
              border: "1px solid rgba(217,182,108,0.4)",
              color: "var(--text)",
              padding: "0.4rem",
              borderRadius: 6,
            }}
          >
            {playerCounts.map((n) => (
              <option key={n} value={n}>{n}명</option>
            ))}
          </select>
        </label>
        <button onClick={onCreate}>만들기</button>
      </div>
    </div>
  );
};
