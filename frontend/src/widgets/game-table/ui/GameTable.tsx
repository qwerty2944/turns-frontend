"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getGame } from "@/entities/game/model/registry";
import { authApi } from "@/entities/user/api/auth";
import { useAuthStore } from "@/entities/user/model/authStore";
import { storage } from "@/shared/lib/storage";
import { FullPageSpinner } from "@/shared/ui/Spinner";

export const GameTable = () => {
  const router = useRouter();
  const sp = useSearchParams();
  const hydrated = useAuthStore((s) => s.hydrated);
  const token = useAuthStore((s) => s.token);
  const hydrate = useAuthStore((s) => s.hydrate);
  const setSession = useAuthStore((s) => s.setSession);

  // Mobile-app bridge: the Flutter shell opens this page inside a WebView
  // with the JWT as ?tk=… (target is the app's own 127.0.0.1 server, so the
  // URL never leaves the device). Seed localStorage + fetch the user, then
  // proceed exactly like a normal web session.
  const bridgeToken = sp.get("tk");
  const [bridging, setBridging] = useState(!!bridgeToken);
  useEffect(() => {
    if (!bridgeToken) return;
    let active = true;
    storage.setToken(bridgeToken);
    hydrate();
    authApi
      .me()
      .then((user) => {
        if (!active) return;
        setSession(bridgeToken, user);
        setBridging(false);
      })
      .catch(() => {
        if (!active) return;
        storage.clear();
        hydrate();
        setBridging(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridgeToken]);

  useEffect(() => {
    if (hydrated && !token && !bridging) router.replace("/login");
  }, [hydrated, token, bridging, router]);

  if (!hydrated || bridging) {
    return <FullPageSpinner label="불러오는 중…" />;
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

  const rawMode = sp.get("mode");
  const asSpectator = rawMode === "spectate";
  // Colyseus-side mode: spectate piggybacks on the "join" path (existing room).
  const mode: "create" | "join" =
    rawMode === "create" ? "create" : "join";
  const roomId = sp.get("roomId") || undefined;
  const roomName = sp.get("name") || undefined;
  const maxPlayers = Number(sp.get("max")) || undefined;
  const maskNicknames = sp.get("mask") === "1";
  const Table = game.Table;

  return (
    <Table
      mode={mode}
      roomId={roomId}
      roomName={roomName}
      maxPlayers={maxPlayers}
      asSpectator={asSpectator}
      maskNicknames={maskNicknames}
    />
  );
};
