"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { GAME_REGISTRY } from "@/entities/game/model/registry";
import { useAuthStore } from "@/entities/user/model/authStore";
import type { RoomInfo } from "@/entities/room/api/rooms";
import { CreateRoomForm } from "@/features/rooms/create-room/ui/CreateRoomForm";
import { RoomList } from "@/features/rooms/list-rooms/ui/RoomList";
import { LogoutButton } from "@/features/auth/logout/ui/LogoutButton";
import { ThemeSwitcher } from "@/features/theme-switcher/ui/ThemeSwitcher";

export const Lobby = () => {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const onJoin = (room: RoomInfo) => {
    const params = new URLSearchParams({
      mode: "join",
      game: room.game,
      roomId: room.roomId,
    });
    router.push(`/play?${params.toString()}`);
  };

  const onSpectate = (room: RoomInfo) => {
    const params = new URLSearchParams({
      mode: "spectate",
      game: room.game,
      roomId: room.roomId,
    });
    router.push(`/play?${params.toString()}`);
  };

  return (
    <div className="container-wide">
      <div
        className="row row-wrap"
        style={{ justifyContent: "space-between", marginBottom: 16, gap: 12 }}
      >
        <h1 className="title" style={{ margin: 0 }}>로비</h1>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <ThemeSwitcher compact />
          <Link
            href="/account"
            className="muted"
            style={{
              textDecoration: "underline",
              maxWidth: 140,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {user?.nickname}
          </Link>
          <LogoutButton />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <CreateRoomForm games={GAME_REGISTRY} />
      </div>

      <RoomList onJoin={onJoin} onSpectate={onSpectate} />
    </div>
  );
};
