"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { Room } from "@colyseus/sdk";
import { useGameRoom } from "@/features/game-session/lib/useGameRoom";
import { exitGameToApp } from "@/shared/lib/appBridge";
import { useAppLobby } from "@/shared/lib/useAppLobby";
import { useAuthStore } from "@/entities/user/model/authStore";
import { Board, type BoardHandle } from "./Board";
import { MiniBoard, type MiniBoardHandle } from "./MiniBoard";
import { SoftControls } from "./SoftControls";
import { Hud } from "./Hud";
import { KEY_BINDINGS, PIECE_COLOR, PIECE_SHAPES } from "../model/pieces";
import type {
  InputAction,
  LineClearedMsg,
  PlayerBoardSnap,
  TetrisStateSnap,
} from "../model/types";
import type { EffectsOverlayHandle } from "./PhaserEffectsOverlay";

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

const DAS_MS = 150;
const ARR_MS = 33;

export const TetrisTable = (props: Props) => {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const asSpectator = !!props.asSpectator;

  const { room, status } = useGameRoom({
    roomName: "tetris",
    mode: props.mode,
    roomId: props.roomId,
    displayName: props.roomName,
    maxPlayers: props.maxPlayers,
    asSpectator,
    maskNicknames: props.maskNicknames,
  });

  const [stateSnap, setStateSnap] = useState<TetrisStateSnap | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [highlight, setHighlight] = useState<{
    sid: string;
    rows: number[];
    until: number;
  } | null>(null);
  const [isTouch, setIsTouch] = useState(false);
  const isMobile = useViewportIsMobile();

  const overlayRef = useRef<EffectsOverlayHandle | null>(null);
  const overlayWrapRef = useRef<HTMLDivElement | null>(null);
  const myBoardRef = useRef<BoardHandle | null>(null);
  const miniRefs = useRef<Map<string, MiniBoardHandle | null>>(new Map());

  // ───────── room wiring ───────── //
  useEffect(() => {
    if (!room) return;
    const r = room as Room;
    const onChange = () => setStateSnap(toSnap(r.state));
    r.onStateChange(onChange);
    onChange();

    r.onMessage("lineCleared", (msg: LineClearedMsg) => {
      const overlay = overlayRef.current;
      if (!overlay) return;
      const boardRect = rectForBoard(msg.boardSid);
      if (boardRect) {
        overlay.playEffect({
          kind: "lineClear",
          board: boardRect,
          rows: msg.rows,
          count: msg.count,
        });
      }
      // Comet visuals only fire for ≥2-line clears (attack > 0).
      if (msg.attack > 0 && boardRect) {
        for (const targetSid of msg.attackTargets) {
          const toRect = rectForBoard(targetSid);
          if (!toRect) continue;
          overlay.playEffect({
            kind: "attackComet",
            from: boardRect,
            to: toRect,
            lines: msg.attack,
          });
        }
      }
      // Brief in-board row highlight pre-flash (200ms).
      setHighlight({ sid: msg.boardSid, rows: msg.rows, until: Date.now() + 220 });
    });

    r.onMessage("topOut", (msg: { boardSid: string }) => {
      const rect = rectForBoard(msg.boardSid);
      if (rect) overlayRef.current?.playEffect({ kind: "topOut", board: rect });
    });

    r.onMessage("roundWin", (msg: { boardSid: string }) => {
      const rect = rectForBoard(msg.boardSid);
      if (rect) overlayRef.current?.playEffect({ kind: "roundWin", board: rect });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  // Clear highlight after its window expires.
  useEffect(() => {
    if (!highlight) return;
    const t = setTimeout(() => {
      setHighlight((h) => (h && Date.now() >= h.until ? null : h));
    }, 240);
    return () => clearTimeout(t);
  }, [highlight]);

  // Detect coarse pointer once on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(hover: none) and (pointer: coarse)");
    const update = () => setIsTouch(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  // ───────── input ───────── //
  const sendAction = (action: InputAction) => {
    if (asSpectator) return;
    room?.send("input", { action });
  };

  // Keyboard handler with DAS/ARR for horizontal + soft-drop hold.
  useEffect(() => {
    if (!room) return;
    if (asSpectator) return;
    if (stateSnap?.phase !== "playing") return;
    const repeats = new Map<string, { das: any; arr: any }>();

    const startRepeat = (key: string, action: InputAction, arr = ARR_MS) => {
      sendAction(action);
      if (repeats.has(key)) return;
      const t = { das: null as any, arr: null as any };
      t.das = setTimeout(() => {
        t.arr = setInterval(() => sendAction(action), arr);
      }, DAS_MS);
      repeats.set(key, t);
    };

    const stopRepeat = (key: string) => {
      const t = repeats.get(key);
      if (!t) return;
      clearTimeout(t.das);
      clearInterval(t.arr);
      repeats.delete(key);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return; // ignore OS auto-repeat; we manage our own DAS
      const action = KEY_BINDINGS[e.key];
      if (!action) return;
      e.preventDefault();
      if (action === "left" || action === "right") {
        startRepeat(action, action);
      } else if (action === "softDrop") {
        startRepeat("softDrop", "softDrop", 33);
      } else {
        sendAction(action as InputAction);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const action = KEY_BINDINGS[e.key];
      if (!action) return;
      if (action === "left" || action === "right" || action === "softDrop") {
        stopRepeat(action === "softDrop" ? "softDrop" : action);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      for (const t of repeats.values()) {
        clearTimeout(t.das);
        clearInterval(t.arr);
      }
      repeats.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, stateSnap?.phase]);

  // ───────── derived ───────── //
  const players: PlayerBoardSnap[] = stateSnap
    ? Object.values(stateSnap.players)
    : [];
  const meSid = room?.sessionId;
  const me = players.find((p) => p.sessionId === meSid);
  const opponents = players.filter((p) => p.sessionId !== meSid);
  const isHost = stateSnap?.hostSessionId === meSid;
  // ─── Flutter 앱 네이티브 대기실 브릿지 (게임 시작 전 로비는 앱 UI가 담당) ───
  const appLobbySnap = useMemo(
    () =>
      stateSnap
        ? {
            game: "tetris",
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

  const rectForBoard = (sid: string): { x: number; y: number; width: number; height: number } | null => {
    const wrap = overlayWrapRef.current;
    if (!wrap) return null;
    const handle =
      sid === meSid ? myBoardRef.current : miniRefs.current.get(sid);
    const dom = handle?.getRect();
    if (!dom) return null;
    const wr = wrap.getBoundingClientRect();
    return {
      x: dom.left - wr.left,
      y: dom.top - wr.top,
      width: dom.width,
      height: dom.height,
    };
  };

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

  const highlightRowsForMe = useMemo(
    () => (highlight && highlight.sid === meSid ? highlight.rows : []),
    [highlight, meSid],
  );

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
          title={stateSnap?.roomName ? `테트리스 · ${stateSnap.roomName}` : "테트리스"}
        >
          테트리스 {stateSnap?.roomName ? `· ${stateSnap.roomName}` : ""}
        </h1>
        <div className="row" style={{ gap: 8, flexShrink: 0 }}>
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
              isHost={isHost && !asSpectator}
              onReady={() => room?.send("toggleReady")}
              onStart={() => room?.send("startGame")}
              spectating={asSpectator}
            />
          </div>
          <div className="play-side">
            <SidePanel
              stateSnap={stateSnap}
              meSid={meSid!}
              chatInput={chatInput}
              setChatInput={setChatInput}
              sendChat={sendChat}
            />
          </div>
        </div>
      )}

      {phase !== "lobby" && stateSnap && me && (
        isMobile ? (
          <div
            ref={overlayWrapRef}
            className="tetris-arena tetris-arena--mobile"
            style={{ position: "relative" }}
          >
            <MobileStatsBar board={me} />
            {opponents.length > 0 && (
              <div className="tetris-mini-rail">
                {opponents.map((op) => (
                  <div key={op.sessionId} className="tetris-mini-cell">
                    <MiniBoard
                      board={op}
                      ref={(h) => {
                        if (h) miniRefs.current.set(op.sessionId, h);
                        else miniRefs.current.delete(op.sessionId);
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
            <div className="tetris-board-wrap">
              <Board
                ref={myBoardRef}
                board={me}
                highlightRows={highlightRowsForMe}
              />
              {!me.alive && (
                <div className="tetris-game-over">💀 탈락</div>
              )}
            </div>
            <SoftControls
              enabled={me.alive && phase === "playing"}
              onAction={sendAction}
            />
            <PhaserEffectsOverlay ref={overlayRef} />
          </div>
        ) : (
          <div className="play-grid">
            <div
              ref={overlayWrapRef}
              className="tetris-arena"
              style={{ position: "relative" }}
            >
              {opponents.length > 0 && (
                <div className="tetris-mini-rail">
                  {opponents.map((op) => (
                    <div key={op.sessionId} className="tetris-mini-cell">
                      <MiniBoard
                        board={op}
                        ref={(h) => {
                          if (h) miniRefs.current.set(op.sessionId, h);
                          else miniRefs.current.delete(op.sessionId);
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="tetris-main">
                <div className="tetris-hud-left">
                  <Hud board={me} />
                </div>
                <div className="tetris-board-wrap">
                  <Board
                    ref={myBoardRef}
                    board={me}
                    highlightRows={highlightRowsForMe}
                  />
                  {!me.alive && (
                    <div className="tetris-game-over">💀 탈락</div>
                  )}
                </div>
              </div>

              <SoftControls
                enabled={me.alive && phase === "playing"}
                onAction={sendAction}
              />

              <PhaserEffectsOverlay ref={overlayRef} />
            </div>

            <div className="play-side">
              <SidePanel
                stateSnap={stateSnap}
                meSid={meSid!}
                chatInput={chatInput}
                setChatInput={setChatInput}
                sendChat={sendChat}
              />
            </div>
          </div>
        )
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
          <div className="col" style={{ gap: 4 }}>
            {players
              .slice()
              .sort((a, b) => b.tokens - a.tokens)
              .map((p) => (
                <div
                  key={p.sessionId}
                  className="row"
                  style={{ justifyContent: "space-between", fontSize: 13 }}
                >
                  <span>{p.sessionId === meSid ? "나" : p.nickname}</span>
                  <span className="muted">
                    🏆 {p.tokens} · {p.lines}줄 · {p.score}점
                  </span>
                </div>
              ))}
          </div>
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
    </div>
  );
};

// ───────── subcomponents ───────── //

const SidePanel = ({
  stateSnap,
  meSid,
  chatInput,
  setChatInput,
  sendChat,
}: {
  stateSnap: TetrisStateSnap;
  meSid: string;
  chatInput: string;
  setChatInput: (v: string) => void;
  sendChat: () => void;
}) => {
  const players = Object.values(stateSnap.players);
  return (
    <>
      <ActionLog log={stateSnap.log ?? []} />
      <ChatBox value={chatInput} onChange={setChatInput} onSubmit={sendChat} />
      <ScorePanel players={players} meSid={meSid} tokensToWin={stateSnap.tokensToWin} />
    </>
  );
};

const ActionLog = ({ log }: { log: TetrisStateSnap["log"] }) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log.length]);
  return (
    <div
      className="panel panel-log"
      style={{ minHeight: 0, overflow: "hidden" }}
    >
      <h3 className="title" style={{ margin: 0, fontSize: "0.95rem" }}>로그</h3>
      <div
        ref={scrollRef}
        className="col"
        style={{ gap: 2, minHeight: 0, overflowY: "auto", fontSize: 12 }}
      >
        {log.map((e, i) => (
          <div
            key={`${e.ts}-${i}`}
            style={{
              opacity: e.kind === "system" ? 0.65 : 1,
              color:
                e.kind === "result"
                  ? "var(--gold-soft, #facc15)"
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

const ScorePanel = ({
  players,
  meSid,
  tokensToWin,
}: {
  players: PlayerBoardSnap[];
  meSid: string;
  tokensToWin: number;
}) => (
  <div className="panel col" style={{ gap: 6 }}>
    <h3 className="title" style={{ margin: 0, fontSize: "0.95rem" }}>
      점수 (먼저 {tokensToWin}점)
    </h3>
    {players
      .slice()
      .sort((a, b) => b.tokens - a.tokens)
      .map((p) => (
        <div
          key={p.sessionId}
          className="row"
          style={{ justifyContent: "space-between", fontSize: 13 }}
        >
          <span>
            {p.sessionId === meSid ? "나" : p.nickname}
            {!p.alive && " 💀"}
          </span>
          <span className="muted">
            🏆 {p.tokens} · {p.lines}줄
          </span>
        </div>
      ))}
  </div>
);

const LobbyView = ({
  state,
  meSid,
  isHost,
  onReady,
  onStart,
  spectating = false,
}: {
  state: TetrisStateSnap;
  meSid: string;
  isHost: boolean;
  onReady: () => void;
  onStart: () => void;
  spectating?: boolean;
}) => {
  const players = Object.values(state.players);
  const ready = players.every(
    (p) => p.ready || p.sessionId === state.hostSessionId,
  );
  return (
    <div className="panel col">
      <h2 className="title" style={{ margin: 0, fontSize: "1.2rem" }}>대기실</h2>
      <p className="muted">
        최대 {state.maxPlayers}명. 모두 준비되면 방장이 시작합니다. 2줄 이상 깨면
        상대 보드로 가비지가 날아갑니다.
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

// Compact stats strip shown on mobile in place of the side HUD column.
// Surface the few essentials a player can't play without: Hold, Next 3, score, lines.
const MobileStatsBar = ({ board }: { board: PlayerBoardSnap }) => {
  const next = board.nextQueue.slice(0, 3);
  return (
    <div className="tetris-mobile-stats">
      <div className="tetris-mobile-stats-slot" aria-label="홀드">
        <span className="tetris-mobile-stats-label">H</span>
        <MiniPieceMark type={board.hold} dimmed={board.holdUsed} />
      </div>
      <div className="tetris-mobile-stats-slot" aria-label="다음">
        <span className="tetris-mobile-stats-label">N</span>
        {next.map((t, i) => (
          <MiniPieceMark key={i} type={t} small={i > 0} />
        ))}
      </div>
      <div className="tetris-mobile-stats-numbers">
        <span>{board.score}</span>
        <span className="muted">{board.lines}줄 · Lv {board.level}</span>
        {board.incomingGarbage > 0 && (
          <span style={{ color: "var(--danger, #ef4444)" }}>
            ⚠ {board.incomingGarbage}
          </span>
        )}
      </div>
    </div>
  );
};

const MiniPieceMark = ({
  type,
  small,
  dimmed,
}: {
  type: number;
  small?: boolean;
  dimmed?: boolean;
}) => {
  const cell = small ? 4 : 6;
  if (!type) {
    return (
      <span
        style={{
          display: "inline-block",
          width: 4 * cell,
          height: 2 * cell,
          opacity: 0.25,
          background: "rgba(255,255,255,0.04)",
        }}
      />
    );
  }
  const shape = PIECE_SHAPES[type]?.[0] ?? [];
  const minX = Math.min(...shape.map((c) => c[0]));
  const minY = Math.min(...shape.map((c) => c[1]));
  const w = (Math.max(...shape.map((c) => c[0])) - minX + 1) * cell;
  const h = (Math.max(...shape.map((c) => c[1])) - minY + 1) * cell;
  return (
    <span
      style={{
        position: "relative",
        display: "inline-block",
        width: w,
        height: h,
        opacity: dimmed ? 0.4 : 1,
      }}
    >
      {shape.map(([dx, dy], i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            left: (dx - minX) * cell,
            top: (dy - minY) * cell,
            width: cell,
            height: cell,
            background: PIECE_COLOR[type] ?? "#fff",
          }}
        />
      ))}
    </span>
  );
};

const useViewportIsMobile = () => {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 640px)").matches;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 640px)");
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return isMobile;
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

// ───────── snapshot helper ───────── //

const toSnap = (state: any): TetrisStateSnap | null => {
  if (!state) return null;
  const playersObj: Record<string, PlayerBoardSnap> = {};
  state.players?.forEach?.((p: any, key: string) => {
    playersObj[key] = {
      sessionId: p.sessionId,
      userId: p.userId,
      nickname: p.nickname,
      connected: p.connected,
      ready: p.ready,
      alive: p.alive,
      tokens: p.tokens,
      cells: p.cells ? Array.from(p.cells) : [],
      cur: {
        type: p.cur?.type ?? 0,
        rot: p.cur?.rot ?? 0,
        x: p.cur?.x ?? 0,
        y: p.cur?.y ?? 0,
      },
      hold: p.hold ?? 0,
      holdUsed: !!p.holdUsed,
      nextQueue: p.nextQueue ? Array.from(p.nextQueue) : [],
      level: p.level ?? 1,
      lines: p.lines ?? 0,
      score: p.score ?? 0,
      incomingGarbage: p.incomingGarbage ?? 0,
      lastClearTs: p.lastClearTs ?? 0,
    };
  });
  return {
    hostSessionId: state.hostSessionId,
    roomName: state.roomName,
    phase: state.phase,
    maxPlayers: state.maxPlayers,
    tokensToWin: state.tokensToWin,
    players: playersObj,
    seatOrder: state.seatOrder ? Array.from(state.seatOrder) : [],
    roundWinnerId: state.roundWinnerId,
    lastWinnerId: state.lastWinnerId,
    gameWinnerId: state.gameWinnerId,
    log: state.log
      ? Array.from(state.log).map((e: any) => ({
          ts: e.ts,
          kind: e.kind,
          text: e.text,
          actor: e.actor,
          target: e.target,
        }))
      : [],
  };
};

export default TetrisTable;
