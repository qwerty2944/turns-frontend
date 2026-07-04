"use client";

import { CardImage } from "./CardImage";

type Props = {
  remaining: number;
  deckRef: React.MutableRefObject<HTMLDivElement | null>;
};

/** Deck rendered as a small stack of offset card backs + a count badge. */
export const DeckStack = ({ remaining, deckRef }: Props) => {
  const ghosts = Math.min(2, Math.max(0, remaining - 1));
  return (
    <div
      className="col"
      style={{ alignItems: "center", justifyContent: "center", gap: 6 }}
    >
      <div ref={deckRef} className="ll-deck" style={{ width: 74, height: 111 }}>
        {ghosts >= 2 && (
          <div
            className="ll-deck-ghost"
            style={{ transform: "translate(6px, -6px) rotate(3deg)" }}
          >
            <CardImage card={0} faceDown fluid style={{ height: "100%" }} />
          </div>
        )}
        {ghosts >= 1 && (
          <div
            className="ll-deck-ghost"
            style={{ transform: "translate(3px, -3px) rotate(1.5deg)" }}
          >
            <CardImage card={0} faceDown fluid style={{ height: "100%" }} />
          </div>
        )}
        {remaining > 0 ? (
          <CardImage card={0} faceDown fluid style={{ height: "100%" }} />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 6,
              border: "1px dashed rgba(217,182,108,0.4)",
            }}
          />
        )}
        <span className="ll-deck-badge">덱 {remaining}</span>
      </div>
    </div>
  );
};
