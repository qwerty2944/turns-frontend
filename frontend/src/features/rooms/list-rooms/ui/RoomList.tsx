"use client";

import { useRoomsQuery } from "../api";
import { getGame } from "@/entities/game/model/registry";
import type { RoomInfo } from "@/entities/room/api/rooms";
import { extractApiError } from "@/shared/api/axios";
import { Spinner } from "@/shared/ui/Spinner";

type Props = {
  onJoin: (room: RoomInfo) => void;
  onSpectate: (room: RoomInfo) => void;
};

export const RoomList = ({ onJoin, onSpectate }: Props) => {
  const { data, error, refetch, isFetching } = useRoomsQuery();
  const rooms = data ?? [];

  return (
    <div className="panel col">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 className="title" style={{ margin: 0, fontSize: "1.2rem" }}>방 목록</h2>
        <button onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Spinner size={14} label="새로고침" /> : "새로고침"}
        </button>
      </div>
      {error && <div className="error">{extractApiError(error)}</div>}
      {rooms.length === 0 ? (
        <p className="muted">아직 열린 방이 없습니다.</p>
      ) : (
        <div className="col" style={{ gap: 8 }}>
          {rooms.map((r) => {
            const g = getGame(r.game);
            const fullOrLocked = r.locked || r.clients >= r.maxClients;
            const spectators = r.spectators ?? 0;
            return (
              <div
                key={r.roomId}
                className="row row-wrap"
                style={{
                  justifyContent: "space-between",
                  padding: "0.6rem 0.8rem",
                  border: "1px solid var(--panel-border)",
                  borderRadius: "var(--radius)",
                  gap: 8,
                }}
              >
                <div className="col" style={{ gap: 2, minWidth: 0, flex: "1 1 0" }}>
                  <strong
                    style={{
                      color: "var(--accent)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.name}
                  </strong>
                  <span className="muted" style={{ fontSize: 13 }}>
                    {g?.displayName ?? r.game} · {r.clients}/{r.maxClients}명
                    {spectators > 0 && ` · 👁 ${spectators}`}
                    {r.locked && " · 시작됨"}
                  </span>
                </div>
                <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                  <button
                    disabled={fullOrLocked}
                    onClick={() => onJoin(r)}
                    title={fullOrLocked ? "입장 불가" : "플레이어로 입장"}
                  >
                    입장
                  </button>
                  <button
                    onClick={() => onSpectate(r)}
                    title="관전자로 입장 (잠긴 방/만석도 가능)"
                  >
                    👁 관전
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
