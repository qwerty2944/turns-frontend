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
import dynamic from "next/dynamic";
import type { Room } from "@colyseus/sdk";
import { useGameRoom } from "@/features/game-session/lib/useGameRoom";
import { useAuthStore } from "@/entities/user/model/authStore";
import { exitGameToApp, isInApp } from "@/shared/lib/appBridge";
import { useAppLobby } from "@/shared/lib/useAppLobby";
import { cardArt, cardView, FACTION_META } from "../model/cards";
import {
  toSnap,
  type FxBatch,
  type Loc,
  type PlayerSnap,
  type Snap,
} from "../model/types";
import { useFxQueue, type FxHandlers, type YdAnnouncement } from "../model/useFxQueue";
import { useAttackAnim } from "../model/useAttackAnim";
import {
  attackTargets,
  IDLE,
  selectorTargets,
  targetingReducer,
} from "../model/targeting";
import { UnitCard } from "./UnitCard";
import { HandCard } from "./HandCard";
import { HeroPlate } from "./HeroPlate";
import { EndTurnButton } from "./EndTurnButton";
import { PopLayer, type Pop } from "./PopLayer";
import { CenterStage } from "./CenterStage";
import { VictoryScreen } from "./VictoryScreen";
import type { EffectsOverlayHandle } from "./PhaserEffectsOverlay";

const PhaserEffectsOverlay = dynamic(() => import("./PhaserEffectsOverlay"), {
  ssr: false,
});

const TURN_MS = 75_000;
const BOARD_MAX = 5;
const HERO_POWER_COST = 2;

type Props = {
  mode: "create" | "join";
  roomId?: string;
  roomName?: string;
  maxPlayers?: number;
  asSpectator?: boolean;
  maskNicknames?: boolean;
};

export const YeouidoTable = (props: Props) => {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const asSpectator = !!props.asSpectator;

  const { room, status } = useGameRoom({
    roomName: "yeouido",
    mode: props.mode,
    roomId: props.roomId,
    displayName: props.roomName,
    maxPlayers: 2,
    asSpectator,
    maskNicknames: props.maskNicknames,
  });

  const [snap, setSnap] = useState<Snap | null>(null);
  const snapRef = useRef<Snap | null>(null);
  const [myHand, setMyHand] = useState<string[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [pops, setPops] = useState<Pop[]>([]);
  const [hoverCardId, setHoverCardId] = useState<string | null>(null);
  const [drawFlights, setDrawFlights] = useState<
    { id: number; enemy: boolean; from: { x: number; y: number }; to: { x: number; y: number }; go: boolean }[]
  >([]);
  const flightIdRef = useRef(0);
  const handRowRef = useRef<HTMLDivElement | null>(null);
  const popIdRef = useRef(0);
  const [stage, setStage] = useState<{ a: YdAnnouncement; id: number } | null>(null);
  const stageIdRef = useRef(0);
  const stageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [victor, setVictor] = useState<string | null>(null);
  const pendingRef = useRef(false);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── refs for animation anchors ───
  const unitRefs = useRef(new Map<string, HTMLDivElement | null>());
  const heroRefs = useRef(new Map<string, HTMLDivElement | null>());
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<EffectsOverlayHandle | null>(null);

  const { playAttack, anchorFor } = useAttackAnim({ unitRefs, heroRefs, wrapRef });

  const handlersRef = useRef<FxHandlers | null>(null);
  const { visual, animating, onFxBatch, onSnap } = useFxQueue({ snapRef, handlersRef });

  const meSid = room?.sessionId;
  const inApp = isInApp();

  // ─── fx handler implementations (reassigned every render; queue reads via ref) ───
  const announce = useCallback(
    (a: YdAnnouncement, ms: number) => {
      // 내가 낸 카드는 공개 연출 생략 (이미 내 손에서 봤으니까)
      if (a.kind === "play" && a.sid === meSid) return;
      const id = ++stageIdRef.current;
      setStage({ a, id });
      if (stageTimerRef.current) clearTimeout(stageTimerRef.current);
      stageTimerRef.current = setTimeout(() => {
        setStage((s) => (s && s.id === id ? null : s));
      }, ms + 250);
    },
    [meSid],
  );

  const domShake = () => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    wrap.classList.remove("yd-shake");
    void wrap.offsetWidth;
    wrap.classList.add("yd-shake");
  };

  handlersRef.current = {
    playAttack,
    drawFx: (sid: string) => {
      // 카드백이 드로어의 플레이트에서 손패(나) 또는 플레이트 옆(상대)으로 날아간다.
      const from = anchorFor({ sid, hero: true });
      if (!from || !wrapRef.current) return;
      const enemy = sid !== meSid;
      let to = { x: from.x + 70, y: from.y + (enemy ? 26 : -20) };
      if (!enemy && handRowRef.current) {
        const wr = wrapRef.current.getBoundingClientRect();
        const hr = handRowRef.current.getBoundingClientRect();
        to = { x: hr.left - wr.left + hr.width / 2, y: hr.top - wr.top + hr.height / 2 };
      }
      const id = ++flightIdRef.current;
      setDrawFlights((prev) => [...prev.slice(-5), { id, enemy, from, to, go: false }]);
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          setDrawFlights((prev) =>
            prev.map((f) => (f.id === id ? { ...f, go: true } : f)),
          ),
        ),
      );
      setTimeout(
        () => setDrawFlights((prev) => prev.filter((f) => f.id !== id)),
        620,
      );
    },
    impact: (at: Loc, power: number) => {
      const a = anchorFor(at);
      if (a) overlayRef.current?.playEffect({ kind: "impact", x: a.x, y: a.y, power });
      domShake();
    },
    pop: (at, n, kind) => {
      const a = anchorFor(at);
      if (!a) return;
      const id = ++popIdRef.current;
      setPops((prev) => [...prev.slice(-11), { id, x: a.x, y: a.y, n, kind }]);
      if (kind === "heal") {
        overlayRef.current?.playEffect({ kind: "heal", x: a.x, y: a.y });
      }
    },
    shatter: (at) => {
      const a = anchorFor(at);
      if (a) overlayRef.current?.playEffect({ kind: "shatter", x: a.x, y: a.y });
    },
    summonDust: (at) => {
      const a = anchorFor(at);
      if (a) overlayRef.current?.playEffect({ kind: "dust", x: a.x, y: a.y });
    },
    spellFx: (e) => {
      let a = e.at ? anchorFor(e.at) : null;
      if (!a && wrapRef.current) {
        const r = wrapRef.current.getBoundingClientRect();
        a = { x: r.width / 2, y: r.height / 2 };
      }
      if (a) overlayRef.current?.playEffect({ kind: "nova", x: a.x, y: a.y });
    },
    announce,
    onGameEnd: (winnerSid) => {
      overlayRef.current?.playEffect({ kind: "confetti" });
      setVictor(winnerSid);
    },
  };

  // ─── Colyseus wiring ───
  useEffect(() => {
    if (!room) return;
    const r = room as Room;
    r.onStateChange(() => {
      const s = toSnap(r.state);
      snapRef.current = s;
      setSnap(s);
      onSnap();
    });
    const first = toSnap(r.state);
    snapRef.current = first;
    setSnap(first);
    onSnap();

    r.onMessage("hand", (msg: { cards: string[] }) => {
      pendingRef.current = false;
      setMyHand(msg.cards ?? []);
    });
    r.onMessage("fx", (batch: FxBatch) => {
      pendingRef.current = false;
      onFxBatch(batch);
    });
  }, [room, onSnap, onFxBatch]);

  // ─── Flutter app bridge: native pre-game lobby drives this hidden page ───
  const appLobbySnap = useMemo(
    () =>
      snap
        ? {
            game: "yeouido",
            phase: snap.phase,
            meSid: room?.sessionId ?? "",
            hostSid: snap.hostSessionId,
            players: Object.values(snap.players).map((p) => ({
              sid: p.sessionId,
              nickname: p.nickname,
              faction: p.faction,
              ready: p.ready,
              connected: p.connected,
            })),
            log: snap.log.slice(-40).map((e) => ({
              ts: e.ts,
              kind: e.kind,
              text: e.text,
              actor: e.actor,
            })),
          }
        : null,
    [snap, room],
  );
  useAppLobby(room, appLobbySnap, {
    pickFaction: (p) =>
      room?.send("pickFaction", { faction: (p as { faction?: string })?.faction }),
  });

  // ─── derived ───
  const phase = snap?.phase ?? "lobby";
  const players: PlayerSnap[] = snap ? Object.values(snap.players) : [];
  const me = meSid ? snap?.players[meSid] : undefined;
  const bottom = !asSpectator && me ? me : players[0];
  const top = players.find((p) => p.sessionId !== bottom?.sessionId);
  const enemySid = top?.sessionId ?? "";
  const isHost = snap?.hostSessionId === meSid;
  const isMyTurn =
    !asSpectator && phase === "playing" && !!meSid && snap?.turnSid === meSid;

  const nicknameOf = useCallback(
    (sid: string) => snap?.players[sid]?.nickname ?? "?",
    [snap],
  );

  // ─── targeting ───
  const [targeting, dispatchTargeting] = useReducer(targetingReducer, IDLE);
  const cancelTargeting = useCallback(() => dispatchTargeting({ type: "cancel" }), []);

  const targetInfo = useMemo(() => {
    const empty = { unitUids: new Set<string>(), heroSids: new Set<string>() };
    if (!meSid || !isMyTurn) return empty;
    if (targeting.mode === "handPick" && !targeting.confirm) {
      const view = cardView(targeting.cardId);
      if (view.target === "none") return empty;
      return selectorTargets(view.target, meSid, enemySid, visual);
    }
    if (targeting.mode === "attacking") {
      return attackTargets(targeting.attackerUid, meSid, enemySid, visual);
    }
    return empty;
  }, [targeting, meSid, enemySid, visual, isMyTurn]);

  // reset targeting when the situation shifts
  useEffect(() => {
    if (targeting.mode !== "idle") cancelTargeting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap?.turnSid, myHand, phase]);

  useEffect(() => {
    if (targeting.mode === "idle") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelTargeting();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [targeting.mode, cancelTargeting]);

  const markPending = () => {
    pendingRef.current = true;
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    pendingTimerRef.current = setTimeout(() => {
      pendingRef.current = false;
    }, 1500);
  };

  const sendPlay = (payload: {
    handIdx: number;
    targetUid?: string;
    targetHeroSid?: string;
  }) => {
    if (pendingRef.current) return;
    markPending();
    room?.send("playCard", payload);
    cancelTargeting();
  };

  const sendAttack = (payload: { attackerUid: string; targetUid?: string }) => {
    if (pendingRef.current) return;
    markPending();
    room?.send("attack", payload);
    cancelTargeting();
  };

  const canPlayCard = (cardId: string): boolean => {
    if (!me || !isMyTurn) return false;
    const view = cardView(cardId);
    if (me.mana < view.cost) return false;
    if (view.type === "unit" && (visual?.boards[meSid!]?.length ?? 0) >= BOARD_MAX) {
      return false;
    }
    if (view.type === "spell" && view.target !== "none") {
      const t = selectorTargets(view.target, meSid!, enemySid, visual);
      if (t.unitUids.size === 0 && t.heroSids.size === 0) return false;
    }
    return true;
  };

  const onHandClick = (idx: number) => {
    if (!isMyTurn || pendingRef.current) return;
    const cardId = myHand[idx];
    if (!cardId || !canPlayCard(cardId)) return;
    const view = cardView(cardId);

    if (targeting.mode === "handPick" && targeting.handIdx === idx) {
      if (targeting.confirm) {
        sendPlay({ handIdx: idx });
      } else {
        cancelTargeting();
      }
      return;
    }

    if (view.target === "none") {
      dispatchTargeting({ type: "pickHand", handIdx: idx, cardId, confirm: true });
      return;
    }
    const t = selectorTargets(view.target, meSid!, enemySid, visual);
    const hasAny = t.unitUids.size > 0 || t.heroSids.size > 0;
    if (!hasAny) {
      // battlecry fizzles — confirm play; targeted spells were filtered by canPlayCard
      dispatchTargeting({ type: "pickHand", handIdx: idx, cardId, confirm: true });
      return;
    }
    dispatchTargeting({ type: "pickHand", handIdx: idx, cardId, confirm: false });
  };

  const onUnitClick = (uid: string, ownerSid: string) => {
    if (asSpectator || !meSid) return;
    if (
      targeting.mode === "handPick" &&
      !targeting.confirm &&
      targetInfo.unitUids.has(uid)
    ) {
      sendPlay({ handIdx: targeting.handIdx, targetUid: uid });
      return;
    }
    if (targeting.mode === "attacking") {
      if (targetInfo.unitUids.has(uid)) {
        sendAttack({ attackerUid: targeting.attackerUid, targetUid: uid });
        return;
      }
      if (targeting.attackerUid === uid) {
        cancelTargeting();
        return;
      }
    }
    if (ownerSid === meSid && isMyTurn) {
      const u = visual?.boards[meSid]?.find((x) => x.uid === uid);
      if (u && u.canAttack && u.atk > 0 && !u.dying) {
        dispatchTargeting({ type: "pickAttacker", attackerUid: uid });
        return;
      }
    }
    if (targeting.mode !== "idle") cancelTargeting();
  };

  const onHeroClick = (sid: string) => {
    if (asSpectator || !meSid) return;
    if (
      targeting.mode === "handPick" &&
      !targeting.confirm &&
      targetInfo.heroSids.has(sid)
    ) {
      sendPlay({ handIdx: targeting.handIdx, targetHeroSid: sid });
      return;
    }
    if (targeting.mode === "attacking" && targetInfo.heroSids.has(sid)) {
      sendAttack({ attackerUid: targeting.attackerUid });
      return;
    }
    if (targeting.mode !== "idle") cancelTargeting();
  };

  const onHeroPower = () => {
    if (!isMyTurn || !me || me.heroPowerUsed || me.mana < HERO_POWER_COST) return;
    if (pendingRef.current) return;
    markPending();
    room?.send("heroPower");
    cancelTargeting();
  };

  const onEndTurn = () => {
    if (!isMyTurn) return;
    cancelTargeting();
    room?.send("endTurn");
  };

  // gameEnd fallback (reconnect into a finished game / missed fx)
  useEffect(() => {
    if (phase !== "gameEnd") {
      setVictor(null);
      return;
    }
    const t = setTimeout(() => {
      setVictor((v) => v ?? snapRef.current?.winnerSid ?? null);
    }, 1800);
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

  // ─── render ───
  return (
    <div className="play-shell">
      <div className="row row-wrap" style={{ justifyContent: "space-between", gap: 8 }}>
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
        >
          여의도 대전 {snap?.roomName ? `· ${snap.roomName}` : ""}
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

      {status.kind === "connecting" && (
        <p className="muted" style={{ margin: 0 }}>방에 연결 중…</p>
      )}
      {/* 접속 자체가 실패했을 때만 배너 — 상태가 살아있으면(재접속 등) 노이즈 억제 */}
      {status.kind === "error" && !snap && (
        <div className="error" style={{ marginTop: 0 }}>{status.error}</div>
      )}
      {status.kind === "closed" && <RoomClosedRedirect />}

      {phase === "lobby" && snap && (
        <div className="play-grid">
          <div className="col" style={{ minHeight: 0, overflowY: "auto" }}>
            <FactionLobby
              snap={snap}
              meSid={meSid}
              isHost={isHost && !asSpectator}
              spectating={asSpectator}
              onPick={(f) => room?.send("pickFaction", { faction: f })}
              onReady={() => room?.send("toggleReady")}
              onStart={() => room?.send("startGame")}
            />
          </div>
          <SidePanel
            snap={snap}
            chatInput={chatInput}
            onChat={setChatInput}
            onSend={sendChat}
            spectating={asSpectator}
          />
        </div>
      )}

      {phase !== "lobby" && snap && bottom && (
        <div
          className="play-grid"
          style={inApp ? { gridTemplateColumns: "minmax(0, 1fr)" } : undefined}
        >
          <div
            ref={wrapRef}
            className="panel yd-table"
            onClick={(e) => {
              if (targeting.mode === "idle") return;
              const el = e.target as HTMLElement;
              if (el.closest(".yd-unit, .yd-card, .yd-hero-portrait-wrap, .yd-action-strip, button")) {
                return;
              }
              cancelTargeting();
            }}
          >
            {/* enemy hero */}
            {top && (
              <HeroPlate
                player={top}
                visualHp={visual?.heroes[top.sessionId]?.hp ?? top.hp}
                hitKey={visual?.heroes[top.sessionId]?.hitKey ?? 0}
                mine={false}
                isTurn={snap.turnSid === top.sessionId}
                targetable={targetInfo.heroSids.has(top.sessionId)}
                heroPowerUsable={false}
                registerRef={(el) => heroRefs.current.set(top.sessionId, el)}
                onClick={() => onHeroClick(top.sessionId)}
                onHeroPower={() => {}}
              />
            )}

            {/* enemy board */}
            <div className="yd-board yd-board--enemy">
              {(top ? (visual?.boards[top.sessionId] ?? []) : []).map((u) => (
                <UnitCard
                  key={u.uid}
                  unit={u}
                  mine={false}
                  glowAttack={false}
                  targetable={targetInfo.unitUids.has(u.uid)}
                  selected={false}
                  registerRef={(el) => unitRefs.current.set(u.uid, el)}
                  onClick={() => top && onUnitClick(u.uid, top.sessionId)}
                />
              ))}
              {top && (visual?.boards[top.sessionId]?.length ?? 0) === 0 && (
                <span className="yd-board-empty" />
              )}
            </div>

            {/* my board */}
            <div className="yd-board yd-board--mine">
              {(visual?.boards[bottom.sessionId] ?? []).map((u) => (
                <UnitCard
                  key={u.uid}
                  unit={u}
                  mine={!asSpectator}
                  glowAttack={
                    isMyTurn && u.canAttack && u.atk > 0 && !u.dying &&
                    targeting.mode !== "attacking"
                  }
                  targetable={targetInfo.unitUids.has(u.uid)}
                  selected={targeting.mode === "attacking" && targeting.attackerUid === u.uid}
                  registerRef={(el) => unitRefs.current.set(u.uid, el)}
                  onClick={() => onUnitClick(u.uid, bottom.sessionId)}
                />
              ))}
              {(visual?.boards[bottom.sessionId]?.length ?? 0) === 0 && (
                <span className="yd-board-empty" />
              )}
            </div>

            {/* my hero */}
            <HeroPlate
              player={bottom}
              visualHp={visual?.heroes[bottom.sessionId]?.hp ?? bottom.hp}
              hitKey={visual?.heroes[bottom.sessionId]?.hitKey ?? 0}
              mine={!asSpectator}
              isTurn={snap.turnSid === bottom.sessionId}
              targetable={targetInfo.heroSids.has(bottom.sessionId)}
              heroPowerUsable={
                isMyTurn && !!me && !me.heroPowerUsed && me.mana >= HERO_POWER_COST &&
                !pendingRef.current
              }
              registerRef={(el) => heroRefs.current.set(bottom.sessionId, el)}
              onClick={() => onHeroClick(bottom.sessionId)}
              onHeroPower={onHeroPower}
            />

            {/* my hand */}
            {!asSpectator && (
              <div className="yd-hand-zone">
                {/* 카드 설명 프리뷰 — 스크롤 컨테이너에 잘리지 않는 고정 바.
                    호버(데스크톱) 또는 선택(터치) 시 손패 위에 표시 */}
                {(() => {
                  const previewId =
                    targeting.mode === "handPick"
                      ? targeting.cardId
                      : targeting.mode === "idle"
                        ? hoverCardId
                        : null;
                  if (!previewId) return null;
                  const v = cardView(previewId);
                  return (
                    <div
                      className="yd-action-strip yd-card-preview"
                      style={
                        targeting.mode === "handPick"
                          ? { bottom: "calc(100% + 50px)" }
                          : undefined
                      }
                    >
                      <span className="yd-preview-name">
                        ({v.cost}) {v.name}
                        {v.type === "unit" ? ` · ${v.atk}/${v.hp}` : ""}
                      </span>
                      <span className="yd-preview-text">
                        {v.text || v.flavor}
                      </span>
                    </div>
                  );
                })()}
                {targeting.mode === "handPick" && (
                  <div className="yd-action-strip">
                    {targeting.confirm ? (
                      <>
                        <span>{cardView(targeting.cardId).name} 사용할까요?</span>
                        <button onClick={() => sendPlay({ handIdx: targeting.handIdx })}>
                          사용
                        </button>
                      </>
                    ) : (
                      <>
                        <span style={{ color: "var(--gold-soft)" }}>
                          ⬆ 대상을 선택하세요
                        </span>
                        {cardView(targeting.cardId).type === "unit" && (
                          <button onClick={() => sendPlay({ handIdx: targeting.handIdx })}>
                            효과 없이 소환
                          </button>
                        )}
                      </>
                    )}
                    <button onClick={cancelTargeting}>취소</button>
                  </div>
                )}
                {targeting.mode === "attacking" && (
                  <div className="yd-action-strip">
                    <span style={{ color: "var(--danger)" }}>⚔ 공격 대상을 선택하세요</span>
                    <button onClick={cancelTargeting}>취소</button>
                  </div>
                )}
                <div
                  ref={handRowRef}
                  className={`yd-hand${myHand.length > 5 ? " yd-hand--crowded" : ""}`}
                >
                  {myHand.map((cardId, idx) => (
                    <HandCard
                      key={`${cardId}-${idx}`}
                      cardId={cardId}
                      playable={canPlayCard(cardId)}
                      selected={targeting.mode === "handPick" && targeting.handIdx === idx}
                      onClick={() => onHandClick(idx)}
                      onHover={setHoverCardId}
                    />
                  ))}
                  {myHand.length === 0 && <span className="muted">손패 없음</span>}
                </div>
              </div>
            )}

            {/* end turn + overlays */}
            <EndTurnButton
              isMyTurn={isMyTurn}
              turnEndsAt={snap.turnEndsAt}
              turnMs={TURN_MS}
              onEndTurn={onEndTurn}
            />
            <PhaserEffectsOverlay ref={overlayRef} />
            {drawFlights.map((f) => (
              <div
                key={f.id}
                className={`yd-draw-fly${f.enemy ? " yd-draw-fly--enemy" : ""}`}
                style={{
                  left: f.from.x - (f.enemy ? 20 : 26),
                  top: f.from.y - (f.enemy ? 28 : 37),
                  transform: f.go
                    ? `translate(${f.to.x - f.from.x}px, ${f.to.y - f.from.y}px) rotate(12deg) scale(${f.enemy ? 0.7 : 0.9})`
                    : "translate(0,0)",
                  opacity: f.go ? 0.15 : 1,
                }}
              >
                <div className="yd-cardback">◆</div>
              </div>
            ))}
            <PopLayer
              pops={pops}
              onDone={(id) => setPops((prev) => prev.filter((p) => p.id !== id))}
            />
            <CenterStage stage={stage} meSid={meSid} nicknameOf={nicknameOf} />
          </div>

          {/* 앱에서는 네이티브 채팅/로그가 담당 — 웹뷰 패널 숨김 */}
          {!inApp && (
            <SidePanel
              snap={snap}
              chatInput={chatInput}
              onChat={setChatInput}
              onSend={sendChat}
              spectating={asSpectator}
            />
          )}
        </div>
      )}

      {victor && snap && (
        <VictoryScreen
          won={victor === meSid}
          winnerName={nicknameOf(victor)}
          spectating={asSpectator}
          onLeave={leave}
        />
      )}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────
// Lobby — faction pick
// ────────────────────────────────────────────────────────────────────

const FactionLobby = ({
  snap,
  meSid,
  isHost,
  spectating,
  onPick,
  onReady,
  onStart,
}: {
  snap: Snap;
  meSid?: string;
  isHost: boolean;
  spectating: boolean;
  onPick: (f: "ruling" | "opposition") => void;
  onReady: () => void;
  onStart: () => void;
}) => {
  const players = Object.values(snap.players);
  const me = meSid ? snap.players[meSid] : undefined;
  const factionsPicked = players.length === 2 && players.every((p) => p.faction);
  const allReady = players.every(
    (p) => p.ready || p.sessionId === snap.hostSessionId,
  );
  const canStart = isHost && players.length === 2 && factionsPicked && allReady;

  return (
    <div className="panel col" style={{ gap: 14 }}>
      <h2 className="title" style={{ margin: 0, fontSize: "1.2rem" }}>후보 등록</h2>
      <p className="muted" style={{ margin: 0 }}>
        진영을 선택하세요. 두 후보가 모두 등록하면 방장이 선거를 시작합니다.
      </p>

      <div className="yd-faction-row">
        {(["ruling", "opposition"] as const).map((f) => {
          const meta = FACTION_META[f];
          const holder = players.find((p) => p.faction === f);
          const mine = holder?.sessionId === meSid;
          const takenByOther = !!holder && !mine;
          return (
            <button
              key={f}
              className={`yd-faction yd-faction--${f}${mine ? " yd-faction--mine" : ""}${
                takenByOther ? " yd-faction--taken" : ""
              }`}
              disabled={spectating || takenByOther}
              onClick={() => onPick(f)}
            >
              <div
                className="yd-faction-portrait"
                style={{ backgroundImage: `url(/games/yeouido/${meta.artKey}.png)` }}
              />
              <strong className="yd-faction-name">{meta.heroName}</strong>
              <span className="yd-faction-label">{meta.label}</span>
              <span className="yd-faction-power">
                {meta.heroPowerName} — {meta.heroPowerText}
              </span>
              {holder && (
                <span className="yd-faction-holder">
                  {mine ? "✅ 나의 진영" : `${holder.nickname} 선택`}
                </span>
              )}
            </button>
          );
        })}
      </div>

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
            }}
          >
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {p.sessionId === snap.hostSessionId && "👑 "}
              {p.nickname}
              {p.sessionId === meSid && " (나)"}
              {p.faction && ` · ${FACTION_META[p.faction as "ruling" | "opposition"]?.label}`}
            </span>
            <span className="muted" style={{ flexShrink: 0, fontSize: 13 }}>
              {p.sessionId === snap.hostSessionId ? "방장" : p.ready ? "✅ 준비" : "대기"}
            </span>
          </div>
        ))}
        {players.length < 2 && (
          <span className="muted" style={{ fontSize: 13 }}>상대 후보를 기다리는 중…</span>
        )}
      </div>

      <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
        {spectating ? (
          <span className="muted" style={{ fontSize: 13 }}>👁 관전 중 — 선거 시작을 기다리세요</span>
        ) : (
          <>
            {!isHost && (
              <button onClick={onReady} disabled={!me?.faction}>
                준비 토글
              </button>
            )}
            {isHost && (
              <button onClick={onStart} disabled={!canStart}>
                선거 시작
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────
// Side panel: log + chat
// ────────────────────────────────────────────────────────────────────

const SidePanel = ({
  snap,
  chatInput,
  onChat,
  onSend,
  spectating,
}: {
  snap: Snap;
  chatInput: string;
  onChat: (v: string) => void;
  onSend: () => void;
  spectating: boolean;
}) => (
  <div className="play-side">
    <LogPanel snap={snap} />
    {!spectating && (
      <form
        className="panel row"
        style={{ gap: 8 }}
        onSubmit={(e) => {
          e.preventDefault();
          onSend();
        }}
      >
        <input
          value={chatInput}
          onChange={(e) => onChat(e.target.value)}
          placeholder="채팅 입력… (Enter)"
          maxLength={120}
        />
        <button type="submit" disabled={!chatInput.trim()} style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
          전송
        </button>
      </form>
    )}
  </div>
);

const LOG_COLORS: Record<string, string> = {
  system: "var(--muted)",
  turn: "var(--gold-soft)",
  play: "var(--text)",
  combat: "#ff9b9b",
  result: "#f6d36b",
  info: "var(--muted)",
};

const LogPanel = ({ snap }: { snap: Snap }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [snap.log.length]);

  return (
    <div className="panel panel-log col" style={{ gap: 8 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3 className="title" style={{ margin: 0, fontSize: "1rem" }}>선거 상황</h3>
        <span className="muted" style={{ fontSize: 12 }}>{snap.log.length}개</span>
      </div>
      <div
        ref={ref}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          paddingRight: 4,
        }}
      >
        {snap.log.length === 0 && (
          <span className="muted" style={{ fontSize: 13 }}>아직 기록 없음</span>
        )}
        {snap.log.map((e, i) => (
          <div
            key={`${e.ts}-${i}`}
            style={{
              fontSize: 13,
              padding: "3px 8px",
              borderRadius: 4,
              color: LOG_COLORS[e.kind] ?? "var(--text)",
              lineHeight: 1.5,
            }}
          >
            <span>{e.text}</span>
            {e.card && (
              <span
                title={cardView(e.card).name}
                style={{
                  display: "inline-block",
                  width: 20,
                  height: 26,
                  verticalAlign: "middle",
                  marginLeft: 5,
                  backgroundImage: `url(${cardArt(e.card)})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center top",
                  borderRadius: 3,
                  border: "1px solid rgba(217,182,108,0.5)",
                }}
              />
            )}
          </div>
        ))}
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

export default YeouidoTable;
