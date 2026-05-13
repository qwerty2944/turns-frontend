"use client";

import { CARD_KEY, CARD_NAMES_KR } from "../model/cards";

type Props = {
  card: number;
  size?: number;
  faceDown?: boolean;
};

export const CardImage = ({ card, size = 64, faceDown }: Props) => {
  const key = faceDown ? "back" : CARD_KEY[card] || "back";
  return (
    <div
      title={faceDown ? "" : CARD_NAMES_KR[card]}
      style={{
        width: size,
        height: size * 1.5,
        backgroundImage: `url(/cards/${key}.png)`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        borderRadius: 6,
        border: "1px solid rgba(217,182,108,0.6)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
      }}
    />
  );
};
