"use client";

import { useEffect, useRef, useState } from "react";
import { CARD_NAMES_KR } from "../model/cards";
import { CardImage } from "./CardImage";

type Props = {
  card: number;
  playable: boolean;
  selected: boolean;
  locked: boolean;
  incoming: boolean;
  fanRot: number;
  fanY: number;
  shakeKey: number;
  onPick: () => void;
};

const canHover = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(hover: hover) and (pointer: fine)").matches;

/**
 * A single hand card with Balatro-style hover: lift + zoom + 3D tilt that
 * follows the cursor (rAF-throttled). Touch devices skip the tilt — the
 * first tap selects instead.
 */
export const HandCard = ({
  card,
  playable,
  selected,
  locked,
  incoming,
  fanRot,
  fanY,
  shakeKey,
  onPick,
}: Props) => {
  const ref = useRef<HTMLButtonElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastEventRef = useRef<{ x: number; y: number } | null>(null);
  const [shaking, setShaking] = useState(false);

  // Re-trigger the shake animation whenever shakeKey bumps.
  useEffect(() => {
    if (!shakeKey) return;
    setShaking(true);
    const t = setTimeout(() => setShaking(false), 450);
    return () => clearTimeout(t);
  }, [shakeKey]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Inline tilt vars would override the selected-state lift — drop them.
  useEffect(() => {
    if (selected) clearTilt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const applyTilt = () => {
    rafRef.current = null;
    const el = ref.current;
    const pos = lastEventRef.current;
    if (!el || !pos) return;
    const rect = el.getBoundingClientRect();
    const px = (pos.x - rect.left) / rect.width - 0.5;
    const py = (pos.y - rect.top) / rect.height - 0.5;
    el.style.setProperty("--tilt-y", `${(px * 14).toFixed(2)}deg`);
    el.style.setProperty("--tilt-x", `${(-py * 10).toFixed(2)}deg`);
    el.style.setProperty("--lift", "-14px");
    el.style.setProperty("--zoom", "1.06");
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!playable || selected || !canHover()) return;
    lastEventRef.current = { x: e.clientX, y: e.clientY };
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(applyTilt);
    }
  };

  const clearTilt = () => {
    const el = ref.current;
    if (!el) return;
    el.style.removeProperty("--tilt-y");
    el.style.removeProperty("--tilt-x");
    el.style.removeProperty("--lift");
    el.style.removeProperty("--zoom");
  };

  const classes = [
    "ll-hand-card",
    playable && !locked ? "ll-hand-card--playable" : "",
    selected ? "ll-hand-card--selected" : "",
    locked ? "ll-hand-card--locked" : "",
    incoming ? "ll-hand-card--incoming" : "",
    shaking ? "ll-hand-card--shake" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      ref={ref}
      className={classes}
      style={
        {
          "--fan-rot": `${fanRot}deg`,
          "--fan-y": `${fanY}px`,
        } as React.CSSProperties
      }
      title={CARD_NAMES_KR[card]}
      aria-label={CARD_NAMES_KR[card]}
      onClick={onPick}
      onMouseMove={onMouseMove}
      onMouseLeave={() => {
        lastEventRef.current = null;
        clearTilt();
      }}
    >
      <CardImage card={card} fluid noTooltip={!canHover()} />
      {locked && <span className="ll-lock-badge">🔒</span>}
    </button>
  );
};
