"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { Room } from "@colyseus/sdk";
import { useGameRoom } from "@/features/game-session/lib/useGameRoom";
import { useAuthStore } from "@/entities/user/model/authStore";
import { CARD, CARD_NAMES_KR, cardNeedsTarget } from "../model/cards";
import { PlayCardModal } from "./PlayCardModal";
import { CardImage } from "./CardImage";
import { ActionLog } from "./ActionLog";
import type { EffectsOverlayHandle } from "./PhaserEffectsOverlay";

// Phaser pulls in `window`; load only on the client.
const PhaserEffectsOverlay = dynamic(() => import("./PhaserEffectsOverlay"), {
  ssr: false,
});

type Props = {
  mode: "create" | "join";
  roomId?: string;
  roomName?: string;
  maxPlayers?: number;
};

export const LoveLetterTable = (props: Props) => {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const { room, status } = useGameRoom({
    roomName: "love_letter",
    mode: props.mode,
    roomId: props.roomId,
    displayName: props.roomName,
    maxPlayers: props.maxPlayers,
  });

  const [stateSnap, setStateSnap] = useState<any>(null);
  const [myHand, setMyHand] = useState<number[]>([]);
  const [peek, setPeek] = useState<{ nickname: string; card: number } | null>(null);
  const [revealed, setRevealed] = useState<Record<string, number[]> | null>(null);
  const [playing, setPlaying] = useState<number | null>(null);
  const [chatInput, setChatInput] = useState("");

  // ─── Phaser effects wiring ─── //
  const overlayRef = useRef<EffectsOverlayHandle | null>(null);
  const seatRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const myHandRef = useRef<HTMLDivElement | null>(null);
  const deckRef = useRef<HTMLDivElement | null>(null);
  const overlayWrapRef = useRef<HTMLDivElement | null>(null);
  const lastSeenTsRef = useRef<number>(0);

  const anchorFor = (sid?: string) => {
    if (!sid) return undefined;
    const wrap = overlayWrapRef.current;
    if (!wrap) return undefined;
    const target =
      sid === room?.sessionId ? myHandRef.current : seatRefs.current.get(sid);
    if (!target) return undefined;
    const wr = wrap.getBoundingClientRect();
    const tr = target.getBoundingClientRect();
    return { x: tr.left - wr.left + tr.width / 2, y: tr.top - wr.top + tr.height / 2 };
  };

  const sidByNickname = (nick?: string): string | undefined => {
    if (!nick || !stateSnap) return undefined;
    for (const p of Object.values(stateSnap.players) as any[]) {
      if (p.nickname === nick) return p.sessionId;
    }
    return undefined;
  };

  // Wire Colyseus state to React
  useEffect(() => {
    if (!room) return;
    const r = room as Room;
    const onChange = () => setStateSnap(toSnap(r.state));
    r.onStateChange(onChange);
    onChange();

    r.onMessage("hand", (msg: { cards: number[] }) => {
      setMyHand(msg.cards);
    });
    r.onMessage("priestPeek", (msg: { nickname: string; card: number }) => {
      setPeek(msg);
      setTimeout(() => setPeek(null), 6000);
    });
    r.onMessage("revealHands", (msg: Record<string, number[]>) => {
      setRevealed(msg);
    });
  }, [room]);

  // Hide reveal modal when a new round begins
  useEffect(() => {
    if (stateSnap?.phase === "playing" && revealed) setRevealed(null);
  }, [stateSnap?.phase, revealed]);

  // Dispatch Phaser effects when new server log entries arrive.
  // Diff by `ts` (not length) so we survive the server's 200-entry truncation
  // and don't re-fire backlog on reconnect.
  useEffect(() => {
    const log = stateSnap?.log;
    if (!log || log.length === 0) return;
    if (lastSeenTsRef.current === 0) {
      // Skip everything that existed before we connected.
      lastSeenTsRef.current = log[log.length - 1].ts;
      return;
    }
    const seen = lastSeenTsRef.current;
    let max = seen;
    for (const e of log) {
      if (e.ts <= seen) continue;
      if (e.ts > max) max = e.ts;
      dispatchEffect(e);
    }
    lastSeenTsRef.current = max;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateSnap?.log]);

  const dispatchEffect = (e: any) => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const actorSid = sidByNickname(e.actor);
    const targetSid = sidByNickname(e.target);
    const actorAnchor = anchorFor(actorSid);
    const targetAnchor = anchorFor(targetSid);

    if (e.kind === "play" && actorAnchor) {
      overlay.playEffect({
        kind: "play",
        card: e.card,
        guess: e.guess || undefined,
        actor: actorAnchor,
        target: targetAnchor,
      });
    } else if (e.kind === "reveal") {
      // Guard hit/miss heuristics — server text starts with 🎯 / ❌
      if (typeof e.text === "string" && e.text.startsWith("🎯") && targetAnchor) {
        overlay.playEffect({ kind: "guardHit", target: targetAnchor });
      } else if (typeof e.text === "string" && e.text.startsWith("❌") && actorAnchor) {
        overlay.playEffect({ kind: "guardMiss", actor: actorAnchor });
      }
    } else if (e.kind === "result") {
      if (typeof e.text === "string" && e.text.includes("탈락") && actorAnchor) {
        overlay.playEffect({ kind: "eliminated", seat: actorAnchor });
      } else if (
        typeof e.text === "string" &&
        e.text.includes("라운드 승리") &&
        actorAnchor
      ) {
        overlay.playEffect({ kind: "roundWin", seat: actorAnchor });
      }
    }
  };

  const players: any[] = stateSnap ? Object.values(stateSnap.players) : [];
  const meSid = room?.sessionId;
  const me = players.find((p) => p.sessionId === meSid);
  const opponents = players.filter((p) => p.sessionId !== meSid);
  const isHost = stateSnap?.hostSessionId === meSid;
  const isMyTurn = stateSnap?.turnOrder?.[stateSnap.turnIndex] === meSid;
  const currentTurnSid: string | undefined =
    stateSnap?.turnOrder?.[stateSnap.turnIndex];
  const phase = stateSnap?.phase ?? "lobby";

  const countessRestriction = useMemo(() => {
    return (
      myHand.includes(CARD.COUNTESS) &&
      (myHand.includes(CARD.KING) || myHand.includes(CARD.PRINCE))
    );
  }, [myHand]);

  const leave = () => {
    room?.leave().catch(() => {});
    router.push("/lobby");
  };

  const sendChat = () => {
    const msg = chatInput.trim();
    if (!msg) return;
    room?.send("chat", msg);
    setChatInput("");
  };

  return (
    <div className="play-shell">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 className="title" style={{ margin: 0, fontSize: "1.4rem" }}>
          러브레터 {stateSnap?.roomName ? `· ${stateSnap.roomName}` : ""}
        </h1>
        <div className="row">
          <span className="muted">{user?.nickname}</span>
          <button onClick={leave}>나가기</button>
        </div>
      </div>

      {status.kind === "connecting" && <p className="muted" style={{ margin: 0 }}>방에 연결 중…</p>}
      {status.kind === "error" && <div className="error" style={{ marginTop: 0 }}>{status.error}</div>}
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
            />
          </div>
          <div className="play-side">
            <ActionLog log={stateSnap?.log ?? []} />
            <ChatBox
              value={chatInput}
              onChange={setChatInput}
              onSubmit={sendChat}
            />
            <ScorePanel players={players} meSid={meSid!} />
          </div>
        </div>
      )}

      {phase !== "lobby" && (
        <div className="play-grid">
          <TableView
            opponents={opponents}
            currentTurnSid={currentTurnSid}
            deckRemaining={stateSnap?.deckRemaining ?? 0}
            myHand={myHand}
            isMyTurn={isMyTurn && !me?.eliminated}
            myEliminated={!!me?.eliminated}
            onPickCard={(c) => {
              // Countess auto-discard rule still routed through the modal hint.
              const restricted =
                myHand.includes(CARD.COUNTESS) &&
                (myHand.includes(CARD.KING) || myHand.includes(CARD.PRINCE)) &&
                c !== CARD.COUNTESS;
              // No-target cards (Handmaid, Countess, Princess) — just send.
              if (!restricted && !cardNeedsTarget(c)) {
                room?.send("playCard", { card: c });
                return;
              }
              setPlaying(c);
            }}
            myTokens={me?.tokens ?? 0}
            myNickname={user?.nickname ?? "나"}
            myProtected={!!me?.protected}
            seatRefs={seatRefs}
            myHandRef={myHandRef}
            deckRef={deckRef}
            overlayWrapRef={overlayWrapRef}
            overlayRef={overlayRef}
          />
          <div className="play-side">
            <ActionLog log={stateSnap?.log ?? []} />
            <ChatBox
              value={chatInput}
              onChange={setChatInput}
              onSubmit={sendChat}
            />
            <ScorePanel players={players} meSid={meSid!} />
          </div>
        </div>
      )}

      {peek && (
        <FloatingNote onClose={() => setPeek(null)}>
          <strong>{peek.nickname}</strong>의 카드는{" "}
          <strong>{CARD_NAMES_KR[peek.card]}</strong> 입니다.
        </FloatingNote>
      )}

      {phase === "roundEnd" && stateSnap && (
        <Modal>
          <h2 className="title" style={{ margin: 0 }}>라운드 종료</h2>
          {stateSnap.roundWinnerId && (
            <p>
              승자:{" "}
              <strong>
                {players.find((p) => p.sessionId === stateSnap.roundWinnerId)?.nickname}
              </strong>
            </p>
          )}
          {revealed && (
            <div className="col">
              <h3 className="title" style={{ margin: 0, fontSize: "1rem" }}>최종 손패</h3>
              {Object.entries(revealed).map(([sid, cards]) => {
                const player = players.find((p) => p.sessionId === sid);
                return (
                  <div key={sid} className="row" style={{ gap: 8 }}>
                    <span style={{ minWidth: 120 }}>{player?.nickname ?? sid}</span>
                    <div className="row" style={{ gap: 6 }}>
                      {cards.map((c, i) => (
                        <CardImage key={i} card={c} size={42} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="row" style={{ justifyContent: "flex-end" }}>
            {isHost ? (
              <button onClick={() => room?.send("nextRound")}>다음 라운드</button>
            ) : (
              <span className="muted">방장의 시작을 기다리는 중…</span>
            )}
          </div>
        </Modal>
      )}

      {phase === "gameEnd" && stateSnap && (
        <Modal>
          <h2 className="title" style={{ margin: 0 }}>🎉 게임 종료</h2>
          <p>
            최종 승자:{" "}
            <strong>
              {players.find((p) => p.sessionId === stateSnap.gameWinnerId)?.nickname}
            </strong>
          </p>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button onClick={leave}>로비로</button>
          </div>
        </Modal>
      )}

      {playing !== null && isMyTurn && me && !me.eliminated && (
        <PlayCardModal
          card={playing}
          selfSessionId={meSid!}
          targets={players.map((p) => ({
            sessionId: p.sessionId,
            nickname: p.nickname,
            eliminated: p.eliminated,
            protected: p.protected,
          }))}
          myHandHasCountessRestriction={countessRestriction}
          onCancel={() => setPlaying(null)}
          onConfirm={(payload) => {
            room?.send("playCard", payload);
            setPlaying(null);
          }}
        />
      )}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ────────────────────────────────────────────────────────────────────────────

type OpponentView = {
  sessionId: string;
  nickname: string;
  discard: number[];
  eliminated: boolean;
  protected: boolean;
  tokens: number;
};

const TableView = ({
  opponents,
  currentTurnSid,
  deckRemaining,
  myHand,
  isMyTurn,
  myEliminated,
  onPickCard,
  myTokens,
  myNickname,
  myProtected,
  seatRefs,
  myHandRef,
  deckRef,
  overlayWrapRef,
  overlayRef,
}: {
  opponents: OpponentView[];
  currentTurnSid?: string;
  deckRemaining: number;
  myHand: number[];
  isMyTurn: boolean;
  myEliminated: boolean;
  onPickCard: (card: number) => void;
  myTokens: number;
  myNickname: string;
  myProtected: boolean;
  seatRefs: React.MutableRefObject<Map<string, HTMLDivElement | null>>;
  myHandRef: React.MutableRefObject<HTMLDivElement | null>;
  deckRef: React.MutableRefObject<HTMLDivElement | null>;
  overlayWrapRef: React.MutableRefObject<HTMLDivElement | null>;
  overlayRef: React.MutableRefObject<EffectsOverlayHandle | null>;
}) => {
  return (
    <div
      ref={overlayWrapRef}
      className="panel"
      style={{
        position: "relative",
        padding: 16,
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        gap: 16,
        minHeight: 0,
        height: "100%",
        overflow: "hidden",
        background:
          "radial-gradient(60% 80% at 50% 45%, rgba(122,63,255,0.18) 0%, transparent 60%), linear-gradient(180deg, rgba(20,13,46,0.9) 0%, rgba(33,25,74,0.9) 100%)",
      }}
    >
      {/* Opponents row */}
      <div
        className="row"
        style={{
          justifyContent: "space-around",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        {opponents.length === 0 && (
          <span className="muted">상대를 기다리는 중…</span>
        )}
        {opponents.map((op) => (
          <OpponentSeat
            key={op.sessionId}
            op={op}
            isTurn={op.sessionId === currentTurnSid}
            registerRef={(el) => seatRefs.current.set(op.sessionId, el)}
          />
        ))}
      </div>

      {/* Deck center */}
      <div
        ref={deckRef}
        className="col"
        style={{ alignItems: "center", justifyContent: "center", gap: 6 }}
      >
        <CardImage card={0} faceDown size={70} />
        <span className="muted">덱 {deckRemaining}장</span>
      </div>

      {/* My hand */}
      <div className="col" style={{ alignItems: "center", gap: 8 }}>
        <div
          ref={myHandRef}
          className="row"
          style={{ gap: 12, flexWrap: "wrap", justifyContent: "center" }}
        >
          {myHand.length === 0 ? (
            <span className="muted">손패 없음</span>
          ) : (
            myHand.map((c, idx) => (
              <button
                key={`${c}-${idx}`}
                onClick={() => isMyTurn && onPickCard(c)}
                disabled={!isMyTurn}
                title={CARD_NAMES_KR[c]}
                style={{
                  padding: 0,
                  background: "transparent",
                  border: "none",
                  cursor: isMyTurn ? "pointer" : "default",
                  transition: "transform 0.1s ease",
                  opacity: isMyTurn ? 1 : 0.75,
                  filter: isMyTurn
                    ? "drop-shadow(0 0 12px rgba(217,182,108,0.4))"
                    : "none",
                }}
                onMouseEnter={(e) => {
                  if (isMyTurn) e.currentTarget.style.transform = "translateY(-6px) scale(1.03)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "";
                }}
              >
                <CardImage card={c} size={88} />
              </button>
            ))
          )}
        </div>
        <div
          style={{
            color: myEliminated
              ? "var(--danger)"
              : isMyTurn
                ? "var(--gold-soft)"
                : "var(--muted)",
            fontSize: 15,
          }}
        >
          {myEliminated
            ? "💀 탈락"
            : isMyTurn
              ? "내 차례 — 카드를 클릭해서 사용"
              : "상대 차례를 기다리는 중"}
          {"  ❤ "}{myTokens} · {myNickname}
          {myProtected && " 🛡"}
        </div>
      </div>

      {/* Phaser effects overlay — animations only, no pointer events */}
      <PhaserEffectsOverlay ref={overlayRef} />
    </div>
  );
};

const OpponentSeat = ({
  op,
  isTurn,
  registerRef,
}: {
  op: OpponentView;
  isTurn: boolean;
  registerRef: (el: HTMLDivElement | null) => void;
}) => (
  <div
    ref={registerRef}
    data-sid={op.sessionId}
    className="col"
    style={{
      alignItems: "center",
      gap: 4,
      padding: "8px 10px",
      borderRadius: 8,
      background: isTurn ? "rgba(217,182,108,0.14)" : "transparent",
      border: isTurn ? "1px solid var(--gold-soft)" : "1px solid transparent",
      minWidth: 140,
      opacity: op.eliminated ? 0.45 : 1,
    }}
  >
    <div style={{ color: isTurn ? "var(--gold-soft)" : "var(--text)" }}>
      {op.eliminated ? "💀 " : ""}{op.nickname}{op.protected ? " 🛡" : ""}{isTurn ? " ▶" : ""}
    </div>
    <CardImage card={0} faceDown size={56} />
    <div className="muted" style={{ fontSize: 13 }}>❤ {op.tokens}</div>
    {op.discard.length > 0 && (
      <div className="row" style={{ gap: 2, flexWrap: "wrap", justifyContent: "center", marginTop: 2 }}>
        {op.discard.slice(-6).map((c, i) => (
          <CardImage key={i} card={c} size={26} />
        ))}
      </div>
    )}
  </div>
);

const RoomClosedRedirect = () => {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => router.replace("/lobby"), 2500);
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

const LobbyView = ({
  state,
  meSid,
  isHost,
  onReady,
  onStart,
}: {
  state: any;
  meSid: string;
  isHost: boolean;
  onReady: () => void;
  onStart: () => void;
}) => {
  const players: any[] = Object.values(state.players);
  const ready = players.every((p) => p.ready || p.sessionId === state.hostSessionId);
  return (
    <div className="panel col">
      <h2 className="title" style={{ margin: 0, fontSize: "1.2rem" }}>대기실</h2>
      <p className="muted">최대 {state.maxPlayers}명. 모두 준비되면 방장이 시작합니다.</p>
      <div className="col" style={{ gap: 6 }}>
        {players.map((p) => (
          <div
            key={p.sessionId}
            className="row"
            style={{
              justifyContent: "space-between",
              padding: "0.5rem 0.75rem",
              border: "1px solid rgba(217,182,108,0.3)",
              borderRadius: 6,
            }}
          >
            <span>
              {p.sessionId === state.hostSessionId && "👑 "}
              {p.nickname}{p.sessionId === meSid && " (나)"}
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
        {!isHost && <button onClick={onReady}>준비 토글</button>}
        {isHost && (
          <button onClick={onStart} disabled={players.length < 2 || !ready}>
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

const ScorePanel = ({ players, meSid }: { players: any[]; meSid: string }) => (
  <div className="panel col" style={{ gap: 6 }}>
    <h3 className="title" style={{ margin: 0, fontSize: "0.95rem" }}>점수</h3>
    {players.map((p) => (
      <div
        key={p.sessionId}
        className="row"
        style={{ justifyContent: "space-between", fontSize: 13 }}
      >
        <span>
          {p.sessionId === meSid ? "나" : p.nickname}
          {p.eliminated && " 💀"}
        </span>
        <span className="muted">❤ {p.tokens}</span>
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
    <div className="panel col" style={{ width: "min(520px, 92vw)" }}>
      {children}
    </div>
  </div>
);

const FloatingNote = ({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) => (
  <div
    onClick={onClose}
    className="panel"
    style={{
      position: "fixed",
      right: 16,
      bottom: 16,
      maxWidth: 320,
      cursor: "pointer",
      borderColor: "var(--gold-soft)",
    }}
  >
    {children}
  </div>
);

// Convert Colyseus Schema (with MapSchema/ArraySchema) into a plain snapshot.
const toSnap = (state: any) => {
  if (!state) return state;
  const playersObj: Record<string, any> = {};
  state.players?.forEach?.((p: any, key: string) => {
    playersObj[key] = {
      sessionId: p.sessionId,
      userId: p.userId,
      nickname: p.nickname,
      connected: p.connected,
      ready: p.ready,
      hand: p.hand ? Array.from(p.hand) : [],
      discard: p.discard ? Array.from(p.discard) : [],
      protected: p.protected,
      eliminated: p.eliminated,
      tokens: p.tokens,
    };
  });
  return {
    hostSessionId: state.hostSessionId,
    roomName: state.roomName,
    phase: state.phase,
    maxPlayers: state.maxPlayers,
    tokensToWin: state.tokensToWin,
    turnOrder: state.turnOrder ? Array.from(state.turnOrder) : [],
    turnIndex: state.turnIndex,
    deckRemaining: state.deckRemaining,
    publicDiscard: state.publicDiscard ? Array.from(state.publicDiscard) : [],
    lastWinnerId: state.lastWinnerId,
    roundWinnerId: state.roundWinnerId,
    gameWinnerId: state.gameWinnerId,
    players: playersObj,
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

export default LoveLetterTable;
