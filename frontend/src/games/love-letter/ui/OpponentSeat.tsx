"use client";

import { CardImage } from "./CardImage";

export type OpponentView = {
  sessionId: string;
  nickname: string;
  discard: number[];
  eliminated: boolean;
  protected: boolean;
  tokens: number;
};

type Props = {
  op: OpponentView;
  isTurn: boolean;
  /** Targeting mode: this seat can be clicked to target. */
  targetable: boolean;
  /** Targeting mode: this seat is not a valid target. */
  dimmed: boolean;
  registerRef: (el: HTMLDivElement | null) => void;
  onTarget: () => void;
};

export const OpponentSeat = ({
  op,
  isTurn,
  targetable,
  dimmed,
  registerRef,
  onTarget,
}: Props) => {
  const classes = [
    "ll-seat",
    isTurn ? "ll-seat--turn" : "",
    op.eliminated ? "ll-seat--eliminated" : "",
    targetable ? "ll-seat--targetable" : "",
    dimmed ? "ll-seat--dimmed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const recent = op.discard.slice(-5);

  return (
    <div
      ref={registerRef}
      data-sid={op.sessionId}
      className={classes}
      role={targetable ? "button" : undefined}
      tabIndex={targetable ? 0 : undefined}
      onClick={targetable ? onTarget : undefined}
      onKeyDown={
        targetable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onTarget();
            }
          : undefined
      }
    >
      <div
        className="ll-seat-name"
        style={{ color: isTurn ? "var(--gold-soft)" : "var(--text)" }}
      >
        {op.eliminated ? "💀 " : ""}
        {op.nickname}
        {op.protected ? " 🛡" : ""}
        {isTurn ? " ▶" : ""}
      </div>
      <CardImage card={0} faceDown size={op.eliminated ? 48 : 64} />
      <div className="muted" style={{ fontSize: 13 }}>
        ❤ {op.tokens}
      </div>
      {recent.length > 0 && (
        <div className="ll-seat-discard">
          {recent.map((c, i) => (
            <CardImage
              key={`${c}-${i}`}
              card={c}
              size={i === recent.length - 1 ? 46 : 28}
              noTooltip={i !== recent.length - 1}
              style={{ zIndex: i }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
