"use client";

import { PIECE_COLOR, PIECE_SHAPES } from "../model/pieces";
import type { PlayerBoardSnap } from "../model/types";

type Props = {
  board: PlayerBoardSnap;
};

// Sidebar showing Next 4, Hold, Score, Lines, Level, Incoming garbage gauge.
export const Hud = ({ board }: Props) => {
  const next = board.nextQueue.slice(0, 4);
  return (
    <div
      className="col"
      style={{
        gap: 6,
        padding: 8,
        background: "var(--panel, rgba(0,0,0,0.35))",
        border: "1px solid var(--panel-border, rgba(255,255,255,0.12))",
        borderRadius: 8,
        minWidth: 0,
      }}
    >
      <Section title="HOLD">
        <MiniPiece type={board.hold} dimmed={board.holdUsed} />
      </Section>

      <Section title="NEXT">
        <div className="col" style={{ gap: 4 }}>
          {next.map((t, i) => (
            <MiniPiece key={i} type={t} small={i > 0} />
          ))}
        </div>
      </Section>

      <Section title="SCORE">
        <div style={{ fontSize: 18, fontWeight: 700 }}>{board.score}</div>
      </Section>

      <Section title="LINES / LEVEL">
        <div style={{ fontSize: 14 }}>
          {board.lines}줄 · Lv {board.level}
        </div>
      </Section>

      {board.incomingGarbage > 0 && (
        <Section title="INCOMING">
          <div
            style={{
              height: 8,
              width: "100%",
              background: "rgba(0,0,0,0.4)",
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.min(100, board.incomingGarbage * 10)}%`,
                background: "linear-gradient(90deg,#facc15,#ef4444)",
              }}
            />
          </div>
          <div style={{ fontSize: 12, color: "var(--danger, #ef4444)" }}>
            ⚠ {board.incomingGarbage}줄 들어옴
          </div>
        </Section>
      )}
    </div>
  );
};

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="col" style={{ gap: 3 }}>
    <div
      className="muted"
      style={{ fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase" }}
    >
      {title}
    </div>
    {children}
  </div>
);

// Small 4x2 canvas-free renderer for the Hold/Next preview.
const MiniPiece = ({
  type,
  small,
  dimmed,
}: {
  type: number;
  small?: boolean;
  dimmed?: boolean;
}) => {
  const cell = small ? 6 : 10;
  if (!type) {
    return (
      <div
        style={{
          width: 4 * cell + 4,
          height: 2 * cell + 4,
          opacity: 0.25,
          borderRadius: 4,
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
    <div
      style={{
        position: "relative",
        width: w,
        height: h,
        opacity: dimmed ? 0.4 : 1,
      }}
    >
      {shape.map(([dx, dy], i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: (dx - minX) * cell,
            top: (dy - minY) * cell,
            width: cell - 1,
            height: cell - 1,
            background: PIECE_COLOR[type] ?? "#fff",
            borderRadius: 1,
          }}
        />
      ))}
    </div>
  );
};

export default Hud;
