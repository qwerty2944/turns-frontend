"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import type { Room } from "@colyseus/sdk";
import { useGameRoom } from "@/features/game-session/lib/useGameRoom";
import { exitGameToApp } from "@/shared/lib/appBridge";
import { useAppLobby } from "@/shared/lib/useAppLobby";
import { useAuthStore } from "@/entities/user/model/authStore";
import { CARD } from "../model/cards";
import { logToAnnouncement } from "../model/announcements";
import { useAnnouncementQueue } from "../model/useAnnouncementQueue";
import {
  IDLE,
  targetingReducer,
  validTargetSids,
} from "../model/targeting";
import type { Flight } from "./DrawFlyer";
import { CardImage } from "./CardImage";
import { ActionLog } from "./ActionLog";
import { TableView } from "./TableView";
import type { EffectsOverlayHandle } from "./PhaserEffectsOverlay";

type Props = {
  mode: "create" | "join";
  roomId?: string;
  roomName?: string;
  maxPlayers?: number;
  asSpectator?: boolean;
  maskNicknames?: boolean;
};

export const LoveLetterTable = (props: Props) => {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const asSpectator = !!props.asSpectator;

  const { room, status } = useGameRoom({
    roomName: "love_letter",
    mode: props.mode,
    roomId: props.roomId,
    displayName: props.roomName,
    maxPlayers: props.maxPlayers,
    asSpectator,
    maskNicknames: props.maskNicknames,
  });

  const [stateSnap, setStateSnap] = useState<any>(null);
  const [myHand, setMyHand] = useState<number[]>([]);
  const [revealed, setRevealed] = useState<Record<string, number[]> | null>(null);
  const [chatInput, setChatInput] = useState("");

  // ─── Center-stage announcement queue ─── //
  const { current: announcement, leaving: announcementLeaving, enqueue } =
    useAnnouncementQueue();

  // ─── In-table targeting ─── //
  const [targeting, dispatchTargeting] = useReducer(targetingReducer, IDLE);
  const [shakeKeys, setShakeKeys] = useState<number[]>([]);
  const pendingPlayRef = useRef(false);

  // ─── Turn banner / draw animation ─── //
  const [showTurnBanner, setShowTurnBanner] = useState(false);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [incomingIdx, setIncomingIdx] = useState<number | null>(null);
  const prevHandLenRef = useRef(0);
  const prevTurnSidRef = useRef<string | undefined>(undefined);

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

  const resolveAnchor = (nickname?: string) => anchorFor(sidByNickname(nickname));

  // Wire Colyseus state to React
  useEffect(() => {
    if (!room) return;
    const r = room as Room;
    const onChange = () => setStateSnap(toSnap(r.state));
    r.onStateChange(onChange);
    onChange();

    r.onMessage("hand", (msg: { cards: number[] }) => {
      pendingPlayRef.current = false;
      setMyHand(msg.cards);
    });
    r.onMessage("priestPeek", (msg: { nickname: string; card: number }) => {
      enqueue({ type: "peek", card: msg.card, nickname: msg.nickname });
    });
    r.onMessage("revealHands", (msg: Record<string, number[]>) => {
      setRevealed(msg);
    });
  }, [room, enqueue]);

  // Hide revealed hands when a new round actually begins. Only clear on the
  // transition INTO "playing" — the revealHands message can arrive while the
  // local snapshot still says "playing" (message beats the state patch), and
  // clearing on that stale phase wiped the round-end reveal.
  const prevPhaseForRevealRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const phaseNow = stateSnap?.phase;
    const prev = prevPhaseForRevealRef.current;
    prevPhaseForRevealRef.current = phaseNow;
    if (phaseNow === "playing" && prev && prev !== "playing") setRevealed(null);
  }, [stateSnap?.phase]);

  // Dispatch Phaser effects + center-stage announcements when new server log
  // entries arrive. Diff by `ts` (not length) so we survive the server's
  // 200-entry truncation and don't re-fire backlog on reconnect.
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
      const ann = logToAnnouncement(e);
      if (ann) enqueue(ann);
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
  // ─── Flutter 앱 네이티브 대기실 브릿지 (게임 시작 전 로비는 앱 UI가 담당) ───
  const appLobbySnap = useMemo(
    () =>
      stateSnap
        ? {
            game: "love_letter",
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

  // ─── Targeting flow ─── //

  const canAct =
    !asSpectator && isMyTurn && !me?.eliminated && phase === "playing";

  const sendPlay = useCallback(
    (payload: { card: number; targetSessionId?: string; guardGuess?: number }) => {
      if (pendingPlayRef.current) return;
      pendingPlayRef.current = true;
      room?.send("playCard", payload);
      dispatchTargeting({ type: "cancel" });
      // Fallback in case neither a hand message nor a turn change arrives.
      setTimeout(() => {
        pendingPlayRef.current = false;
      }, 2000);
    },
    [room],
  );

  const onPickCard = (card: number, idx: number) => {
    if (!canAct || pendingPlayRef.current) return;
    const locked =
      countessRestriction && (card === CARD.KING || card === CARD.PRINCE);
    if (locked) {
      setShakeKeys((prev) => {
        const next = [...prev];
        next[idx] = (next[idx] ?? 0) + 1;
        return next;
      });
      return;
    }
    // Second tap on the raised confirm card plays it.
    if (targeting.mode === "confirm" && targeting.handIdx === idx) {
      sendPlay({ card: targeting.card });
      return;
    }
    const validCount = meSid
      ? validTargetSids(card, meSid, players).length
      : 0;
    dispatchTargeting({ type: "pick", card, handIdx: idx, validTargetCount: validCount });
  };

  const onSeatTarget = (sid: string) => {
    if (targeting.mode !== "target" || !canAct || !meSid) return;
    // Re-validate at click time — the seat may have just been eliminated.
    if (!validTargetSids(targeting.card, meSid, players).includes(sid)) return;
    if (targeting.card === CARD.GUARD) {
      dispatchTargeting({ type: "seat", sid });
      return;
    }
    sendPlay({ card: targeting.card, targetSessionId: sid });
  };

  const onGuess = (guess: number) => {
    if (targeting.mode !== "guess" || !canAct) return;
    sendPlay({
      card: targeting.card,
      targetSessionId: targeting.targetSid,
      guardGuess: guess,
    });
  };

  const onConfirm = () => {
    if (targeting.mode !== "confirm" || !canAct) return;
    sendPlay({ card: targeting.card });
  };

  const cancelTargeting = useCallback(
    () => dispatchTargeting({ type: "cancel" }),
    [],
  );

  // Reset targeting whenever the situation it was built on changes.
  useEffect(() => {
    if (targeting.mode === "idle") return;
    const stillHave = myHand[targeting.handIdx] === targeting.card;
    if (!canAct || !stillHave) cancelTargeting();
  }, [targeting, canAct, myHand, cancelTargeting]);

  // ESC cancels targeting.
  const targetingActive = targeting.mode !== "idle";
  useEffect(() => {
    if (!targetingActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelTargeting();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [targetingActive, cancelTargeting]);

  const targetableSids = useMemo(() => {
    if (targeting.mode !== "target" || !meSid) return new Set<string>();
    return new Set(validTargetSids(targeting.card, meSid, players));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targeting, meSid, stateSnap]);

  // Clear the pending-play latch when the turn moves on.
  useEffect(() => {
    pendingPlayRef.current = false;
  }, [stateSnap?.turnIndex]);

  // ─── Turn banner ─── //
  useEffect(() => {
    const prev = prevTurnSidRef.current;
    prevTurnSidRef.current = currentTurnSid;
    if (
      phase === "playing" &&
      currentTurnSid &&
      currentTurnSid !== prev &&
      currentTurnSid === meSid &&
      !me?.eliminated &&
      !asSpectator
    ) {
      setShowTurnBanner(true);
      const t = setTimeout(() => setShowTurnBanner(false), 1150);
      return () => clearTimeout(t);
    }
  }, [currentTurnSid, phase, meSid, me?.eliminated, asSpectator]);

  // ─── Draw animation: deck → hand when my hand grows ─── //
  useEffect(() => {
    const prevLen = prevHandLenRef.current;
    prevHandLenRef.current = myHand.length;
    if (asSpectator || myHand.length === 0 || myHand.length <= prevLen) return;
    if (stateSnap?.phase !== "playing") return;
    const wrap = overlayWrapRef.current;
    const deck = deckRef.current;
    const handEl = myHandRef.current;
    if (!wrap || !deck || !handEl) return;
    const wr = wrap.getBoundingClientRect();
    const dr = deck.getBoundingClientRect();
    const hr = handEl.getBoundingClientRect();
    // Match the CSS card width: min(clamp(96px, 15vw, 170px), 28dvh / 1.5)
    const existing = handEl.querySelector<HTMLElement>(".ll-hand-card");
    const w = existing
      ? existing.getBoundingClientRect().width
      : Math.min(
          Math.min(Math.max(96, window.innerWidth * 0.15), 170),
          (window.innerHeight * 0.28) / 1.5,
        );
    const idx = myHand.length - 1;
    setIncomingIdx(idx);
    setFlight({
      card: myHand[idx],
      from: {
        x: dr.left - wr.left + dr.width / 2,
        y: dr.top - wr.top + dr.height / 2,
      },
      to: {
        x: hr.left - wr.left + hr.width / 2,
        y: hr.top - wr.top + hr.height / 2,
      },
      w,
      h: w * 1.5,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myHand]);

  const onFlightDone = useCallback(() => {
    setFlight(null);
    setIncomingIdx(null);
  }, []);

  // ─── Round/game end: delay modals so the last announcement plays ─── //
  const [showRoundEndModal, setShowRoundEndModal] = useState(false);
  useEffect(() => {
    if (phase !== "roundEnd") {
      setShowRoundEndModal(false);
      return;
    }
    const t = setTimeout(() => setShowRoundEndModal(true), 1300);
    return () => clearTimeout(t);
  }, [phase]);

  const [showGameEndModal, setShowGameEndModal] = useState(false);
  useEffect(() => {
    if (phase !== "gameEnd") {
      setShowGameEndModal(false);
      return;
    }
    overlayRef.current?.playEffect({ kind: "confetti" });
    const t = setTimeout(() => setShowGameEndModal(true), 900);
    return () => clearTimeout(t);
  }, [phase]);

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
          title={stateSnap?.roomName ? `러브레터 · ${stateSnap.roomName}` : "러브레터"}
        >
          러브레터 {stateSnap?.roomName ? `· ${stateSnap.roomName}` : ""}
        </h1>
        <div className="row" style={{ gap: 8, flexShrink: 0 }}>
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

      {status.kind === "connecting" && <p className="muted" style={{ margin: 0 }}>방에 연결 중…</p>}
      {status.kind === "error" && <div className="error" style={{ marginTop: 0 }}>{status.error}</div>}
      {status.kind === "closed" && <RoomClosedRedirect />}

      {phase === "lobby" && stateSnap && (
        <div className="play-grid">
          <div className="col" style={{ minHeight: 0, overflowY: "auto" }}>
            <LobbyView
              state={stateSnap}
              meSid={meSid!}
              isHost={isHost && !asSpectator}
              onReady={() => room?.send("toggleReady")}
              onStart={() => room?.send("startGame")}
              spectating={asSpectator}
            />
          </div>
          <div className="play-side">
            <ActionLog log={stateSnap?.log ?? []} />
            {!asSpectator && (
              <ChatBox
                value={chatInput}
                onChange={setChatInput}
                onSubmit={sendChat}
              />
            )}
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
            publicDiscard={stateSnap?.publicDiscard ?? []}
            myHand={asSpectator ? [] : myHand}
            isMyTurn={canAct}
            myEliminated={!!me?.eliminated}
            myTokens={me?.tokens ?? 0}
            myNickname={asSpectator ? "관전 중" : (user?.nickname ?? "나")}
            myProtected={!!me?.protected}
            targeting={targeting}
            targetableSids={targetableSids}
            countessRestriction={countessRestriction}
            shakeKeys={shakeKeys}
            incomingIdx={incomingIdx}
            flight={flight}
            showTurnBanner={showTurnBanner}
            announcement={announcement}
            announcementLeaving={announcementLeaving}
            resolveAnchor={resolveAnchor}
            onPickCard={onPickCard}
            onSeatTarget={onSeatTarget}
            onGuess={onGuess}
            onConfirm={onConfirm}
            onCancel={cancelTargeting}
            onFlightDone={onFlightDone}
            meSid={meSid}
            seatRefs={seatRefs}
            myHandRef={myHandRef}
            deckRef={deckRef}
            overlayWrapRef={overlayWrapRef}
            overlayRef={overlayRef}
          />
          <div className="play-side">
            <ActionLog log={stateSnap?.log ?? []} />
            {!asSpectator && (
              <ChatBox
                value={chatInput}
                onChange={setChatInput}
                onSubmit={sendChat}
              />
            )}
            <ScorePanel players={players} meSid={meSid!} />
          </div>
        </div>
      )}

      {phase === "roundEnd" && stateSnap && showRoundEndModal && (
        <Modal>
          <h2 className="title" style={{ margin: 0 }}>라운드 종료</h2>
          {stateSnap.roundWinnerId && (
            <p style={{ margin: 0 }}>
              승자:{" "}
              <strong style={{ color: "var(--gold-soft)" }}>
                {players.find((p) => p.sessionId === stateSnap.roundWinnerId)?.nickname}
              </strong>
            </p>
          )}
          {revealed && (
            <div className="col" style={{ gap: 6 }}>
              <h3 className="title" style={{ margin: 0, fontSize: "1rem" }}>최종 손패</h3>
              {Object.entries(revealed).map(([sid, cards]) => {
                const player = players.find((p) => p.sessionId === sid);
                const isWinner = sid === stateSnap.roundWinnerId;
                return (
                  <div
                    key={sid}
                    className={`ll-reveal-row${isWinner ? " ll-winner-row" : ""}`}
                  >
                    <span style={{ minWidth: 110, fontSize: 14 }}>
                      {isWinner ? "👑 " : ""}
                      {player?.nickname ?? sid}
                    </span>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                      {cards.map((c, i) => (
                        <CardImage key={i} card={c} size={64} />
                      ))}
                      {cards.length === 0 && (
                        <span className="muted" style={{ fontSize: 13 }}>
                          (탈락)
                        </span>
                      )}
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

      {phase === "gameEnd" && stateSnap && showGameEndModal && (
        <Modal backdrop="rgba(8,5,22,0.5)">
          <h2 className="title" style={{ margin: 0 }}>🏆 게임 종료</h2>
          <p style={{ margin: 0 }}>
            최종 승자:{" "}
            <strong
              style={{
                color: "var(--gold-soft)",
                fontFamily: "var(--font-display)",
              }}
            >
              {players.find((p) => p.sessionId === stateSnap.gameWinnerId)?.nickname}
            </strong>
          </p>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button onClick={leave}>로비로</button>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ────────────────────────────────────────────────────────────────────────────

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

const LobbyView = ({
  state,
  meSid,
  isHost,
  onReady,
  onStart,
  spectating = false,
}: {
  state: any;
  meSid: string;
  isHost: boolean;
  onReady: () => void;
  onStart: () => void;
  spectating?: boolean;
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
              {p.nickname}{p.sessionId === meSid && " (나)"}
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
        {spectating ? (
          <span className="muted" style={{ fontSize: 13 }}>👁 관전 중 — 게임 시작을 기다리세요</span>
        ) : (
          <>
            {!isHost && <button onClick={onReady}>준비 토글</button>}
            {isHost && (
              <button onClick={onStart} disabled={players.length < 2 || !ready}>
                시작
              </button>
            )}
          </>
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

const Modal = ({
  children,
  backdrop = "rgba(8,5,22,0.7)",
}: {
  children: React.ReactNode;
  backdrop?: string;
}) => (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: backdrop,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 40,
    }}
  >
    <div className="panel col" style={{ width: "min(560px, 92vw)", maxHeight: "86dvh", overflowY: "auto" }}>
      {children}
    </div>
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
