"use client";

import { useEffect, useRef } from "react";
import type {
  InputCallbacks,
  PlayerView,
} from "../scene/PlayerBoardScene";

type Props = {
  player: PlayerView;
  isLocal: boolean;
  size: "small" | "large";
  onHoldTap?: () => void;
  onTapCell?: (cell: number) => void;
  onMoveCol?: (col: number) => void;
};

const themeFromCss = () => {
  if (typeof window === "undefined") return undefined;
  const root = document.documentElement;
  const cs = getComputedStyle(root);
  const hex = (name: string, fallback: number) => {
    const raw = cs.getPropertyValue(name).trim();
    if (!raw) return fallback;
    // Accept either "#rrggbb" or "rgb(r,g,b)" — Phaser wants 0xRRGGBB.
    if (raw.startsWith("#")) {
      return parseInt(raw.slice(1), 16) || fallback;
    }
    const m = raw.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
    if (!m) return fallback;
    const r = parseInt(m[1], 10);
    const g = parseInt(m[2], 10);
    const b = parseInt(m[3], 10);
    return (r << 16) | (g << 8) | b;
  };
  const text = (cs.getPropertyValue("--text").trim() || "#e9e3f5");
  return {
    bg: hex("--bg", 0x140d2e),
    panel: hex("--panel", 0x21194a),
    text,
    accent: hex("--accent", 0x7a3fff),
    danger: hex("--danger", 0xff5f70),
    gold: hex("--gold-soft", 0xd9b66c),
    muted: hex("--muted", 0x6e6794),
  };
};

export const PlayerBoardView = (props: Props) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<any>(null);
  const sceneRef = useRef<any>(null);
  const callbacksRef = useRef<InputCallbacks>({
    onHoldTap: () => props.onHoldTap?.(),
    onTapCell: (c) => props.onTapCell?.(c),
    onMoveCol: (c) => props.onMoveCol?.(c),
  });

  // Keep callback ref fresh without remounting Phaser.
  callbacksRef.current.onHoldTap = () => props.onHoldTap?.();
  callbacksRef.current.onTapCell = (c) => props.onTapCell?.(c);
  callbacksRef.current.onMoveCol = (c) => props.onMoveCol?.(c);

  useEffect(() => {
    if (gameRef.current) return;
    let cancelled = false;

    (async () => {
      const Phaser = (await import("phaser")).default;
      const { PlayerBoardScene, BOARD_W, BOARD_H } = await import(
        "../scene/PlayerBoardScene"
      );
      if (cancelled || !wrapRef.current) return;

      const scene = new PlayerBoardScene();
      const game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: wrapRef.current,
        transparent: false,
        backgroundColor: "#140d2e",
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          width: BOARD_W,
          height: BOARD_H,
        },
        scene,
        banner: false,
      });
      gameRef.current = game;
      sceneRef.current = scene;

      // Start scene with the locality flag + callbacks + theme.
      const theme = themeFromCss();
      game.scene.start("PlayerBoard", {
        theme,
        isLocal: props.isLocal,
        callbacks: callbacksRef.current,
      });
    })();

    return () => {
      cancelled = true;
      const g = gameRef.current;
      if (g) {
        g.destroy(true);
        gameRef.current = null;
        sceneRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push the latest player view into the scene every render.
  useEffect(() => {
    const s = sceneRef.current;
    if (s && s.setPlayerView) s.setPlayerView(props.player);
  }, [props.player]);

  const aspect = 220 / 420;
  const style: React.CSSProperties =
    props.size === "large"
      ? {
          // Fit by HEIGHT so the dodge lane at the bottom doesn't get
          // clipped by the parent container on mobile. The board is taller
          // than wide (220:420) — if we sized by width=100%, on a narrow
          // phone height would overflow the .multitask-solo 1fr slot and
          // chop the dodge region. Sizing by height + aspect-ratio lets
          // width shrink instead, keeping the whole board visible.
          height: "100%",
          width: "auto",
          maxWidth: "100%",
          maxHeight: "100%",
          aspectRatio: `${aspect}`,
          margin: "0 auto",
          borderRadius: 10,
          overflow: "hidden",
          background: "var(--panel)",
          border: "1px solid var(--panel-border)",
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
        }
      : {
          // Cap width so a solo card on PC doesn't stretch to the full grid
          // cell — at width=1fr the 220:420 aspect would make height = ~1.9×
          // width, pushing tap and dodge below the viewport fold.
          width: "100%",
          maxWidth: 240,
          aspectRatio: `${aspect}`,
          margin: "0 auto",
          borderRadius: 8,
          overflow: "hidden",
          background: "var(--panel)",
          border: props.isLocal
            ? "2px solid var(--gold-soft)"
            : "1px solid var(--panel-border)",
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
        };

  return <div ref={wrapRef} style={style} data-local={props.isLocal} />;
};

export default PlayerBoardView;
