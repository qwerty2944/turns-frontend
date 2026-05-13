"use client";

import { useRoomsQuery } from "../api";
import type { RoomInfo } from "@/entities/room/api/rooms";
import { extractApiError } from "@/shared/api/axios";

type Props = {
  gameId: string;
  onJoin: (room: RoomInfo) => void;
};

export const RoomList = ({ gameId, onJoin }: Props) => {
  const { data, error, refetch, isFetching } = useRoomsQuery(gameId);
  const rooms = data ?? [];

  return (
    <div className="panel col">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 className="title" style={{ margin: 0, fontSize: "1.2rem" }}>방 목록</h2>
        <button onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? "새로고침 중…" : "새로고침"}
        </button>
      </div>
      {error && <div className="error">{extractApiError(error)}</div>}
      {rooms.length === 0 ? (
        <p className="muted">아직 열린 방이 없습니다.</p>
      ) : (
        <div className="col" style={{ gap: 8 }}>
          {rooms.map((r) => (
            <div
              key={r.roomId}
              className="row"
              style={{
                justifyContent: "space-between",
                padding: "0.6rem 0.8rem",
                border: "1px solid rgba(217,182,108,0.25)",
                borderRadius: 8,
              }}
            >
              <div className="col" style={{ gap: 2 }}>
                <strong style={{ color: "var(--gold-soft)" }}>{r.name}</strong>
                <span className="muted">
                  {r.clients}/{r.maxClients}명 {r.locked && "· 시작됨"}
                </span>
              </div>
              <button
                disabled={r.locked || r.clients >= r.maxClients}
                onClick={() => onJoin(r)}
              >
                입장
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
