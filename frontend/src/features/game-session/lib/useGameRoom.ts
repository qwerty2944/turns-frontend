"use client";

import { useEffect, useRef, useState } from "react";
import type { Room } from "@colyseus/sdk";
import { createColyseusClient } from "@/shared/lib/colyseus";
import { useAuthStore } from "@/entities/user/model/authStore";

type Options = {
  roomName: string;          // colyseus room name (e.g. "love_letter")
  mode: "create" | "join";
  roomId?: string;
  displayName?: string;
  maxPlayers?: number;
  asSpectator?: boolean;
};

export type GameRoomStatus =
  | { kind: "idle" }
  | { kind: "connecting" }
  | { kind: "connected" }
  | { kind: "error"; error: string }
  | { kind: "closed" };

/** Establishes a Colyseus connection for the current user/auth. */
export const useGameRoom = (options: Options) => {
  const token = useAuthStore((s) => s.token);
  const [room, setRoom] = useState<Room | null>(null);
  const [status, setStatus] = useState<GameRoomStatus>({ kind: "idle" });
  const optsRef = useRef(options);
  optsRef.current = options;

  useEffect(() => {
    if (!token) return;
    let active = true;
    let r: Room | null = null;
    const connect = async () => {
      setStatus({ kind: "connecting" });
      try {
        const client = createColyseusClient();
        const o = optsRef.current;
        const joinOpts = {
          token,
          roomName: o.displayName,
          maxPlayers: o.maxPlayers,
          ...(o.asSpectator ? { spectator: true } : {}),
        };
        if (o.mode === "create") {
          r = await client.create(o.roomName, joinOpts);
        } else if (o.roomId) {
          r = await client.joinById(o.roomId, joinOpts);
        } else {
          r = await client.joinOrCreate(o.roomName, joinOpts);
        }
        if (!active) {
          await r.leave();
          return;
        }
        setRoom(r);
        setStatus({ kind: "connected" });
        r.onLeave(() => active && setStatus({ kind: "closed" }));
        r.onError((_code, message) =>
          active && setStatus({ kind: "error", error: message || "오류" }),
        );
      } catch (e) {
        if (!active) return;
        setStatus({
          kind: "error",
          error: e instanceof Error ? e.message : "연결 실패",
        });
      }
    };
    connect();
    return () => {
      active = false;
      if (r) r.leave(true).catch(() => {});
    };
  }, [token]);

  // Make sure browser close / tab close sends a consented leave so the
  // server can dispose empty rooms immediately instead of waiting for
  // the reconnection window or ping timeout.
  useEffect(() => {
    if (!room) return;
    const handler = () => {
      try {
        room.leave(true);
      } catch {}
    };
    window.addEventListener("beforeunload", handler);
    window.addEventListener("pagehide", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      window.removeEventListener("pagehide", handler);
    };
  }, [room]);

  return { room, status };
};
