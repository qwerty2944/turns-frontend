"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { Room } from "@colyseus/sdk";
import { useGameRoom } from "@/features/game-session/lib/useGameRoom";
import { exitGameToApp } from "@/shared/lib/appBridge";
import { useAppLobby } from "@/shared/lib/useAppLobby";
import { useAuthStore } from "@/entities/user/model/authStore";
import { ActionLog } from "@/games/love-letter/ui/ActionLog";
import {
  ROLE,
  ROLE_EMOJI,
  ROLE_NAMES_KR,
  type Role,
  type WolfTeamMember,
} from "../model/roles";
import type {
  MafiaPlayerView,
  MafiaPhase,
  MafiaStateView,
  SeerResult,
  WolfChatMessage,
} from "../model/types";
import { RoleCard } from "./RoleCard";
import { SeatGrid } from "./SeatGrid";
import { NightActions } from "./NightActions";
import { VotePanel } from "./VotePanel";
import { WolfChat } from "./WolfChat";
import type { MafiaEffectsOverlayHandle } from "./PhaserEffectsOverlay";

const PhaserEffectsOverlay = dynamic(() => import("./PhaserEffectsOverlay"), {
  ssr: false,
});

type Props = {
  mode: "create" | "join";
  roomId?: string;
  roomName?: string;
  maxPlayers?: number;
  asSpectator?: boolean;
  maskNicknames?: boolean;
};

export const MafiaTable = (props: Props) => {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const asSpectator = !!props.asSpectator;

  const { room, status } = useGameRoom({
    roomName: "mafia",
    mode: props.mode,
    roomId: props.roomId,
    displayName: props.roomName,
    maxPlayers: props.maxPlayers,
    asSpectator,
    maskNicknames: props.maskNicknames,
  });

  const [stateSnap, setStateSnap] = useState<MafiaStateView | null>(null);
  const [myRole, setMyRole] = useState<Role | "">("");
  const [wolfTeam, setWolfTeam] = useState<WolfTeamMember[]>([]);
  const [seerResults, setSeerResults] = useState<SeerResult[]>([]);
  const [wolfChat, setWolfChat] = useState<WolfChatMessage[]>([]);
  const [nightSubmitted, setNightSubmitted] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [now, setNow] = useState(Date.now());

  const overlayRef = useRef<MafiaEffectsOverlayHandle | null>(null);
  const seatRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const overlayWrapRef = useRef<HTMLDivElement | null>(null);
  const lastPhaseRef = useRef<MafiaPhase | "">("");
  const lastDayCountRef = useRef<number>(0);

  // Tick clock every second for countdowns
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  // Wire Colyseus state + private messages
  useEffect(() => {
    if (!room) return;
    const r = room as Room;
    const onChange = () => setStateSnap(toSnap(r.state));
    r.onStateChange(onChange);
    onChange();

    r.onMessage("role", (msg: { role: Role }) => setMyRole(msg.role));
    r.onMessage("wolfTeam", (msg: { wolves: WolfTeamMember[] }) =>
      setWolfTeam(msg.wolves ?? []),
    );
    r.onMessage("seerResult", (msg: SeerResult) =>
      setSeerResults((prev) => [...prev, msg]),
    );
    r.onMessage("wolfChat", (msg: WolfChatMessage) =>
      setWolfChat((prev) => [...prev, msg]),
    );
  }, [room]);

  const anchorFor = (sid?: string) => {
    if (!sid) return undefined;
    const wrap = overlayWrapRef.current;
    const target = seatRefs.current.get(sid);
    if (!wrap || !target) return undefined;
    const wr = wrap.getBoundingClientRect();
    const tr = target.getBoundingClientRect();
    return {
      x: tr.left - wr.left + tr.width / 2,
      y: tr.top - wr.top + tr.height / 2,
    };
  };

  // Dispatch Phaser effects on phase / day transitions
  useEffect(() => {
    if (!stateSnap || !overlayRef.current) return;
    const phase = stateSnap.phase as MafiaPhase;
    const prevPhase = lastPhaseRef.current;
    const prevDay = lastDayCountRef.current;

    if (phase !== prevPhase) {
      if (phase === "night") overlayRef.current.playEffect({ kind: "nightFall" });
      if (phase === "day") overlayRef.current.playEffect({ kind: "dayBreak" });
      if (phase === "nightReveal") {
        if (stateSnap.lastKilledId) {
          const a = anchorFor(stateSnap.lastKilledId);
          if (a) overlayRef.current.playEffect({ kind: "wolfHunt", target: a });
        } else if (stateSnap.lastNightSaved) {
          // pop a save glow on every alive seat — keep it simple, on host seat
          const a = anchorFor(stateSnap.hostSessionId);
          if (a) overlayRef.current.playEffect({ kind: "doctorSave", target: a });
        }
      }
      if (phase === "voteReveal" && stateSnap.lastLynchedId) {
        const a = anchorFor(stateSnap.lastLynchedId);
        if (a) overlayRef.current.playEffect({ kind: "lynch", target: a });
      }
      if (phase === "gameEnd") {
        if (stateSnap.winners === "wolves") {
          overlayRef.current.playEffect({ kind: "wolfWin" });
        } else if (stateSnap.winners === "villagers") {
          overlayRef.current.playEffect({ kind: "villagerWin" });
        }
      }
      lastPhaseRef.current = phase;
    }

    if (stateSnap.dayCount !== prevDay) {
      lastDayCountRef.current = stateSnap.dayCount;
      // Reset night submission flag at each new night
      if (phase === "night") setNightSubmitted(false);
    }
  }, [stateSnap]);

  // Surface seer glow when a new seer result arrives
  useEffect(() => {
    if (!overlayRef.current) return;
    const latest = seerResults[seerResults.length - 1];
    if (!latest) return;
    const a = anchorFor(latest.targetId);
    if (a)
      overlayRef.current.playEffect({
        kind: "seerGlow",
        target: a,
        isWolf: latest.isWolf,
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seerResults.length]);

  const players: MafiaPlayerView[] = stateSnap
    ? Object.values(stateSnap.players)
    : [];
  const alive = players.filter((p) => p.alive);
  const meSid = room?.sessionId ?? "";
  const me = players.find((p) => p.sessionId === meSid);
  const isHost = stateSnap?.hostSessionId === meSid;
  // ─── Flutter 앱 네이티브 대기실 브릿지 (게임 시작 전 로비는 앱 UI가 담당) ───
  const appLobbySnap = useMemo(
    () =>
      stateSnap
        ? {
            game: "mafia",
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

  const phase = (stateSnap?.phase as MafiaPhase) ?? "lobby";

  const wolfIds = useMemo(
    () => new Set(wolfTeam.map((w) => w.sessionId)),
    [wolfTeam],
  );

  // Last doctor protected target — derive from own memory (server enforces canonical rule)
  const lastDoctorTargetRef = useRef("");
  useEffect(() => {
    if (myRole !== ROLE.DOCTOR) return;
    if (phase === "nightReveal" && nightSubmitted) {
      // After submitting and revealing, our target becomes "last protected"
      // For UX (disable that seat next night), we'd need server feedback;
      // best-effort: just don't track here — server still validates.
    }
  }, [phase, nightSubmitted, myRole]);

  const voteCounts = useMemo(() => {
    const m = new Map<string, number>();
    if (phase !== "vote") return m;
    for (const p of alive) {
      if (p.voteTarget) m.set(p.voteTarget, (m.get(p.voteTarget) ?? 0) + 1);
    }
    return m;
  }, [phase, alive]);

  const phaseEndsAt = stateSnap?.phaseEndsAt ?? 0;
  const secondsLeft = phaseEndsAt
    ? Math.max(0, Math.ceil((phaseEndsAt - now) / 1000))
    : 0;

  const leave = () => {
    room?.leave().catch(() => {});
    if (!exitGameToApp()) router.push("/lobby");
  };

  const sendChat = () => {
    const msg = chatInput.trim();
    if (!msg) return;
    room?.send("chat", msg);
    setChatInput("");
  };

  const phaseLabel = phaseLabels[phase] ?? phase;

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
            fontSize: "clamp(1rem, 4vw, 1.4rem)",
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: "1 1 0",
          }}
          title={stateSnap?.roomName ? `타뷸라의 늑대 · ${stateSnap.roomName}` : "타뷸라의 늑대"}
        >
          타뷸라의 늑대 {stateSnap?.roomName ? `· ${stateSnap.roomName}` : ""}
        </h1>
        <div className="row" style={{ gap: 8, flexShrink: 0 }}>
          {phase !== "lobby" && phase !== "gameEnd" && (
            <span className="muted" style={{ fontFamily: "var(--font-display)", fontSize: 12 }}>
              {phaseLabel} · {secondsLeft}s
            </span>
          )}
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
          <span className="muted hide-sm">{user?.nickname}</span>
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

      {stateSnap && (
        <div className="play-grid">
          <div
            ref={overlayWrapRef}
            className="panel"
            style={{
              position: "relative",
              padding: 16,
              minHeight: 0,
              height: "100%",
              overflow: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {phase === "lobby" && (
              <LobbyView
                state={stateSnap}
                meSid={meSid}
                isHost={isHost && !asSpectator}
                onReady={() => room?.send("toggleReady")}
                onStart={() => room?.send("startGame")}
                spectating={asSpectator}
              />
            )}

            {phase === "roleReveal" && myRole && (
              <div
                className="col"
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  flex: 1,
                  gap: 16,
                }}
              >
                <p className="muted" style={{ margin: 0, fontFamily: "var(--font-display)" }}>
                  YOUR ROLE
                </p>
                <RoleCard role={myRole as Role} size={200} />
                {myRole === ROLE.WOLF && wolfTeam.length > 1 && (
                  <p className="muted" style={{ margin: 0 }}>
                    🐺 동료 늑대:{" "}
                    {wolfTeam
                      .filter((w) => w.sessionId !== meSid)
                      .map((w) => w.nickname)
                      .join(", ")}
                  </p>
                )}
              </div>
            )}

            {phase !== "lobby" && phase !== "roleReveal" && (
              <>
                <SeatGrid
                  players={players}
                  meSid={meSid}
                  seatRefs={seatRefs}
                  highlightWolfIds={myRole === ROLE.WOLF ? wolfIds : undefined}
                  voteCounts={voteCounts}
                />

                {phase === "night" && !asSpectator && me?.alive && (
                  <NightActions
                    room={room}
                    role={myRole}
                    meSid={meSid}
                    alive={alive}
                    wolfIds={wolfIds}
                    lastDoctorTarget={lastDoctorTargetRef.current}
                    seerResults={seerResults}
                    submitted={nightSubmitted}
                    onSubmit={(t) => {
                      setNightSubmitted(true);
                      if (myRole === ROLE.DOCTOR) lastDoctorTargetRef.current = t;
                    }}
                  />
                )}

                {phase === "nightReveal" && (
                  <div className="panel col" style={{ alignItems: "center" }}>
                    {stateSnap.lastKilledId ? (
                      <p style={{ margin: 0 }}>
                        🐺{" "}
                        <strong>
                          {players.find((p) => p.sessionId === stateSnap.lastKilledId)?.nickname}
                        </strong>{" "}
                        님이 사냥당했습니다
                      </p>
                    ) : stateSnap.lastNightSaved ? (
                      <p style={{ margin: 0 }}>✨ 조용한 밤이었습니다 (의사가 살림)</p>
                    ) : (
                      <p style={{ margin: 0 }}>🤫 조용한 밤이었습니다</p>
                    )}
                  </div>
                )}

                {phase === "vote" && !asSpectator && (
                  <VotePanel
                    room={room}
                    meSid={meSid}
                    alive={alive}
                    myVote={me?.voteTarget ?? ""}
                  />
                )}

                {phase === "voteReveal" && (
                  <div className="panel col" style={{ alignItems: "center" }}>
                    {stateSnap.lastLynchedId ? (
                      <p style={{ margin: 0 }}>
                        ⚖️{" "}
                        <strong>
                          {players.find((p) => p.sessionId === stateSnap.lastLynchedId)?.nickname}
                        </strong>
                        {" "}— {ROLE_EMOJI[(players.find((p) => p.sessionId === stateSnap.lastLynchedId)?.revealedRole as Role) ?? "villager"]}{" "}
                        {ROLE_NAMES_KR[(players.find((p) => p.sessionId === stateSnap.lastLynchedId)?.revealedRole as Role) ?? "villager"]}
                      </p>
                    ) : (
                      <p style={{ margin: 0 }}>🤷 동률 — 아무도 처형되지 않았습니다</p>
                    )}
                  </div>
                )}

                {phase === "gameEnd" && (
                  <div
                    className="col"
                    style={{ alignItems: "center", gap: 12 }}
                  >
                    <h2 className="title" style={{ margin: 0 }}>
                      {stateSnap.winners === "wolves" ? "🐺 늑대 승리" : "🌾 시민 승리"}
                    </h2>
                    <div className="row" style={{ flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
                      {players.map((p) => (
                        <div key={p.sessionId} className="col" style={{ alignItems: "center", gap: 4 }}>
                          <span style={{ fontSize: 14 }}>
                            {p.sessionId === meSid ? "나" : p.nickname}
                          </span>
                          <span style={{ fontSize: 13 }}>
                            {ROLE_EMOJI[(p.revealedRole as Role) || "villager"]}{" "}
                            {ROLE_NAMES_KR[(p.revealedRole as Role) || "villager"]}
                          </span>
                        </div>
                      ))}
                    </div>
                    <button onClick={leave}>로비로</button>
                  </div>
                )}
              </>
            )}
            <PhaserEffectsOverlay ref={overlayRef} />
          </div>

          <div className="play-side">
            <ActionLog log={stateSnap.log ?? []} />
            {!asSpectator && (
              <ChatBox
                value={chatInput}
                onChange={setChatInput}
                onSubmit={sendChat}
              />
            )}
            {!asSpectator && myRole === ROLE.WOLF && (
              <WolfChat
                room={room}
                enabled={phase === "night"}
                messages={wolfChat}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const phaseLabels: Record<MafiaPhase, string> = {
  lobby: "대기실",
  roleReveal: "역할 공개",
  night: "🌙 밤",
  nightReveal: "밤 결과",
  day: "☀️ 낮 (토론)",
  vote: "🗳 투표",
  voteReveal: "투표 결과",
  gameEnd: "게임 종료",
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
      placeholder="모두에게 보이는 채팅… (Enter)"
      maxLength={160}
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

const LobbyView = ({
  state,
  meSid,
  isHost,
  onReady,
  onStart,
  spectating = false,
}: {
  state: MafiaStateView;
  meSid: string;
  isHost: boolean;
  onReady: () => void;
  onStart: () => void;
  spectating?: boolean;
}) => {
  const players: MafiaPlayerView[] = Object.values(state.players);
  const ready = players.every(
    (p) => p.ready || p.sessionId === state.hostSessionId,
  );
  return (
    <div className="col" style={{ gap: 12 }}>
      <h2 className="title" style={{ margin: 0, fontSize: "1.2rem" }}>대기실</h2>
      <p className="muted" style={{ margin: 0 }}>
        최소 4명 · 최대 {state.maxPlayers}명. 모두 준비되면 방장이 시작합니다.
      </p>
      <div className="col" style={{ gap: 6 }}>
        {players.map((p) => (
          <div
            key={p.sessionId}
            className="row"
            style={{
              justifyContent: "space-between",
              padding: "0.5rem 0.75rem",
              border: "1px solid var(--panel-border)",
              borderRadius: "var(--radius)",
            }}
          >
            <span>
              {p.sessionId === state.hostSessionId && "👑 "}
              {p.nickname}
              {p.sessionId === meSid && " (나)"}
            </span>
            <span className="muted">
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
          <button onClick={onStart} disabled={players.length < 4 || !ready}>
            시작
          </button>
        )}
      </div>
    </div>
  );
};

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
      <h2 className="title" style={{ margin: 0 }}>방이 종료되었습니다</h2>
      <p className="muted" style={{ margin: 0 }}>
        인원 부족 또는 호스트 퇴장으로 방이 폭파되었습니다. 곧 로비로 돌아갑니다…
      </p>
    </div>
  );
};

const toSnap = (state: any): MafiaStateView | null => {
  if (!state) return null;
  const playersObj: Record<string, MafiaPlayerView> = {};
  state.players?.forEach?.((p: any, key: string) => {
    playersObj[key] = {
      sessionId: p.sessionId,
      userId: p.userId,
      nickname: p.nickname,
      connected: p.connected,
      ready: p.ready,
      alive: p.alive,
      revealedRole: p.revealedRole,
      voteTarget: p.voteTarget,
    };
  });
  return {
    hostSessionId: state.hostSessionId,
    roomName: state.roomName,
    phase: state.phase,
    maxPlayers: state.maxPlayers,
    dayCount: state.dayCount,
    phaseEndsAt: state.phaseEndsAt,
    players: playersObj,
    lastKilledId: state.lastKilledId,
    lastNightSaved: state.lastNightSaved,
    lastLynchedId: state.lastLynchedId,
    winners: state.winners,
    log: state.log
      ? Array.from(state.log).map((e: any) => ({
          ts: e.ts,
          kind: e.kind,
          text: e.text,
          actor: e.actor,
          target: e.target,
          card: e.card,
          guess: e.guess,
        }))
      : [],
  };
};

export default MafiaTable;
