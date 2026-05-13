"use client";

import { useEffect, useRef } from "react";
import { CARD_KEY, CARD_NAMES_KR } from "../model/cards";

export type LogEntryView = {
  ts: number;
  kind: string;
  text: string;
  actor: string;
  target: string;
  card: number;
  guess: number;
};

const KIND_COLORS: Record<string, string> = {
  system: "var(--muted)",
  turn: "var(--gold-soft)",
  play: "var(--text)",
  reveal: "#c8a5ff",
  result: "#f6d36b",
  info: "var(--muted)",
};

const KIND_BG: Record<string, string> = {
  system: "transparent",
  turn: "rgba(217,182,108,0.08)",
  play: "rgba(122,63,255,0.10)",
  reveal: "rgba(122,63,255,0.18)",
  result: "rgba(217,182,108,0.18)",
  info: "transparent",
};

const Mini = ({ card }: { card: number }) => {
  if (!card) return null;
  return (
    <span
      title={CARD_NAMES_KR[card]}
      style={{
        display: "inline-block",
        width: 22,
        height: 33,
        verticalAlign: "middle",
        marginLeft: 4,
        marginRight: 4,
        backgroundImage: `url(/cards/${CARD_KEY[card]}.png)`,
        backgroundSize: "cover",
        borderRadius: 3,
        border: "1px solid rgba(217,182,108,0.5)",
      }}
    />
  );
};

const formatTime = (ts: number) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
};

export const ActionLog = ({ log }: { log: LogEntryView[] }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [log.length]);

  return (
    <div className="panel panel-log col" style={{ gap: 8 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3 className="title" style={{ margin: 0, fontSize: "1rem" }}>
          액션 로그
        </h3>
        <span className="muted" style={{ fontSize: 12 }}>
          {log.length}개
        </span>
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
        {log.length === 0 && (
          <span className="muted" style={{ fontSize: 13 }}>아직 기록 없음</span>
        )}
        {log.map((e, i) => (
          <div
            key={`${e.ts}-${i}`}
            style={{
              fontSize: 13,
              padding: "4px 8px",
              borderRadius: 4,
              background: KIND_BG[e.kind] ?? "transparent",
              color: KIND_COLORS[e.kind] ?? "var(--text)",
              lineHeight: 1.5,
            }}
          >
            <span className="muted" style={{ fontSize: 11, marginRight: 6 }}>
              {formatTime(e.ts)}
            </span>
            <span>{e.text}</span>
            {e.card !== 0 && <Mini card={e.card} />}
            {e.guess !== 0 && <Mini card={e.guess} />}
          </div>
        ))}
      </div>
    </div>
  );
};
