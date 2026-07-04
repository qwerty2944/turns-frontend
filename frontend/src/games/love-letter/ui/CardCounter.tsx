"use client";

import { useMemo } from "react";
import { CARD_NAMES_KR, CARD_TOTALS } from "../model/cards";
import { CardImage } from "./CardImage";

type Props = {
  publicDiscard: number[];
};

/**
 * Remaining-copies tracker for the 8 card types. Counts are upper bounds:
 * they include opponents' hands, the deck, and the face-down burned card.
 */
export const CardCounter = ({ publicDiscard }: Props) => {
  const remaining = useMemo(() => {
    const r: Record<number, number> = { ...CARD_TOTALS };
    for (const c of publicDiscard) {
      if (r[c] !== undefined && r[c] > 0) r[c] -= 1;
    }
    return r;
  }, [publicDiscard]);

  return (
    <div
      className="ll-counter"
      title="공개된 버림패 기준 남은 장수 (뒷면 소각 1장 포함)"
    >
      {Object.keys(CARD_TOTALS).map((k) => {
        const card = Number(k);
        const left = remaining[card] ?? 0;
        return (
          <div
            key={card}
            className={`ll-counter-item${left === 0 ? " ll-counter-item--depleted" : ""}`}
            aria-label={`${CARD_NAMES_KR[card]} ${left}장 남음`}
          >
            <CardImage card={card} size={26} />
            <span className="ll-counter-count">×{left}</span>
          </div>
        );
      })}
    </div>
  );
};
