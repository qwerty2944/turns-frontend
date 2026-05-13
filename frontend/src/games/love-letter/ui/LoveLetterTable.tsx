"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Room } from "@colyseus/sdk";
import { useGameRoom } from "@/features/game-session/lib/useGameRoom";
import { useAuthStore } from "@/entities/user/model/authStore";
import { CARD, CARD_NAMES_KR } from "../model/cards";
import { PlayCardModal } from "./PlayCardModal";
import { CardImage } from "./CardImage";
import { ActionLog } from "./ActionLog";

type Props = {
  mode: "create" | "join";
  roomId?: string;
  roomName?: string;
  maxPlayers?: number;
};

type SceneStateRef = { update: (s: any) => void } | null;

export const LoveLetterTable = (props: Props) => {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneStateRef>(null);
  const phaserGameRef = useRef<any>(null);

  const { room, status } = useGameRoom({
    roomName: "love_letter",
    mode: props.mode,
    roomId: props.roomId,
    displayName: props.roomName,
    maxPlayers: props.maxPlayers,
  });

  const [stateSnap, setStateSnap] = useState<any>(null);
  const [myHand, setMyHand] = useState<number[]>([]);
  const [, force] = useState(0);
  const [peek, setPeek] = useState<{ nickname: string; card: number } | null>(null);
  const [revealed, setRevealed] = useState<Record<string, number[]> | null>(null);
  const [playing, setPlaying] = useState<number | null>(null);

  // Mount Phaser scene lazily on the client.
  useEffect(() => {
    let destroyed = false;
    (async () => {
      const Phaser = (await import("phaser")).default;
      const { LoveLetterScene } = await import("../scene/LoveLetterScene");
      if (destroyed || !hostRef.current) return;
      const game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: hostRef.current,
        backgroundColor: "#140d2e",
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        width: hostRef.current.clientWidth,
        height: 480,
        scene: [LoveLetterScene],
      });
      phaserGameRef.current = game;
      game.events.once("ready", () => {
        const sc = game.scene.getScene("love-letter") as InstanceType<
          typeof LoveLetterScene
        >;
        sc.setListener({
          onCardClick: (card) => setPlaying(card),
        });
        sceneRef.current = {
          update: (s) => sc.updateState(s),
        };
        force((n) => n + 1);
      });
    })();
    return () => {
      destroyed = true;
      if (phaserGameRef.current) {
        phaserGameRef.current.destroy(true);
        phaserGameRef.current = null;
      }
    };
  }, []);

  // Wire Colyseus state to scene + react UI
  useEffect(() => {
    if (!room) return;
    const r = room as Room;
    const onChange = () => setStateSnap(toSnap(r.state));
    // Initial + every state change
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

  // When a new round begins, hide reveal modal
  useEffect(() => {
    if (stateSnap?.phase === "playing" && revealed) setRevealed(null);
  }, [stateSnap?.phase, revealed]);

  // Push state to Phaser
  useEffect(() => {
    if (!stateSnap || !sceneRef.current || !room) return;
    const meSid = (room as Room).sessionId;
    const players: any[] = Object.values(stateSnap.players);
    const me = players.find((p) => p.sessionId === meSid);
    const opponents = players
      .filter((p) => p.sessionId !== meSid)
      .map((p) => ({
        sessionId: p.sessionId,
        nickname: p.nickname,
        discard: p.discard,
        eliminated: p.eliminated,
        protected: p.protected,
        tokens: p.tokens,
        isTurn: stateSnap.turnOrder?.[stateSnap.turnIndex] === p.sessionId,
      }));
    sceneRef.current.update({
      myHand,
      opponents,
      isMyTurn: stateSnap.turnOrder?.[stateSnap.turnIndex] === meSid,
      deckRemaining: stateSnap.deckRemaining,
      myTokens: me?.tokens ?? 0,
      myEliminated: me?.eliminated ?? false,
      myProtected: me?.protected ?? false,
    });
  }, [stateSnap, myHand, room]);

  const players: any[] = stateSnap ? Object.values(stateSnap.players) : [];
  const meSid = room?.sessionId;
  const me = players.find((p) => p.sessionId === meSid);
  const isHost = stateSnap?.hostSessionId === meSid;
  const isMyTurn = stateSnap?.turnOrder?.[stateSnap.turnIndex] === meSid;
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

  return (
    <div className="container-wide">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <h1 className="title" style={{ margin: 0 }}>
          러브레터 {stateSnap?.roomName ? `· ${stateSnap.roomName}` : ""}
        </h1>
        <div className="row">
          <span className="muted">{user?.nickname}</span>
          <button onClick={leave}>나가기</button>
        </div>
      </div>

      {status.kind === "connecting" && <p className="muted">방에 연결 중…</p>}
      {status.kind === "error" && <div className="error">{status.error}</div>}

      {phase === "lobby" && stateSnap && (
        <LobbyView
          state={stateSnap}
          meSid={meSid!}
          isHost={isHost}
          onReady={() => room?.send("toggleReady")}
          onStart={() => room?.send("startGame")}
        />
      )}

      {phase !== "lobby" && (
        <>
          <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
            <div ref={hostRef} style={{ width: "100%", height: 480 }} />
          </div>

          <div className="row" style={{ marginTop: 12, alignItems: "flex-start", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <ActionLog log={stateSnap?.log ?? []} />
            </div>
            <div className="panel col" style={{ flex: 1 }}>
              <h3 className="title" style={{ margin: 0, fontSize: "1rem" }}>점수</h3>
              {players.map((p) => (
                <div key={p.sessionId} className="row" style={{ justifyContent: "space-between" }}>
                  <span>
                    {p.sessionId === meSid ? "나" : p.nickname}
                    {p.eliminated && " 💀"}
                  </span>
                  <span className="muted">❤ {p.tokens}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {peek && (
        <FloatingNote onClose={() => setPeek(null)}>
          <strong>{peek.nickname}</strong>의 카드는 <strong>{CARD_NAMES_KR[peek.card]}</strong> 입니다.
        </FloatingNote>
      )}

      {phase === "roundEnd" && stateSnap && (
        <Modal>
          <h2 className="title" style={{ margin: 0 }}>라운드 종료</h2>
          {stateSnap.roundWinnerId && (
            <p>
              승자: <strong>
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
          <button
            onClick={onStart}
            disabled={players.length < 2 || !ready}
          >
            시작
          </button>
        )}
      </div>
    </div>
  );
};

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

// Convert Colyseus Schema (with MapSchema/ArraySchema) into plain snapshot.
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
