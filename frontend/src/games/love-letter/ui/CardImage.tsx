"use client";

import { CARD_DESC_KR, CARD_KEY, CARD_NAMES_KR } from "../model/cards";

type Props = {
  card: number;
  size?: number;
  /** Fill the parent width instead of a fixed pixel size (keeps 2:3 ratio). */
  fluid?: boolean;
  faceDown?: boolean;
  /** Disable the hover tooltip even for face-up cards (e.g. inside a Modal that already shows the info). */
  noTooltip?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

export const CardImage = ({
  card,
  size = 64,
  fluid,
  faceDown,
  noTooltip,
  className,
  style,
}: Props) => {
  const key = faceDown ? "back" : CARD_KEY[card] || "back";
  const showTooltip = !faceDown && !noTooltip && card > 0;
  const hostSize: React.CSSProperties = fluid
    ? { width: "100%", aspectRatio: "2 / 3" }
    : { width: size, height: size * 1.5 };

  return (
    <div
      className={className ? `card-host ${className}` : "card-host"}
      style={{ ...hostSize, ...style }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundImage: `url(/cards/${key}.png)`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          borderRadius: 6,
          border: "1px solid rgba(217,182,108,0.6)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
        }}
      />
      {showTooltip && (
        <div className="card-tooltip" role="tooltip">
          <div
            style={{
              width: 96,
              height: 144,
              flex: "0 0 96px",
              backgroundImage: `url(/cards/${key}.png)`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              borderRadius: 6,
              border: "1px solid var(--gold)",
            }}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              flex: 1,
              minWidth: 0,
              maxWidth: "100%",
            }}
          >
            <strong
              style={{
                color: "var(--gold-soft)",
                fontSize: 16,
                whiteSpace: "normal",
              }}
            >
              {card}. {CARD_NAMES_KR[card]}
            </strong>
            <p
              style={{
                margin: 0,
                color: "var(--text)",
                fontSize: 13,
                lineHeight: 1.5,
                whiteSpace: "normal",
                wordBreak: "break-word",
                overflowWrap: "anywhere",
              }}
            >
              {CARD_DESC_KR[card]}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
