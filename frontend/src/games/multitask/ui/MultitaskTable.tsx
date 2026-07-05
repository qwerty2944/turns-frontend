"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { Room } from "@colyseus/sdk";
import { useGameRoom } from "@/features/game-session/lib/useGameRoom";
import { exitGameToApp } from "@/shared/lib/appBridge";
import { useAppLobby } from "@/shared/lib/useAppLobby";
import { useAuthStore } from "@/entities/user/model/authStore";
import type { PlayerView } from "../scene/PlayerBoardScene";

const PlayerBoardView = dynamic(
  () => import("./PlayerBoardView").then((m) => m.PlayerBoardView),
  { ssr: false },
);

type Props = {
  mode: "create" | "join";
  roomId?: string;
  roomName?: string;
  maxPlayers?: number;
  asSpectator?: boolean;
  maskNicknames?: boolean;
};

type StateSnap = {
  hostSessionId: string;
  roomName: string;
  phase: string;
  maxPlayers: number;
  startedAt: number;
  endsAt: number;
  difficulty: number;
  serverNow: number;
  winnerSessionId: string;
  winnerNickname: string;
  players: Record<string, any>;
  log: any[];
};

const toSnap = (s: any): StateSnap => {
  const players: Record<string, any> = {};
  if (s.players?.forEach) {
    s.players.forEach((p: any, k: string) => {
      players[k] = playerToObj(p);
    });
  }
  return {
    hostSessionId: s.hostSessionId ?? "",
    roomName: s.roomName ?? "",
    phase: s.phase ?? "lobby",
    maxPlayers: s.maxPlayers ?? 8,
    startedAt: s.startedAt ?? 0,
    endsAt: s.endsAt ?? 0,
    difficulty: s.difficulty ?? 1,
    serverNow: s.serverNow ?? 0,
    winnerSessionId: s.winnerSessionId ?? "",
    winnerNickname: s.winnerNickname ?? "",
    players,
    log: (s.log ?? []).map?.((e: any) => ({
      ts: e.ts,
      kind: e.kind,
      text: e.text,
      actor: e.actor,
    })) ?? [],
  };
};

const playerToObj = (p: any) => ({
  sessionId: p.sessionId,
  userId: p.userId,
  nickname: p.nickname,
  connected: p.connected,
  ready: p.ready,
  alive: p.alive,
  hearts: p.hearts,
  score: p.score,
  tapMisses: p.tapMisses,
  lastDamageAt: p.lastDamageAt,
  deathAt: p.deathAt,
  holdPos: p.holdPos,
  holdZoneStart: p.holdZoneStart,
  holdZoneEnd: p.holdZoneEnd,
  holdCycleId: p.holdCycleId,
  dodgeCol: p.dodgeCol,
  tapTargets: (p.tapTargets ?? []).map?.((t: any) => ({
    id: t.id,
    cell: t.cell,
    spawnedAt: t.spawnedAt,
    expiresAt: t.expiresAt,
  })) ?? [],
  dodgeBlocks: (p.dodgeBlocks ?? []).map?.((b: any) => ({
    id: b.id,
    col: b.col,
    y: b.y,
    speed: b.speed,
    spawnedAt: b.spawnedAt,
  })) ?? [],
});

const useViewportIsMobile = () => {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 640px)").matches;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 640px)");
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isMobile;
};

const useNowTick = (intervalMs: number) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
};

export const MultitaskTable = (props: Props) => {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const asSpectator = !!props.asSpectator;

  const { room, status } = useGameRoom({
    roomName: "multitask",
    mode: props.mode,
    roomId: props.roomId,
    displayName: props.roomName,
    maxPlayers: props.maxPlayers,
    asSpectator,
    maskNicknames: props.maskNicknames,
  });

  const [stateSnap, setStateSnap] = useState<StateSnap | null>(null);
  const offsetRef = useRef<number>(0); // serverNow - clientNow
  const isMobile = useViewportIsMobile();
  const now = useNowTick(33); // ~30Hz UI tick for countdown + scene updates

  useEffect(() => {
    if (!room) return;
    const r = room as Room;
    const onChange = () => {
      const snap = toSnap(r.state);
      setStateSnap(snap);
      if (snap.serverNow > 0) {
        offsetRef.current = snap.serverNow - Date.now();
      }
    };
    r.onStateChange(onChange);
    onChange();
  }, [room]);

  const players = useMemo(
    () => (stateSnap ? Object.values(stateSnap.players) : []),
    [stateSnap],
  );
  const meSid = room?.sessionId;
  const me = players.find((p: any) => p.sessionId === meSid);
  const isHost = stateSnap?.hostSessionId === meSid;
  // ─── Flutter 앱 네이티브 대기실 브릿지 (게임 시작 전 로비는 앱 UI가 담당) ───
  const appLobbySnap = useMemo(
    () =>
      stateSnap
        ? {
            game: "multitask",
            phase: stateSnap.phase ?? "lobby",
            meSid: room?.sessionId ?? "",
            hostSid: stateSnap.hostSessionId ?? "",
            players: Object.values(stateSnap.players ?? {}).map((p: any) => ({
              sid: p.sessionId,
              nickname: p.nickname,
              ready: !!p.ready,
              connected: p.connected !== false,
            })),
            log: (stateSnap.log ?? []).slice(-40).map((e: any) => ({
              ts: e.ts ?? 0,
              kind: e.kind ?? "info",
              text: e.text ?? "",
              actor: e.actor ?? "",
            })),
          }
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stateSnap, room],
  );
  useAppLobby(room as any, appLobbySnap);

  const phase = stateSnap?.phase ?? "lobby";
  const serverNowEst = now + offsetRef.current;

  const difficulty = stateSnap?.difficulty ?? 1;
  const playerViews: PlayerView[] = useMemo(() => {
    return players.map((p: any) => ({
      sessionId: p.sessionId,
      nickname: p.nickname,
      alive: !!p.alive,
      hearts: p.hearts ?? 0,
      score: p.score ?? 0,
      holdPos: p.holdPos ?? 0,
      holdZoneStart: p.holdZoneStart ?? 0,
      holdZoneEnd: p.holdZoneEnd ?? 0,
      holdCycleId: p.holdCycleId ?? 0,
      tapTargets: p.tapTargets ?? [],
      dodgeCol: p.dodgeCol ?? 1,
      dodgeBlocks: p.dodgeBlocks ?? [],
      lastDamageAt: p.lastDamageAt ?? 0,
      serverNowEst,
      difficulty,
    }));
  }, [players, serverNowEst, difficulty]);

  const leave = () => {
    room?.leave().catch(() => {});
    if (!exitGameToApp()) router.push("/lobby");
  };

  const sendHold = () => {
    if (asSpectator) return;
    room?.send("input", { kind: "hold" });
  };
  const sendTap = (cell: number) => {
    if (asSpectator) return;
    room?.send("input", { kind: "tap", cell });
  };
  const sendMove = (col: number) => {
    if (asSpectator) return;
    room?.send("input", { kind: "move", col });
  };

  const [chatInput, setChatInput] = useState("");
  const sendChat = () => {
    const v = chatInput.trim();
    if (!v) return;
    room?.send("chat", v);
    setChatInput("");
  };

  const myView = playerViews.find((p) => p.sessionId === meSid);
  const opponentViews = playerViews.filter((p) => p.sessionId !== meSid);

  const secondsLeft =
    stateSnap?.phase === "playing" && stateSnap.endsAt > 0
      ? Math.max(0, Math.ceil((stateSnap.endsAt - serverNowEst) / 1000))
      : 0;

  return (
    <div className="play-shell">
      <div
        className="row row-wrap"
        style={{ justifyContent: "space-between", gap: 8 }}
      >
        <h1
          className="title"
          style={{
            margin: 0,
            fontSize: "clamp(0.85rem, 3vw, 1.1rem)",
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: "1 1 0",
          }}
          title={
            stateSnap?.roomName
              ? `멀티태스크 · ${stateSnap.roomName}`
              : "멀티태스크"
          }
        >
          멀티태스크 {stateSnap?.roomName ? `· ${stateSnap.roomName}` : ""}
        </h1>
        <div className="row" style={{ gap: 8, flexShrink: 0 }}>
          {phase === "playing" && (
            <span className="muted hide-sm">
              난이도 {stateSnap?.difficulty} · 남은 {secondsLeft}초
            </span>
          )}
          {phase === "playing" && (
            <span style={{ fontSize: 13 }}>
              ⏱ {secondsLeft}s
            </span>
          )}
          <span className="muted hide-sm">{user?.nickname}</span>
          {asSpectator && (
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 11,
                padding: "0.2rem 0.5rem",
                border: "1px solid var(--accent)",
                color: "var(--accent)",
              }}
            >
              👁 관전 중
            </span>
          )}
          <button onClick={leave}>나가기</button>
        </div>
      </div>

      {status.kind === "connecting" && (
        <p className="muted" style={{ margin: 0 }}>방에 연결 중…</p>
      )}
      {status.kind === "error" && (
        <div className="error" style={{ marginTop: 0 }}>{status.error}</div>
      )}
      {status.kind === "closed" && <RoomClosedRedirect />}

      {phase === "lobby" && stateSnap && (
        <div className="play-grid">
          <div className="col" style={{ minHeight: 0, overflowY: "auto" }}>
            <LobbyView
              state={stateSnap}
              meSid={meSid!}
              isHost={isHost}
              onReady={() => room?.send("toggleReady")}
              onStart={() => room?.send("startGame")}
              spectating={asSpectator}
            />
          </div>
          <div className="play-side">
            <ActionLog log={stateSnap.log} />
            <ScorePanel players={players as any[]} meSid={meSid!} />
          </div>
        </div>
      )}

      {phase === "playing" && stateSnap && (
        isMobile ? (
          <div className="multitask-solo">
            {myView ? (
              <PlayerBoardView
                player={myView}
                isLocal
                size="large"
                onHoldTap={sendHold}
                onTapCell={sendTap}
                onMoveCol={sendMove}
              />
            ) : (
              <p className="muted">관전 모드</p>
            )}
            <div className="multitask-others-tiny">
              {playerViews
                .filter((p) => p.sessionId !== meSid)
                .map((p) => (
                  <div key={p.sessionId} className="multitask-tiny-card">
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12 }}>
                        {p.alive ? "" : "💀 "}{p.nickname}
                      </span>
                      <span style={{ fontSize: 12 }} className="muted">
                        ❤{p.hearts} · {p.score}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ) : (
          <div className="play-grid">
            <div className="multitask-pc-main">
              {opponentViews.length > 0 && (
                <div className="multitask-opponents-rail">
                  {opponentViews.map((p) => (
                    <div key={p.sessionId} className="multitask-opponent-cell">
                      <PlayerBoardView
                        player={p}
                        isLocal={false}
                        size="small"
                      />
                    </div>
                  ))}
                </div>
              )}
              <div className="multitask-me-stage">
                {myView ? (
                  <PlayerBoardView
                    player={myView}
                    isLocal
                    size="large"
                    onHoldTap={sendHold}
                    onTapCell={sendTap}
                    onMoveCol={sendMove}
                  />
                ) : (
                  <p className="muted">관전 모드</p>
                )}
              </div>
            </div>
            <div className="play-side">
              <ActionLog log={stateSnap.log} />
              <ChatBox
                value={chatInput}
                onChange={setChatInput}
                onSubmit={sendChat}
              />
              <ScorePanel players={players as any[]} meSid={meSid!} />
            </div>
          </div>
        )
      )}

      {phase === "gameEnd" && stateSnap && (
        <Modal>
          <h2 className="title" style={{ margin: 0 }}>
            🏁 게임 종료
          </h2>
          {stateSnap.winnerSessionId ? (
            <p>
              승자:{" "}
              <strong>
                {stateSnap.winnerNickname}
                {stateSnap.winnerSessionId === meSid ? " (나!)" : ""}
              </strong>
            </p>
          ) : (
            <p className="muted">모두 탈락 — 무승부</p>
          )}
          <div className="col" style={{ gap: 4 }}>
            <h3 className="title" style={{ margin: 0, fontSize: "0.95rem" }}>
              최종 점수
            </h3>
            {[...players]
              .sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0))
              .map((p: any) => (
                <div
                  key={p.sessionId}
                  className="row"
                  style={{ justifyContent: "space-between", fontSize: 13 }}
                >
                  <span>
                    {p.alive ? "" : "💀 "}
                    {p.sessionId === meSid ? "나" : p.nickname}
                  </span>
                  <span className="muted">
                    {p.score}점 · ❤{p.hearts}
                  </span>
                </div>
              ))}
          </div>
          <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
            {isHost ? (
              <button onClick={() => room?.send("playAgain")}>다시 하기</button>
            ) : (
              <span className="muted">방장의 결정을 기다리는 중…</span>
            )}
            <button onClick={leave}>로비로</button>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────

const LobbyView = ({
  state,
  meSid,
  isHost,
  onReady,
  onStart,
  spectating = false,
}: {
  state: StateSnap;
  meSid: string;
  isHost: boolean;
  onReady: () => void;
  onStart: () => void;
  spectating?: boolean;
}) => {
  const players = Object.values(state.players);
  const ready = players.every(
    (p: any) => p.ready || p.sessionId === state.hostSessionId,
  );
  return (
    <div className="panel col">
      <h2 className="title" style={{ margin: 0, fontSize: "1.2rem" }}>
        대기실
      </h2>
      <p className="muted" style={{ margin: 0 }}>
        2~{state.maxPlayers}명 · 3개 미니태스크를 동시에! 하트 3개 모두 잃으면 탈락.
        최후 생존자 또는 3분 후 최고점수자가 승리.
      </p>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        조작: <strong>스페이스</strong>=홀드 / <strong>탭/클릭</strong>=타깃 /{" "}
        <strong>←→ 또는 스와이프</strong>=회피
      </p>
      <div className="col" style={{ gap: 6 }}>
        {players.map((p: any) => (
          <div
            key={p.sessionId}
            className="row"
            style={{
              justifyContent: "space-between",
              padding: "0.5rem 0.75rem",
              border: "1px solid var(--panel-border)",
              borderRadius: "var(--radius)",
              gap: 8,
              minWidth: 0,
            }}
          >
            <span
              style={{
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {p.sessionId === state.hostSessionId && "👑 "}
              {p.nickname}
              {p.sessionId === meSid && " (나)"}
            </span>
            <span className="muted" style={{ flexShrink: 0, fontSize: 13 }}>
              {p.sessionId === state.hostSessionId
                ? "방장"
                : p.ready
                  ? "✅ 준비"
                  : "대기"}
            </span>
          </div>
        ))}
      </div>
      <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
        {spectating && (
          <span className="muted" style={{ fontSize: 13 }}>👁 관전 중</span>
        )}
        {!spectating && !isHost && <button onClick={onReady}>준비 토글</button>}
        {!spectating && isHost && (
          <button onClick={onStart} disabled={players.length < 1 || !ready}>
            시작
          </button>
        )}
      </div>
    </div>
  );
};

const ChatBox = ({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) => (
  <form
    className="panel row"
    style={{ gap: 8 }}
    onSubmit={(e) => {
      e.preventDefault();
      onSubmit();
    }}
  >
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="채팅 입력… (Enter)"
      maxLength={120}
      style={{ flex: "1 1 auto", minWidth: 0 }}
    />
    <button
      type="submit"
      disabled={!value.trim()}
      style={{ whiteSpace: "nowrap", flexShrink: 0 }}
    >
      전송
    </button>
  </form>
);

const ActionLog = ({ log }: { log: any[] }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [log]);
  return (
    <div className="panel panel-log col" style={{ gap: 6 }}>
      <h3 className="title" style={{ margin: 0, fontSize: "0.95rem" }}>
        로그
      </h3>
      <div
        ref={ref}
        className="col"
        style={{
          gap: 2,
          overflowY: "auto",
          minHeight: 0,
          fontSize: 13,
        }}
      >
        {log.slice(-50).map((e, i) => (
          <div
            key={`${e.ts}-${i}`}
            style={{
              color:
                e.kind === "hit"
                  ? "var(--danger)"
                  : e.kind === "win"
                    ? "var(--gold-soft)"
                    : e.kind === "death"
                      ? "#ff8896"
                      : e.kind === "system"
                        ? "var(--muted)"
                        : "var(--text)",
            }}
          >
            {e.text}
          </div>
        ))}
      </div>
    </div>
  );
};

const ScorePanel = ({
  players,
  meSid,
}: {
  players: any[];
  meSid: string;
}) => (
  <div className="panel col" style={{ gap: 6 }}>
    <h3 className="title" style={{ margin: 0, fontSize: "0.95rem" }}>
      현황
    </h3>
    {players.map((p: any) => (
      <div
        key={p.sessionId}
        className="row"
        style={{ justifyContent: "space-between", fontSize: 13 }}
      >
        <span>
          {p.alive ? "" : "💀 "}
          {p.sessionId === meSid ? "나" : p.nickname}
        </span>
        <span className="muted">
          ❤{p.hearts} · {p.score}점
        </span>
      </div>
    ))}
  </div>
);

const Modal = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(8,5,22,0.7)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 40,
    }}
  >
    <div className="panel col" style={{ width: "min(520px, 92vw)", gap: 12 }}>
      {children}
    </div>
  </div>
);

const RoomClosedRedirect = () => {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => {
      if (!exitGameToApp()) router.replace("/lobby");
    }, 2500);
    return () => clearTimeout(t);
  }, [router]);
  return (
    <div className="panel col" style={{ alignItems: "center", gap: 8 }}>
      <h2 className="title" style={{ margin: 0 }}>
        방이 종료되었습니다
      </h2>
      <p className="muted" style={{ margin: 0 }}>
        곧 로비로 돌아갑니다…
      </p>
    </div>
  );
};

export default MultitaskTable;
